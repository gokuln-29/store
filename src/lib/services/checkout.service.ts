import { Prisma, type PaymentMethod } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { resolveFeatures } from "@/lib/features";
import { stateNameFromCode } from "@/lib/constants/indian-states";
import { getPaymentProvider } from "@/lib/providers/payment";
import type { AddressData } from "@/lib/validators/auth";
import {
  loadCartLines,
  toPricingLines,
  type CartAdjustment,
  type CartItemInput,
  type CartLine,
} from "./cart.service";
import { evaluateCoupon, priceOrder, type CouponRejection, type PriceResult } from "./pricing";
import { enqueueOrderNotification, scheduleNotificationDelivery } from "./notification.service";
import { ensurePaymentSession, expireOrder } from "./payment.service";
import { quote as quoteShipping, type ShippingQuote } from "./shipping.service";
import { getStoreSettingsFresh } from "./settings.service";
import { logger } from "@/lib/logger";

const log = logger("checkout");

type Tx = Prisma.TransactionClient;
type Client = Tx | typeof db;

export type CouponStatus =
  | { code: string; status: "applied"; discount: number }
  | ({ code: string; status: "rejected" } & (CouponRejection | { reason: "not_found" }));

export type CheckoutIssue =
  | { code: "cart_empty" }
  | { code: "min_order_value"; minOrderValue: number }
  | { code: "not_deliverable" }
  | { code: "cod_unavailable" }
  | { code: "online_unavailable" };

export type CheckoutQuote = {
  lines: CartLine[];
  adjustments: CartAdjustment[];
  price: PriceResult;
  shipping: ShippingQuote | null;
  coupon: CouponStatus | null;
  codAvailable: boolean;
  onlineAvailable: boolean;
  pricesIncludeTax: boolean;
  issues: CheckoutIssue[];
};

type Customer = { userId: string; phone: string | null } | null;

async function customerCouponUses(
  client: Client,
  couponId: string,
  customer: Customer,
): Promise<number> {
  if (!customer) return 0;
  return client.couponUsage.count({
    where: {
      couponId,
      OR: [{ userId: customer.userId }, ...(customer.phone ? [{ phone: customer.phone }] : [])],
    },
  });
}

/**
 * Prices a cart for checkout: coupon, shipping (for the destination), GST, COD fee and
 * everything that would stop the order. Used for the live summary and when placing the order.
 */
