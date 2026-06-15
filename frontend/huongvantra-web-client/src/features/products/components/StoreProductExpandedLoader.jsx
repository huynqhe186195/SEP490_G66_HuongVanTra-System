import { useEffect, useState } from 'react'
import { showError } from '../../../app/toast.js'
import { fetchProductById } from '../services/productsApi.js'
import ProductExpandedPanel from './ProductExpandedPanel.jsx'

export default function StoreProductExpandedLoader({
  sku,
  stockBySkuId,
  canAdjustStock = false,
  inBatch = false,
  isInBatch,
  onToggleBatchSku,
  onToggleBatchSkuItem,
  onAddAllSkusToBatch,
}) {
  const [product, setProduct] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!sku?.productId) {
      setProduct(null)
      setIsLoading(false)
      return undefined
    }

    let mounted = true
    async function load() {
      try {
        setIsLoading(true)
        const item = await fetchProductById(sku.productId)
        if (mounted) setProduct(item)
      } catch (error) {
        if (mounted) {
          showError(error.message)
          setProduct(null)
        }
      } finally {
        if (mounted) setIsLoading(false)
      }
    }

    load()
    return () => {
      mounted = false
    }
  }, [sku?.productId, sku?.id])

  if (isLoading) {
    return (
      <div className="border-t border-[#356647]/20 bg-[#eef3ef] px-5 py-8 text-center text-sm text-slate-500">
        Đang tải chi tiết sản phẩm...
      </div>
    )
  }

  if (!product) {
    return (
      <div className="border-t border-[#356647]/20 bg-[#eef3ef] px-5 py-8 text-center text-sm text-slate-500">
        Không tải được thông tin sản phẩm.
      </div>
    )
  }

  return (
    <ProductExpandedPanel
      product={product}
      stockBySkuId={stockBySkuId}
      stockLabel="Tồn cửa hàng"
      activeSkuId={sku.id}
      readOnly
      canAdjustStock={canAdjustStock}
      inBatch={inBatch}
      isInBatch={isInBatch}
      onToggleBatchSku={onToggleBatchSku}
      onToggleBatchSkuItem={(item) =>
        onToggleBatchSkuItem?.(item, {
          productName: product.name,
          quantityOnHand: Number(stockBySkuId.get(item.id) ?? 0),
        })
      }
      onAddAllSkusToBatch={(skuList) => onAddAllSkusToBatch?.(skuList, product.name)}
    />
  )
}
