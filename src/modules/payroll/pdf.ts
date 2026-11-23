import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";

export type ReceiptPdfItem = {
  /** Código del concepto (ej. 3001). Opcional. */
  code?: string | number;
  description: string;
  itemType: "employer_contribution" | "remuneration" | "deduction";
  categoryLabel?: string;
  calculationBase: number | null;
  /** Legacy: ya no se imprime. */
  unit: string | null;
  /** Columna "Und." (días, porcentaje, cantidad). Opcional. */
  quantity?: number | null;
  /** Solo para remuneraciones. Si no se informa, se infiere por la descripción ("no remunerativa"). */
  remunerative?: boolean;
  amount: number;
};

export type ReceiptPdfData = {
  companyName: string;
  taxId: string;
  address: string;
  employeeName: string;
  cuil: string;
  category: string;
  cctCode: string;
  weeklyHours: number;
  seniorityYears: number;
  startDate: string;
  periodLabel: string; // "MM/AAAA"
  paymentDate: string;
  paymentLocation: string;
  items: ReceiptPdfItem[];
  netEstimate: number;
  finalized: boolean;
  approvedAt: string | null;
  // ── Opcionales (formato Taval) ──
  logo?: Uint8Array; // PNG o JPG
  legajo?: string | number;
  fortnight?: string | number; // columna "Q"
  basicSalary?: number; // "Básico/Jornal"; por defecto, el primer concepto remunerativo
  seniorityMonths?: number;
  socialChargesDeposit?: { date: string; period: string; bank: string };
  observations?: string;
};

// ───────────────────────── Constantes de layout ─────────────────────────
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const L = 28;
const R = PAGE_WIDTH - 28;
const W = R - L;
const FRAME_TOP = 30;
const CONTENT_BOTTOM = PAGE_HEIGHT - 32; // límite inferior (distancia desde arriba)
const ROW_H = 11;
const BAR_H = 15;
const CELL_H = 13;
const FONT = 8;
const DETAIL_ROW_H = 13.5;
const SIG_H = 54;

const DESC_W = W - 32 - 42 - 131 - 90;
const E = { code0: L, desc0: L + 32, und0: L + 32 + DESC_W, base0: L + 32 + DESC_W + 42, monto0: R - 90 };

const BLACK = rgb(0, 0, 0);
const GRAY = rgb(0.851, 0.851, 0.851);
const MUTED = rgb(0.4, 0.4, 0.4);
const GREEN = rgb(0.28, 0.43, 0.29);
const AMBER = rgb(0.62, 0.42, 0.12);

type Cat = "Sindical" | "Seguridad social" | "Obra social" | "INSSJP" | "ART" | "SCVO" | "Cámaras" | "Otros";
const CATEGORY_ORDER: Cat[] = ["Sindical", "Seguridad social", "Obra social", "INSSJP", "ART", "SCVO", "Cámaras", "Otros"];
const BASE_CATEGORIES: Cat[] = ["Sindical", "Seguridad social", "Obra social", "INSSJP", "ART", "SCVO"];
const PIE_ORDER: Cat[] = ["ART", "INSSJP", "SCVO", "Sindical", "Obra social", "Seguridad social", "Cámaras", "Otros"];
const DETAIL_TITLE: Record<Cat, string> = {
  Sindical: "Total Costo Sindical", "Seguridad social": "Total Seguridad Social", "Obra social": "Total Obra Social",
  INSSJP: "Total Costo INSSJP", ART: "Total Costo ART", SCVO: "Total Costo SCVO", Cámaras: "Total Cámaras", Otros: "Total Otros",
};
const LEGEND_NAME: Record<Cat, string> = {
  Sindical: "Costo Sindical", "Seguridad social": "Seguridad Social", "Obra social": "Obra Social",
  INSSJP: "Costo INSSJP", ART: "Costo ART", SCVO: "Costo SCVO", Cámaras: "Cámaras", Otros: "Otros",
};
const CAT_COLORS: Record<Cat | "Neto", string> = {
  ART: "#3b6bb5", INSSJP: "#f2a54a", SCVO: "#2e9e5b", Sindical: "#e0572b", "Obra social": "#a3245b",
  "Seguridad social": "#ffd166", Cámaras: "#9b8bb5", Otros: "#b8b8b8", Neto: "#2a7a8c",
};

