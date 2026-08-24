import { apiRequestAuth } from '../../../lib/apiClient.js'

export async function previewPosStockHandling(items) {
  const data = await apiRequestAuth('/api/v1/inventory/pos-stock-handling', {
    method: 'POST',
    body: JSON.stringify({
      orderId: crypto.randomUUID(),
      orderCode: `POS-PREVIEW-${Date.now()}`,
      orderStatus: 'pendingpayment',
      totalAmount: 0,
      previewOnly: true,
      items: items.map((item) => ({
        skuId: item.skuId,
        skuSnapshotName: item.skuSnapshotName,
        skuSnapshotCode: item.skuSnapshotCode,
        quantity: Number(item.quantity),
      })),
    }),
  })
  return {
    stockHandlingMode: data.stockHandlingMode ?? data.StockHandlingMode ?? '',
    backorderRequired: Boolean(data.backorderRequired ?? data.BackorderRequired),
    backorderMessage: data.backorderMessage ?? data.BackorderMessage ?? '',
    lines: (data.lines ?? data.Lines ?? []).map((line) => ({
      skuId: line.skuId ?? line.SkuId,
      skuCode: line.skuCode ?? line.SkuCode ?? '',
      skuName: line.skuName ?? line.SkuName ?? '',
      orderedQuantity: Number(line.orderedQuantity ?? line.OrderedQuantity ?? 0),
      finishedDeductedQuantity: Number(line.finishedDeductedQuantity ?? line.FinishedDeductedQuantity ?? 0),
      warehouseDeductedQuantity: Number(line.warehouseDeductedQuantity ?? line.WarehouseDeductedQuantity ?? 0),
      pendingBomQuantity: Number(line.pendingBomQuantity ?? line.PendingBomQuantity ?? 0),
    })),
  }
}
