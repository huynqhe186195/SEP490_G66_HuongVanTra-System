import { useCallback, useEffect, useState } from 'react'
import {
  STOCK_ADJUSTMENT_BATCH_CHANGED_EVENT,
  addSkuToBatch,
  addSkusToBatch,
  buildBatchLine,
  clearStockAdjustmentBatch,
  getBatchLines,
  isSkuInBatch,
  removeSkuFromBatch,
  toggleSkuInBatch,
} from '../utils/stockAdjustmentBatchStore.js'

export function useStockAdjustmentBatch() {
  const [lines, setLines] = useState(() => getBatchLines())

  useEffect(() => {
    const sync = () => setLines(getBatchLines())
    window.addEventListener(STOCK_ADJUSTMENT_BATCH_CHANGED_EVENT, sync)
    return () => window.removeEventListener(STOCK_ADJUSTMENT_BATCH_CHANGED_EVENT, sync)
  }, [])

  const isInBatch = useCallback((skuId) => isSkuInBatch(skuId), [lines])

  const addLine = useCallback((sku, meta = {}) => {
    addSkuToBatch(buildBatchLine(sku, meta))
  }, [])

  const addAll = useCallback((skus, meta = {}) => {
    addSkusToBatch(skus.map((sku) => buildBatchLine(sku, typeof meta === 'function' ? meta(sku) : meta)))
  }, [])

  const removeLine = useCallback((skuId) => {
    removeSkuFromBatch(skuId)
  }, [])

  const toggleLine = useCallback((sku, meta = {}) => {
    toggleSkuInBatch(buildBatchLine(sku, meta))
  }, [])

  const clear = useCallback(() => {
    clearStockAdjustmentBatch()
  }, [])

  return {
    lines,
    count: lines.length,
    isInBatch,
    addLine,
    addAll,
    removeLine,
    toggleLine,
    clear,
  }
}
