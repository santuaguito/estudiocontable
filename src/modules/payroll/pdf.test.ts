import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { createReceiptPdf } from "./pdf";

describe("createReceiptPdf", () => {
  it("returns a real PDF document with the receipt draft content", async () => {
    const bytes = await createReceiptPdf({
      companyName: "Comercio de Prueba S.A.", taxId: "30-12345678-9", address: "Córdoba 123",
      employeeName: "José Pérez", cuil: "20-12345678-9", category: "Administrativo A",
      cctCode: "Administrativo A", weeklyHours: 48, seniorityYears: 3, startDate: "2020-01-01",
      periodLabel: "11/2026", paymentDate: "Pendiente", paymentLocation: "Pendiente", netEstimate: 100,
      finalized: false, approvedAt: null,
      items: [
        ...(["Sindical", "Seguridad social", "Obra social", "INSSJP", "ART"] as const).map((categoryLabel) => ({ description: "Contribución patronal", itemType: "employer_contribution" as const, categoryLabel, calculationBase: 1000, unit: "ARS", amount: 100 })),
        ...["Sueldo básico", "Antigüedad", "Presentismo", "Suma no remunerativa", "Antigüedad no remunerativa", "Presentismo no remunerativo", "Suma única"].map((description) => ({ description, itemType: "remuneration" as const, calculationBase: 1000, unit: "ARS", amount: 1000 })),
        ...["Jubilación", "INSSJP", "Obra social", "Aporte sindical", "Cuota solidaria"].map((description) => ({ description, itemType: "deduction" as const, calculationBase: 1000, unit: "ARS", amount: 100 })),
      ],
    });

    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    const document = await PDFDocument.load(bytes);
    expect(document.getPageCount()).toBe(1);
  });

  it("marks approved receipts as final in the PDF metadata", async () => {
    const bytes = await createReceiptPdf({
      companyName: "Estudio", taxId: "30-12345678-9", address: "Dirección",
      employeeName: "Ana López", cuil: "27-12345678-9", category: "Administrativa",
      cctCode: "Administrativo A", weeklyHours: 48, seniorityYears: 1, startDate: "2020-01-01",
      periodLabel: "11/2026", paymentDate: "Pendiente", paymentLocation: "Pendiente", netEstimate: 0,
      finalized: true, approvedAt: "23/11/2026 10:30",
      items: [],
    });
    const document = await PDFDocument.load(bytes);
    expect(document.getTitle()).toContain("Recibo final");
  });
});
