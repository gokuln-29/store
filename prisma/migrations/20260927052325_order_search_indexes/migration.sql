-- CreateIndex
CREATE INDEX "Order_orderNumber_trgm_idx" ON "Order" USING GIN ("orderNumber" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "Order_customerName_trgm_idx" ON "Order" USING GIN ("customerName" gin_trgm_ops);

