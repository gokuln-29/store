-- CreateIndex
CREATE INDEX "Order_invoiceNumber_trgm_idx" ON "Order" USING GIN ("invoiceNumber" gin_trgm_ops);

