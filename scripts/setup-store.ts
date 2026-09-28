/**
 * First-run setup for a new client store: store settings, owner account, shipping and GST.
 * Creates no demo data. Run after migrations:
 *
 *   pnpm setup:store                 # asks questions
 *   pnpm setup:store --yes           # unattended, answers from SETUP_* variables (see below)
 *   pnpm setup:store --force         # run again on a store that is already set up
 *
 * In Docker: docker compose -f docker-compose.prod.yml run --rm migrate pnpm setup:store
 */
import { checkbox, confirm, input, password, select } from "@inquirer/prompts";
import type { ZodType } from "zod";
import en from "@/messages/en.json";
import { locales } from "@/i18n/routing";
import { INDIAN_STATES } from "@/lib/constants/indian-states";
import { db } from "@/lib/db";
import {
  isStoreSetUp,
  setupStore,
  storeSetupSchema,
  type StoreSetupInput,
} from "@/lib/services/store-setup.service";

const args = new Set(process.argv.slice(2));
const unattended = args.has("--yes");
const force = args.has("--force");

const LOCALE_NAMES: Record<(typeof locales)[number], string> = {
  en: "English",
  ta: "Tamil (தமிழ்)",
  kn: "Kannada (ಕನ್ನಡ)",
};

const errors = en.Errors as Record<string, string>;
const errorText = (key: string) => errors[key]?.replace(/\{\w+\}/g, "…") ?? key;
const fields = storeSetupSchema.shape;

/** inquirer validator from a zod field schema: true, or the translated error message. */
function check(schema: ZodType) {
  return (value: unknown) => {
    const result = schema.safeParse(value);
    return result.success || errorText(result.error.issues[0]?.message ?? "invalid");
  };
}

function env(name: string): string | undefined {
  const value = process.env[`SETUP_${name}`];
  return value === undefined || value === "" ? undefined : value;
}

async function ask(): Promise<StoreSetupInput> {
  console.log("\nStore\n─────");
  const storeName = await input({
    message: "Store name",
    default: env("STORE_NAME"),
    validate: check(fields.storeName),
  });
  const supportedLocales = await checkbox({
    message: "Languages shown in the store",
    choices: locales.map((l) => ({ value: l, name: LOCALE_NAMES[l], checked: true })),
    validate: (v) => v.length > 0 || errorText("localeRequired"),
  });
  const defaultLocale =
    supportedLocales.length === 1
      ? supportedLocales[0]!
      : await select({
          message: "Default language",
          choices: supportedLocales.map((l) => ({ value: l, name: LOCALE_NAMES[l] })),
        });
  console.log("  Currency: INR (₹). Prices, GST and payments are built for India.");

  console.log("\nOwner account (admin panel login)\n─────────────────────────────────");
  const ownerName = await input({
    message: "Owner name",
    default: env("OWNER_NAME"),
    validate: check(fields.ownerName),
  });
  const ownerEmail = await input({
    message: "Owner email",
    default: env("OWNER_EMAIL"),
    validate: check(fields.ownerEmail),
  });
  const ownerPassword = await password({
    message: "Owner password (at least 10 characters)",
    mask: "•",
    validate: check(fields.ownerPassword),
  });
  await password({
    message: "Repeat the password",
    mask: "•",
    validate: (v) => v === ownerPassword || errorText("passwordMismatch"),
  });

  console.log("\nContact details shown to customers\n──────────────────────────────────");
  const contactEmail = await input({
    message: "Support email",
    default: env("CONTACT_EMAIL") ?? ownerEmail,
    validate: check(fields.contactEmail),
  });
  const contactPhone = await input({
    message: "Support mobile number (10 digits)",
    default: env("CONTACT_PHONE"),
    validate: check(fields.contactPhone),
  });

  console.log("\nGST\n───");
  const stateCode = await select({
    message: "State where the business is registered",
    choices: INDIAN_STATES.map((s) => ({ value: s.code, name: s.name })),
    default: INDIAN_STATES.find((s) => s.code === env("STATE_CODE"))?.code,
    pageSize: 12,
  });
  const legalName = await input({
    message: "Legal business name for invoices (optional)",
    default: env("LEGAL_NAME"),
  });
  const gstNumber = await input({
    message: "GSTIN (optional, leave empty if not registered)",
    default: env("GST_NUMBER"),
    validate: check(fields.gstNumber),
  });
  const defaultTaxRate = await input({
    message: "Default GST rate in % (categories can override it)",
    default: env("TAX_RATE") ?? "18",
    validate: check(fields.defaultTaxRateBps),
  });
  const pricesIncludeTax = await confirm({
    message: "Do the prices you enter already include GST?",
    default: true,
  });

  console.log("\nCheckout and delivery\n─────────────────────");
  const codEnabled = await confirm({ message: "Offer cash on delivery?", default: true });
  const shippingRate = await input({
    message:
      "Delivery charge in ₹ (one rate for all of India; refine later in Settings → Shipping)",
    default: env("SHIPPING_RATE") ?? "50",
    validate: check(fields.shippingRate),
  });
  const freeShippingThreshold = await input({
    message: "Free delivery for orders above ₹ (optional)",
    default: env("FREE_SHIPPING_ABOVE") ?? "",
    validate: check(fields.freeShippingThreshold),
  });

  return {
    storeName,
    ownerName,
    ownerEmail,
    ownerPassword,
    supportedLocales,
    defaultLocale,
    contactEmail,
    contactPhone,
    legalName,
    gstNumber,
    stateCode: stateCode as StoreSetupInput["stateCode"],
    pricesIncludeTax,
    defaultTaxRateBps: defaultTaxRate,
    codEnabled,
    shippingRate,
    freeShippingThreshold,
  };
}

