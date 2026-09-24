-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "searchText" TEXT NOT NULL DEFAULT '';

-- Trigram search across English, Tamil and Kannada names, brand and SKUs.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX "Product_searchText_trgm_idx" ON "Product" USING GIN ("searchText" gin_trgm_ops);

-- Backfill existing products.
UPDATE "Product" p SET "searchText" = lower(concat_ws(' ',
  p.name->>'en', p.name->>'ta', p.name->>'kn', p.brand, p.slug,
  (SELECT string_agg(v.sku, ' ') FROM "ProductVariant" v WHERE v."productId" = p.id)
));

-- Listing queries: active variants per product (price/stock aggregates).
CREATE INDEX "ProductVariant_productId_isActive_price_idx" ON "ProductVariant" ("productId", "isActive", "price");
