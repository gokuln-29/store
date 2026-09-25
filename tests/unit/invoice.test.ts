import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { buildInvoiceData, type InvoiceOrder, type InvoiceSeller } from "@/lib/invoice/data";
import { pdfMoney, pdfSafe, renderInvoicePdf, renderPackingSlipPdf } from "@/lib/invoice/pdf";
import { amountInWords, numberToIndianWords } from "@/lib/invoice/words";
import { priceOrder, type PricingLine } from "@/lib/services/pricing";

describe("amount in words", () => {
  it("uses the Indian numbering system", () => {
    expect(numberToIndianWords(0)).toBe("Zero");
    expect(numberToIndianWords(19)).toBe("Nineteen");
    expect(numberToIndianWords(309)).toBe("Three Hundred Nine");
    expect(numberToIndianWords(1_00_000)).toBe("One Lakh");
    expect(numberToIndianWords(12_34_567)).toBe(
      "Twelve Lakh Thirty Four Thousand Five Hundred Sixty Seven",
    );
    expect(numberToIndianWords(1_00_00_001)).toBe("One Crore One");
  });

  it("includes paise", () => {
    expect(amountInWords(30900)).toBe("Rupees Three Hundred Nine Only");
    expect(amountInWords(30950)).toBe("Rupees Three Hundred Nine and Fifty Paise Only");
    expect(amountInWords(5)).toBe("Rupees Zero and Five Paise Only");
  });
});

describe("PDF text", () => {
  it("keeps Latin-1 and replaces what standard fonts can't draw", () => {
    expect(pdfSafe("Café “quoted” – ok")).toBe('Café "quoted" - ok');
    expect(pdfSafe("₹499")).toBe("Rs.499");
    expect(pdfSafe("சென்னை")).toMatch(/^\?+$/);
    expect(pdfSafe("line\nbreak")).toBe("line break");
  });

  it("formats money with Indian grouping and no floating point", () => {
    expect(pdfMoney(12345678)).toBe("Rs. 1,23,456.78");
    expect(pdfMoney(5)).toBe("Rs. 0.05");
    expect(pdfMoney(-100)).toBe("-Rs. 1.00");
  });
});

const seller: InvoiceSeller = {
  name: "Demo Store",
  legalName: "Demo Store Pvt Ltd",
  gstNumber: "29ABCDE1234F1Z5",
  stateCode: "KA",
  address: { line1: "1 MG Road", city: "Bengaluru", pincode: "560001" },
  email: "hello@demo.in",
  phone: "+919876543210",
};

/** Builds an order exactly like checkout does, from the real pricing engine. */
function orderFrom(opts: {
  lines: PricingLine[];
  inclusive: boolean;
  shipping: number;
  cod: boolean;
  destination: string;
  discounts?: number[];
}): InvoiceOrder {
  const price = priceOrder({
    lines: opts.lines,
    lineDiscounts: opts.discounts,
    settings: { pricesIncludeTax: opts.inclusive, storeStateCode: "KA", codFee: 4900 },
    shipping: { charge: opts.shipping },
    cod: opts.cod,
    destinationStateCode: opts.destination,
  });
  return {
    orderNumber: "DS-1001",
    invoiceNumber: "DS2627-0001",
    invoicedAt: new Date("2026-09-25T10:00:00Z"),
    createdAt: new Date("2026-09-24T10:00:00Z"),
    customerName: "Asha Rao",
    customerPhone: "+919876543210",
    customerEmail: null,
    shippingAddress: {
      name: "Asha Rao",
      phone: "+919876543210",
      line1: "12 Main Road",
      city: "Chennai",
      state: "Tamil Nadu",
      stateCode: opts.destination,
      pincode: "600020",
    },
    customerNote: null,
    shippingTotal: price.shippingTotal,
    codFee: price.codFee,
    taxTotal: price.taxTotal,
    total: price.total,
    pricesIncludeTax: opts.inclusive,
    taxBreakup: price.taxBreakup,
    paymentMethod: opts.cod ? "COD" : "ONLINE",
    paymentStatus: opts.cod ? "PENDING" : "CAPTURED",
    items: price.lines.map((l, i) => ({
      productName: { en: `Product ${i + 1}` },
      sku: `SKU-${i + 1}`,
      optionValues: [],
      unitPrice: l.unitPrice,
      quantity: l.quantity,
      taxRateBps: l.taxRateBps,
      hsnCode: "0901",
      taxAmount: l.taxAmount,
      discountAmount: l.discount,
      lineTotal: l.total,
    })),
  };
}

