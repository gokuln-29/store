-- CreateIndex
CREATE INDEX "Product_searchText_trgm_idx" ON "Product" USING GIN ("searchText" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "ProductVariant_productId_isActive_price_idx" ON "ProductVariant"("productId", "isActive", "price");
