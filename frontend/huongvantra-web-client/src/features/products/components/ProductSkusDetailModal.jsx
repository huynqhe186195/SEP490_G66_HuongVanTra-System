import { useEffect, useState } from 'react'
import { showError } from '../../../app/toast.js'
import ProductImage from './ProductImage.jsx'
import { useStockAdjustmentBatch } from '../../inventory/hooks/useStockAdjustmentBatch.js'
import { fetchSkusByProductId } from '../services/productSkusApi.js'
import {
  formatProductPrice,
  formatStockQuantity,
  formatWeightGrams,
  getProductStatusMeta,
} from '../utils/productDisplay.js'
import {
  fetchSkuStocks,
  fetchStoreSkuStocks,
  buildWarehouseStockBySkuIdMap,
  buildStockBySkuIdMap,
} from '../../inventory/services/inventoryStockApi.js'
import { INVENTORY_STOCK_CHANGED_EVENT } from '../../inventory/utils/inventoryStockEvents.js'

function ProductSkusDetailModal({
  product,
  stockBySkuId,
  canAdjustStock = false,
  warehouseStockView = false,
  onClose,
}) {
  const stockLabel = warehouseStockView ? 'Tồn kho tổng' : 'Tồn cửa hàng'
  const [skus, setSkus] = useState(() => product?.skus ?? [])
  const [isLoading, setIsLoading] = useState(false)
  const [refreshedStockBySkuId, setRefreshedStockBySkuId] = useState(null)
  const localStockBySkuId = refreshedStockBySkuId ?? stockBySkuId ?? new Map()
  const { isInBatch, addAll, toggleLine, count } = useStockAdjustmentBatch()

  useEffect(() => {
    async function refreshStocks() {
      try {
        const stocks = warehouseStockView ? await fetchSkuStocks() : await fetchStoreSkuStocks()
        setRefreshedStockBySkuId(
          warehouseStockView ? buildWarehouseStockBySkuIdMap(stocks) : buildStockBySkuIdMap(stocks),
        )
      } catch {
        /* keep current */
      }
    }
    window.addEventListener(INVENTORY_STOCK_CHANGED_EVENT, refreshStocks)
    return () => window.removeEventListener(INVENTORY_STOCK_CHANGED_EVENT, refreshStocks)
  }, [warehouseStockView])

  useEffect(() => {
    if (!product?.id) return undefined

    let mounted = true
    async function load() {
      try {
        setIsLoading(true)
        const items = await fetchSkusByProductId(product.id)
        if (mounted) setSkus(items)
      } catch (error) {
        if (mounted) {
          showError(error.message)
          setSkus(product.skus ?? [])
        }
      } finally {
        if (mounted) setIsLoading(false)
      }
    }

    load()
    return () => {
      mounted = false
    }
  }, [product?.id, product?.skus])

  if (!product) return null

  function skuMeta(sku) {
    return {
      productName: product.name,
      quantityOnHand: Number(localStockBySkuId.get(sku.id) ?? 0),
    }
  }

  function addAllToBatch() {
    addAll(skus, skuMeta)
  }

  const batchableSkuCount = skus.filter((sku) => !isInBatch(sku.id)).length
  const inProductBatchCount = skus.filter((sku) => isInBatch(sku.id)).length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div
        className="flex max-h-[min(90dvh,720px)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-skus-title"
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 px-6 py-4">
          <div className="min-w-0">
            <h2 id="product-skus-title" className="text-lg font-bold text-slate-800">
              Biến thể SKU
            </h2>
            <p className="mt-1 truncate font-semibold text-[#356647]">{product.name}</p>
            <p className="mt-0.5 text-xs text-slate-500">
              {product.categoryName || '—'}
              {product.origin ? ` · ${product.origin}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Đóng"
          >
            <span className="material-symbols-outlined text-[22px]">close</span>
          </button>
        </div>

        <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {isLoading ? (
            <p className="py-8 text-center text-sm text-slate-500">Đang tải SKU...</p>
          ) : skus.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-500">
              Sản phẩm chưa có biến thể SKU.
            </p>
          ) : (
            <div className="space-y-3">
              {canAdjustStock && skus.length > 1 ? (
                <div className="flex justify-end">
                  <button
                    type="button"
                    disabled={batchableSkuCount === 0}
                    onClick={addAllToBatch}
                    className="rounded-lg border border-[#356647]/30 px-3 py-1.5 text-xs font-semibold text-[#356647] hover:bg-[#356647]/5 disabled:opacity-50"
                  >
                    {batchableSkuCount === 0
                      ? 'Đã thêm hết SKU SP này vào lô'
                      : `Thêm tất cả ${skus.length} SKU vào lô`}
                  </button>
                </div>
              ) : null}
              {skus.map((sku) => {
                const status = getProductStatusMeta(sku.isActive)
                const quantityOnHand = Number(localStockBySkuId?.get(sku.id) ?? 0)
                return (
                  <div
                    key={sku.id}
                    className="flex flex-col gap-3 rounded-xl border border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <ProductImage src={sku.imageUrl} alt={sku.skuCode} className="h-16 w-16 shrink-0 rounded-xl" />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-mono text-sm font-bold text-[#356647]">{sku.skuCode}</p>
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${status.className}`}>
                            {status.label}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-slate-700">{sku.packagingType || '—'}</p>
                        <p className="text-xs text-slate-500">
                          {formatWeightGrams(sku.weightInGrams)} · Niêm yết {formatProductPrice(sku.basePrice)}
                        </p>
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                          {sku.barcode ? <span>Barcode: <span className="font-mono">{sku.barcode}</span></span> : null}
                          <span>Giá vốn: {formatProductPrice(sku.costPrice)}</span>
                          <span>Giá bán lẻ: {formatProductPrice(sku.retailPrice)}</span>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                          <span>Tồn min/max: {sku.minStock ?? '—'} / {sku.maxStock ?? '—'}</span>
                          <span>{sku.isSellable ? 'Được bán' : 'Ngừng bán trực tiếp'}</span>
                          <span>{sku.allowRewardPoints ? 'Có tích điểm' : 'Không tích điểm'}</span>
                        </div>
                        <p
                          className={`mt-1 text-xs font-semibold ${
                            quantityOnHand <= 0
                              ? 'text-[#b42318]'
                              : quantityOnHand <= 5
                                ? 'text-[#7e5700]'
                                : 'text-[#356647]'
                          }`}
                        >
                          {stockLabel}: {formatStockQuantity(quantityOnHand)}
                        </p>
                      </div>
                    </div>
                    {canAdjustStock ? (
                      <button
                        type="button"
                        className={`shrink-0 rounded-lg px-4 py-2 text-sm font-semibold ${
                          isInBatch(sku.id)
                            ? 'bg-[#356647]/15 text-[#356647]'
                            : 'bg-[#538463] text-white hover:bg-[#457053]'
                        }`}
                        onClick={() => toggleLine(sku, skuMeta(sku))}
                      >
                        {isInBatch(sku.id) ? 'Đã thêm vào lô' : 'Thêm vào lô'}
                      </button>
                    ) : null}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-slate-100 px-6 py-4">
          {canAdjustStock && count > 0 ? (
            <span className="mr-auto text-sm text-slate-600">
              Lô chung: {count} SKU
              {inProductBatchCount > 0 ? ` (${inProductBatchCount} từ sản phẩm này)` : ''}
            </span>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  )
}

export default ProductSkusDetailModal
