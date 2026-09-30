/**
 * Demo seed: owner admin, store settings, 3 categories, 12 products, 3 coupons, 2 shipping rules.
 * Safe to re-run: everything is upserted by a stable key (slug, sku, code, id).
 *
 * Run: pnpm prisma db seed
 */
import { hash } from "@node-rs/argon2";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "../src/generated/prisma/client";
import {
  attributeDefinitionSchema,
  productAttributesSchema,
  productOptionsSchema,
  productVariantSchema,
  variantOptionValuesSchema,
} from "../src/lib/validators/catalog";
import { buildSearchText } from "../src/lib/utils/search-text";
import { productImageCount } from "./demo-images";
import { demoAdminCredentials, isDemoMode } from "../src/lib/demo-config";
import {
  banners,
  categories,
  homeSections,
  coupons,
  productImage,
  products,
  shippingRules,
  storeSettings,
} from "./seed-data";

try {
  process.loadEnvFile();
} catch {
  // Use the real environment.
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set");
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const DEV_OWNER_EMAIL = "owner@example.com";
const DEV_OWNER_PASSWORD = "ChangeMe@123";

function ownerCredentials() {
  const password = process.env.SEED_OWNER_PASSWORD ?? DEV_OWNER_PASSWORD;
  if (process.env.NODE_ENV === "production" && !process.env.SEED_OWNER_PASSWORD) {
    throw new Error("Set SEED_OWNER_PASSWORD when seeding in production.");
  }
  if (password.length < 10) throw new Error("SEED_OWNER_PASSWORD must be at least 10 characters.");
  return { password, isDefault: password === DEV_OWNER_PASSWORD };
}

async function seedOwner() {
  const email = (process.env.SEED_OWNER_EMAIL ?? DEV_OWNER_EMAIL).trim().toLowerCase();
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    // Never overwrite an existing password on re-seed.
    await db.user.update({ where: { email }, data: { role: "OWNER", isActive: true } });
    console.log(`  owner: ${email} (exists, password unchanged)`);
    return;
  }
  // A store set up another way (pnpm setup:store, the admin panel) already has its owner: keep it
  // instead of adding a second one. The demo admin is an owner too, so it doesn't count.
  if (!process.env.SEED_OWNER_EMAIL) {
    const owner = await db.user.findFirst({
      where: { role: "OWNER", email: { not: demoAdminCredentials().email } },
      select: { email: true },
    });
    if (owner) {
      console.log(`  owner: ${owner.email} (existing owner kept)`);
      return;
    }
  }
  const { password, isDefault } = ownerCredentials();
  await db.user.create({
    data: {
      email,
      name: "Store Owner",
      role: "OWNER",
      passwordHash: await hash(password),
      emailVerifiedAt: new Date(),
    },
  });
  console.log(`  owner: ${email}${isDefault ? ` / ${password} (dev default, change it!)` : ""}`);
}

/**
 * DEMO_MODE=true: a view-only admin account whose login is shown on the admin sign-in page.
 * Its password is reset on every seed so the published login always works.
 */
async function seedDemoAdmin() {
  if (!isDemoMode()) return;
  const { email, password } = demoAdminCredentials();
  const passwordHash = await hash(password);
  await db.user.upsert({
    where: { email },
    create: { email, name: "Demo Admin", role: "OWNER", passwordHash, emailVerifiedAt: new Date() },
    update: { role: "OWNER", isActive: true, passwordHash },
  });
  console.log(`  demo admin (view only): ${email}`);
}

/**
 * Demo store settings. An existing store keeps its own name, logo, contact details and branding
 * unless SEED_RESET_SETTINGS=true, so seeding the demo catalogue never overwrites them.
 */
async function seedSettings() {
  const existing = await db.storeSettings.findUnique({ where: { id: "default" } });
  if (existing && process.env.SEED_RESET_SETTINGS !== "true") {
    console.log(`  store settings: ${existing.name} (kept; SEED_RESET_SETTINGS=true to reset)`);
    return;
  }
  await db.storeSettings.upsert({
    where: { id: "default" },
    create: { id: "default", ...storeSettings },
    update: storeSettings,
  });
  console.log(`  store settings: ${storeSettings.name}`);
}

async function seedCategories() {
  const idsBySlug = new Map<string, string>();
  for (const cat of categories) {
    const { attributes, ...data } = cat;
    const category = await db.category.upsert({
      where: { slug: cat.slug },
      create: data,
      update: data,
    });
    idsBySlug.set(cat.slug, category.id);

    for (const raw of attributes) {
      const attr = attributeDefinitionSchema.parse(raw);
      const values = { ...attr, options: attr.options ?? Prisma.DbNull };
      await db.attributeDefinition.upsert({
        where: { categoryId_key: { categoryId: category.id, key: attr.key } },
        create: { categoryId: category.id, ...values },
        update: values,
      });
    }
  }
  console.log(`  categories: ${categories.length}`);
  return idsBySlug;
}