// Formato numérico como en el recibo de referencia (1,234.56). Cambiar a "es-AR" para 1.234,56.
const NUMBER_LOCALE = "en-US";
const NUM = new Intl.NumberFormat(NUMBER_LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ───────────────────────── Utilidades ─────────────────────────
function pdfColor(hex: string) {
  const v = hex.replace("#", "");
  return rgb(parseInt(v.slice(0, 2), 16) / 255, parseInt(v.slice(2, 4), 16) / 255, parseInt(v.slice(4, 6), 16) / 255);
}

const strip = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

function categoryOf(item: ReceiptPdfItem): Cat {
  const label = item.categoryLabel ? strip(item.categoryLabel) : "";
  const direct = CATEGORY_ORDER.find((c) => strip(c) === label);
  if (direct) return direct;
  const d = strip(item.description);
  if (/sindical|solidaria|promocion social|faecys/.test(d)) return "Sindical";
  if (/inssjp|19032|pami/.test(d)) return "INSSJP";
  if (/obra social|osecac/.test(d)) return "Obra social";
  if (/jubilacion|sipa|anses|fondo nacional|seguridad social|asig/.test(d)) return "Seguridad social";
  if (/\bart\b|a\.r\.t/.test(d)) return "ART";
  if (/scvo|seguro.*vida/.test(d)) return "SCVO";
  if (/camara/.test(d)) return "Cámaras";
  return "Otros";
}

function formatDate(v: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : v;
}

function formatCuit(v: string): string {
  const d = v.replace(/\D/g, "");
  return d.length === 11 ? `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}` : v;
}

function fit(s: string, font: PDFFont, size: number, maxW: number): string {
  if (font.widthOfTextAtSize(s, size) <= maxW) return s;
  let out = s;
  while (out.length > 1 && font.widthOfTextAtSize(`${out}…`, size) > maxW) out = out.slice(0, -1);
  return `${out}…`;
}

function wrap(value: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  let current = "";
  for (const word of value.split(/\s+/).filter(Boolean)) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else current = candidate;
  }
  if (current) lines.push(current);
  return lines;
}

// ── Importe en letras ("Dos Millones Trescientos ... y Siete") ──
const UNITS = ["", "Uno", "Dos", "Tres", "Cuatro", "Cinco", "Seis", "Siete", "Ocho", "Nueve", "Diez", "Once", "Doce", "Trece", "Catorce", "Quince", "Dieciséis", "Diecisiete", "Dieciocho", "Diecinueve", "Veinte", "Veintiuno", "Veintidós", "Veintitrés", "Veinticuatro", "Veinticinco", "Veintiséis", "Veintisiete", "Veintiocho", "Veintinueve"];
const TENS = ["", "", "", "Treinta", "Cuarenta", "Cincuenta", "Sesenta", "Setenta", "Ochenta", "Noventa"];
const HUNDREDS = ["", "Ciento", "Doscientos", "Trescientos", "Cuatrocientos", "Quinientos", "Seiscientos", "Setecientos", "Ochocientos", "Novecientos"];

function below100(n: number, apocope: boolean): string {
  if (n < 30) {
    if (apocope && n === 1) return "Un";
    if (apocope && n === 21) return "Veintiún";
    return UNITS[n];
  }
  const t = Math.floor(n / 10);
  const u = n % 10;
  if (u === 0) return TENS[t];
  return `${TENS[t]} y ${apocope && u === 1 ? "Un" : UNITS[u]}`;
}
function below1000(n: number, apocope: boolean): string {
  if (n === 0) return "";
  if (n === 100) return "Cien";
  const h = Math.floor(n / 100);
  const r = n % 100;
  return [HUNDREDS[h], r ? below100(r, apocope) : ""].filter(Boolean).join(" ");
}
function amountInWords(value: number): string {
  const totalCents = Math.round(Math.abs(value) * 100);
  const int = Math.floor(totalCents / 100);
  const cents = totalCents % 100;
  if (int >= 1_000_000_000) return NUM.format(value);
  const millions = Math.floor(int / 1_000_000);
  const thousands = Math.floor((int % 1_000_000) / 1000);
  const rest = int % 1000;
  const parts: string[] = [];
  if (millions) parts.push(millions === 1 ? "Un Millón" : `${below1000(millions, true)} Millones`);
  if (thousands) parts.push(thousands === 1 ? "Mil" : `${below1000(thousands, true)} Mil`);
  if (rest) parts.push(below1000(rest, false));
  const words = parts.length ? parts.join(" ") : "Cero";
  return cents ? `${words} con ${String(cents).padStart(2, "0")}/100` : words;
}

