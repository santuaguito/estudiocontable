import { describe, expect, it } from "vitest";
import { formatIdentifier, isValidCuil, isValidTaxId, validateCompany, validateEmployee } from "./domain";

describe("identificadores argentinos", () => {
  it("normaliza el formato sin cambiar los dígitos", () => {
    expect(formatIdentifier("30000000007")).toBe("30-00000000-7");
  });

  it("rechaza longitud y dígito verificador incorrectos", () => {
    expect(isValidTaxId("3000000000")).toBe(false);
    expect(isValidTaxId("30-00000000-0")).toBe(false);
    expect(isValidTaxId("30-00000000-7")).toBe(true);
    expect(isValidCuil("20-00000000-1")).toBe(true);
    expect(isValidCuil("30-00000000-7")).toBe(false);
  });

  it("rechaza un CUIL duplicado con distinto formato", () => {
    const input = {
      companyId: "company-1",
      fullName: "Persona ficticia",
      cuil: "20000000001",
      category: "Administrativa",
      startDate: "2026-01-10",
    };
    expect(validateEmployee(input, ["20-00000000-1"])).toContain(
      "Ya existe una persona con ese CUIL.",
    );
  });
});

describe("validación de empresa", () => {
  const validCompany = {
    legalName: "Empresa de prueba",
    taxId: "30000000007",
    address: "Domicilio de prueba",
    serviceType: "BALANCE" as const,
    fiscalYearEnd: "2026-12-31",
  };

  it("requiere cierre de ejercicio para balance", () => {
    expect(validateCompany({ ...validCompany, fiscalYearEnd: "" }, [])).toContain(
      "Indicá la fecha de cierre del ejercicio para empresas con servicio de balance.",
    );
  });

  it("rechaza CUIT duplicado comparando solo dígitos", () => {
    expect(validateCompany(validCompany, ["30-00000000-7"])).toContain(
      "Ya existe una empresa con ese CUIT.",
    );
  });

  it("acepta los datos completos para nómina sin exigir cierre", () => {
    const result = validateCompany(
      { ...validCompany, serviceType: "LIQUIDACION_SUELDOS", fiscalYearEnd: "" },
      [],
    );
    expect(result).toEqual([]);
  });
});