async function seedProducts(categoryIds: Map<string, string>) {
  let variantCount = 0;
  for (const p of products) {
    const categoryId = categoryIds.get(p.categorySlug);
    if (!categoryId) throw new Error(`Unknown category "${p.categorySlug}" for ${p.slug}`);

    // Validate everything against the category's attribute definitions before writing.
    const defs = categories.find((c) => c.slug === p.categorySlug)!.attributes;
    const attributes = productAttributesSchema(defs).parse(p.attributes);
    const options = productOptionsSchema.parse(p.options);
    const optionValuesSchema = variantOptionValuesSchema(options);
    const variants = p.variants.map((v, index) => {
      const variant = productVariantSchema.parse({ ...v, isDefault: index === 0 });
      optionValuesSchema.parse(variant.optionValues);
      return { ...variant, sortOrder: index };
    });

    const data = {
      name: p.name,
      shortDescription: p.shortDescription,
      description: p.shortDescription,
      categoryId,
      status: "PUBLISHED" as const,
      brand: p.brand ?? null,
      isFeatured: p.isFeatured ?? false,
      attributes,
      options,
      taxRateBps: p.taxRateBps ?? null,
      hsnCode: p.hsnCode,
      metaTitle: p.name,
      metaDescription: p.shortDescription,
      searchText: buildSearchText({
        name: p.name,
        brand: p.brand,
        slug: p.slug,
        skus: variants.map((v) => v.sku),
      }),
    };

    await db.$transaction(async (tx) => {
      const product = await tx.product.upsert({
        where: { slug: p.slug },
        create: { slug: p.slug, ...data, publishedAt: new Date() },
        update: data,
      });

      for (const variant of variants) {
        await tx.productVariant.upsert({
          where: { sku: variant.sku },
          create: { ...variant, productId: product.id },
          update: { ...variant, productId: product.id },
        });
      }
      // Remove variants dropped from the seed data (only if never ordered).
      await tx.productVariant.deleteMany({
        where: {
          productId: product.id,
          sku: { notIn: variants.map((v) => v.sku) },
          orderItems: { none: {} },
        },
      });

      await tx.productImage.deleteMany({ where: { productId: product.id } });
      await tx.productImage.createMany({
        data: Array.from({ length: productImageCount(p.slug) || p.imageCount }, (_, i) => ({
          productId: product.id,
          url: productImage(p.slug, i + 1),
          alt: p.name,
          width: 1200,
          height: 1200,
          sortOrder: i,
        })),
      });
    });
    variantCount += variants.length;
  }
  console.log(`  products: ${products.length} (${variantCount} variants)`);
}

async function seedCoupons(categoryIds: Map<string, string>) {
  const list = coupons(new Date());
  for (const { categorySlugs, ...coupon } of list) {
    const data = {
      ...coupon,
      categoryIds: categorySlugs.map((slug) => {
        const id = categoryIds.get(slug);
        if (!id) throw new Error(`Unknown category "${slug}" in coupon ${coupon.code}`);
        return id;
      }),
    };
    await db.coupon.upsert({ where: { code: coupon.code }, create: data, update: data });
  }
  console.log(`  coupons: ${list.map((c) => c.code).join(", ")}`);
}

async function seedShipping() {
  for (const { id, ...rule } of shippingRules) {
    await db.shippingRule.upsert({ where: { id }, create: { id, ...rule }, update: rule });
  }
  console.log(`  shipping rules: ${shippingRules.length}`);
}

async function seedHomePage(categoryIds: Map<string, string>) {
  // pnpm setup:store creates its own "New arrivals" carousel; the demo home page has one too,
  // so drop that leftover instead of showing the section twice. Other sections are kept.
  const leftovers = await db.homeSection.findMany({
    where: { type: "PRODUCT_CAROUSEL", NOT: { id: { startsWith: "seed-" } } },
    select: { id: true, config: true },
  });
  const duplicateIds = leftovers
    .filter((s) => (s.config as { source?: string } | null)?.source === "newest")
    .map((s) => s.id);
  if (duplicateIds.length) {
    await db.homeSection.deleteMany({ where: { id: { in: duplicateIds } } });
    console.log(`  home page: removed ${duplicateIds.length} duplicate "New arrivals" section`);
  }

  for (const { id, ...banner } of banners) {
    await db.banner.upsert({ where: { id }, create: { id, ...banner }, update: banner });
  }
  for (const [index, section] of homeSections.entries()) {
    const config =
      "config" in section
        ? section.config
        : {
            categoryIds: (section.categorySlugs ?? [])
              .map((slug) => categoryIds.get(slug))
              .filter(Boolean),
          };
    const data = {
      type: section.type,
      title: "title" in section ? section.title : Prisma.DbNull,
      config: config as Prisma.InputJsonValue,
      sortOrder: index,
      isActive: true,
    };
    await db.homeSection.upsert({
      where: { id: section.id },
      create: { id: section.id, ...data },
      update: data,
    });
  }
  console.log(`  home page: ${banners.length} banners, ${homeSections.length} sections`);
}

async function main() {
  console.log("Seeding database…");
  await seedOwner();
  await seedDemoAdmin();
  await seedSettings();
  const categoryIds = await seedCategories();
  await seedProducts(categoryIds);
  await seedCoupons(categoryIds);
  await seedShipping();
  await seedHomePage(categoryIds);
  console.log("Done.");
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
