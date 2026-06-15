import { buildSkuSnapshotName } from '../../products/components/BatchStockAdjustmentModal.jsx'

const STORAGE_KEY = 'hvt_stock_adjustment_batch'

export const STOCK_ADJUSTMENT_BATCH_CHANGED_EVENT = 'hvt-stock-adjustment-batch-changed'

function readMap() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return parsed
  } catch {
    return {}
  }
}

function writeMap(map) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(map))
  } catch {
    // ignore quota errors
  }
  window.dispatchEvent(new CustomEvent(STOCK_ADJUSTMENT_BATCH_CHANGED_EVENT))
}

export function buildBatchLine(sku, { productName = '', quantityOnHand = 0, skuSnapshotName } = {}) {
  const skuId = String(sku.id)
  return {
    skuId,
    skuCode: sku.skuCode ?? '',
    skuSnapshotName: skuSnapshotName ?? buildSkuSnapshotName(sku, productName),
    productName: productName ?? '',
    packagingType: sku.packagingType ?? '',
    quantityOnHand: Number(quantityOnHand ?? 0),
  }
}

export function getBatchLines() {
  return Object.values(readMap())
}

export function isSkuInBatch(skuId) {
  return Object.hasOwn(readMap(), String(skuId))
}

export function addSkuToBatch(line) {
  const map = readMap()
  const key = String(line.skuId)
  map[key] = { ...line, skuId: key }
  writeMap(map)
}

export function addSkusToBatch(lines) {
  const map = readMap()
  lines.forEach((line) => {
    const key = String(line.skuId)
    map[key] = { ...line, skuId: key }
  })
  writeMap(map)
}

export function removeSkuFromBatch(skuId) {
  const map = readMap()
  delete map[String(skuId)]
  writeMap(map)
}

export function toggleSkuInBatch(line) {
  const key = String(line.skuId)
  if (isSkuInBatch(key)) removeSkuFromBatch(key)
  else addSkuToBatch(line)
}

export function clearStockAdjustmentBatch() {
  writeMap({})
}

export function batchLinesToModalInput(lines) {
  return lines.map((line) => ({
    sku: {
      id: line.skuId,
      skuCode: line.skuCode,
      packagingType: line.packagingType,
    },
    productName: line.productName,
    quantityOnHand: line.quantityOnHand,
    skuSnapshotName: line.skuSnapshotName,
  }))
}
