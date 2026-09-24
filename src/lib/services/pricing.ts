/**
 * Pricing engine — pure functions, all amounts in integer paise, rates in basis points.
 * This is the single source of truth for cart, checkout and order totals; the server always
 * recomputes with it and never trusts amounts sent by the browser.
 *
 * GST:
 * - Prices may include GST (tax is extracted) or exclude it (tax is added), per StoreSettings.
 * - Coupon discounts reduce the taxable value of the lines they apply to.
 * - Shipping and COD fee are taxed at the highest item rate in the order (composite supply).
 * - Same state as the store → CGST + SGST (half each); other state → IGST.
 */

// ───────────── Integer maths ─────────────

/** round(a * b / c) with half-up rounding, integers only (no floating point money). */
export function mulDivRound(a: number, b: number, c: number): number {
  if (c <= 0) throw new Error("Division by non-positive number");
  const product = a * b;
  if (!Number.isSafeInteger(product)) throw new Error("Amount too large");
  const q = Math.floor(product / c);
  const r = product - q * c;
  return r * 2 >= c ? q + 1 : q;
}

/** Tax contained in a tax-inclusive amount. */
export function taxFromInclusive(amount: number, rateBps: number): number {
  return rateBps <= 0 ? 0 : mulDivRound(amount, rateBps, 10_000 + rateBps);
}

/** Tax to add on top of a tax-exclusive amount. */
export function taxOnExclusive(amount: number, rateBps: number): number {
  return rateBps <= 0 ? 0 : mulDivRound(amount, rateBps, 10_000);
}

/**
 * Splits `total` across `weights` proportionally, so the parts always add up exactly
 * (largest-remainder method). Used to spread a coupon discount over cart lines.
 */
export function allocate(total: number, weights: number[]): number[] {
  const sum = weights.reduce((s, w) => s + w, 0);
  if (total <= 0 || sum <= 0) return weights.map(() => 0);
  const raw = weights.map((w) => (total * w) / sum);
  const parts = raw.map(Math.floor);
  let left = total - parts.reduce((s, p) => s + p, 0);
  const order = raw
    .map((value, index) => ({ index, frac: value - Math.floor(value) }))
    .sort((a, b) => b.frac - a.frac || a.index - b.index);
  for (const { index } of order) {
    if (left <= 0) break;
    parts[index]! += 1;
    left -= 1;
  }
  return parts;
}

// ───────────── Coupons ─────────────

export type CouponRule = {
  code: string;
  type: "PERCENTAGE" | "FLAT";
  /** bps for PERCENTAGE, paise for FLAT */
  value: number;
  minCartValue: number | null;
  maxDiscount: number | null;
  usageLimit: number | null;
  perUserLimit: number | null;
  usedCount: number;
  startsAt: Date | null;
  endsAt: Date | null;
  isActive: boolean;
  categoryIds: string[];
  productIds: string[];
};

export type CouponLine = {
  productId: string;
  /** The product's category and all its ancestors (restrictions include sub-categories). */
  categoryPath: string[];
  /** unit price × quantity, before discount */
  amount: number;
};

export type CouponRejection =
  | {
      reason:
        | "inactive"
        | "not_started"
        | "expired"
        | "usage_limit"
        | "per_user_limit"
        | "not_applicable";
    }
  | { reason: "min_cart_value"; minCartValue: number };

export type CouponResult =
  { ok: true; discount: number; perLine: number[] } | ({ ok: false } & CouponRejection);

/** Checks a coupon against a cart and works out the discount per line. */
export function evaluateCoupon(
  coupon: CouponRule,
  lines: CouponLine[],
  context: { now: Date; usedByCustomer: number },
): CouponResult {
  if (!coupon.isActive) return { ok: false, reason: "inactive" };
  if (coupon.startsAt && context.now < coupon.startsAt) return { ok: false, reason: "not_started" };
  if (coupon.endsAt && context.now > coupon.endsAt) return { ok: false, reason: "expired" };
  if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit)
    return { ok: false, reason: "usage_limit" };
  if (coupon.perUserLimit != null && context.usedByCustomer >= coupon.perUserLimit) {
    return { ok: false, reason: "per_user_limit" };
  }

  const cartTotal = lines.reduce((s, l) => s + l.amount, 0);
  if (coupon.minCartValue != null && cartTotal < coupon.minCartValue) {
    return { ok: false, reason: "min_cart_value", minCartValue: coupon.minCartValue };
  }

  const restricted = coupon.categoryIds.length > 0 || coupon.productIds.length > 0;
  const eligible = lines.map(
    (l) =>
      !restricted ||
      coupon.productIds.includes(l.productId) ||
      l.categoryPath.some((c) => coupon.categoryIds.includes(c)),
  );
  const base = lines.reduce((s, l, i) => s + (eligible[i] ? l.amount : 0), 0);
  if (base <= 0) return { ok: false, reason: "not_applicable" };

  let discount =
    coupon.type === "PERCENTAGE" ? mulDivRound(base, coupon.value, 10_000) : coupon.value;
  if (coupon.maxDiscount != null) discount = Math.min(discount, coupon.maxDiscount);
  discount = Math.min(discount, base);

  const perLine = allocate(
    discount,
    lines.map((l, i) => (eligible[i] ? l.amount : 0)),
  );
  return { ok: true, discount, perLine };
}

