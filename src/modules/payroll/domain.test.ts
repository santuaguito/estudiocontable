import { describe, expect, it } from "vitest";
import { addMoneyAmounts, arithmeticDraftNet, parseNonNegativeAmount } from "./domain";

describe("helpers de borradores de recibo", () => {
  it("interpreta importes con formato argentino y rechaza valores inválidos", () => {
    expect(parseNonNegativeAmount("1.234,56")).toBe(1234.56);
    expect(parseNonNegativeAmount("12,5")).toBe(12.5);
    expect(parseNonNegativeAmount("-10")).toBeNull();
    expect(parseNonNegativeAmount("1,234.56")).toBeNull();
  });

  it("suma centavos sin acumular errores binarios y calcula solo una vista aritmética", () => {
    expect(addMoneyAmounts([0.1, 0.2])).toBe(0.3);
    expect(arithmeticDraftNet([1000, 250.5], [100.25])).toBe(1150.25);
  });
});
