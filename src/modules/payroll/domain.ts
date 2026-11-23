import type { EmployerCostCategory, PayrollItemType } from "@/lib/supabase/database.types";

export type PayrollItemInput = {
  item_type: PayrollItemType;
  cost_category: EmployerCostCategory | null;
  description: string;
  calculation_base: number | null;
  unit: string | null;
  amount: number;
  calculation_note: string | null;
  rule_version: string | null;
  sort_order: number;
};

export const itemTypeLabels: Record<PayrollItemType, string> = {
  employer_contribution: "Contribuciones patronales",
  remuneration: "Remuneraciones",
  deduction: "Deducciones",
};

export const costCategoryLabels: Record<EmployerCostCategory, string> = {
  sindical: "Sindical",
  seguridad_social: "Seguridad social",
  obra_social: "Obra social",
  inssjp: "INSSJP",
  art: "ART",
  camaras: "Cámaras",
  otros: "Otros",
};

export function parseNonNegativeAmount(value: string): number | null {
  const normalized = value.trim().replace(/\s/g, "").replace(/\.(?=\d{3}(?:\D|$))/g, "").replace(",", ".");
  if (!/^(?:\d+)(?:\.\d{1,2})?$/.test(normalized)) return null;
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount >= 0 ? Math.round(amount * 100) / 100 : null;
}

export function addMoneyAmounts(values: number[]): number {
  return values.reduce((total, value) => total + Math.round(value * 100), 0) / 100;
}

export function formatARS(value: number): string {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(value);
}

export function arithmeticDraftNet(remunerations: number[], deductions: number[]): number {
  return addMoneyAmounts(remunerations) - addMoneyAmounts(deductions);
}
