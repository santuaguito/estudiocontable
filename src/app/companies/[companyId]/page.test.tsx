import { render, screen } from "@testing-library/react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Database } from "@/lib/supabase/database.types";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import CompanyWorkspacePage from "./page";

vi.mock("@/lib/supabase/client", () => ({ getSupabaseBrowserClient: vi.fn() }));
vi.mock("next/navigation", () => ({ useParams: () => ({ companyId: "company-test" }) }));

const company = {
  id: "company-test", studio_id: "studio-test", legal_name: "Empresa de prueba", tax_id: "30000000007",
  address: "Domicilio ficticio", service_type: "both" as const, fiscal_year_end: "2026-12-31",
  active: true, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
};
const employee = {
  id: "employee-test", studio_id: "studio-test", company_id: company.id, full_name: "Persona de prueba",
  cuil: "20000000001", category: "Administrativa", start_date: "2026-01-10", base_salary: 0, active: true,
  created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
};

function mockClient(serviceType: "payroll" | "balance" | "both") {
  const client = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-test", email: "test@example.invalid" } } }), signOut: vi.fn() },
    from: vi.fn((table: string) => ({
      select: () => ({ eq: () => table === "companies"
        ? { maybeSingle: async () => ({ data: { ...company, service_type: serviceType }, error: null }) }
        : { order: async () => ({ data: [employee], error: null }) },
      }),
    })),
  };
  return client;
}

describe("ficha de empresa y módulos habilitados", () => {
  beforeEach(() => vi.mocked(getSupabaseBrowserClient).mockReturnValue(mockClient("both") as unknown as SupabaseClient<Database>));

  it("muestra nómina, contabilidad, reportes, personal y perfil de convenio", async () => {
    render(<CompanyWorkspacePage />);
    expect(await screen.findByRole("heading", { name: "Empresa de prueba" })).not.toBeNull();
    expect(screen.getAllByRole("link", { name: /sueldos/i })[0].getAttribute("href")).toBe("/companies/company-test/payroll");
    expect(screen.getAllByText("Contabilidad").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Reportes").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Persona de prueba").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("heading", { name: "Perfil CCT 130/75" })).not.toBeNull();
    expect(screen.getByLabelText("Alícuota sindical (%)")).not.toBeNull();
  });

  it("omite el menú de nómina si la empresa no contrató ese servicio", async () => {
    vi.mocked(getSupabaseBrowserClient).mockReturnValue(mockClient("balance") as unknown as SupabaseClient<Database>);
    render(<CompanyWorkspacePage />);
    await screen.findByRole("heading", { name: "Empresa de prueba" });
    expect(screen.queryByRole("link", { name: /sueldos/i })).toBeNull();
    expect(screen.getAllByText("Contabilidad").length).toBeGreaterThan(0);
  });
});
