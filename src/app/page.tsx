"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import {
  Company,
  Employee,
  ServiceType,
  digitsOnly,
  formatIdentifier,
  validateCompany,
  validateEmployee,
} from "@/modules/companies/domain";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { CompanyService, Database } from "@/lib/supabase/database.types";

type CompanyRow = Database["public"]["Tables"]["companies"]["Row"];
type EmployeeRow = Database["public"]["Tables"]["employees"]["Row"];

const serviceLabels: Record<ServiceType, string> = {
  LIQUIDACION_SUELDOS: "Sueldos",
  BALANCE: "Balance",
  AMBOS: "Sueldos y balance",
};

const toDatabaseService: Record<ServiceType, CompanyService> = {
  LIQUIDACION_SUELDOS: "payroll",
  BALANCE: "balance",
  AMBOS: "both",
};

const fromDatabaseService: Record<CompanyService, ServiceType> = {
  payroll: "LIQUIDACION_SUELDOS",
  balance: "BALANCE",
  both: "AMBOS",
};

function mapCompany(row: CompanyRow): Company {
  return {
    id: row.id,
    legalName: row.legal_name,
    taxId: row.tax_id,
    address: row.address,
    serviceType: fromDatabaseService[row.service_type],
    fiscalYearEnd: row.fiscal_year_end ?? "",
    active: row.active,
  };
}

function mapEmployee(row: EmployeeRow): Employee {
  return {
    id: row.id,
    companyId: row.company_id,
    fullName: row.full_name,
    cuil: row.cuil,
    category: row.category,
    startDate: row.start_date,
    active: row.active,
  };
}

