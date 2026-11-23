"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { CompanyService, Database } from "@/lib/supabase/database.types";
import { digitsOnly, validateEmployee } from "@/modules/companies/domain";

type Company = Database["public"]["Tables"]["companies"]["Row"];
type Employee = Database["public"]["Tables"]["employees"]["Row"];
const serviceName: Record<CompanyService, string> = { payroll: "Sueldos", balance: "Contabilidad", both: "Sueldos y contabilidad" };
const commerceCategories = ["Maestranza A", "Maestranza B", "Maestranza C", "Administrativo A", "Administrativo B", "Administrativo C", "Administrativo D", "Administrativo E", "Administrativo F", "Cajero A", "Cajero B", "Cajero C", "Auxiliar A", "Auxiliar B", "Auxiliar C", "Auxiliar especializado A", "Auxiliar especializado B", "Vendedor A", "Vendedor B", "Vendedor C", "Vendedor D"];

export default function CompanyWorkspacePage() {
  const params = useParams<{ companyId: string }>();
  const companyId = params.companyId;
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(() => Boolean(supabase));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [employeeFormOpen, setEmployeeFormOpen] = useState(false);
  const [employeeError, setEmployeeError] = useState("");

  useEffect(() => {
    if (!supabase) return;
    let mounted = true;
    void (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!mounted) return;
      setUser(auth.user);
      if (!auth.user) { setLoading(false); return; }
      const [companyResult, employeeResult] = await Promise.all([
        supabase.from("companies").select("*").eq("id", companyId).maybeSingle(),
        supabase.from("employees").select("*").eq("company_id", companyId).order("full_name"),
      ]);
      if (!mounted) return;
      if (companyResult.error || !companyResult.data) setError("No encontramos esta empresa en tu espacio de trabajo.");
      else setCompany(companyResult.data);
      if (employeeResult.error) setError("No pudimos cargar el personal asociado.");
      else setEmployees(employeeResult.data ?? []);
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, [supabase, companyId]);

  async function saveService(service_type: CompanyService) {
    if (!supabase || !company) return;
    setSaving(true); setSaved(false); setError("");
    const { data, error: updateError } = await supabase.from("companies").update({ service_type }).eq("id", company.id).select("*").single();
    if (updateError || !data) setError("No pudimos actualizar los servicios de la empresa.");
    else { setCompany(data); setSaved(true); }
    setSaving(false);
  }

  async function saveEmployerRates(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!supabase || !company) return;
    const data = new FormData(event.currentTarget);
    const arcaRate = Number(data.get("arcaRate")); const falRate = Number(data.get("falRate")); const artRate = Number(data.get("artRate"));
    if (![18, 20.4].includes(arcaRate) || ![0, 1, 2.5].includes(falRate) || !Number.isFinite(artRate) || artRate < 0 || artRate > 100 || falRate > arcaRate) {
      setError("Ingresá alícuotas válidas de ARCA, FAL y ART para esta empresa."); return;
    }
    const { data: row, error: updateError } = await supabase.from("companies").update({ arca_employer_rate: arcaRate, fal_rate: falRate, art_rate: artRate }).eq("id", company.id).select("*").single();
    if (updateError || !row) { setError("No pudimos guardar las alícuotas patronales."); return; }
    setCompany(row); setError(""); setSaved(true);
  }

  async function reactivate() {
    if (!supabase || !company) return;
    const { data, error: updateError } = await supabase.from("companies").update({ active: true }).eq("id", company.id).select("*").single();
    if (updateError || !data) setError("No pudimos reactivar la empresa.");
    else setCompany(data);
  }

  async function addEmployee(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !company || !user) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const input = {
      companyId: company.id,
      fullName: String(data.get("fullName") ?? ""),
      cuil: String(data.get("cuil") ?? ""),
      category: String(data.get("category") ?? ""),
      startDate: String(data.get("startDate") ?? ""),
      baseSalary: 0,
      cctCode: String(data.get("cctCode") ?? ""),
      weeklyHours: Number(data.get("weeklyHours") ?? 0),
      seniorityYears: Number(data.get("seniorityYears") ?? -1),
      presentismoEligible: data.get("presentismoEligible") === "on",
      unionRate: Number(data.get("unionRate") ?? -1),
      solidarityRate: Number(data.get("solidarityRate") ?? -1),
      riflEligible: data.get("riflEligible") === "on",
    };
    const errors = validateEmployee(input, employees.map((employee) => employee.cuil));
    if (errors.length) { setEmployeeError(errors[0]); return; }
    if (!input.cctCode || !Number.isFinite(input.weeklyHours) || input.weeklyHours <= 0 || input.weeklyHours > 48 || !Number.isInteger(input.seniorityYears) || input.seniorityYears < 0 || input.seniorityYears > 80 || !Number.isFinite(input.unionRate) || input.unionRate < 0 || input.unionRate > 100 || !Number.isFinite(input.solidarityRate) || input.solidarityRate < 0 || input.solidarityRate > 100) {
      setEmployeeError("Completá categoría, jornada, antigüedad y porcentajes válidos (0 a 100)."); return;
    }
    const { data: row, error: insertError } = await supabase.from("employees").insert({
      studio_id: company.studio_id, company_id: company.id, full_name: input.fullName.trim(),
      cuil: digitsOnly(input.cuil), category: input.category.trim(), start_date: input.startDate,
      base_salary: input.baseSalary,
      cct_code: input.cctCode || null, weekly_hours: input.weeklyHours,
      seniority_years: input.seniorityYears, presentismo_eligible: input.presentismoEligible,
      union_rate: input.unionRate, solidarity_rate: input.solidarityRate, rifl_eligible: input.riflEligible,
    }).select("*").single();
    if (insertError || !row) { setEmployeeError("No se pudo guardar la persona. Revisá los datos y los permisos."); return; }
    setEmployees((current) => [...current, row].sort((a, b) => a.full_name.localeCompare(b.full_name, "es")));
    setEmployeeError(""); setEmployeeFormOpen(false); form.reset();
  }

  async function updatePayrollProfile(event: React.FormEvent<HTMLFormElement>, employee: Employee) {
    event.preventDefault(); if (!supabase) return;
    const data = new FormData(event.currentTarget);
    const weeklyHours = Number(data.get("weeklyHours")); const seniorityYears = Number(data.get("seniorityYears"));
    const cctCode = String(data.get("cctCode") ?? ""); const presentismoEligible = data.get("presentismoEligible") === "on";
    const unionRate = Number(data.get("unionRate")); const solidarityRate = Number(data.get("solidarityRate"));
    const riflEligible = data.get("riflEligible") === "on";
    if (!cctCode || !Number.isFinite(weeklyHours) || weeklyHours <= 0 || weeklyHours > 48 || !Number.isInteger(seniorityYears) || seniorityYears < 0 || seniorityYears > 80 || !Number.isFinite(unionRate) || unionRate < 0 || unionRate > 100 || !Number.isFinite(solidarityRate) || solidarityRate < 0 || solidarityRate > 100) {
      setEmployeeError("Revisá categoría, jornada, antigüedad y porcentajes antes de guardar el perfil."); return;
    }
    const { data: row, error: updateError } = await supabase.from("employees").update({ cct_code: cctCode, weekly_hours: weeklyHours, seniority_years: seniorityYears, presentismo_eligible: presentismoEligible, union_rate: unionRate, solidarity_rate: solidarityRate, rifl_eligible: riflEligible }).eq("id", employee.id).select("*").single();
    if (updateError || !row) { setEmployeeError("No pudimos guardar el perfil laboral."); return; }
    setEmployees((current) => current.map((entry) => entry.id === employee.id ? row : entry)); setEmployeeError("");
  }

  if (!supabase || !user && !loading) return <main className="auth-shell"><section className="auth-card"><h1>Iniciá sesión</h1><p>Para abrir una empresa, iniciá sesión en el espacio de trabajo.</p><Link href="/">Ir a inicio de sesión</Link></section></main>;
  if (loading) return <main className="auth-shell"><section className="auth-card"><h1>Cargando empresa…</h1></section></main>;
  if (error && !company) return <main className="auth-shell"><section className="auth-card"><h1>No se pudo abrir la empresa</h1><p role="alert">{error}</p><Link href="/">Volver a empresas</Link></section></main>;
  if (!company) return null;

  const payrollEnabled = company.service_type === "payroll" || company.service_type === "both";
  const balanceEnabled = company.service_type === "balance" || company.service_type === "both";
  const activeEmployees = employees.filter((employee) => employee.active);

  return <main className="app-shell"><aside className="sidebar"><Link className="brand" href="/"><span className="brand-mark">e.</span><span><strong>estudio</strong><small>GESTIÓN CONTABLE</small></span></Link><div className="nav-label">EMPRESA</div><nav aria-label="Navegación de empresa"><Link className="nav-item" href="/"><span>▦</span> Todas las empresas</Link><a className="nav-item active" href="#resumen"><span>▣</span> Resumen</a>{payrollEnabled && <Link className="nav-item" href={`/companies/${company.id}/payroll`}><span>▤</span> Sueldos</Link>}{balanceEnabled && <a className="nav-item" href="#contabilidad"><span>◫</span> Contabilidad</a>}{balanceEnabled && <a className="nav-item" href="#reportes"><span>▧</span> Reportes</a>}</nav><div className="sidebar-bottom"><div className="profile-avatar">SC</div><div><strong>Estudio contable</strong><small>{user?.email}</small></div><button className="profile-menu" onClick={() => void supabase.auth.signOut()} aria-label="Cerrar sesión">Salir</button></div></aside>
    <section className="workspace"><header className="topbar"><div className="breadcrumbs"><Link href="/">Empresas</Link><span>/</span><strong>{company.legal_name}</strong></div><div className="topbar-actions"><span className="environment-pill"><i /> {company.active ? "Activa" : "Archivada"}</span></div></header>
      <div className="page-content" id="resumen"><div className="page-heading"><div><div className="eyebrow">FICHA DE EMPRESA</div><h1>{company.legal_name}</h1><p>CUIT {company.tax_id} · {company.address}</p></div><Link href="/" className="secondary-button">Volver a empresas</Link></div>
        {!company.active && <div className="demo-notice"><span className="notice-icon">!</span><span><strong>Empresa archivada.</strong> Reactivala para habilitar su operación y procesar nómina.</span><button className="secondary-button" onClick={reactivate}>Reactivar empresa</button></div>}
        {error && <p className="form-error" role="alert">{error}</p>}
        <section className="company-services"><div className="section-heading"><div><h2>Servicios de esta empresa</h2><p>Los módulos disponibles dependen de esta configuración.</p></div></div><div className="service-settings"><label>Servicios habilitados<select aria-label="Servicios habilitados" value={company.service_type} disabled={saving || !company.active} onChange={(event) => void saveService(event.target.value as CompanyService)}><option value="payroll">Solo sueldos</option><option value="balance" disabled={!company.fiscal_year_end}>Solo contabilidad</option><option value="both" disabled={!company.fiscal_year_end}>Sueldos y contabilidad</option></select></label><span>{saved ? "Configuración guardada" : `Configuración actual: ${serviceName[company.service_type]}`}</span></div>{payrollEnabled && <form className="employer-rates-form" onSubmit={(event) => void saveEmployerRates(event)}><h3>Parámetros de costos patronales</h3><label>Alícuota general ARCA<select name="arcaRate" defaultValue={company.arca_employer_rate ?? ""} required><option value="" disabled>Seleccionar encuadre</option><option value="18">18% · empleador MiPyME con certificado vigente / otros encuadres</option><option value="20.4">20,4% · comercio/servicios sobre límite MiPyME</option></select></label><label>Alícuota FAL<select name="falRate" defaultValue={company.fal_rate} required><option value="0">No aplica / sin caracterización</option><option value="1">1% · resto de empleadores alcanzados</option><option value="2.5">2,5% · MiPyME / entidades alcanzadas</option></select></label><label>Alícuota ART (%)<input name="artRate" type="number" min="0" max="100" step="0.01" defaultValue={company.art_rate ?? ""} required /></label><button className="secondary-button">Guardar parámetros patronales</button><small>Confirmá el encuadre en ARCA y la tasa vigente de la ART. Se guardan en la ficha y quedan en el recibo borrador.</small></form>}</section>
        <section className="company-module-grid"><h2>Módulos</h2><div className="module-cards">{payrollEnabled && <Link className={`module-card ${!company.active ? "module-disabled" : ""}`} href={company.active ? `/companies/${company.id}/payroll` : "#"}><span className="module-icon">▤</span><strong>Sueldos</strong><p>Personal, períodos y recibos en borrador.</p><span className="module-open">Abrir módulo →</span></Link>}{balanceEnabled && <article className="module-card" id="contabilidad"><span className="module-icon">◫</span><strong>Contabilidad</strong><p>El espacio contable de esta empresa.</p><span className="module-open">Próximamente</span></article>}{balanceEnabled && <article className="module-card" id="reportes"><span className="module-icon">▧</span><strong>Reportes</strong><p>Reportes disponibles para esta empresa.</p><span className="module-open">Próximamente</span></article>}</div></section>
        <section className="people-section" id="personal"><div className="section-heading"><div><h2>Personal</h2><p>{activeEmployees.length} personas activas · {employees.length} registradas</p></div><button className="secondary-button" disabled={!company.active} onClick={() => { setEmployeeError(""); setEmployeeFormOpen((open) => !open); }}>{employeeFormOpen ? "Cancelar" : "＋ Agregar persona"}</button></div>
          {employeeFormOpen && <form className="company-employee-form" onSubmit={addEmployee}><label>Nombre y apellido<input name="fullName" required /></label><label>CUIL<input name="cuil" inputMode="numeric" required /></label><label>Categoría o calificación<input name="category" required /></label><label>Categoría CCT 130/75<select name="cctCode" defaultValue="" required><option value="" disabled>Seleccionar categoría FAECYS</option>{commerceCategories.map((category) => <option key={category}>{category}</option>)}</select></label><label>Jornada semanal (horas)<input name="weeklyHours" type="number" min="1" max="48" step="0.25" defaultValue="48" required /></label><label>Antigüedad reconocida (años)<input name="seniorityYears" type="number" min="0" max="80" step="1" defaultValue="0" required /></label><label>Fecha de ingreso<input name="startDate" type="date" required /></label><label>Porcentaje aporte sindical<input name="unionRate" type="number" min="0" max="100" step="0.01" defaultValue="2" required /></label><label>Porcentaje promoción social / cuota solidaria<input name="solidarityRate" type="number" min="0" max="100" step="0.01" defaultValue="0" required /></label><label className="employee-checkbox"><input name="presentismoEligible" type="checkbox" /> Presentismo habilitado para el cálculo del borrador</label><label className="employee-checkbox"><input name="riflEligible" type="checkbox" /> RIFL confirmado como aplicable en ARCA</label><p className="field-hint">Confirmá elegibilidad según asistencia del período. Marcá RIFL solo si la empresa verificó que la persona cumple las condiciones vigentes. Los porcentajes sindicales se aplican automáticamente al generar el borrador.</p>{employeeError && <p className="form-error" role="alert">{employeeError}</p>}<button className="primary-button">Guardar persona</button></form>}
          {employeeError && !employeeFormOpen && <p className="form-error" role="alert">{employeeError}</p>}
          {employees.length === 0 ? <div className="people-empty">Todavía no hay personas registradas. Agregá la primera desde esta ficha.</div> : <><div className="companies-panel"><table><thead><tr><th>PERSONA</th><th>CUIL</th><th>CATEGORÍA</th><th>INGRESO</th><th>ESTADO</th></tr></thead><tbody>{employees.map((employee) => <tr key={employee.id}><td>{employee.full_name}</td><td>{employee.cuil}</td><td>{employee.category}</td><td>{employee.start_date}</td><td>{employee.active ? "Activa" : "Inactiva"}</td></tr>)}</tbody></table></div><h3>Perfil CCT 130/75</h3><p>La escala define automáticamente los importes del borrador. Configurá solamente las tasas sindicales y de cuota solidaria que correspondan.</p><div className="employee-profile-list">{employees.map((employee) => <form className="employee-profile-form" key={employee.id} onSubmit={(event) => void updatePayrollProfile(event, employee)}><strong>{employee.full_name}</strong><label>Categoría FAECYS<select name="cctCode" defaultValue={employee.cct_code ?? ""} required><option value="" disabled>Seleccionar</option>{commerceCategories.map((category) => <option key={category}>{category}</option>)}</select></label><label>Horas semanales<input name="weeklyHours" type="number" min="1" max="48" step="0.25" defaultValue={employee.weekly_hours ?? 48} required /></label><label>Años reconocidos<input name="seniorityYears" type="number" min="0" max="80" defaultValue={employee.seniority_years ?? 0} required /></label><label>Alícuota sindical (%)<input name="unionRate" type="number" min="0" max="100" step="0.01" defaultValue={employee.union_rate ?? 2} required /></label><label>Promoción social / cuota solidaria (%)<input name="solidarityRate" type="number" min="0" max="100" step="0.01" defaultValue={employee.solidarity_rate ?? 0} required /></label><label className="employee-checkbox"><input name="presentismoEligible" type="checkbox" defaultChecked={employee.presentismo_eligible ?? false} /> Presentismo para este período</label><label className="employee-checkbox"><input name="riflEligible" type="checkbox" defaultChecked={employee.rifl_eligible ?? false} /> RIFL confirmado como aplicable en ARCA</label><button className="secondary-button">Guardar perfil</button></form>)}</div></>}</section>
      </div>
    </section>
  </main>;
}
