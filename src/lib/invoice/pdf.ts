import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";
import { gstStateLabel } from "@/lib/constants/indian-states";
import type { Address, InvoiceData, InvoiceLine } from "./data";

/**
 * Invoice and packing slip PDFs (pdf-lib, standard Helvetica). Documents are in English — the
 * standard fonts cover Latin-1 only, so other scripts are replaced rather than failing.
 */

const PAGE: [number, number] = [595.28, 841.89]; // A4
const MARGIN = 36;
const RIGHT = PAGE[0] - MARGIN;
const WIDTH = RIGHT - MARGIN;
const INK = rgb(0.09, 0.09, 0.11);
const MUTED = rgb(0.42, 0.42, 0.46);
const RULE = rgb(0.82, 0.82, 0.85);
const HEADER_BG = rgb(0.95, 0.95, 0.96);

/** Makes text encodable by the standard PDF fonts (WinAnsi). */
export function pdfSafe(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/₹/g, "Rs.")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, "?");
}

const groupINR = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
/** Integer paise → "Rs. 1,23,456.78" without floating point. */
export function pdfMoney(paise: number): string {
  const sign = paise < 0 ? "-" : "";
  const abs = Math.abs(paise);
  return `${sign}Rs. ${groupINR.format(Math.floor(abs / 100))}.${String(abs % 100).padStart(2, "0")}`;
}
function amount(paise: number): string {
  return pdfMoney(paise).replace("Rs. ", "");
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(date);
}

type Align = "left" | "right";
type TextOpts = { size?: number; bold?: boolean; color?: ReturnType<typeof rgb>; align?: Align };

class Writer {
  page!: PDFPage;
  y = 0;
  private constructor(
    readonly doc: PDFDocument,
    readonly font: PDFFont,
    readonly bold: PDFFont,
  ) {}

  static async create(title: string): Promise<Writer> {
    const doc = await PDFDocument.create();
    doc.setTitle(pdfSafe(title));
    doc.setProducer("Neo Store");
    const w = new Writer(
      doc,
      await doc.embedFont(StandardFonts.Helvetica),
      await doc.embedFont(StandardFonts.HelveticaBold),
    );
    w.addPage();
    return w;
  }

  addPage() {
    this.page = this.doc.addPage(PAGE);
    this.y = PAGE[1] - MARGIN;
  }

  width(text: string, size: number, bold = false) {
    return (bold ? this.bold : this.font).widthOfTextAtSize(pdfSafe(text), size);
  }

  text(text: string, x: number, y: number, opts: TextOpts = {}) {
    const size = opts.size ?? 8.5;
    const safe = pdfSafe(text);
    const font = opts.bold ? this.bold : this.font;
    const dx = opts.align === "right" ? font.widthOfTextAtSize(safe, size) : 0;
    this.page.drawText(safe, { x: x - dx, y, size, font, color: opts.color ?? INK });
  }

  /** Splits text into lines that fit `maxWidth` (breaking long words if needed). */
  wrap(text: string, maxWidth: number, size: number, bold = false): string[] {
    const words = pdfSafe(text).split(" ").filter(Boolean);
    const lines: string[] = [];
    let line = "";
    for (let word of words) {
      while (this.width(word, size, bold) > maxWidth && word.length > 1) {
        let cut = word.length - 1;
        while (cut > 1 && this.width(word.slice(0, cut), size, bold) > maxWidth) cut -= 1;
        if (line) lines.push(line);
        lines.push(word.slice(0, cut));
        line = "";
        word = word.slice(cut);
      }
      const candidate = line ? `${line} ${word}` : word;
      if (this.width(candidate, size, bold) <= maxWidth) line = candidate;
      else {
        if (line) lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
    return lines.length ? lines : [""];
  }

  rule(y: number, x1 = MARGIN, x2 = RIGHT) {
    this.page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness: 0.6, color: RULE });
  }

  /** Page numbers and footer text on every page. */
  footer(note: string) {
    const pages = this.doc.getPages();
    pages.forEach((page, i) => {
      this.page = page;
      this.text(note, MARGIN, 20, { size: 7, color: MUTED });
      this.text(`Page ${i + 1} of ${pages.length}`, RIGHT, 20, {
        size: 7,
        color: MUTED,
        align: "right",
      });
    });
  }
}

