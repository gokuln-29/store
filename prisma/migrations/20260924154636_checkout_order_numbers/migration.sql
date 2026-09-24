-- DropIndex
DROP INDEX "Product_searchText_trgm_idx";

-- DropIndex
DROP INDEX "ProductVariant_productId_isActive_price_idx";

-- AlterTable
ALTER TABLE "StoreSettings" ADD COLUMN     "orderNumberPrefix" TEXT;

-- Human-friendly order numbers (prefix + counter). A sequence never hands out the same
-- number twice, even under concurrent checkouts.
CREATE SEQUENCE IF NOT EXISTS order_number_seq START WITH 1001;