function seeded(seed: number) {
  let s = seed;
  return (max: number) => {
    s = (s * 1103515245 + 12345) % 2 ** 31;
    return s % max;
  };
}

describe("invoice data", () => {
  it("reconciles every column with the order totals (300 random orders)", () => {
    const rand = seeded(7);
    const rates = [0, 500, 1200, 1800, 2800];
    for (let n = 0; n < 300; n++) {
      const count = 1 + rand(4);
      const lines: PricingLine[] = Array.from({ length: count }, (_, i) => ({
        variantId: `v${i}`,
        productId: `p${i}`,
        categoryPath: [],
        unitPrice: 100 + rand(200_000),
        quantity: 1 + rand(5),
        taxRateBps: rates[rand(rates.length)]!,
        weightGrams: 100,
      }));
      const order = orderFrom({
        lines,
        inclusive: rand(2) === 0,
        shipping: rand(3) === 0 ? 0 : 1 + rand(10_000),
        cod: rand(2) === 0,
        destination: rand(2) === 0 ? "KA" : "TN",
        discounts: lines.map((l) => (rand(3) === 0 ? rand(l.unitPrice) : 0)),
      });
      const inv = buildInvoiceData(order, seller);
      const tax = inv.totals.cgst + inv.totals.sgst + inv.totals.igst;
      expect(inv.totals.total).toBe(order.total);
      expect(tax).toBe(order.taxTotal);
      expect(inv.totals.taxable + tax).toBe(order.total);
      for (const l of inv.lines) {
        expect(l.taxableValue + l.cgst + l.sgst + l.igst).toBe(l.total);
        expect(l.taxableValue).toBeGreaterThanOrEqual(0);
      }
      if (inv.interState) expect(inv.totals.cgst + inv.totals.sgst).toBe(0);
      else expect(inv.totals.igst).toBe(0);
    }
  });

  it("splits CGST/SGST within the state and uses IGST across states", () => {
    const lines: PricingLine[] = [
      {
        variantId: "v",
        productId: "p",
        categoryPath: [],
        unitPrice: 22000,
        quantity: 1,
        taxRateBps: 500,
        weightGrams: 250,
      },
    ];
    const local = buildInvoiceData(
      orderFrom({ lines, inclusive: true, shipping: 4000, cod: true, destination: "KA" }),
      seller,
    );
    expect(local.interState).toBe(false);
    expect(local.lines.map((l) => l.description)).toEqual([
      "Product 1",
      "Shipping charges",
      "Cash on delivery fee",
    ]);
    const other = buildInvoiceData(
      orderFrom({ lines, inclusive: true, shipping: 4000, cod: false, destination: "TN" }),
      seller,
    );
    expect(other.interState).toBe(true);
    expect(other.placeOfSupply).toBe("Tamil Nadu (33)");
    expect(other.amountInWords).toMatch(/^Rupees .* Only$/);
  });

  it("renders invoice and packing slip PDFs, paginating long orders", async () => {
    const lines: PricingLine[] = Array.from({ length: 40 }, (_, i) => ({
      variantId: `v${i}`,
      productId: `p${i}`,
      categoryPath: [],
      unitPrice: 9900 + i,
      quantity: 1 + (i % 3),
      taxRateBps: 1800,
      weightGrams: 100,
    }));
    const order = orderFrom({
      lines,
      inclusive: false,
      shipping: 5000,
      cod: true,
      destination: "TN",
    });
    order.items[0]!.productName = { en: "A very long product name ".repeat(6), ta: "தமிழ்" };
    order.customerNote = "Please call before delivery — சென்னை";
    const data = buildInvoiceData(order, seller);

    for (const bytes of [await renderInvoicePdf(data), await renderPackingSlipPdf(data)]) {
      expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe("%PDF-");
      const doc = await PDFDocument.load(bytes);
      expect(doc.getPageCount()).toBeGreaterThan(1);
    }
  });
});
