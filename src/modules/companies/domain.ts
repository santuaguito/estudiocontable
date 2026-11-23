export type ServiceType = "LIQUIDACION_SUELDOS" | "BALANCE" | "AMBOS";

export type Company = {
  id: string;
  legalName: string;
  taxId: string;
  address: string;
  serviceType: ServiceType;
  fiscalYearEnd: string;
  active: boolean;
};

export type Employee = {
  id: string;
  companyId: string;
  fullName: string;
  cuil: string;
  category: string;
  startDate: string;
  baseSalary: number;
  active: boolean;
};

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

function checkDigitFor(firstTenDigits: string): number {
  const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const sum = weights.reduce((total, weight, index) => {
    return total + Number(firstTenDigits[index]) * weight;
  }, 0);
  const checkDigit = 11 - (sum % 11);
  return checkDigit === 11 ? 0 : checkDigit;
}

function hasValidArgentineIdentifierCheckDigit(value: string, kind: "CUIT" | "CUIL"): boolean {
  const digits = digitsOnly(value);
  if (digits.length !== 11 || /^0+$/.test(digits)) return false;

  const prefix = digits.slice(0, 2);
  const validPrefixes = kind === "CUIT"
    ? ["20", "23", "24", "27", "30", "33", "34"]
    : ["20", "23", "24", "27"];
  if (!validPrefixes.includes(prefix)) return false;

  const expected = checkDigitFor(digits.slice(0, 10));
  if (expected !== 10) return Number(digits[10]) === expected;
  if (prefix === "23") {
    const middle = digits.slice(2, 10);
    return (
      checkDigitFor(`20${middle}`) === 10 && digits[10] === "9"
    ) || (
      checkDigitFor(`27${middle}`) === 10 && digits[10] === "4"
    );
  }
  if (prefix === "33" && checkDigitFor(`30${digits.slice(2, 10)}`) === 10) {
    return digits[10] === "9";
  }
  return false;
}

export function isValidTaxId(value: string): boolean {
  return hasValidArgentineIdentifierCheckDigit(value, "CUIT");
}

export function isValidCuil(value: string): boolean {
  return hasValidArgentineIdentifierCheckDigit(value, "CUIL");
}

export function validateCompany(
  input: Omit<Company, "id" | "active">,
  existingTaxIds: string[],
): string[] {
  const errors: string[] = [];
  const taxId = digitsOnly(input.taxId);

  if (!input.legalName.trim()) errors.push("Ingresá la razón social.");
  if (!isValidTaxId(taxId)) errors.push("El CUIT debe tener 11 dígitos y un dígito verificador válido.");
  if (existingTaxIds.some((existing) => digitsOnly(existing) === taxId)) {
    errors.push("Ya existe una empresa con ese CUIT.");
  }
  if (!input.address.trim()) errors.push("Ingresá el domicilio fiscal.");
  if (input.serviceType !== "LIQUIDACION_SUELDOS" && !input.fiscalYearEnd) {
    errors.push("Indicá la fecha de cierre del ejercicio para empresas con servicio de balance.");
  }

  return errors;
}

export function validateEmployee(
  input: Omit<Employee, "id" | "active">,
  existingCuils: string[] = [],
): string[] {
  const errors: string[] = [];
  if (!input.fullName.trim()) errors.push("Ingresá el nombre y apellido.");
  if (!isValidCuil(input.cuil)) errors.push("El CUIL debe tener 11 dígitos y un dígito verificador válido.");
  if (existingCuils.some((existing) => digitsOnly(existing) === digitsOnly(input.cuil))) {
    errors.push("Ya existe una persona con ese CUIL.");
  }
  if (!input.category.trim()) errors.push("Ingresá la categoría o calificación profesional.");
  if (!input.startDate) errors.push("Ingresá la fecha de ingreso.");
  if (!Number.isFinite(input.baseSalary) || input.baseSalary < 0 || Math.round(input.baseSalary * 100) !== input.baseSalary * 100) {
    errors.push("Ingresá un sueldo básico no negativo con hasta dos decimales.");
  }
  return errors;
}

export function parseBaseSalary(value: string): number | null {
  const normalized = value.trim().replace(/\s/g, "").replace(/\.(?=\d{3}(?:\D|$))/g, "").replace(",", ".");
  if (!/^(?:\d+)(?:\.\d{1,2})?$/.test(normalized)) return null;
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount >= 0 ? Math.round(amount * 100) / 100 : null;
}

export function formatIdentifier(value: string): string {
  const digits = digitsOnly(value);
  if (digits.length !== 11) return value;
  return `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10)}`;
}