export async function buildQuote(
  input: {
    items: CartItemInput[];
    destination: { pincode: string; stateCode: string } | null;
    couponCode: string | null;
    paymentMethod: PaymentMethod | null;
    customer: Customer;
    now?: Date;
  },
  client: Client = db,
): Promise<CheckoutQuote> {
  const now = input.now ?? new Date();
  const [settings, { lines, adjustments }, rules] = await Promise.all([
    getStoreSettingsFresh(),
    loadCartLines(input.items, client),
    client.shippingRule.findMany({ where: { isActive: true } }),
  ]);
  const pricingLines = toPricingLines(lines);

  // Coupon
  let coupon: CouponStatus | null = null;
  let lineDiscounts: number[] | undefined;
  // Coupons switched off in Settings → Features: codes are ignored, never applied.
  const couponCode = resolveFeatures(settings.features).coupons ? input.couponCode : null;
  if (couponCode) {
    const row = await client.coupon.findUnique({ where: { code: couponCode } });
    if (!row) {
      coupon = { code: couponCode, status: "rejected", reason: "not_found" };
    } else {
      const result = evaluateCoupon(
        row,
        pricingLines.map((l) => ({
          productId: l.productId,
          categoryPath: l.categoryPath,
          amount: l.unitPrice * l.quantity,
        })),
        { now, usedByCustomer: await customerCouponUses(client, row.id, input.customer) },
      );
      if (result.ok) {
        coupon = { code: row.code, status: "applied", discount: result.discount };
        lineDiscounts = result.perLine;
      } else {
        const { ok: _ok, ...rejection } = result;
        coupon = { code: row.code, status: "rejected", ...rejection };
      }
    }
  }

  // Shipping is decided on the discounted merchandise value.
  const withoutCharges = priceOrder({
    lines: pricingLines,
    lineDiscounts,
    settings: {
      pricesIncludeTax: settings.pricesIncludeTax,
      storeStateCode: settings.stateCode,
      codFee: settings.codFee,
    },
    shipping: null,
    cod: false,
    destinationStateCode: input.destination?.stateCode ?? null,
  });
  const shipping = input.destination
    ? quoteShipping(rules, {
        pincode: input.destination.pincode,
        stateCode: input.destination.stateCode,
        subtotal: withoutCharges.merchandiseTotal,
        weightGrams: withoutCharges.totalWeightGrams,
      })
    : null;

  const beforeCod = priceOrder({
    lines: pricingLines,
    lineDiscounts,
    settings: {
      pricesIncludeTax: settings.pricesIncludeTax,
      storeStateCode: settings.stateCode,
      codFee: settings.codFee,
    },
    shipping: shipping ? { charge: shipping.charge } : null,
    cod: false,
    destinationStateCode: input.destination?.stateCode ?? null,
  });

  const codAvailable =
    settings.codEnabled &&
    (shipping?.codAvailable ?? true) &&
    (settings.codMinOrderValue == null || beforeCod.total >= settings.codMinOrderValue) &&
    (settings.codMaxOrderValue == null || beforeCod.total <= settings.codMaxOrderValue);
  const onlineAvailable = settings.onlinePaymentsEnabled;

  const price =
    input.paymentMethod === "COD" && codAvailable
      ? priceOrder({
          lines: pricingLines,
          lineDiscounts,
          settings: {
            pricesIncludeTax: settings.pricesIncludeTax,
            storeStateCode: settings.stateCode,
            codFee: settings.codFee,
          },
          shipping: shipping ? { charge: shipping.charge } : null,
          cod: true,
          destinationStateCode: input.destination?.stateCode ?? null,
        })
      : beforeCod;

  const issues: CheckoutIssue[] = [];
  if (lines.length === 0) issues.push({ code: "cart_empty" });
  if (lines.length && price.merchandiseTotal < settings.minOrderValue) {
    issues.push({ code: "min_order_value", minOrderValue: settings.minOrderValue });
  }
  if (input.destination && !shipping) issues.push({ code: "not_deliverable" });
  if (input.paymentMethod === "COD" && !codAvailable) issues.push({ code: "cod_unavailable" });
  if (input.paymentMethod === "ONLINE" && !onlineAvailable)
    issues.push({ code: "online_unavailable" });

  return {
    lines,
    adjustments,
    price,
    shipping,
    coupon,
    codAvailable,
    onlineAvailable,
    pricesIncludeTax: settings.pricesIncludeTax,
    issues,
  };
}

// ───────────── Placing the order ─────────────

export type PlaceOrderError =
  | { code: "cart_changed"; quote: CheckoutQuote }
  | { code: "total_changed"; quote: CheckoutQuote }
  | { code: "blocked"; quote: CheckoutQuote }
  | { code: "coupon_rejected"; quote: CheckoutQuote }
  | { code: "out_of_stock"; variantId: string }
  | { code: "address_not_found" };

export type PlaceOrderResult =
  | {
      ok: true;
      orderId: string;
      orderNumber: string;
      next: { type: "confirmation" } | { type: "redirect"; url: string };
    }
  | { ok: false; error: PlaceOrderError };

class CheckoutAbort extends Error {
  constructor(readonly detail: PlaceOrderError) {
    super(detail.code);
  }
}

/** "Demo Store" → "DS"; used when no order number prefix is configured. */
export function storeInitials(name: string): string {
  const initials = name
    .split(/\s+/)
    .map((w) => w.replace(/[^A-Za-z0-9]/g, "")[0] ?? "")
    .join("")
    .toUpperCase()
    .slice(0, 4);
  return initials || "ORD";
}

type AddressSnapshot = {
  name: string;
  phone: string;
  line1: string;
  line2: string | null;
  landmark: string | null;
  city: string;
  state: string;
  stateCode: string;
  pincode: string;
  country: string;
};

