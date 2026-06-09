import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { showError } from '../../../app/toast.js'
import ProductImage from './ProductImage.jsx'
import { fetchSkusByProductId } from '../services/productSkusApi.js'
import {
  formatProductPrice,
  formatStockQuantity,
  formatWeightGrams,
  getProductStatusMeta,
} from '../utils/productDisplay.js'

function ProductSkusDetailModal({ product, stockBySkuId, onClose }) {
  const [skus, setSkus] = useState(() => product?.skus ?? [])
  const [isLoading, setIsLoading] = useState(false)

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
              {skus.map((sku) => {
                const status = getProductStatusMeta(sku.isActive)
                const quantityOnHand = Number(stockBySkuId?.get(sku.id) ?? 0)
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
                          {formatWeightGrams(sku.weightInGrams)} · {formatProductPrice(sku.basePrice)}
                        </p>
                        <p
                          className={`mt-1 text-xs font-semibold ${
                            quantityOnHand <= 0
                              ? 'text-[#b42318]'
                              : quantityOnHand <= 5
                                ? 'text-[#7e5700]'
                                : 'text-[#356647]'
                          }`}
                        >
                          Số lượng hiện tại: {formatStockQuantity(quantityOnHand)}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-slate-100 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Đóng
          </button>
          <Link
            to={`/products/${product.id}/edit`}
            className="rounded-xl bg-[#538463] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#457053]"
            onClick={onClose}
          >
            Sửa sản phẩm / SKU
          </Link>
        </div>
      </div>
    </div>
  )
}

export default ProductSkusDetailModal
