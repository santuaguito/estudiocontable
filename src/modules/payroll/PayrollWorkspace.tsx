"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { CompanyService, Database, EmployerCostCategory, PayrollItemType } from "@/lib/supabase/database.types";
import { addMoneyAmounts, arithmeticDraftNet, costCategoryLabels, formatARS } from "@/modules/payroll/domain";
import { createReceiptPdf } from "@/modules/payroll/pdf";

type Company = Pick<Database["public"]["Tables"]["companies"]["Row"], "id" | "legal_name" | "service_type" | "active">;
type Period = Database["public"]["Tables"]["payroll_periods"]["Row"];
type Slip = Database["public"]["Tables"]["payroll_slips"]["Row"];
type Item = Database["public"]["Tables"]["payroll_items"]["Row"];
type Employee = Pick<Database["public"]["Tables"]["employees"]["Row"], "id" | "full_name" | "cuil" | "category" | "start_date" | "cct_code" | "weekly_hours" | "seniority_years" | "presentismo_eligible">;
type PayrollQueryError = { code?: string; message?: string };
const costCategories = Object.keys(costCategoryLabels) as EmployerCostCategory[];
const companyName = (slip: Slip) => String((slip.company_snapshot as Record<string, unknown>).legal_name ?? "Empresa");
const employeeOf = (slip: Slip) => slip.employee_snapshot as unknown as Employee;
function chartGradient(rows: Item[]) {
  const values = costCategories.map((category) => addMoneyAmounts(rows.filter((row) => row.cost_category === category).map((row) => Number(row.amount))));
  const colors = ["#6e9871", "#9bb68e", "#d5bd81", "#8198ad", "#c88c71", "#b39ac1", "#d9ded5"];
  const total = addMoneyAmounts(values);
  if (total <= 0) return "conic-gradient(#e1e5df 0 100%)";
  let edge = 0;
  const sectors = values.map((value, index) => {
    const start = edge;
    edge += value / total * 100;
    return `${colors[index]} ${start}% ${edge}%`;
  });
  return `conic-gradient(${sectors.join(",")})`;
}
function missingPayrollMigration(error: PayrollQueryError) {
  return ["42P01", "42703", "PGRST205"].includes(error.code ?? "")
    || /payroll_(periods|slips|items)|payroll_status/i.test(error.message ?? "");
}