type Column = { label: string; width: number; align: Align };

function drawTableHeader(w: Writer, columns: Column[]) {
  const h = 18;
  w.page.drawRectangle({
    x: MARGIN,
    y: w.y - h,
    width: WIDTH,
    height: h,
    color: HEADER_BG,
  });
  let x = MARGIN;
  for (const col of columns) {
    w.text(col.label, col.align === "right" ? x + col.width - 3 : x + 3, w.y - 12, {
      size: 7.5,
      bold: true,
      align: col.align,
    });
    x += col.width;
  }
  w.y -= h;
}

/**
 * Draws table rows; `cells` returns each column's lines (first line bold for the item column
 * is up to the caller). Starts a new page with the header repeated when space runs out.
 */
function drawRows<T>(
  w: Writer,
  columns: Column[],
  rows: T[],
  cells: (row: T, index: number) => { lines: string[]; muted?: string[] }[],
  bottom = 60,
) {
  drawTableHeader(w, columns);
  rows.forEach((row, index) => {
    const content = cells(row, index).map((c, i) => {
      const width = columns[i]!.width - 6;
      return {
        lines: c.lines.flatMap((l) => w.wrap(l, width, 8)),
        muted: (c.muted ?? []).flatMap((l) => w.wrap(l, width, 7)),
      };
    });
    const height = Math.max(...content.map((c) => c.lines.length * 10 + c.muted.length * 9)) + 8;
    if (w.y - height < bottom) {
      w.addPage();
      drawTableHeader(w, columns);
    }
    let x = MARGIN;
    content.forEach((c, i) => {
      const col = columns[i]!;
      const tx = col.align === "right" ? x + col.width - 3 : x + 3;
      let ty = w.y - 12;
      for (const line of c.lines) {
        w.text(line, tx, ty, { size: 8, align: col.align });
        ty -= 10;
      }
      for (const line of c.muted) {
        w.text(line, tx, ty, { size: 7, color: MUTED, align: col.align });
        ty -= 9;
      }
      x += col.width;
    });
    w.y -= height;
    w.rule(w.y);
  });
}

function addressLines(a: Address): string[] {
  return [
    a.line1,
    [a.line2, a.landmark].filter(Boolean).join(", "),
    `${a.city}, ${a.state} - ${a.pincode}`,
  ].filter(Boolean);
}

function sellerBlock(w: Writer, data: Pick<InvoiceData, "seller">, withTax: boolean): number {
  const s = data.seller;
  let y = w.y;
  w.text(s.legalName || s.name, MARGIN, y - 12, { size: 13, bold: true });
  y -= 26;
  const a = s.address;
  const lines = [
    a?.line1,
    a?.line2,
    [a?.city, a?.pincode].filter(Boolean).join(" - "),
    withTax && s.gstNumber ? `GSTIN: ${s.gstNumber}` : null,
    withTax && s.stateCode ? `State: ${gstStateLabel(s.stateCode)}` : null,
    [s.email, s.phone].filter(Boolean).join("  |  "),
  ].filter((l): l is string => !!l);
  for (const line of lines) {
    w.text(line, MARGIN, y, { size: 8.5, color: MUTED });
    y -= 11;
  }
  return y;
}

function keyValues(w: Writer, title: string, rows: [string, string][]): number {
  let y = w.y;
  w.text(title, RIGHT, y - 14, { size: 15, bold: true, align: "right" });
  y -= 30;
  for (const [key, value] of rows) {
    w.text(value, RIGHT, y, { size: 8.5, align: "right" });
    w.text(`${key}:`, RIGHT - w.width(value, 8.5) - 6, y, {
      size: 8.5,
      color: MUTED,
      align: "right",
    });
    y -= 11;
  }
  return y;
}

