-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "ratingCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "ratingTotal" INTEGER NOT NULL DEFAULT 0;


-- Review ratings are already limited to 1–5 (initial migration); totals can never go negative.
ALTER TABLE "Product" ADD CONSTRAINT "Product_rating_totals" CHECK ("ratingCount" >= 0 AND "ratingTotal" >= 0);