export default function Home() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [studioId, setStudioId] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [authMode, setAuthMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [authError, setAuthError] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [dataError, setDataError] = useState("");
  const [companies, setCompanies] = useState<Company[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [companyOpen, setCompanyOpen] = useState(false);
  const [employeeOpen, setEmployeeOpen] = useState(false);
  const [companyError, setCompanyError] = useState("");
  const [employeeError, setEmployeeError] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!supabase) return;
    let mounted = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setUser(session?.user ?? null);
      setAuthLoading(false);
      if (!session) {
        setStudioId(null);
        setCompanies([]);
        setEmployees([]);
      }
    });
    void supabase.auth.getUser().then(({ data, error }) => {
      if (!mounted) return;
      if (error) setAuthError("No pudimos validar la sesión. Volvé a iniciar sesión.");
      setUser(data.user);
      setAuthLoading(false);
    });
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if (!supabase || !user) return;
    const client = supabase;
    const authenticatedUser = user;
    let mounted = true;
    async function loadWorkspace() {
      setDataLoading(true);
      setDataError("");
      const { data: membership, error: membershipError } = await client
        .from("studio_members")
        .select("studio_id")
        .eq("user_id", authenticatedUser.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (!mounted) return;
      if (membershipError || !membership) {
        setDataError("No encontramos un estudio asociado a esta cuenta.");
        setDataLoading(false);
        return;
      }
      setStudioId(membership.studio_id);
      const [companyResult, employeeResult] = await Promise.all([
        client.from("companies").select("*").eq("studio_id", membership.studio_id).order("created_at", { ascending: false }),
        client.from("employees").select("*").eq("studio_id", membership.studio_id).order("created_at", { ascending: false }),
      ]);
      if (!mounted) return;
      if (companyResult.error || employeeResult.error) {
        setDataError("No pudimos cargar los datos del estudio. Revisá la conexión y las políticas RLS.");
      } else {
        setCompanies((companyResult.data ?? []).map(mapCompany));
        setEmployees((employeeResult.data ?? []).map(mapEmployee));
      }
      setDataLoading(false);
    }
    void loadWorkspace();
    return () => { mounted = false; };
  }, [supabase, user]);

  const selectedCompany = companies.find((company) => company.id === selectedCompanyId) ?? null;
  const visibleCompanies = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("es-AR");
    return companies.filter((company) =>
      `${company.legalName} ${company.taxId}`.toLocaleLowerCase("es-AR").includes(normalizedQuery),
    );
  }, [companies, query]);
  const companyEmployees = employees.filter((employee) => employee.companyId === selectedCompanyId);

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") ?? "").trim();
    const password = String(data.get("password") ?? "");
    setAuthError("");
    setAuthMessage("");

    if (authMode === "sign-up") {
      const studioName = String(data.get("studioName") ?? "").trim();
      const { data: result, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { studio_name: studioName } },
      });
      if (error) setAuthError("No pudimos crear la cuenta. Verificá los datos o consultá al administrador del proyecto.");
      else if (!result.session) setAuthMessage("Cuenta creada. Confirmá tu correo y luego iniciá sesión.");
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setAuthError("No pudimos iniciar sesión. Revisá el correo y la contraseña.");
  }

  async function createCompany(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const input = {
      legalName: String(data.get("legalName") ?? ""),
      taxId: String(data.get("taxId") ?? ""),
      address: String(data.get("address") ?? ""),
      serviceType: String(data.get("serviceType") ?? "LIQUIDACION_SUELDOS") as ServiceType,
      fiscalYearEnd: String(data.get("fiscalYearEnd") ?? ""),
    };
    const errors = validateCompany(input, companies.map((company) => company.taxId));
    if (errors.length) {
      setCompanyError(errors[0]);
      return;
    }

    if (!supabase || !studioId) return;
    const { data: row, error } = await supabase.from("companies").insert({
      studio_id: studioId,
      legal_name: input.legalName.trim(),
      tax_id: digitsOnly(input.taxId),
      address: input.address.trim(),
      service_type: toDatabaseService[input.serviceType],
      fiscal_year_end: input.fiscalYearEnd || null,
    }).select("*").single();
    if (error || !row) {
      setCompanyError(error?.code === "23505" ? "Ya existe una empresa con ese CUIT." : "No pudimos guardar la empresa. Revisá la conexión y los permisos.");
      return;
    }
    const company = mapCompany(row);
    setCompanies((current) => [company, ...current]);
    setSelectedCompanyId(company.id);
    setCompanyError("");
    setCompanyOpen(false);
    form.reset();
  }

  async function createEmployee(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedCompany || !supabase || !studioId) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const input = {
      companyId: selectedCompany.id,
      fullName: String(data.get("fullName") ?? ""),
      cuil: String(data.get("cuil") ?? ""),
      category: String(data.get("category") ?? ""),
      startDate: String(data.get("startDate") ?? ""),
    };
    const errors = validateEmployee(input, employees.map((employee) => employee.cuil));
    if (errors.length) {
      setEmployeeError(errors[0]);
      return;
    }

    const { data: row, error } = await supabase.from("employees").insert({
      studio_id: studioId,
      company_id: input.companyId,
      full_name: input.fullName.trim(),
      cuil: digitsOnly(input.cuil),
      category: input.category.trim(),
      start_date: input.startDate,
    }).select("*").single();
    if (error || !row) {
      setEmployeeError(error?.code === "23505" ? "Ya existe una persona con ese CUIL en esta empresa." : "No pudimos guardar la persona. Revisá la conexión y los permisos.");
      return;
    }
    setEmployees((current) => [mapEmployee(row), ...current]);
    setEmployeeError("");
    setEmployeeOpen(false);
    form.reset();
  }

  async function archiveCompany(companyId: string) {
    if (!supabase || !studioId) return;
    const { error } = await supabase.from("companies").update({ active: false }).eq("id", companyId).eq("studio_id", studioId);
    if (error) {
      setDataError("No pudimos archivar la empresa.");
      return;
    }
    setCompanies((current) => current.map((company) => company.id === companyId ? { ...company, active: false } : company));
    if (selectedCompanyId === companyId) setSelectedCompanyId(null);
  }

  if (!supabase) {
    return <main className="auth-shell"><section className="auth-card"><div className="brand-mark">e.</div><div className="eyebrow">CONFIGURACIÓN REQUERIDA</div><h1>Conectá tu proyecto Supabase</h1><p>Creá <code>.env.local</code> con la URL del proyecto y su publishable key para habilitar la gestión de clientes.</p><pre>NEXT_PUBLIC_SUPABASE_URL=...<br />NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...</pre><p className="auth-help">La publishable key está diseñada para usarse en el cliente y queda limitada por las políticas RLS. No uses una secret ni service-role key aquí.</p></section></main>;
  }

  if (authLoading) {
    return <main className="auth-shell"><section className="auth-card"><div className="brand-mark">e.</div><h1>Conectando con Supabase…</h1><p>Validando la sesión.</p></section></main>;
  }

  if (!user) {
    return <main className="auth-shell"><section className="auth-card"><div className="auth-brand"><div className="brand-mark">e.</div><div><strong>estudio</strong><small>GESTIÓN CONTABLE</small></div></div><div className="eyebrow">ESPACIO DE TRABAJO</div><h1>{authMode === "sign-in" ? "Iniciá sesión" : "Crear cuenta"}</h1><p>{authMode === "sign-in" ? "Accedé a la cartera de clientes de tu estudio." : "Tu cuenta tendrá un espacio privado para sus clientes."}</p><form onSubmit={submitAuth} className="auth-form"><label>Correo electrónico<input name="email" type="email" autoComplete="email" required /></label>{authMode === "sign-up" && <label>Nombre del estudio<input name="studioName" required /></label>}<label>Contraseña<input name="password" type="password" minLength={8} autoComplete={authMode === "sign-in" ? "current-password" : "new-password"} required /></label>{authError && <p className="form-error" role="alert">{authError}</p>}{authMessage && <p className="auth-success" role="status">{authMessage}</p>}<button className="primary-button" type="submit">{authMode === "sign-in" ? "Ingresar" : "Crear cuenta"}</button></form><button className="auth-switch" onClick={() => { setAuthError(""); setAuthMessage(""); setAuthMode((mode) => mode === "sign-in" ? "sign-up" : "sign-in"); }}>{authMode === "sign-in" ? "¿Primera vez? Crear una cuenta" : "Ya tengo una cuenta"}</button></section></main>;
  }

  if (dataLoading) {
    return <main className="auth-shell"><section className="auth-card"><div className="brand-mark">e.</div><h1>Cargando tus clientes…</h1><p>Consultando los datos protegidos del estudio.</p></section></main>;
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#inicio" aria-label="Estudio, inicio">
          <span className="brand-mark">e.</span>
          <span><strong>estudio</strong><small>GESTIÓN CONTABLE</small></span>
        </a>
        <div className="nav-label">ESPACIO DE TRABAJO</div>
        <nav aria-label="Navegación principal">
          <a className="nav-item active" href="#empresas"><span>▦</span> Empresas <span className="nav-count">{companies.length}</span></a>
          <a className="nav-item disabled" href="#sueldos" aria-disabled="true"><span>▤</span> Sueldos <span className="soon">Próximo</span></a>
          <a className="nav-item disabled" href="#contabilidad" aria-disabled="true"><span>◫</span> Contabilidad <span className="soon">Próximo</span></a>
          <a className="nav-item disabled" href="#reportes" aria-disabled="true"><span>▧</span> Reportes</a>
        </nav>
        <div className="sidebar-bottom">
          <div className="profile-avatar">SC</div>
          <div><strong>Estudio contable</strong><small>{user.email}</small></div>
          <button className="profile-menu" onClick={() => void supabase.auth.signOut()} aria-label="Cerrar sesión">Salir</button>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div className="breadcrumbs">Espacio de trabajo <span>/</span> <strong>Empresas</strong></div>
          <div className="topbar-actions"><span className="environment-pill"><i /> Conectado</span><button className="icon-button" aria-label="Notificaciones">♧</button></div>
        </header>

        <div className="page-content">
          <div className="demo-notice"><span className="notice-icon">i</span><span><strong>Datos protegidos por estudio.</strong> Los registros se guardan en Supabase y se limitan mediante políticas RLS.</span></div>
          {dataError && <p className="form-error" role="alert">{dataError}</p>}
          <div className="page-heading">
            <div><div className="eyebrow">ADMINISTRACIÓN</div><h1>Empresas</h1><p>Organizá las empresas y personas de tu estudio.</p></div>
            <button className="primary-button" onClick={() => { setCompanyError(""); setCompanyOpen(true); }}><span>＋</span> Nueva empresa</button>
          </div>

          <div className="overview-grid">
            <article className="metric-card"><div className="metric-top"><span>Empresas activas</span><span className="metric-icon lavender">▦</span></div><strong>{companies.filter((company) => company.active).length.toString().padStart(2, "0")}</strong><small>En tu espacio de trabajo</small></article>
            <article className="metric-card"><div className="metric-top"><span>Personas registradas</span><span className="metric-icon mint">♙</span></div><strong>{employees.filter((employee) => employee.active).length.toString().padStart(2, "0")}</strong><small>En todas las empresas</small></article>
            <article className="metric-card summary-card"><div className="summary-orb">✳</div><div><strong>Todo en orden</strong><p>Los módulos se habilitarán a medida que avancemos.</p></div></article>
          </div>

          <div className="section-heading"><div><h2>Tu cartera</h2><p>{companies.length ? `${companies.length} empresas cargadas` : "Empresas y actividad reciente"}</p></div><label className="search-box"><span>⌕</span><input aria-label="Buscar empresas" placeholder="Buscar empresa..." value={query} onChange={(event) => setQuery(event.target.value)} /></label></div>

          {visibleCompanies.length === 0 ? (
            <div className="empty-state"><div className="empty-illustration"><span>▦</span><i>＋</i></div><h3>{companies.length ? "No encontramos coincidencias" : "Todavía no hay empresas"}</h3><p>{companies.length ? "Probá con otra razón social o CUIT." : "Creá tu primera empresa para empezar a organizar el trabajo del estudio."}</p>{!companies.length && <button className="secondary-button" onClick={() => setCompanyOpen(true)}>＋ Crear empresa</button>}</div>
          ) : (
            <div className="companies-panel"><table><thead><tr><th>EMPRESA</th><th>SERVICIO</th><th>CIERRE</th><th>PERSONAS</th><th>ESTADO</th><th><span className="sr-only">Acciones</span></th></tr></thead><tbody>{visibleCompanies.map((company) => {
              const count = employees.filter((employee) => employee.companyId === company.id).length;
              return <tr key={company.id} className={selectedCompanyId === company.id ? "selected-row" : ""}>
                <td><button className="company-cell" onClick={() => setSelectedCompanyId(company.id)}><span className="company-avatar">{company.legalName.slice(0, 1).toUpperCase()}</span><span><strong>{company.legalName}</strong><small>{formatIdentifier(company.taxId)}</small></span></button></td>
                <td><span className="service-tag">{serviceLabels[company.serviceType]}</span></td><td>{company.fiscalYearEnd ? new Date(`${company.fiscalYearEnd}T12:00:00`).toLocaleDateString("es-AR", { day: "2-digit", month: "short" }) : "—"}</td><td>{count} {count === 1 ? "persona" : "personas"}</td><td><span className={`status ${company.active ? "status-active" : "status-inactive"}`}><i />{company.active ? "Activa" : "Archivada"}</span></td><td><button className="row-menu" aria-label={`Archivar ${company.legalName}`} onClick={() => archiveCompany(company.id)}>•••</button></td>
              </tr>;
            })}</tbody></table></div>
          )}

          {selectedCompany && <section className="people-section"><div className="section-heading"><div><h2>{selectedCompany.legalName}</h2><p>Personas asociadas a esta empresa</p></div><button className="secondary-button" onClick={() => { setEmployeeError(""); setEmployeeOpen(true); }}>＋ Agregar persona</button></div>
            {companyEmployees.length === 0 ? <div className="people-empty">Todavía no hay personas asociadas.</div> : <div className="companies-panel"><table><thead><tr><th>PERSONA</th><th>CUIL</th><th>CATEGORÍA</th><th>FECHA DE INGRESO</th><th>ESTADO</th></tr></thead><tbody>{companyEmployees.map((employee) => <tr key={employee.id}><td><strong>{employee.fullName}</strong></td><td>{formatIdentifier(employee.cuil)}</td><td>{employee.category}</td><td>{new Date(`${employee.startDate}T12:00:00`).toLocaleDateString("es-AR")}</td><td><span className="status status-active"><i />Activa</span></td></tr>)}</tbody></table></div>}
          </section>}

          <footer className="page-footer"><span>ESTUDIO <b>·</b> Gestión contable</span><span>Hecho para trabajar con claridad</span></footer>
        </div>
      </section>

      {companyOpen && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setCompanyOpen(false); }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="company-title"><div className="modal-heading"><div><div className="eyebrow">NUEVO REGISTRO</div><h2 id="company-title">Agregar empresa</h2><p>Completá la información principal de la empresa.</p></div><button className="icon-button" aria-label="Cerrar" onClick={() => setCompanyOpen(false)}>×</button></div><form onSubmit={createCompany} noValidate><label>Razón social<input name="legalName" autoFocus placeholder="Ej. Empresa de prueba S.A." /></label><label>CUIT<input name="taxId" inputMode="numeric" placeholder="30-00000000-0" /></label><label>Domicilio fiscal<input name="address" placeholder="Calle, número, localidad" /></label><label>Servicio<select name="serviceType" defaultValue="LIQUIDACION_SUELDOS"><option value="LIQUIDACION_SUELDOS">Liquidación de sueldos</option><option value="BALANCE">Balance</option><option value="AMBOS">Sueldos y balance</option></select></label><label>Fecha de cierre del ejercicio <span className="optional">Requerida para balance</span><input name="fiscalYearEnd" type="date" /></label>{companyError && <p className="form-error" role="alert">{companyError}</p>}<div className="form-actions"><button type="button" className="secondary-button" onClick={() => setCompanyOpen(false)}>Cancelar</button><button className="primary-button" type="submit">Guardar empresa</button></div></form></section></div>}

      {employeeOpen && selectedCompany && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setEmployeeOpen(false); }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="employee-title"><div className="modal-heading"><div><div className="eyebrow">{selectedCompany.legalName}</div><h2 id="employee-title">Agregar persona</h2><p>Registrá datos básicos del equipo.</p></div><button className="icon-button" aria-label="Cerrar" onClick={() => setEmployeeOpen(false)}>×</button></div><form onSubmit={createEmployee} noValidate><label>Nombre y apellido<input name="fullName" autoFocus placeholder="Ej. Nombre de prueba" /></label><label>CUIL<input name="cuil" inputMode="numeric" placeholder="20-00000000-0" /></label><label>Categoría o calificación<input name="category" placeholder="Ej. Administrativa" /></label><label>Fecha de ingreso<input name="startDate" type="date" /></label>{employeeError && <p className="form-error" role="alert">{employeeError}</p>}<div className="form-actions"><button type="button" className="secondary-button" onClick={() => setEmployeeOpen(false)}>Cancelar</button><button className="primary-button" type="submit">Guardar persona</button></div></form></section></div>}
    </main>
  );
}