function shipToBlock(w: Writer, heading: string, a: Address, extra: string[], size = 8.5) {
  w.text(heading, MARGIN, w.y, { size: 7.5, bold: true, color: MUTED });
  w.y -= size + 5;
  w.text(a.name, MARGIN, w.y, { size: size + 0.5, bold: true });
  w.y -= size + 3;
  for (const line of [...addressLines(a), ...extra]) {
    for (const wrapped of w.wrap(line, 300, size)) {
      w.text(wrapped, MARGIN, w.y, { size });
      w.y -= size + 3;
    }
  }
}

function paymentText(data: InvoiceData): string {
  const o = data.order;
  if (o.paymentMethod === "COD")
    return `Cash on delivery (${o.paymentStatus === "CAPTURED" ? "collected" : "to be collected"})`;
  const status: Record<string, string> = {
    CAPTURED: "paid",
    PARTIALLY_REFUNDED: "paid, partly refunded",
    REFUNDED: "refunded",
  };
  return `Paid online (${status[o.paymentStatus] ?? o.paymentStatus.toLowerCase()})`;
}

export async function renderInvoicePdf(data: InvoiceData): Promise<Uint8Array> {
  const o = data.order;
  const registered = !!data.seller.gstNumber;
  const title = registered ? "TAX INVOICE" : "INVOICE";
  const w = await Writer.create(`${title} ${o.invoiceNumber ?? o.orderNumber}`);

  const leftEnd = sellerBlock(w, data, true);
  const rightEnd = keyValues(w, title, [
    ["Invoice No", o.invoiceNumber ?? "-"],
    ["Invoice Date", formatDate(o.invoicedAt ?? o.createdAt)],
    ["Order No", o.orderNumber],
    ["Order Date", formatDate(o.createdAt)],
    ["Place of Supply", data.placeOfSupply],
  ]);
  w.y = Math.min(leftEnd, rightEnd) - 6;
  w.rule(w.y);
  w.y -= 16;

  shipToBlock(w, "BILLED & SHIPPED TO", data.shipTo, [
    `Phone: ${o.customerPhone}`,
    ...(o.customerEmail ? [`Email: ${o.customerEmail}`] : []),
  ]);
  w.y -= 10;

  const taxCols: Column[] = data.interState
    ? [{ label: "IGST", width: 84, align: "right" }]
    : [
        { label: "CGST", width: 42, align: "right" },
        { label: "SGST", width: 42, align: "right" },
      ];
  const columns: Column[] = [
    { label: "#", width: 18, align: "left" },
    { label: "Item", width: 160, align: "left" },
    { label: "HSN/SAC", width: 44, align: "left" },
    { label: "Qty", width: 26, align: "right" },
    { label: "Rate", width: 52, align: "right" },
    { label: "Taxable", width: 58, align: "right" },
    { label: "GST %", width: 30, align: "right" },
    ...taxCols,
    { label: "Amount", width: 51, align: "right" },
  ];
  const pct = (bps: number) => `${(bps / 100).toFixed(bps % 100 ? 1 : 0)}%`;
  drawRows(w, columns, data.lines, (l: InvoiceLine, i) => [
    { lines: [String(i + 1)] },
    {
      lines: [l.description],
      muted: [l.details, l.discount ? `Discount: ${pdfMoney(l.discount)}` : ""].filter(Boolean),
    },
    { lines: [l.hsn || "-"] },
    { lines: [String(l.quantity)] },
    { lines: [amount(l.unitPrice)] },
    { lines: [amount(l.taxableValue)] },
    { lines: [pct(l.rateBps)] },
    ...(data.interState
      ? [{ lines: [amount(l.igst)] }]
      : [{ lines: [amount(l.cgst)] }, { lines: [amount(l.sgst)] }]),
    { lines: [amount(l.total)] },
  ]);

  // Totals + amount in words (kept together on one page).
  if (w.y < 190) w.addPage();
  w.y -= 14;
  const labelX = RIGHT - 110;
  const totals: [string, number, boolean][] = [
    ["Taxable value", data.totals.taxable, false],
    ...(data.interState
      ? ([["IGST", data.totals.igst, false]] as [string, number, boolean][])
      : ([
          ["CGST", data.totals.cgst, false],
          ["SGST", data.totals.sgst, false],
        ] as [string, number, boolean][])),
    ["Total", data.totals.total, true],
  ];
  const top = w.y;
  for (const [label, value, strong] of totals) {
    if (strong) {
      w.rule(w.y + 9, labelX - 60, RIGHT);
      w.y -= 4;
    }
    w.text(label, labelX, w.y, { size: strong ? 10 : 8.5, bold: strong, align: "right" });
    w.text(pdfMoney(value), RIGHT, w.y, { size: strong ? 10 : 8.5, bold: strong, align: "right" });
    w.y -= strong ? 14 : 12;
  }
  let wy = top;
  w.text("Amount in words", MARGIN, wy, { size: 7.5, bold: true, color: MUTED });
  wy -= 11;
  for (const line of w.wrap(data.amountInWords, 280, 8.5)) {
    w.text(line, MARGIN, wy, { size: 8.5 });
    wy -= 11;
  }
  wy -= 6;
  w.text(`Payment: ${paymentText(data)}`, MARGIN, wy, { size: 8.5 });
  wy -= 11;
  if (registered) {
    w.text("Tax payable under reverse charge: No", MARGIN, wy, { size: 8.5 });
    wy -= 11;
  }
  w.y = Math.min(w.y, wy) - 28;

  const seller = data.seller.legalName || data.seller.name;
  w.text(`For ${seller}`, RIGHT, w.y, { size: 8.5, bold: true, align: "right" });
  w.y -= 30;
  w.text("Authorised signatory", RIGHT, w.y, { size: 8, color: MUTED, align: "right" });

  w.footer("This is a computer-generated invoice and does not need a signature.");
  return w.doc.save();
}

