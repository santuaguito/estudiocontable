import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Home from "./page";
import type { Database } from "@/lib/supabase/database.types";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

vi.mock("@/lib/supabase/client", () => ({ getSupabaseBrowserClient: vi.fn() }));

const user = { id: "user-test", email: "user@example.invalid" };
const membership = { studio_id: "studio-test" };
const companyRow = {
  id: "company-test", studio_id: "studio-test", legal_name: "Compañía ficticia",
  tax_id: "30000000007", address: "Domicilio de prueba", service_type: "balance" as const,
  fiscal_year_end: "2026-12-31", active: true, created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};
const employeeRow = {
  id: "employee-test", studio_id: "studio-test", company_id: "company-test",
  full_name: "Persona ficticia", cuil: "20000000001", category: "Administrativa",
  start_date: "2026-01-10", active: true, created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

function createFakeSupabase(options: { authenticated?: boolean } = {}) {
  const rows = { companies: [] as typeof companyRow[], employees: [] as typeof employeeRow[] };
  let authListener: (event: string, session: { user: typeof user } | null) => void = () => undefined;
  const client = {
    auth: {
      onAuthStateChange: vi.fn((listener: typeof authListener) => {
        authListener = listener;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      }),
      getUser: vi.fn().mockResolvedValue({ data: { user: options.authenticated === false ? null : user }, error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
      signInWithPassword: vi.fn().mockImplementation(async () => {
        authListener("SIGNED_IN", { user });
        return { error: null };
      }),
      signUp: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    },
    from: vi.fn((table: string) => {
      if (table === "studio_members") {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({ limit: () => ({ maybeSingle: async () => ({ data: membership, error: null }) }) }),
            }),
          }),
        };
      }
      const collection = table === "companies" ? rows.companies : rows.employees;
      const returnedRow = table === "companies" ? companyRow : employeeRow;
      return {
        select: () => ({
          eq: () => ({ order: async () => ({ data: collection, error: null }) }),
        }),
        insert: (values: unknown) => ({
          select: () => ({ single: async () => {
            const row = { ...returnedRow, ...(values as object) };
            collection.unshift(row as never);
            return { data: row, error: null };
          } }),
        }),
        update: () => ({ eq: () => ({ eq: async () => ({ error: null }) }) }),
      };
    }),
  };
  return { client, rows };
}

describe("gestión de clientes en Supabase", () => {
  beforeEach(() => {
    const { client } = createFakeSupabase();
    vi.mocked(getSupabaseBrowserClient).mockReturnValue(client as unknown as SupabaseClient<Database>);
  });

  it("guarda una empresa y su persona asociada", async () => {
    render(<Home />);
    await screen.findByText("Todavía no hay empresas");

    fireEvent.click(screen.getByRole("button", { name: /nueva empresa/i }));
    fireEvent.change(screen.getByLabelText("Razón social"), { target: { value: "Compañía ficticia" } });
    fireEvent.change(screen.getByLabelText("CUIT"), { target: { value: "30-00000000-7" } });
    fireEvent.change(screen.getByLabelText("Domicilio fiscal"), { target: { value: "Domicilio de prueba" } });
    fireEvent.change(screen.getByLabelText("Servicio"), { target: { value: "BALANCE" } });
    fireEvent.change(screen.getByLabelText(/fecha de cierre/i), { target: { value: "2026-12-31" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar empresa" }));

    await waitFor(() => expect(screen.getAllByText("Compañía ficticia")).toHaveLength(2));
    expect(screen.getByText("30-00000000-7")).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /agregar persona/i }));
    fireEvent.change(screen.getByLabelText("Nombre y apellido"), { target: { value: "Persona ficticia" } });
    fireEvent.change(screen.getByLabelText("CUIL"), { target: { value: "20-00000000-1" } });
    fireEvent.change(screen.getByLabelText("Categoría o calificación"), { target: { value: "Administrativa" } });
    fireEvent.change(screen.getByLabelText("Fecha de ingreso"), { target: { value: "2026-01-10" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar persona" }));

    const peopleRow = await screen.findByText("Persona ficticia").then((element) => element.closest("tr"));
    expect(peopleRow).not.toBeNull();
    expect(within(peopleRow as HTMLElement).getByText("Administrativa")).not.toBeNull();
  });

  it("no inserta una empresa sin cierre de ejercicio para balance", async () => {
    render(<Home />);
    await screen.findByText("Todavía no hay empresas");
    fireEvent.click(screen.getByRole("button", { name: /nueva empresa/i }));
    fireEvent.change(screen.getByLabelText("Razón social"), { target: { value: "Compañía ficticia" } });
    fireEvent.change(screen.getByLabelText("CUIT"), { target: { value: "30-00000000-7" } });
    fireEvent.change(screen.getByLabelText("Domicilio fiscal"), { target: { value: "Domicilio de prueba" } });
    fireEvent.change(screen.getByLabelText("Servicio"), { target: { value: "BALANCE" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar empresa" }));
    expect(screen.getByRole("alert").textContent).toMatch(/cierre del ejercicio/i);
  });

  it("presenta el acceso cuando no hay sesión y entra tras autenticar", async () => {
    const { client } = createFakeSupabase({ authenticated: false });
    vi.mocked(getSupabaseBrowserClient).mockReturnValue(client as unknown as SupabaseClient<Database>);
    render(<Home />);

    fireEvent.change(await screen.findByLabelText("Correo electrónico"), { target: { value: "user@example.invalid" } });
    fireEvent.change(screen.getByLabelText("Contraseña"), { target: { value: "test-password-only" } });
    fireEvent.click(screen.getByRole("button", { name: "Ingresar" }));

    await screen.findByText("Todavía no hay empresas");
  });

  it("no habilita la gestión si falta la configuración del proyecto", () => {
    vi.mocked(getSupabaseBrowserClient).mockReturnValue(null);
    render(<Home />);
    expect(screen.getByRole("heading", { name: "Conectá tu proyecto Supabase" })).not.toBeNull();
  });
});