type Align = "left" | "center" | "right";
type Row = { code: string; description: string; quantity: number | null; base: number | null; amount: number };

// ───────────────────────── Generador ─────────────────────────
export async function createReceiptPdf(data: ReceiptPdfData): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  document.setTitle(`Recibo ${data.finalized ? "final" : "borrador"} ${data.periodLabel} - ${data.employeeName}`);
  document.setSubject(data.finalized ? "Recibo aprobado por el contador del estudio" : "Documento de trabajo sujeto a revisión profesional");
  document.setCreator("Estudio - Gestión Contable");
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);

  let logoImage: PDFImage | undefined;
  if (data.logo?.length) {
    try {
      const isPng = data.logo[0] === 0x89 && data.logo[1] === 0x50;
      logoImage = isPng ? await document.embedPng(data.logo) : await document.embedJpg(data.logo);
    } catch {
      logoImage = undefined;
    }
  }

  // ── Datos derivados ──
  const sum = (xs: ReceiptPdfItem[]) => xs.reduce((s, i) => s + i.amount, 0);
  const contributions = data.items.filter((i) => i.itemType === "employer_contribution");
  const remunerations = data.items.filter((i) => i.itemType === "remuneration");
  const deductions = data.items.filter((i) => i.itemType === "deduction");
  const isNonRem = (i: ReceiptPdfItem) => i.remunerative === false || (i.remunerative === undefined && /no\s+remunerativ/i.test(i.description));
  const remunerativeTotal = sum(remunerations.filter((i) => !isNonRem(i)));
  const nonRemTotal = sum(remunerations.filter(isNonRem));
  const gross = remunerativeTotal + nonRemTotal;
  const deductionsTotal = sum(deductions);
  const contributionsTotal = sum(contributions);
  const employerCost = gross + contributionsTotal;

  const emp = Object.fromEntries(CATEGORY_ORDER.map((c) => [c, 0])) as Record<Cat, number>;
  const wrk = Object.fromEntries(CATEGORY_ORDER.map((c) => [c, 0])) as Record<Cat, number>;
  contributions.forEach((i) => (emp[categoryOf(i)] += i.amount));
  deductions.forEach((i) => (wrk[categoryOf(i)] += i.amount));
  const categories = CATEGORY_ORDER.filter((c) => BASE_CATEGORIES.includes(c) || emp[c] + wrk[c] !== 0);
  const perCol = Math.ceil(categories.length / 2);

  const toRow = (i: ReceiptPdfItem): Row => ({
    code: i.code != null ? String(i.code) : "",
    description: i.description,
    quantity: i.quantity ?? null,
    base: i.calculationBase,
    amount: i.amount,
  });
  const contributionRows = contributions.map(toRow);
  const conceptRows = [...remunerations, ...deductions].map(toRow);

  const [month, year = ""] = data.periodLabel.split("/");
  const basic = data.basicSalary ?? remunerations[0]?.amount ?? 0;
  const statusText = data.finalized ? "FINALIZADO POR CONTADOR" : "BORRADOR - PENDIENTE DE REVISIÓN PROFESIONAL";
  const statusColor = data.finalized ? GREEN : AMBER;
  const statusNote = data.finalized
    ? `Aprobado por contador del estudio el ${data.approvedAt ?? "fecha pendiente"}. Firma y pago no registrados.`
    : "Importes y bases sujetos a revisión profesional. No es un recibo legal ni acredita pago.";
  const obsText = [data.observations, statusNote].filter(Boolean).join(" ");
  const obsLines = wrap(obsText, regular, 7.5, W - 8).slice(0, 3);

  const detailH = Math.max(perCol * 3 * DETAIL_ROW_H, 112) + 14;
  const frameBottomH = BAR_H + CELL_H + 1 + 16 + 19 + BAR_H + detailH + 15;
  const BOTTOM_H = frameBottomH + 6 + 12 + obsLines.length * 9.5 + 6 + SIG_H;

  // ── Estado de dibujo (t = distancia desde el borde superior) ──
  const pages: PDFPage[] = [];
  let page!: PDFPage;
  let t = FRAME_TOP;
  let frameTop = FRAME_TOP;
  let segTop = 0;

  const Y = (top: number) => PAGE_HEIGHT - top;
  const line = (x1: number, t1: number, x2: number, t2: number, thickness = 0.6) =>
    page.drawLine({ start: { x: x1, y: Y(t1) }, end: { x: x2, y: Y(t2) }, thickness, color: BLACK });
  const box = (x: number, top: number, w: number, h: number, fill?: ReturnType<typeof rgb>, bw = 0.6) =>
    page.drawRectangle({ x, y: Y(top + h), width: w, height: h, borderColor: BLACK, borderWidth: bw, ...(fill ? { color: fill } : {}) });
  const drawText = (s: string, x: number, baseline: number, size = FONT, font = regular, color = BLACK) =>
    page.drawText(s, { x, y: Y(baseline), size, font, color });
  const drawTextRight = (s: string, right: number, baseline: number, size = FONT, font = regular, color = BLACK) =>
    drawText(s, right - font.widthOfTextAtSize(s, size), baseline, size, font, color);
  const drawTextCenter = (s: string, cx: number, baseline: number, size = FONT, font = regular, color = BLACK) =>
    drawText(s, cx - font.widthOfTextAtSize(s, size) / 2, baseline, size, font, color);
  const cell = (s: string, x1: number, x2: number, top: number, h: number, o: { size?: number; font?: PDFFont; align?: Align; pad?: number; color?: ReturnType<typeof rgb> } = {}) => {
    const size = o.size ?? FONT;
    const font = o.font ?? regular;
    const pad = o.pad ?? 4;
    const w = font.widthOfTextAtSize(s, size);
    const x = o.align === "right" ? x2 - pad - w : o.align === "center" ? (x1 + x2) / 2 - w / 2 : x1 + pad;
    drawText(s, x, top + h / 2 + size * 0.35, size, font, o.color ?? BLACK);
  };

  const closeFrame = (tEnd: number) => box(L, frameTop, W, tEnd - frameTop, undefined, 1.1);

  const newPage = (continuation: boolean) => {
    page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    pages.push(page);
    frameTop = FRAME_TOP;
    t = FRAME_TOP;
    page.drawText(statusText, { x: L, y: PAGE_HEIGHT - 18, size: 7.5, font: bold, color: statusColor });
    if (continuation) {
      box(L, t, W, 18, GRAY);
      cell(`${data.companyName} - Recibo de sueldo ${data.periodLabel} - ${data.employeeName.toUpperCase()} (continuación)`, L, R, t, 18, { font: bold, size: 8.5, align: "center" });
      t += 18;
    }
  };
  const ensure = (h: number) => {
    if (t + h > CONTENT_BOTTOM - 8) {
      closeFrame(t);
      newPage(true);
    }
  };

  // ── Bloques ──
  const drawHeader = () => {
    const headerH = 88;
    let textX = L + 12;
    if (logoImage) {
      const dims = logoImage.scaleToFit(150, 76);
      const top = t + 6 + (76 - dims.height) / 2;
      page.drawImage(logoImage, { x: L + 10, y: Y(top + dims.height), width: dims.width, height: dims.height });
      textX = L + 176;
    }
    drawText(data.companyName, textX, t + 28, 14, bold);
    drawText(data.address, textX, t + 46, 9);
    drawText(`CUIT: ${formatCuit(data.taxId)}`, textX, t + 60, 9);
    t += headerH;
  };

  const gridRow = (cells: { w: number; text: string }[], header: boolean) => {
    const h = CELL_H;
    let x = L;
    for (const c of cells) {
      box(x, t, c.w, h, header ? GRAY : undefined);
      cell(fit(c.text, header ? bold : regular, FONT, c.w - 6), x, x + c.w, t, h, { font: header ? bold : regular, align: "center" });
      x += c.w;
    }
    t += h;
  };

  const tableHeader = () => {
    const cols: [number, number, string][] = [
      [E.code0, E.desc0, "Código"], [E.desc0, E.und0, "Descripción"], [E.und0, E.base0, "Und."], [E.base0, E.monto0, "Base"], [E.monto0, R, "Monto"],
    ];
    for (const [x1, x2, label] of cols) {
      box(x1, t, x2 - x1, CELL_H, GRAY);
      cell(label, x1, x2, t, CELL_H, { font: bold, align: "center" });
    }
    t += CELL_H;
  };

  const bar = (label: string, amount: number, labelFrom: number) => {
    box(L, t, W, BAR_H, GRAY);
    line(E.monto0, t, E.monto0, t + BAR_H);
    if (labelFrom > L) line(labelFrom, t, labelFrom, t + BAR_H);
    cell(label, labelFrom, E.monto0, t, BAR_H, { font: bold, size: 8.5, align: "center" });
    cell(NUM.format(amount), E.monto0, R, t, BAR_H, { font: bold, size: 8.5, align: "right", pad: 7 });
    t += BAR_H;
  };

  const startSegment = () => { segTop = t; };
  const endSegment = () => {
    for (const x of [E.desc0, E.und0, E.base0, E.monto0]) line(x, segTop, x, t);
  };
  const drawRow = (r: Row) => {
    if (t + ROW_H > CONTENT_BOTTOM - 8) {
      endSegment();
      closeFrame(t);
      newPage(true);
      tableHeader();
      startSegment();
    }
    if (r.code) cell(r.code, E.code0, E.desc0, t, ROW_H, { align: "right" });
    cell(fit(r.description, regular, FONT, E.und0 - E.desc0 - 8), E.desc0, E.und0, t, ROW_H);
    if (r.quantity != null) cell(NUM.format(r.quantity), E.und0, E.base0, t, ROW_H, { align: "right", pad: 10 });
    if (r.base != null) cell(NUM.format(r.base), E.base0, E.monto0, t, ROW_H, { align: "right", pad: 18 });
    cell(NUM.format(r.amount), E.monto0, R, t, ROW_H, { align: "right", pad: 7 });
    t += ROW_H;
  };

  const drawPie = (values: number[], colors: string[], cx: number, cyTop: number, radius: number) => {
    const total = values.reduce((s, v) => s + Math.max(v, 0), 0);
    if (total <= 0) {
      page.drawCircle({ x: cx, y: Y(cyTop), size: radius, color: rgb(0.88, 0.9, 0.88) });
      return;
    }
    let angle = -Math.PI / 2;
    values.forEach((v, i) => {
      if (v <= 0) return;
      const next = angle + (v / total) * Math.PI * 2;
      const steps = Math.max(3, Math.ceil((next - angle) * 20));
      const pts = Array.from({ length: steps + 1 }, (_, s) => {
        const a = angle + ((next - angle) * s) / steps;
        return `${(radius * Math.cos(a)).toFixed(2)} ${(radius * Math.sin(a)).toFixed(2)}`;
      });
      page.drawSvgPath(`M 0 0 L ${pts.join(" L ")} Z`, { x: cx, y: Y(cyTop), color: pdfColor(colors[i]) });
      angle = next;
    });
  };

  const drawBottom = () => {
    // Composición salarial
    box(L, t, W, BAR_H, GRAY);
    cell("COMPOSICIÓN SALARIAL", L, L + 180, t, BAR_H, { font: bold, size: 8.5, pad: 12 });
    const cx = [L + 225, L + 350, L + 474];
    ["Remunerativo", "No Remunerativo", "Descuentos"].forEach((lab, i) => drawTextCenter(lab, cx[i], t + BAR_H / 2 + 3, 8.5, bold));
    t += BAR_H;
    box(L, t, W, CELL_H + 1);
    [remunerativeTotal, nonRemTotal, deductionsTotal].forEach((v, i) => drawTextCenter(NUM.format(v), cx[i], t + (CELL_H + 1) / 2 + 3, 8.5, bold));
    t += CELL_H + 1;

    // Sueldo neto
    const netH = 16;
    const netX = L + 363;
    box(L, t, W, netH);
    box(netX, t, E.monto0 - netX, netH, GRAY);
    cell("SUELDO NETO", netX, E.monto0, t, netH, { font: bold, size: 8.5, align: "center" });
    box(E.monto0, t, R - E.monto0, netH);
    cell(NUM.format(data.netEstimate), E.monto0, R, t, netH, { font: bold, size: 9, align: "right", pad: 7 });
    t += netH;

    // Son pesos
    box(L, t, W, 19);
    const label = "Son Pesos: ";
    const labelW = regular.widthOfTextAtSize(label, 8.5);
    drawText(label, L + 4, t + 12.5, 8.5);
    const words = fit(amountInWords(data.netEstimate), regular, 8.5, W - labelW - 12);
    drawText(words, L + 4 + labelW, t + 12.5, 8.5);
    const wordsEnd = L + 4 + labelW + regular.widthOfTextAtSize(words, 8.5);
    if (wordsEnd + 10 < L + 405) line(wordsEnd + 6, t + 14.5, L + 405, t + 14.5, 0.5);
    t += 19;

    // Detalle de la composición salarial
    box(L, t, W, BAR_H, GRAY);
    cell("Detalle de la composición salarial", L, R, t, BAR_H, { font: bold, size: 8.5, align: "center" });
    t += BAR_H;
    const dTop = t;
    const colCats = [categories.slice(0, perCol), categories.slice(perCol)];
    const colX = [L + 8, L + 170];
    const colRight = [L + 150, L + 318];
    colCats.forEach((cats, c) => {
      cats.forEach((cat, i) => {
        const base = dTop + 14 + i * 3 * DETAIL_ROW_H;
        drawText(DETAIL_TITLE[cat], colX[c], base, 8, bold);
        drawTextRight(NUM.format(emp[cat] + wrk[cat]), colRight[c], base, 8, bold);
        drawText("Empleador:", colX[c], base + DETAIL_ROW_H, 8);
        drawTextRight(NUM.format(emp[cat]), colRight[c], base + DETAIL_ROW_H, 8);
        drawText("Trabajador:", colX[c], base + DETAIL_ROW_H * 2, 8);
        drawTextRight(NUM.format(wrk[cat]), colRight[c], base + DETAIL_ROW_H * 2, 8);
      });
    });
    // Torta + leyenda
    const legend: { name: string; color: string; value: number }[] = PIE_ORDER
      .filter((c) => BASE_CATEGORIES.includes(c) || emp[c] + wrk[c] !== 0)
      .map((c) => ({ name: LEGEND_NAME[c], color: CAT_COLORS[c], value: emp[c] + wrk[c] }));
    legend.push({ name: "Sueldo Neto", color: CAT_COLORS.Neto, value: Math.max(data.netEstimate, 0) });
    const pieTotal = legend.reduce((s, e) => s + Math.max(e.value, 0), 0);
    drawTextCenter("Costo Total del Empleador", L + 442, dTop + 14, 9, bold);
    drawPie(legend.map((e) => e.value), legend.map((e) => e.color), L + 392, dTop + 68, 32);
    legend.forEach((e, i) => {
      const base = dTop + 34 + i * 8.6;
      page.drawRectangle({ x: L + 432, y: Y(base), width: 5, height: 5, color: pdfColor(e.color) });
      drawText(e.name, L + 441, base + 4, 6);
      drawTextRight(`${(pieTotal > 0 ? (Math.max(e.value, 0) / pieTotal) * 100 : 0).toFixed(2)}%`, R - 8, base + 4, 6);
    });
    const totalBase = dTop + 34 + legend.length * 8.6;
    drawText("Total:", L + 441, totalBase + 4, 6);
    drawTextRight(pieTotal > 0 ? "100.00%" : "0.00%", R - 8, totalBase + 4, 6);
    t = dTop + detailH;

    // Nota
    line(L, t, R, t);
    drawText("Nota: Seguridad social de empleador incluye SIPA, Fondo Nacional de Empleo y Asignaciones familiares", L + 4, t + 10, 7.5);
    t += 15;
    closeFrame(t);

    // Observaciones + firmas
    t += 6;
    drawText("Observaciones:", L + 4, t + 8, 8, bold);
    obsLines.forEach((ln, i) => drawText(ln, L + 4, t + 18 + i * 9.5, 7.5, regular, MUTED));
    t += 12 + obsLines.length * 9.5 + 6;
    const sigW = 231;
    [[L, "Firma del Empleado"], [R - sigW, "Firma del Empleador"]].forEach(([x, lab]) => {
      const bx = x as number;
      box(bx, t, sigW, SIG_H, undefined, 0.8);
      line(bx + sigW / 2 - 50, t + SIG_H - 16, bx + sigW / 2 + 50, t + SIG_H - 16, 0.6);
      drawTextCenter(lab as string, bx + sigW / 2, t + SIG_H - 6, 8);
    });
    t += SIG_H;
  };

  // ───────── Armado ─────────
  newPage(false);
  drawHeader();

  gridRow([
    { w: 18, text: "Q" }, { w: 25, text: "Mes" }, { w: 31, text: "Año" }, { w: W - 295, text: "Apellido y Nombre" },
    { w: 46, text: "N°Legajo" }, { w: 83, text: "Básico/Jornal" }, { w: 92, text: "Antigüedad" },
  ], true);
  gridRow([
    { w: 18, text: data.fortnight != null ? String(data.fortnight) : "" }, { w: 25, text: month }, { w: 31, text: year },
    { w: W - 295, text: data.employeeName.toUpperCase() }, { w: 46, text: data.legajo != null ? String(data.legajo) : "" },
    { w: 83, text: NUM.format(basic) }, { w: 92, text: `${data.seniorityYears} año/s y ${data.seniorityMonths ?? 0} mes/es` },
  ], false);
  gridRow([{ w: 70, text: "Fecha Ingreso" }, { w: 215, text: "Categoría Laboral" }, { w: 85, text: "CUIL" }, { w: W - 370, text: "Lugar de Pago" }], true);
  gridRow([
    { w: 70, text: formatDate(data.startDate) }, { w: 215, text: [data.category, data.cctCode].filter(Boolean).join(" - ") },
    { w: 85, text: formatCuit(data.cuil) }, { w: W - 370, text: data.paymentLocation },
  ], false);

  // Fila de último depósito / fecha de pago
  box(L, t, W, 15);
  if (data.socialChargesDeposit) {
    const d = data.socialChargesDeposit;
    cell("Último depósito Cargas Sociales", L, L + 150, t, 15, { font: bold, pad: 3 });
    cell(`Fecha:  ${formatDate(d.date)}`, L + 160, L + 250, t, 15, { pad: 0 });
    cell(`Lapso:  ${d.period}`, L + 262, L + 340, t, 15, { pad: 0 });
    cell(`Banco: ${d.bank}`, L + 352, R, t, 15, { pad: 0 });
  } else {
    cell("Fecha de pago:", L, L + 80, t, 15, { font: bold, pad: 3 });
    cell(formatDate(data.paymentDate), L + 80, L + 200, t, 15, { pad: 0 });
  }
  t += 15;

  bar("COSTO TOTAL EMPLEADOR", employerCost, L);
  tableHeader();
  startSegment();
  contributionRows.forEach(drawRow);
  endSegment();

  ensure(BAR_H * 2 + CELL_H + ROW_H * 2);
  bar("SUBTOTAL CONTRIBUCIONES EMPLEADOR", contributionsTotal, L);
  bar("SUELDO BRUTO", gross, E.base0);
  tableHeader();
  startSegment();
  conceptRows.forEach(drawRow);
  const room = CONTENT_BOTTOM - (t + BOTTOM_H) - 4;
  t += room > 0 ? Math.min(room, 200) : 0;
  endSegment();

  if (t + BOTTOM_H > CONTENT_BOTTOM) {
    closeFrame(t);
    newPage(true);
  }
  drawBottom();

  // Pie de página
  pages.forEach((p, index) => {
    const footer = `${data.finalized ? "Recibo final aprobado" : "Borrador de trabajo"} | ${data.periodLabel} | Página ${index + 1} de ${pages.length}`;
    const w = regular.widthOfTextAtSize(footer, 7);
    p.drawText(footer, { x: (PAGE_WIDTH - w) / 2, y: 14, size: 7, font: regular, color: MUTED });
  });

  return document.save();
}