export async function renderPackingSlipPdf(data: InvoiceData): Promise<Uint8Array> {
  const o = data.order;
  const w = await Writer.create(`Packing slip ${o.orderNumber}`);

  const leftEnd = sellerBlock(w, data, false);
  const rightEnd = keyValues(w, "PACKING SLIP", [
    ["Order No", o.orderNumber],
    ["Order Date", formatDate(o.createdAt)],
    ...(o.invoiceNumber ? ([["Invoice No", o.invoiceNumber]] as [string, string][]) : []),
  ]);
  w.y = Math.min(leftEnd, rightEnd) - 6;
  w.rule(w.y);
  w.y -= 18;

  shipToBlock(w, "SHIP TO", data.shipTo, [`Phone: ${data.shipTo.phone || o.customerPhone}`], 11);
  w.y -= 8;
  const cod = o.paymentMethod === "COD";
  w.text(
    cod ? `CASH ON DELIVERY - COLLECT ${pdfMoney(o.total)}` : "PREPAID - DO NOT COLLECT CASH",
    MARGIN,
    w.y,
    { size: 11, bold: true },
  );
  w.y -= 14;
  if (o.customerNote) {
    for (const line of w.wrap(`Customer note: ${o.customerNote}`, WIDTH, 8.5)) {
      w.text(line, MARGIN, w.y, { size: 8.5, color: MUTED });
      w.y -= 11;
    }
  }
  w.y -= 8;

  const items = o.items;
  const columns: Column[] = [
    { label: "#", width: 20, align: "left" },
    { label: "Item", width: 300, align: "left" },
    { label: "SKU", width: 120, align: "left" },
    { label: "Qty", width: 45, align: "right" },
    { label: "Packed", width: 38, align: "right" },
  ];
  const itemLines = data.lines.slice(0, items.length);
  drawRows(w, columns, itemLines, (l, i) => [
    { lines: [String(i + 1)] },
    {
      lines: [l.description],
      // Options only: the SKU has its own column here.
      muted: [l.details.replace(/(^| · )SKU .*$/, "")].filter(Boolean),
    },
    { lines: [items[i]!.sku] },
    { lines: [String(l.quantity)] },
    { lines: ["[   ]"] },
  ]);
  w.y -= 14;
  const units = items.reduce((s, i) => s + i.quantity, 0);
  w.text(`${items.length} item(s), ${units} unit(s) in total`, MARGIN, w.y, { size: 8.5 });

  w.footer(`Packing slip for order ${o.orderNumber}`);
  return w.doc.save();
}
