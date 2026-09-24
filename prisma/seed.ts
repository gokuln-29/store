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
import {
  categories,
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
  const email = (process.env.SEED_OWNER_EMAIL ?? DEV_OWNER_EMAIL).trim().toLowerCase();
  const password = process.env.SEED_OWNER_PASSWORD ?? DEV_OWNER_PASSWORD;
  if (process.env.NODE_ENV === "production" && !process.env.SEED_OWNER_PASSWORD) {
    throw new Error("Set SEED_OWNER_PASSWORD when seeding in production.");
  }
  if (password.length < 10) throw new Error("SEED_OWNER_PASSWORD must be at least 10 characters.");
  return { email, password, isDefault: password === DEV_OWNER_PASSWORD };
}

async function seedOwner() {
  const { email, password, isDefault } = ownerCredentials();
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    // Never overwrite an existing password on re-seed.
    await db.user.update({ where: { email }, data: { role: "OWNER", isActive: true } });
    console.log(`  owner: ${email} (exists, password unchanged)`);
    return;
  }
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

async function seedSettings() {
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
        data: Array.from({ length: p.imageCount }, (_, i) => ({
          productId: product.id,
          url: productImage(p.slug, i + 1),
          alt: p.name,
          width: 800,
          height: 800,
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

async function main() {
  console.log("Seeding database…");
  await seedOwner();
  await seedSettings();
  const categoryIds = await seedCategories();
  await seedProducts(categoryIds);
  await seedCoupons(categoryIds);
  await seedShipping();
  console.log("Done.");
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