// ───────────── Order pricing ─────────────

export type PricingLine = {
  variantId: string;
  productId: string;
  categoryPath: string[];
  unitPrice: number;
  quantity: number;
  taxRateBps: number;
  weightGrams: number;
};

export type PricingSettings = {
  pricesIncludeTax: boolean;
  /** Store's state code (GST registration). Null = treat every sale as inter-state (IGST). */
  storeStateCode: string | null;
  codFee: number;
};

export type ShippingInput = { charge: number } | null;

export type PricedLine = PricingLine & {
  /** unitPrice × quantity */
  amount: number;
  discount: number;
  taxableValue: number;
  taxAmount: number;
  /** what the customer pays for this line (after discount, incl. tax) */
  total: number;
};

export type TaxBreakup = { cgst: number; sgst: number; igst: number };

export type PriceResult = {
  lines: PricedLine[];
  /** sum of line amounts before discount (as displayed prices) */
  subtotal: number;
  discountTotal: number;
  /** shipping incl. its tax */
  shippingTotal: number;
  /** COD fee incl. its tax */
  codFee: number;
  taxTotal: number;
  taxBreakup: TaxBreakup | null;
  total: number;
  /** subtotal − discount, used for minimum order and free-shipping thresholds */
  merchandiseTotal: number;
  totalWeightGrams: number;
  /** rate applied to shipping/COD fee */
  chargesTaxRateBps: number;
};

/** A charge (shipping/COD fee) priced like the store's products: tax-inclusive or not. */
function priceCharge(amount: number, rateBps: number, inclusive: boolean) {
  if (amount <= 0) return { total: 0, tax: 0 };
  if (inclusive) return { total: amount, tax: taxFromInclusive(amount, rateBps) };
  const tax = taxOnExclusive(amount, rateBps);
  return { total: amount + tax, tax };
}

export function splitTax(tax: number, intraState: boolean): TaxBreakup {
  if (!intraState) return { cgst: 0, sgst: 0, igst: tax };
  const cgst = Math.floor(tax / 2);
  return { cgst, sgst: tax - cgst, igst: 0 };
}

/**
 * Prices an order. `lineDiscounts` comes from evaluateCoupon (same order as `lines`).
 * `destinationStateCode` decides the GST split; unknown → no split (cart preview).
 */
export function priceOrder(input: {
  lines: PricingLine[];
  lineDiscounts?: number[];
  settings: PricingSettings;
  shipping: ShippingInput;
  cod: boolean;
  destinationStateCode: string | null;
}): PriceResult {
  const { settings } = input;
  const inclusive = settings.pricesIncludeTax;

  const lines: PricedLine[] = input.lines.map((line, i) => {
    const amount = line.unitPrice * line.quantity;
    const discount = Math.min(input.lineDiscounts?.[i] ?? 0, amount);
    const net = amount - discount;
    if (inclusive) {
      const taxAmount = taxFromInclusive(net, line.taxRateBps);
      return { ...line, amount, discount, taxableValue: net - taxAmount, taxAmount, total: net };
    }
    const taxAmount = taxOnExclusive(net, line.taxRateBps);
    return { ...line, amount, discount, taxableValue: net, taxAmount, total: net + taxAmount };
  });

  const chargesTaxRateBps = lines.reduce((max, l) => Math.max(max, l.taxRateBps), 0);
  const shipping = priceCharge(input.shipping?.charge ?? 0, chargesTaxRateBps, inclusive);
  const cod = priceCharge(input.cod ? settings.codFee : 0, chargesTaxRateBps, inclusive);

  const subtotal = lines.reduce((s, l) => s + l.amount, 0);
  const discountTotal = lines.reduce((s, l) => s + l.discount, 0);
  const lineTax = lines.reduce((s, l) => s + l.taxAmount, 0);
  const taxTotal = lineTax + shipping.tax + cod.tax;
  const linesTotal = lines.reduce((s, l) => s + l.total, 0);

  const taxBreakup =
    input.destinationStateCode == null
      ? null
      : splitTax(
          taxTotal,
          settings.storeStateCode != null && settings.storeStateCode === input.destinationStateCode,
        );

  return {
    lines,
    subtotal,
    discountTotal,
    shippingTotal: shipping.total,
    codFee: cod.total,
    taxTotal,
    taxBreakup,
    total: linesTotal + shipping.total + cod.total,
    merchandiseTotal: subtotal - discountTotal,
    totalWeightGrams: input.lines.reduce((s, l) => s + l.weightGrams * l.quantity, 0),
    chargesTaxRateBps,
  };
}

/** Effective GST rate: product override → category → store default. */
export function resolveTaxRate(
  product: number | null,
  category: number | null,
  storeDefault: number,
): number {
  return product ?? category ?? storeDefault;
}