function fromEnv(): StoreSetupInput {
  const list = (env("LOCALES") ?? locales.join(",")).split(",").map((s) => s.trim());
  return {
    storeName: env("STORE_NAME") ?? "",
    ownerName: env("OWNER_NAME") ?? "Store Owner",
    ownerEmail: env("OWNER_EMAIL") ?? "",
    ownerPassword: env("OWNER_PASSWORD") ?? "",
    supportedLocales: list as StoreSetupInput["supportedLocales"],
    defaultLocale: (env("DEFAULT_LOCALE") ?? list[0]) as StoreSetupInput["defaultLocale"],
    contactEmail: env("CONTACT_EMAIL") ?? env("OWNER_EMAIL") ?? "",
    contactPhone: env("CONTACT_PHONE") ?? "",
    legalName: env("LEGAL_NAME") ?? "",
    gstNumber: env("GST_NUMBER") ?? "",
    stateCode: (env("STATE_CODE") ?? "") as StoreSetupInput["stateCode"],
    pricesIncludeTax: env("PRICES_INCLUDE_TAX") !== "false",
    defaultTaxRateBps: env("TAX_RATE") ?? "18",
    codEnabled: env("COD") !== "false",
    shippingRate: env("SHIPPING_RATE") ?? "50",
    freeShippingThreshold: env("FREE_SHIPPING_ABOVE") ?? "",
  };
}

/**
 * Pages cached by a running app still show the store as it was before setup. Ask the app to
 * re-render them, then visit each language once so the next shopper gets the fresh page.
 */
async function refreshAppCache(localesToWarm: readonly string[]): Promise<boolean> {
  const base = process.env.APP_INTERNAL_URL ?? process.env.NEXT_PUBLIC_APP_URL;
  const secret = process.env.CRON_SECRET;
  if (!base || !secret) return false;
  try {
    const res = await fetch(`${base}/api/internal/revalidate`, {
      method: "POST",
      headers: { authorization: `Bearer ${secret}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return false;
    for (const locale of localesToWarm) {
      for (const page of ["", "/cart", "/wishlist", "/offline"]) {
        await fetch(`${base}/${locale}${page}`, { signal: AbortSignal.timeout(20_000) });
      }
    }
    return true;
  } catch {
    return false; // The app isn't running yet: nothing is cached, so nothing to refresh.
  }
}

async function main() {
  try {
    await isStoreSetUp().then((done) => {
      if (done && !force) {
        console.error(
          "This database already has a store owner or settings. Change them in the admin panel,\n" +
            "or run again with --force to overwrite the settings and the owner's password.",
        );
        process.exit(1);
      }
    });
  } catch (error) {
    console.error(
      "Can't read the database. Check DATABASE_URL and run migrations first " +
        "(pnpm prisma migrate deploy).\n",
      error instanceof Error ? error.message : error,
    );
    process.exit(1);
  }

  const answers = unattended ? fromEnv() : await ask();
  const result = await setupStore(answers, { force });
  if (!result.ok) {
    if (result.error === "validation") {
      for (const issue of result.issues)
        console.error(`  ${issue.path}: ${errorText(issue.message)}`);
    } else {
      console.error("The store is already set up. Use --force to overwrite.");
    }
    process.exit(1);
  }

  const refreshed = await refreshAppCache(answers.supportedLocales);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  console.log(`
✔ Store "${answers.storeName}" is set up.
  Owner ${result.ownerCreated ? "created" : "updated"}: ${answers.ownerEmail}
  Shipping rule: ${result.shippingRuleCreated ? "Standard delivery" : "kept existing rules"}
  Home page: ${result.homeSectionsCreated ? '"New arrivals" section' : "kept existing sections"}
  Cached pages: ${refreshed ? "refreshed" : "not refreshed (app not reachable); restart the app if it was already running"}

Next steps (docs/CLIENT_ONBOARDING.md):
  1. Sign in at ${appUrl}/${answers.defaultLocale}/admin/login
  2. Settings → Branding: logo, colours, fonts
  3. Catalog: categories and attributes, then Products → Import CSV
  4. Settings → Payments: switch on online payments once Razorpay live keys are set
`);
}

main()
  .catch((error: unknown) => {
    // Ctrl+C in a prompt.
    if (error instanceof Error && error.name === "ExitPromptError") process.exit(130);
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