export default function PayrollWorkspace({ companyId }: { companyId?: string }) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(() => Boolean(supabase));
  const [studioId, setStudioId] = useState<string | null>(null);
  const [memberRole, setMemberRole] = useState<Database["public"]["Tables"]["studio_members"]["Row"]["role"] | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [slips, setSlips] = useState<Slip[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState("");
  const [selectedSlipId, setSelectedSlipId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [companyProblem, setCompanyProblem] = useState("");
  const [notice, setNotice] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    let mounted = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });
    void supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      setUser(data.user);
      setAuthLoading(false);
    });
    return () => { mounted = false; subscription.unsubscribe(); };
  }, [supabase]);

  const refresh = useCallback(async (targetStudio: string, preferredPeriod?: string) => {
    if (!supabase) return;
    setError("");
    setCompanyProblem("");
    let companyQuery = supabase.from("companies").select("id,legal_name,service_type,active").eq("studio_id", targetStudio).eq("active", true);
    if (companyId) companyQuery = companyQuery.eq("id", companyId).in("service_type", ["payroll", "both"] as CompanyService[]);
    else companyQuery = companyQuery.in("service_type", ["payroll", "both"] as CompanyService[]);
    let periodQuery = supabase.from("payroll_periods").select("*").eq("studio_id", targetStudio);
    if (companyId) periodQuery = periodQuery.eq("company_id", companyId);
    const [companyResult, periodResult] = await Promise.all([
      companyQuery.order("legal_name"),
      periodQuery.order("payment_year", { ascending: false }).order("payment_month", { ascending: false }),
    ]);
    if (companyResult.error) {
      setCompanies([]);
      setError("No pudimos consultar la empresa. Revisá la conexión y los permisos de Supabase.");
      return;
    }
    setCompanies(companyResult.data ?? []);
    if (companyId && (companyResult.data ?? []).length === 0) {
      const { data: companyState, error: stateError } = await supabase.from("companies").select("id,active,service_type").eq("id", companyId).maybeSingle();
      if (stateError) setCompanyProblem("No pudimos verificar el estado y los servicios de la empresa.");
      else if (!companyState) setCompanyProblem("No encontramos esta empresa dentro de tu estudio.");
      else if (!companyState.active) setCompanyProblem("Esta empresa está archivada. Reactivala desde su ficha antes de iniciar nómina.");
      else setCompanyProblem("Esta empresa tiene habilitada solo Contabilidad. Cambiá sus servicios a Sueldos o Sueldos y contabilidad desde su ficha.");
    }
    if (periodResult.error) {
      setPeriods([]); setSlips([]); setItems([]); setSelectedPeriodId(""); setSelectedSlipId("");
      setError(missingPayrollMigration(periodResult.error)
        ? "La base todavía no tiene el esquema de nómina. Aplicá supabase/migrations/20261123000000_payroll_draft_receipts.sql después de la migración inicial."
        : "No pudimos leer los períodos de nómina. Revisá las políticas y permisos de Supabase.");
      return;
    }
    const loadedPeriods = periodResult.data ?? [];
    setPeriods(loadedPeriods);
    const nextId = preferredPeriod ?? loadedPeriods[0]?.id ?? "";
    setSelectedPeriodId(nextId);
    if (nextId) {
      const [slipResult, itemResult] = await Promise.all([
        supabase.from("payroll_slips").select("*").eq("period_id", nextId).order("created_at"),
        supabase.from("payroll_items").select("*").eq("studio_id", targetStudio).order("sort_order").order("created_at"),
      ]);
      if (slipResult.error || itemResult.error) { setError("No pudimos cargar los recibos del período."); return; }
      const loadedSlips = slipResult.data ?? [];
      setSlips(loadedSlips);
      setItems((itemResult.data ?? []).filter((item) => loadedSlips.some((slip) => slip.id === item.slip_id)));
      setSelectedSlipId(loadedSlips[0]?.id ?? "");
    } else { setSlips([]); setItems([]); setSelectedSlipId(""); }
  }, [supabase, companyId]);

  useEffect(() => {
    if (!supabase || !user) return;
    let mounted = true;
    void (async () => {
      setLoading(true); setError("");
      const { data: membership, error: membershipError } = await supabase.from("studio_members").select("studio_id,role").eq("user_id", user.id).order("created_at").limit(1).maybeSingle();
      if (!mounted) return;
      if (membershipError || !membership) { setError("No encontramos un estudio asociado a esta cuenta."); setLoading(false); return; }
      setStudioId(membership.studio_id);
      setMemberRole(membership.role);
      await refresh(membership.studio_id);
      if (mounted) setLoading(false);
    })();
    return () => { mounted = false; };
  }, [supabase, user, refresh]);

  useEffect(() => {
    if (!supabase || !studioId || !selectedPeriodId) return;
    let mounted = true;
    void (async () => {
      const [slipResult, itemResult] = await Promise.all([
        supabase.from("payroll_slips").select("*").eq("period_id", selectedPeriodId).order("created_at"),
        supabase.from("payroll_items").select("*").eq("studio_id", studioId).order("sort_order").order("created_at"),
      ]);
      if (!mounted) return;
      if (slipResult.error || itemResult.error) { setError("No pudimos cargar los recibos del período."); return; }
      const nextSlips = slipResult.data ?? [];
      setSlips(nextSlips);
      setItems((itemResult.data ?? []).filter((item) => nextSlips.some((slip) => slip.id === item.slip_id)));
      setSelectedSlipId(nextSlips[0]?.id ?? "");
    })();
    return () => { mounted = false; };
  }, [supabase, studioId, selectedPeriodId]);

  const selectedPeriod = periods.find((period) => period.id === selectedPeriodId) ?? null;
  const selectedSlip = slips.find((slip) => slip.id === selectedSlipId) ?? null;
  const selectedItems = items.filter((item) => item.slip_id === selectedSlipId);
  const canApprove = memberRole === "accountant" || memberRole === "owner";
  const grouped = (kind: PayrollItemType) => selectedItems.filter((item) => item.item_type === kind);
  const contributions = grouped("employer_contribution");
  const remunerations = grouped("remuneration");
  const deductions = grouped("deduction");
  const scaleBasic = remunerations.find((row) => row.description === "Sueldo básico CCT 130/75");
  const total = (rows: Item[]) => addMoneyAmounts(rows.map((row) => Number(row.amount)));

  async function createDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!supabase) return;
    const data = new FormData(event.currentTarget);
    const companyId = String(data.get("company") ?? "");
    const year = Number(data.get("year")); const month = Number(data.get("month"));
    setError(""); setNotice("");
    const { data: periodId, error: createError } = await supabase.rpc("create_payroll_drafts", {
      target_company_id: companyId, target_year: year, target_month: month,
      target_payment_date: String(data.get("paymentDate") || "") || null,
      target_payment_location: String(data.get("paymentLocation") || "") || null,
      target_social_contributions_payment_date: String(data.get("contributionDate") || "") || null,
      target_social_contributions_payment_location: String(data.get("contributionLocation") || "") || null,
    });
    if (createError || !periodId) { setError(createError?.code === "23505" ? "Ya existe un borrador para esa empresa y período." : /Employer ARCA/i.test(createError?.message ?? "") ? "Completá las alícuotas ARCA, FAL y ART en la ficha de la empresa." : /Commerce scale unavailable|profile incomplete/i.test(createError?.message ?? "") ? "Completá categoría CCT, jornada y antigüedad de cada persona activa. La escala disponible cubre noviembre de 2026 a mayo de 2027." : "No se pudo crear el borrador. Verificá que la empresa tenga personas activas, perfil CCT y el servicio de sueldos."); return; }
    if (studioId) await refresh(studioId, periodId);
    setNotice("Borrador calculado con la escala FAECYS y los perfiles laborales de cada persona. Revisalo antes de enviarlo al contador.");
  }

  async function deleteItem(itemId: string) {
    if (!supabase) return;
    const { error: deleteError } = await supabase.from("payroll_items").delete().eq("id", itemId);
    if (deleteError) { setError("No pudimos quitar el concepto."); return; }
    setItems((current) => current.filter((item) => item.id !== itemId));
  }

  async function requestReview() {
    if (!supabase || !selectedPeriod) return;
    setError("");
    const { error: reviewError } = await supabase.rpc("request_payroll_review", { target_period_id: selectedPeriod.id });
    if (reviewError) { setError("No pudimos solicitar la revisión profesional."); return; }
    if (studioId) await refresh(studioId, selectedPeriod.id);
    setNotice("Solicitud registrada. El período queda visible como En revisión para los miembros de este estudio; no se envía un correo ni se asigna a un profesional específico.");
  }

  async function approveReceipt() {
    if (!supabase || !selectedSlip || !canApprove || selectedSlip.status === "approved") return;
    const employeeName = employeeOf(selectedSlip).full_name;
    if (!window.confirm(`¿Aceptar y finalizar el recibo de ${employeeName}? El recibo quedará bloqueado.`)) return;
    setError(""); setNotice("");
    const { data: periodFinalized, error: approveError } = await supabase.rpc("approve_payroll_slip", { target_slip_id: selectedSlip.id });
    if (approveError) { setError(`No se pudo aceptar el recibo: ${approveError.message}`); return; }
    if (studioId) await refresh(studioId, selectedPeriod?.id);
    setNotice(periodFinalized
      ? `Recibo de ${employeeName} aceptado. Todos los recibos del período están finalizados.`
      : `Recibo de ${employeeName} aceptado y bloqueado. El período se finalizará cuando se acepten los demás recibos.`);
  }

  async function downloadReceiptPdf() {
    if (!selectedSlip || !selectedPeriod) return;
    setGeneratingPdf(true); setError(""); setNotice("");
    try {
      const employee = employeeOf(selectedSlip);
      const company = selectedSlip.company_snapshot as Record<string, unknown>;
      const netEstimate = arithmeticDraftNet(
        selectedItems.filter((item) => item.item_type === "remuneration").map((item) => Number(item.amount)),
        selectedItems.filter((item) => item.item_type === "deduction").map((item) => Number(item.amount)),
      );
      const bytes = await createReceiptPdf({
        companyName: String(company.legal_name ?? "Empresa"),
        taxId: String(company.tax_id ?? "Pendiente"),
        address: String(company.address ?? "Pendiente"),
        employeeName: employee.full_name,
        cuil: employee.cuil,
        category: employee.category,
        cctCode: employee.cct_code ?? "Sin clasificar",
        weeklyHours: employee.weekly_hours,
        seniorityYears: employee.seniority_years,
        startDate: employee.start_date,
        periodLabel: `${String(selectedPeriod.payment_month).padStart(2, "0")}/${selectedPeriod.payment_year}`,
        paymentDate: selectedPeriod.payment_date ?? "Pendiente",
        paymentLocation: selectedPeriod.payment_location ?? "Pendiente",
        netEstimate,
        finalized: selectedSlip.status === "approved",
        approvedAt: selectedSlip.reviewed_at ? new Date(selectedSlip.reviewed_at).toLocaleString("es-AR") : null,
        items: selectedItems.map((item) => ({
          description: item.description,
          itemType: item.item_type,
          categoryLabel: item.cost_category ? costCategoryLabels[item.cost_category] : undefined,
          calculationBase: item.calculation_base == null ? null : Number(item.calculation_base),
          unit: item.unit,
          amount: Number(item.amount),
        })),
      });
      const pdfBlob = new Blob([new Uint8Array(bytes).buffer as ArrayBuffer], { type: "application/pdf" });
      const url = URL.createObjectURL(pdfBlob);
      const anchor = document.createElement("a");
      const filePart = `${String(company.legal_name ?? "empresa")}_${employee.full_name}`
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "");
      anchor.href = url;
      anchor.download = `recibo_${selectedSlip.status === "approved" ? "final" : "borrador"}_${filePart}_${String(selectedPeriod.payment_month).padStart(2, "0")}-${selectedPeriod.payment_year}.pdf`;
      document.body.appendChild(anchor); anchor.click(); anchor.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice("PDF del recibo borrador descargado.");
    } catch {
      setError("No pudimos generar el PDF. Revisá que el recibo tenga datos válidos y volvé a intentarlo.");
    } finally { setGeneratingPdf(false); }
  }

  async function deleteDraftPeriod() {
    if (!supabase || !selectedPeriod || selectedPeriod.status !== "draft") return;
    const label = `${String(selectedPeriod.payment_month).padStart(2, "0")}/${selectedPeriod.payment_year}`;
    if (!window.confirm(`¿Eliminar el período borrador ${label} y sus ${slips.length} recibos? Esta acción no se puede deshacer.`)) return;
    setDeleting(true); setError(""); setNotice("");
    const { error: deleteError } = await supabase.rpc("delete_payroll_draft", { target_period_id: selectedPeriod.id });
    if (deleteError) {
      const missingFunction = deleteError.code === "PGRST202" || deleteError.code === "42883";
      setError(missingFunction
        ? "Supabase todavía no tiene la migración 20261127000000_delete_payroll_drafts.sql aplicada. Aplicala y volvé a intentar."
        : `Supabase rechazó la eliminación (${deleteError.code ?? "sin código"}): ${deleteError.message}`);
      setDeleting(false); return;
    }
    if (studioId) await refresh(studioId);
    setNotice(`Se eliminó el período ${label} y sus recibos borrador.`);
    setDeleting(false);
  }

  async function deleteDraftSlip(slip: Slip) {
    if (!supabase || !selectedPeriod || selectedPeriod.status !== "draft") return;
    const name = employeeOf(slip).full_name;
    if (!window.confirm(`¿Quitar el recibo borrador de ${name} del período? El resto de los recibos se conservará.`)) return;
    setDeleting(true); setError(""); setNotice("");
    const { error: deleteError } = await supabase.rpc("delete_payroll_slip_draft", { target_slip_id: slip.id });
    if (deleteError) {
      const missingFunction = deleteError.code === "PGRST202" || deleteError.code === "42883";
      setError(missingFunction
        ? "Supabase todavía no tiene la migración 20261127000000_delete_payroll_drafts.sql aplicada. Aplicala y volvé a intentar."
        : `Supabase rechazó quitar el recibo (${deleteError.code ?? "sin código"}): ${deleteError.message}`);
      setDeleting(false); return;
    }
    if (studioId) await refresh(studioId, selectedPeriod.id);
    setNotice(`Se quitó el recibo de ${name} del borrador.`);
    setDeleting(false);
  }

  if (!supabase) return <main className="auth-shell"><section className="auth-card"><h1>Conectá Supabase</h1><p>Configurá la URL y la publishable key en .env.local.</p></section></main>;
  if (authLoading || loading) return <main className="auth-shell"><section className="auth-card"><h1>Cargando recibos…</h1></section></main>;
  if (!user) return <main className="auth-shell"><section className="auth-card"><h1>Iniciá sesión</h1><p>Primero ingresá desde la sección Empresas.</p><Link href="/">Ir a inicio de sesión</Link></section></main>;

  return <main className="app-shell">
    <aside className="sidebar"><Link className="brand" href="/"><span className="brand-mark">e.</span><span><strong>estudio</strong><small>GESTIÓN CONTABLE</small></span></Link><div className="nav-label">EMPRESA</div><nav aria-label="Navegación principal"><Link className="nav-item" href={companyId ? `/companies/${companyId}` : "/"}><span>▦</span> {companyId ? "Volver a empresa" : "Empresas"}</Link><Link className="nav-item active" href={companyId ? `/companies/${companyId}/payroll` : "/payroll"}><span>▤</span> Sueldos</Link></nav><div className="sidebar-bottom"><div className="profile-avatar">SC</div><div><strong>Estudio contable</strong><small>{user.email}</small></div><button className="profile-menu" onClick={() => void supabase.auth.signOut()} aria-label="Cerrar sesión">Salir</button></div></aside>
    <section className="workspace"><header className="topbar"><div className="breadcrumbs"><Link href={companyId ? `/companies/${companyId}` : "/"}>{companyId ? "Empresa" : "Empresas"}</Link><span>/</span><strong>{companyId ? `${companies[0]?.legal_name ?? "Empresa"} · Sueldos` : "Recibos de sueldo"}</strong></div><div className="topbar-actions"><span className="environment-pill"><i /> Supabase</span></div></header>
      <div className="page-content"><div className="demo-notice"><span className="notice-icon">!</span><span><strong>Borrador calculado automáticamente.</strong> Se aplican escala FAECYS, antigüedad y presentismo según el perfil cargado. Las tasas sindicales y solidarias se calculan automáticamente sobre la base del recibo. Requiere revisión profesional y no es recibo oficial.</span></div>
        {error && <p className="form-error payroll-message" role="alert">{error}</p>}{companyProblem && <p className="form-error payroll-message" role="alert">{companyProblem} {companyId && <Link href={`/companies/${companyId}`}>Abrir ficha de empresa</Link>}</p>}{notice && <p className="payroll-success" role="status">{notice}</p>}
        <div className="page-heading"><div><div className="eyebrow">NÓMINA</div><h1>Recibos de sueldo</h1><p>Prepará borradores por período y pedí una revisión profesional.</p></div></div>
        <section className="payroll-create"><div className="section-heading"><div><h2>Nuevo período</h2><p>Se crea un borrador por cada persona activa de la empresa.</p></div></div>
          {companies.length === 0 ? <p className="people-empty">{companyId ? "La creación está deshabilitada hasta corregir el estado o los servicios indicados arriba." : <>No hay empresas activas con servicio de sueldos. Habilitalo desde la ficha de la empresa en <Link href="/">Empresas</Link>.</>}</p> : <form className="payroll-period-form" onSubmit={createDraft}>
            <label>Empresa{companyId ? <><input value={companies[0].legal_name} readOnly /><input type="hidden" name="company" value={companies[0].id} /></> : <select name="company" required defaultValue={companies[0]?.id}>{companies.map((company) => <option key={company.id} value={company.id}>{company.legal_name}</option>)}</select>}</label>
            <label>Año<input name="year" type="number" min="2000" max="2100" defaultValue={new Date().getFullYear()} required /></label>
            <label>Mes<select name="month" defaultValue={String(new Date().getMonth() + 1)}>{Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{new Intl.DateTimeFormat("es-AR", { month: "long" }).format(new Date(2026, i, 1))}</option>)}</select></label>
            <label>Fecha de pago<input name="paymentDate" type="date" /></label><label>Lugar de pago<input name="paymentLocation" placeholder="A completar" /></label>
            <label>Fecha pago contribuciones<input name="contributionDate" type="date" /></label><label>Lugar pago contribuciones<input name="contributionLocation" placeholder="A completar" /></label>
            <button className="primary-button" type="submit">＋ Crear borradores</button>
          </form>}
        </section>
        <section className="payroll-workspace"><div className="section-heading"><div><h2>Períodos</h2><p>{periods.length ? `${periods.length} períodos` : "Todavía no hay borradores"}</p></div>{selectedPeriod && <div className="section-heading-actions">{selectedPeriod.status === "draft" && slips.every((slip) => slip.status === "draft") && <button className="remove-item no-print" disabled={deleting} onClick={() => void deleteDraftPeriod()}>{deleting ? "Eliminando…" : "Eliminar período"}</button>}<span className={`status-pill ${selectedPeriod.status === "draft" ? "" : selectedPeriod.status === "approved" ? "approved" : "review"}`}>{selectedPeriod.status === "draft" ? "Borrador" : selectedPeriod.status === "approved" ? "Finalizado" : "En revisión"}</span></div>}</div>
          {periods.length === 0 ? <div className="empty-state"><h3>Sin períodos todavía</h3><p>Creá un período para preparar los recibos de las personas activas.</p></div> : <div className="payroll-columns"><div className="payroll-period-list">{periods.map((period) => <button key={period.id} className={`period-choice ${period.id === selectedPeriodId ? "chosen" : ""}`} onClick={() => setSelectedPeriodId(period.id)}><strong>{String(period.payment_month).padStart(2, "0")}/{period.payment_year}</strong><small>{companies.find((company) => company.id === period.company_id)?.legal_name ?? "Empresa"}</small><span>{period.status === "draft" ? "Borrador" : period.status === "approved" ? "Finalizado" : "En revisión"}</span></button>)}</div>
            {selectedPeriod && <div className="payroll-detail"><div className="slip-list">{slips.map((slip) => <button key={slip.id} className={`slip-choice ${slip.id === selectedSlipId ? "chosen" : ""}`} onClick={() => setSelectedSlipId(slip.id)}><strong>{employeeOf(slip).full_name}</strong><small>CUIL {employeeOf(slip).cuil}</small></button>)}</div>
              {selectedSlip && <div className="slip-editor"><div className="slip-toolbar"><div><span className="draft-stamp">{selectedSlip.status === "approved" ? "FINALIZADO" : selectedSlip.status === "review_requested" ? "EN REVISIÓN" : "BORRADOR"}</span><h3>{employeeOf(selectedSlip).full_name}</h3><p>{companyName(selectedSlip)} · Período {String(selectedPeriod.payment_month).padStart(2, "0")}/{selectedPeriod.payment_year}</p></div><div className="slip-toolbar-actions">{selectedPeriod.status === "draft" && selectedSlip.status === "draft" && slips.length > 1 && <button className="remove-item no-print" disabled={deleting} onClick={() => void deleteDraftSlip(selectedSlip)}>Quitar recibo</button>}<button className="secondary-button no-print" disabled={generatingPdf} onClick={() => void downloadReceiptPdf()}>{generatingPdf ? "Generando PDF…" : selectedSlip.status === "approved" ? "Descargar PDF final" : "Descargar PDF borrador"}</button></div></div>
                <article className="receipt-paper"><div className="receipt-watermark">{selectedSlip.status === "approved" ? "FINALIZADO POR CONTADOR" : selectedSlip.status === "review_requested" ? "EN REVISIÓN PROFESIONAL" : "BORRADOR · PENDIENTE DE REVISIÓN"}</div><header><strong>{companyName(selectedSlip)}</strong><small>CUIT {String((selectedSlip.company_snapshot as Record<string, unknown>).tax_id ?? "Pendiente de completar")}</small><h2>RECIBO DE SUELDO · {selectedSlip.status === "approved" ? "FINAL" : "BORRADOR"}</h2></header><div className="receipt-identity"><div>Persona <strong>{employeeOf(selectedSlip).full_name}</strong></div><div>CUIL <strong>{employeeOf(selectedSlip).cuil}</strong></div><div>Categoría informada <strong>{employeeOf(selectedSlip).category}</strong></div><div>CCT 130/75 <strong>{employeeOf(selectedSlip).cct_code ?? "Sin clasificar"}</strong></div><div>Jornada semanal <strong>{employeeOf(selectedSlip).weekly_hours ?? "—"} h</strong></div><div>Antigüedad reconocida <strong>{employeeOf(selectedSlip).seniority_years ?? "—"} años</strong></div><div>Presentismo informado <strong>{employeeOf(selectedSlip).presentismo_eligible ? "Sí, sujeto a asistencia del período" : "No"}</strong></div><div>Básico de escala aplicado <strong>{scaleBasic ? formatARS(Number(scaleBasic.amount)) : "Sin cálculo"}</strong></div><div>Período <strong>{String(selectedPeriod.payment_month).padStart(2, "0")}/{selectedPeriod.payment_year}</strong></div><div>Fecha / lugar de pago <strong>{selectedPeriod.payment_date ?? "Pendiente"} · {selectedPeriod.payment_location ?? "Pendiente"}</strong></div>{selectedSlip.reviewed_at && <div>Aceptado por contador el <strong>{new Date(selectedSlip.reviewed_at).toLocaleString("es-AR")}</strong></div>}</div>
                  <ReceiptSection title="Contribuciones patronales" rows={contributions} onDelete={deleteItem} editable={false} total={total(contributions)} contribution />
                  <ReceiptSection title="Remuneraciones" rows={remunerations} onDelete={deleteItem} editable={false} total={total(remunerations)} />
                  <ReceiptSection title="Aportes personales y deducciones" rows={deductions} onDelete={deleteItem} editable={false} total={total(deductions)} />
                  <section className="receipt-section receipt-net"><h3>{selectedSlip.status === "approved" ? "Neto aprobado por contador" : "Subtotal estimado luego de aportes y tasas"}</h3><strong>{formatARS(arithmeticDraftNet(remunerations.map((row) => Number(row.amount)), deductions.map((row) => Number(row.amount))))}</strong><p>{selectedSlip.status === "approved" ? "La aprobación queda registrada en el sistema; no registra firma ni acreditación de pago." : "Las bases imponibles, topes, beneficios y situaciones particulares pueden modificar este importe."}</p></section>
                  <section className="receipt-cost-summary"><h3>Resumen informativo de costos patronales</h3><div className="cost-items">{costCategories.map((category) => <span key={category}>{costCategoryLabels[category]} <strong>{formatARS(addMoneyAmounts(contributions.filter((row) => row.cost_category === category).map((row) => Number(row.amount))))}</strong></span>)}</div><div className="cost-chart" style={{ background: chartGradient(contributions) }} aria-label="Gráfico circular de los costos patronales estimados"><i>Costos<br />estimados</i></div><small>La contribución ARCA se muestra agregada en seguridad social; el reparto por subsistema (incluido INSSJP) requiere el detalle F.931. Revisá también bases, topes y beneficios antes de usar.</small></section>
                  <footer className="receipt-footer">{selectedSlip.status === "approved" ? "Recibo finalizado por el contador del estudio. La firma y el pago no se registran en este sistema." : "Datos y conceptos pendientes de revisión profesional. No válido para emisión o acreditación de pago."}</footer></article>
                <div className="review-actions no-print">{canApprove && selectedSlip.status !== "approved" ? <button className="primary-button" onClick={() => void approveReceipt()}>Aceptar y finalizar recibo</button> : selectedSlip.status === "approved" ? <p>Recibo aceptado por contador y bloqueado para edición.</p> : selectedSlip.status === "draft" ? <button className="secondary-button" onClick={requestReview}>Solicitar revisión profesional</button> : <p>Este recibo está en revisión y espera la aprobación del contador.</p>}<p>{canApprove ? "La aprobación queda registrada con la cuenta y la fecha; al aceptar todos los recibos, se finaliza el período." : "La solicitud queda en la lista compartida del estudio. Solo un miembro con rol contador o propietario puede aceptar y finalizar."}</p></div>
              </div>}
            </div>}
          </div>}
        </section><footer className="page-footer"><span>ESTUDIO <b>·</b> Gestión contable</span><span>Borradores de nómina</span></footer>
      </div>
    </section>
  </main>;
}

function ReceiptSection({ title, rows, total, editable, onDelete, contribution = false }: { title: string; rows: Item[]; total: number; editable: boolean; onDelete: (id: string) => void; contribution?: boolean }) {
  return <section className="receipt-section"><div className="receipt-section-heading"><h3>{title}</h3><strong>{formatARS(total)}</strong></div>{rows.length === 0 ? <p className="receipt-empty">Sin conceptos cargados</p> : <table><thead><tr><th>Concepto</th>{contribution && <th>Rubro</th>}<th>Importe</th>{editable && <th className="no-print">Acción</th>}</tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td>{row.description}</td>{contribution && <td>{row.cost_category ? costCategoryLabels[row.cost_category] : "—"}</td>}<td>{formatARS(Number(row.amount))}</td>{editable && <td className="no-print"><button className="remove-item" onClick={() => onDelete(row.id)} aria-label={`Quitar ${row.description}`}>Quitar</button></td>}</tr>)}</tbody></table>}</section>;
}