export async function placeOrder(input: {
  userId: string;
  items: CartItemInput[];
  address:
    { kind: "saved"; addressId: string } | { kind: "new"; address: AddressData; save: boolean };
  couponCode: string | null;
  paymentMethod: PaymentMethod;
  customerEmail: string | null;
  customerNote: string | null;
  expectedTotal: number;
  locale: string;
}): Promise<PlaceOrderResult> {
  const user = await db.user.findUniqueOrThrow({
    where: { id: input.userId },
    select: { id: true, name: true, phone: true, email: true },
  });

  let address: AddressSnapshot;
  if (input.address.kind === "saved") {
    const saved = await db.address.findFirst({
      where: { id: input.address.addressId, userId: user.id },
    });
    if (!saved) return { ok: false, error: { code: "address_not_found" } };
    address = {
      name: saved.name,
      phone: saved.phone,
      line1: saved.line1,
      line2: saved.line2,
      landmark: saved.landmark,
      city: saved.city,
      state: saved.state,
      stateCode: saved.stateCode,
      pincode: saved.pincode,
      country: saved.country,
    };
  } else {
    const a = input.address.address;
    address = {
      name: a.name,
      phone: a.phone,
      line1: a.line1,
      line2: a.line2,
      landmark: a.landmark,
      city: a.city,
      state: stateNameFromCode(a.stateCode) ?? a.stateCode,
      stateCode: a.stateCode,
      pincode: a.pincode,
      country: "IN",
    };
  }

  const settings = await getStoreSettingsFresh();
  const customer = { userId: user.id, phone: user.phone };

  let created: { id: string; orderNumber: string; total: number };
  try {
    created = await db.$transaction(
      async (tx) => {
        // Lock the coupon first so usage limits hold under concurrent checkouts.
        if (input.couponCode) {
          await tx.$queryRaw`SELECT id FROM "Coupon" WHERE code = ${input.couponCode} FOR UPDATE`;
        }

        const quote = await buildQuote(
          {
            items: input.items,
            destination: { pincode: address.pincode, stateCode: address.stateCode },
            couponCode: input.couponCode,
            paymentMethod: input.paymentMethod,
            customer,
          },
          tx,
        );
        if (quote.adjustments.length) throw new CheckoutAbort({ code: "cart_changed", quote });
        if (quote.issues.length) throw new CheckoutAbort({ code: "blocked", quote });
        if (quote.coupon && quote.coupon.status !== "applied")
          throw new CheckoutAbort({ code: "coupon_rejected", quote });
        if (quote.price.total !== input.expectedTotal)
          throw new CheckoutAbort({ code: "total_changed", quote });

        // Reserve stock: only succeeds if enough is left right now (atomic per row).
        for (const line of quote.lines) {
          const updated = await tx.$executeRaw`
            UPDATE "ProductVariant" SET stock = stock - ${line.quantity}, "updatedAt" = now()
            WHERE id = ${line.variantId} AND "isActive" = true AND stock >= ${line.quantity}`;
          if (updated !== 1)
            throw new CheckoutAbort({ code: "out_of_stock", variantId: line.variantId });
        }

        const [seq] = await tx.$queryRaw<{ n: bigint }[]>`SELECT nextval('order_number_seq') AS n`;
        if (!seq) throw new Error("order_number_seq returned no value");
        const orderNumber = `${settings.orderNumberPrefix ?? storeInitials(settings.name)}-${seq.n}`;
        const now = new Date();
        const isCod = input.paymentMethod === "COD";
        const price = quote.price;
        const couponRow =
          quote.coupon?.status === "applied"
            ? await tx.coupon.findUnique({
                where: { code: quote.coupon.code },
                select: { id: true },
              })
            : null;

        const order = await tx.order.create({
          data: {
            orderNumber,
            userId: user.id,
            status: isCod ? "PLACED" : "PENDING_PAYMENT",
            paymentStatus: "PENDING",
            paymentMethod: input.paymentMethod,
            customerName: address.name || user.name || "",
            customerPhone: user.phone ?? address.phone,
            customerEmail: input.customerEmail ?? user.email,
            shippingAddress: address as unknown as Prisma.InputJsonValue,
            subtotal: price.subtotal,
            discountTotal: price.discountTotal,
            shippingTotal: price.shippingTotal,
            codFee: price.codFee,
            taxTotal: price.taxTotal,
            total: price.total,
            currency: "INR",
            pricesIncludeTax: quote.pricesIncludeTax,
            taxBreakup: (price.taxBreakup ?? Prisma.DbNull) as Prisma.InputJsonValue,
            couponId: couponRow?.id ?? null,
            couponCode: quote.coupon?.status === "applied" ? quote.coupon.code : null,
            locale: input.locale,
            customerNote: input.customerNote,
            placedAt: isCod ? now : null,
            expiresAt: isCod
              ? null
              : new Date(now.getTime() + settings.pendingOrderTtlMinutes * 60_000),
            items: {
              create: quote.lines.map((line, i) => {
                const priced = price.lines[i]!;
                return {
                  productId: line.productId,
                  variantId: line.variantId,
                  productName: line.name as Prisma.InputJsonValue,
                  sku: line.sku,
                  optionValues: line.options as unknown as Prisma.InputJsonValue,
                  imageUrl: line.imageUrl,
                  unitPrice: line.unitPrice,
                  compareAtPrice: line.compareAtPrice,
                  quantity: line.quantity,
                  taxRateBps: line.taxRateBps,
                  hsnCode: line.hsnCode,
                  taxAmount: priced.taxAmount,
                  discountAmount: priced.discount,
                  lineTotal: priced.total,
                };
              }),
            },
            events: { create: { toStatus: isCod ? "PLACED" : "PENDING_PAYMENT", note: null } },
            payments: {
              create: {
                method: input.paymentMethod,
                provider: isCod ? "cod" : getPaymentProvider().name,
                amount: price.total,
              },
            },
          },
          select: { id: true, orderNumber: true, total: true },
        });

        if (couponRow) {
          await tx.couponUsage.create({
            data: {
              couponId: couponRow.id,
              orderId: order.id,
              userId: user.id,
              phone: user.phone,
              discountAmount: price.discountTotal,
            },
          });
          await tx.coupon.update({
            where: { id: couponRow.id },
            data: { usedCount: { increment: 1 } },
          });
        }

        if (input.address.kind === "new" && input.address.save) {
          const count = await tx.address.count({ where: { userId: user.id } });
          const { isDefault: _d, ...rest } = input.address.address;
          await tx.address.create({
            data: {
              ...rest,
              state: address.state,
              userId: user.id,
              country: "IN",
              isDefault: count === 0,
            },
          });
        }
        if (input.customerEmail && !user.email) {
          // Remember the email for next time if it's not used by another account.
          const taken = await tx.user.findFirst({
            where: { email: input.customerEmail, NOT: { id: user.id } },
            select: { id: true },
          });
          if (!taken)
            await tx.user.update({ where: { id: user.id }, data: { email: input.customerEmail } });
        }

        await tx.cartItem.deleteMany({ where: { cart: { userId: user.id } } });
        // Online orders are announced once the payment is captured.
        if (isCod) await enqueueOrderNotification(tx, order.id, "order_placed");
        return order;
      },
      { timeout: 20_000, maxWait: 10_000 },
    );
  } catch (error) {
    if (error instanceof CheckoutAbort) return { ok: false, error: error.detail };
    throw error;
  }

  if (input.paymentMethod === "COD") {
    await scheduleNotificationDelivery(created.id);
    return {
      ok: true,
      orderId: created.id,
      orderNumber: created.orderNumber,
      next: { type: "confirmation" },
    };
  }

  // Online: open a payment session with the provider (outside the order transaction). If the
  // provider is unavailable right now, the payment page retries.
  try {
    await ensurePaymentSession(created.id);
  } catch (error) {
    log.error("payment session failed", { orderNumber: created.orderNumber }, error);
  }
  return {
    ok: true,
    orderId: created.id,
    orderNumber: created.orderNumber,
    next: { type: "redirect", url: `/checkout/pay/${encodeURIComponent(created.orderNumber)}` },
  };
}

/** An order as its customer may see it (scoped to the customer). */
export async function getCustomerOrder(orderNumber: string, userId: string) {
  const find = () =>
    db.order.findFirst({
      where: { orderNumber, userId },
      include: { items: { orderBy: { id: "asc" } } },
    });
  const order = await find();
  // Expire an overdue unpaid order on the spot, even if the cron job hasn't run yet.
  if (order?.status === "PENDING_PAYMENT" && order.expiresAt && order.expiresAt <= new Date()) {
    return (await expireOrder(order.id)) === "skipped" ? order : find();
  }
  return order;
}
