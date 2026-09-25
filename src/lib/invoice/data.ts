import { gstStateLabel } from "@/lib/constants/indian-states";
import { mulDivRound, taxFromInclusive } from "@/lib/services/pricing";
import { localize } from "@/lib/utils/localized";
import { amountInWords } from "./words";

/** The order fields an invoice needs (all amounts in paise, as stored at purchase). */
export type InvoiceOrder = {
  orderNumber: string;
  invoiceNumber: string | null;
  invoicedAt: Date | null;
  createdAt: Date;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  shippingAddress: unknown;
  customerNote: string | null;
  shippingTotal: number;
  codFee: number;
  taxTotal: number;
  total: number;
  pricesIncludeTax: boolean;
  taxBreakup: unknown;
  paymentMethod: "ONLINE" | "COD";
  paymentStatus: string;
  items: {
    productName: unknown;
    sku: string;
    optionValues: unknown;
    unitPrice: number;
    quantity: number;
    taxRateBps: number;
    hsnCode: string | null;
    taxAmount: number;
    discountAmount: number;
    lineTotal: number;
  }[];
};

export type InvoiceSeller = {
  name: string;
  legalName: string | null;
  gstNumber: string | null;
  stateCode: string | null;
  address: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    pincode?: string;
  } | null;
  email: string | null;
  phone: string | null;
};

export type Address = {
  name: string;
  phone: string;
  line1: string;
  line2?: string | null;
  landmark?: string | null;
  city: string;
  state: string;
  stateCode?: string | null;
  pincode: string;
};

export type InvoiceLine = {
  description: string;
  details: string;
  hsn: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  taxableValue: number;
  rateBps: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
};

export type InvoiceData = {
  order: InvoiceOrder;
  seller: InvoiceSeller;
  shipTo: Address;
  interState: boolean;
  placeOfSupply: string;
  lines: InvoiceLine[];
  totals: { taxable: number; cgst: number; sgst: number; igst: number; total: number };
  amountInWords: string;
};

function split(tax: number, interState: boolean) {
  if (interState) return { cgst: 0, sgst: 0, igst: tax };
  const cgst = Math.floor(tax / 2);
  return { cgst, sgst: tax - cgst, igst: 0 };
}

function optionsText(value: unknown): string {
  if (!Array.isArray(value)) return "";
  return value
    .map((o: { label?: unknown; value?: unknown }) => {
      const label = localize(o.label, "en");
      const v = localize(o.value, "en") || String(o.value ?? "");
      return label ? `${label}: ${v}` : v;
    })
    .filter(Boolean)
    .join(", ");
}

/**
 * Builds GST invoice rows from an order snapshot. Items carry their own tax; shipping and the
 * COD fee share the rest of the order's tax (taxed at the highest item rate at checkout), so
 * every column adds up exactly to the stored order totals.
 */
export function buildInvoiceData(order: InvoiceOrder, seller: InvoiceSeller): InvoiceData {
  const shipTo = order.shippingAddress as Address;
  const breakup = order.taxBreakup as { cgst: number; sgst: number; igst: number } | null;
  const interState = breakup
    ? breakup.igst > 0 || (breakup.cgst === 0 && breakup.sgst === 0 && order.taxTotal > 0)
    : !seller.stateCode || seller.stateCode !== shipTo.stateCode;

  const lines: InvoiceLine[] = order.items.map((item) => ({
    description: localize(item.productName, "en") || item.sku,
    details: [optionsText(item.optionValues), `SKU ${item.sku}`].filter(Boolean).join(" · "),
    hsn: item.hsnCode ?? "",
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    discount: item.discountAmount,
    taxableValue: item.lineTotal - item.taxAmount,
    rateBps: item.taxRateBps,
    ...split(item.taxAmount, interState),
    total: item.lineTotal,
  }));

  const itemTax = order.items.reduce((s, i) => s + i.taxAmount, 0);
  const chargesTax = Math.max(0, order.taxTotal - itemTax);
  const chargeRate = order.items.reduce((m, i) => Math.max(m, i.taxRateBps), 0);
  const shippingTax =
    order.shippingTotal <= 0
      ? 0
      : order.codFee <= 0
        ? chargesTax
        : Math.min(
            chargesTax,
            order.pricesIncludeTax
              ? taxFromInclusive(order.shippingTotal, chargeRate)
              : order.shippingTotal - mulDivRound(order.shippingTotal, 10_000, 10_000 + chargeRate),
          );
  const charge = (description: string, total: number, tax: number): InvoiceLine => ({
    description,
    details: "",
    hsn: "996812", // SAC for courier services
    quantity: 1,
    unitPrice: total,
    discount: 0,
    taxableValue: total - tax,
    rateBps: tax > 0 ? chargeRate : 0,
    ...split(tax, interState),
    total,
  });
  if (order.shippingTotal > 0)
    lines.push(charge("Shipping charges", order.shippingTotal, shippingTax));
  if (order.codFee > 0) {
    lines.push({
      ...charge("Cash on delivery fee", order.codFee, chargesTax - shippingTax),
      hsn: "",
    });
  }

  const sum = (key: "taxableValue" | "cgst" | "sgst" | "igst" | "total") =>
    lines.reduce((s, l) => s + l[key], 0);
  return {
    order,
    seller,
    shipTo,
    interState,
    placeOfSupply: gstStateLabel(shipTo.stateCode) || shipTo.state,
    lines,
    totals: {
      taxable: sum("taxableValue"),
      cgst: sum("cgst"),
      sgst: sum("sgst"),
      igst: sum("igst"),
      total: sum("total"),
    },
    amountInWords: amountInWords(order.total),
  };
}
