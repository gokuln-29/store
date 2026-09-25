import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { buildInvoiceData, type InvoiceData, type InvoiceSeller } from "@/lib/invoice/data";
import { renderInvoicePdf, renderPackingSlipPdf } from "@/lib/invoice/pdf";
import { getStoreSettingsFresh } from "./settings.service";

const orderSelect = {
  orderNumber: true,
  invoiceNumber: true,
  invoicedAt: true,
  createdAt: true,
  customerName: true,
  customerPhone: true,
  customerEmail: true,
  shippingAddress: true,
  customerNote: true,
  shippingTotal: true,
  codFee: true,
  taxTotal: true,
  total: true,
  pricesIncludeTax: true,
  taxBreakup: true,
  paymentMethod: true,
  paymentStatus: true,
  items: {
    orderBy: { id: "asc" },
    select: {
      productName: true,
      sku: true,
      optionValues: true,
      unitPrice: true,
      quantity: true,
      taxRateBps: true,
      hsnCode: true,
      taxAmount: true,
      discountAmount: true,
      lineTotal: true,
    },
  },
} satisfies Prisma.OrderSelect;

async function seller(): Promise<InvoiceSeller> {
  const s = await getStoreSettingsFresh();
  return {
    name: s.name,
    legalName: s.legalName,
    gstNumber: s.gstNumber,
    stateCode: s.stateCode,
    address: (s.businessAddress ?? null) as InvoiceSeller["address"],
    email: s.contactEmail,
    phone: s.contactPhone,
  };
}

async function load(where: Prisma.OrderWhereInput): Promise<InvoiceData | null> {
  const order = await db.order.findFirst({ where, select: orderSelect });
  return order ? buildInvoiceData(order, await seller()) : null;
}

const fileSafe = (value: string) => value.replace(/[^A-Za-z0-9-]/g, "_");

/**
 * The GST invoice of an order, once it has shipped. Customers only get their own orders
 * (`userId`); staff pass `userId: null`.
 */
export async function invoicePdf(
  orderNumber: string,
  userId: string | null,
): Promise<{ filename: string; pdf: Uint8Array } | null> {
  const data = await load({
    orderNumber,
    invoiceNumber: { not: null },
    ...(userId ? { userId } : {}),
  });
  if (!data) return null;
  return {
    filename: `invoice-${fileSafe(data.order.invoiceNumber!)}.pdf`,
    pdf: await renderInvoicePdf(data),
  };
}

/** Packing slip (no prices) for staff. Available for any order not awaiting payment. */
export async function packingSlipPdf(
  orderNumber: string,
): Promise<{ filename: string; pdf: Uint8Array } | null> {
  const data = await load({ orderNumber, status: { not: "PENDING_PAYMENT" } });
  if (!data) return null;
  return {
    filename: `packing-slip-${fileSafe(data.order.orderNumber)}.pdf`,
    pdf: await renderPackingSlipPdf(data),
  };
}
