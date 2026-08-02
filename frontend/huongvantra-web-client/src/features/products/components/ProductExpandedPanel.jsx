import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { showError } from '../../../app/toast.js'
import { formatVietnamDate } from '../../../utils/vietnamDateTime.js'
import { fetchWarehouseBatches } from '../../inventory/services/warehouseBatchApi.js'
import SkuCodReservationSection from '../../inventory/components/SkuCodReservationSection.jsx'
import ProductImage from './ProductImage.jsx'
import {
  formatProductCreatedAt,
  formatProductPrice,
  formatStockQuantity,
  formatWeightGrams,
  getProductBrandLabel,
  getProductStatusMeta,
  pickProductImageUrl,
  summarizeProductVariants,
  summarizeProductSkus,
} from '../utils/productDisplay.js'

const TABS = [
  { id: 'info', label: 'Thông tin' },
  { id: 'notes', label: 'Mô tả, ghi chú' },
  { id: 'stock_card', label: 'Thẻ kho' },
  { id: 'inventory', label: 'Tồn kho' },
  { id: 'variants', label: 'Hàng hóa cùng loại' },
]

const EMPTY_LOTS = []

function InfoCell({ label, value }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-0.5 truncate text-sm font-medium text-slate-800">{value || '—'}</p>
    </div>
  )
}

function sameId(left, right) {
  return String(left ?? '') === String(right ?? '')
}

function buildSkuLotRows(batches, skuId) {
  if (!skuId) return []

  return (batches ?? [])
    .flatMap((batch) => {
      const item = (batch.items ?? []).find((line) => sameId(line.skuId, skuId))
      const quantityOnHand = Number(item?.quantityOnHand ?? 0)
      if (!item || quantityOnHand <= 0) return []

      return [{
        id: `${batch.id}-${item.id ?? item.skuId}`,
        lotCode: batch.lotCode || '—',
        productionDate: batch.createdAt ?? null,
        expiresAt: batch.expiresAt ?? null,
        quantityOnHand,
      }]
    })
    .sort((left, right) => {
      const leftTime = left.productionDate ? new Date(left.productionDate).getTime() : 0
      const rightTime = right.productionDate ? new Date(right.productionDate).getTime() : 0
      if (rightTime !== leftTime) return rightTime - leftTime
      return String(left.lotCode).localeCompare(String(right.lotCode), 'vi')
    })
}

export default function ProductExpandedPanel({
  product,
  stockBySkuId = new Map(),
  stockLabel = 'Tồn kho',
  activeSkuId = null,
  readOnly = false,
  canAdjustStock = false,
  canHide = false,
  inBatch = false,
  onToggleBatchSku,
  onHide,
  isHiding = false,
}) {
  const [tabState, setTabState] = useState(() => ({
    productId: product?.id ?? null,
    activeTab: 'info',
  }))
  const [inventoryLotState, setInventoryLotState] = useState(() => ({
    key: '',
    lots: [],
    error: '',
  }))

  // Use variants as the canonical SKU list; fall back to old skus for legacy data
  const skus = product?.variants?.length ? product.variants : (product?.skus ?? [])
  const skuSummary = product?.variants?.length
    ? summarizeProductVariants(product.variants)
    : summarizeProductSkus(product?.skus ?? [])
  const status = getProductStatusMeta(product?.isActive, product?.isDeleted)
  const imageUrl = pickProductImageUrl(product)
  const primarySku = skus.find((sku) => sku.isActive) || skus[0]
  const focusedSku =
    (activeSkuId ? skus.find((sku) => sku.id === activeSkuId) : null) || primarySku
  const focusedSkuId = focusedSku?.id ?? null
  const activeTab = tabState.productId === product?.id ? tabState.activeTab : 'info'
  const inventoryLotsKey = activeTab === 'inventory' && focusedSkuId ? String(focusedSkuId) : ''
  const inventoryLots = inventoryLotState.key === inventoryLotsKey ? inventoryLotState.lots : EMPTY_LOTS
  const inventoryLotsLoading = Boolean(inventoryLotsKey && inventoryLotState.key !== inventoryLotsKey)
  const inventoryLotsError = inventoryLotState.key === inventoryLotsKey ? inventoryLotState.error : ''
  const brand = getProductBrandLabel(product)
  const tags = [product?.flavorProfile, product?.baseUnit, focusedSku?.packagingType].filter(Boolean)
  const focusedStock = focusedSku ? stockBySkuId.get(focusedSku.id) ?? 0 : 0
  const skuLotRows = useMemo(
    () => buildSkuLotRows(inventoryLots, focusedSkuId),
    [inventoryLots, focusedSkuId],
  )

  function selectTab(tabId) {
    setTabState({
      productId: product?.id ?? null,
      activeTab: tabId,
    })
  }

  useEffect(() => {
    let cancelled = false

    if (!inventoryLotsKey) {
      return () => {
        cancelled = true
      }
    }

    fetchWarehouseBatches({ skuId: focusedSkuId, availableOnly: true })
      .then((batches) => {
        if (!cancelled) {
          setInventoryLotState({ key: inventoryLotsKey, lots: batches, error: '' })
        }
      })
      .catch((err) => {
        if (cancelled) return
        setInventoryLotState({
          key: inventoryLotsKey,
          lots: [],
          error: 'Không tải được lô tồn kho cho SKU này.',
        })
        showError(err.message)
      })

    return () => {
      cancelled = true
    }
  }, [focusedSkuId, inventoryLotsKey])

  if (!product) return null

  function rowClass(skuId) {
    return activeSkuId && skuId === activeSkuId ? 'bg-[#e8f1eb]/70' : ''
  }

  return (
    <div className="border-t border-[#356647]/20 bg-[#eef3ef] px-3 py-3 sm:px-5 sm:py-4">
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex gap-1 overflow-x-auto border-b border-slate-100 bg-slate-50/80 px-2 pt-2 custom-scrollbar sm:px-4">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => selectTab(tab.id)}
            className={`shrink-0 rounded-t-lg px-3 py-2.5 text-sm font-semibold transition ${
              activeTab === tab.id
                ? 'border border-b-white border-slate-200 bg-white text-[#356647] shadow-sm'
                : 'text-slate-500 hover:bg-white/60 hover:text-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="p-4 sm:p-5">
      {activeTab === 'info' ? (
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
          <div className="flex shrink-0 gap-4">
            <ProductImage src={imageUrl} alt={product.name} className="h-24 w-24 rounded-xl border border-slate-200" iconClassName="text-3xl" />
            <div className="min-w-0">
              <h3 className="text-lg font-bold text-slate-900">{product.name}</h3>
              <p className="mt-1 text-sm text-slate-500">{product.categoryName || '—'}</p>
              {tags.length ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {tags.map((tag) => (
                    <span key={tag} className="rounded-full bg-white px-2.5 py-0.5 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
                      {tag}
                    </span>
                  ))}
                </div>
              ) : null}
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="rounded-md bg-white px-2 py-0.5 text-[11px] font-bold text-slate-600 ring-1 ring-slate-200">
                  Hàng hóa thường
                </span>
                {primarySku?.isSellable !== false ? (
                  <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">Bán trực tiếp</span>
                ) : (
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-500">Không bán POS</span>
                )}
                <span className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${status.className}`}>{status.label}</span>
              </div>
            </div>
          </div>

          <div className="grid flex-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <InfoCell label="Mã hàng" value={focusedSku?.skuCode || skuSummary.primaryCode} />
            <InfoCell label="Mã vạch" value={focusedSku?.barcode} />
            <InfoCell label={stockLabel} value={formatStockQuantity(focusedStock)} />
            <InfoCell label="Giá vốn" value={formatProductPrice(focusedSku?.costPrice ?? 0)} />
            <InfoCell label="Giá bán" value={formatProductPrice(focusedSku?.retailPrice || focusedSku?.basePrice)} />
            <InfoCell label="Thương hiệu" value={brand} />
            <InfoCell label="Xuất xứ" value={product.origin} />
            <InfoCell
              label="Trọng lượng"
              value={focusedSku?.weightInGrams ? formatWeightGrams(focusedSku.weightInGrams) : '—'}
            />
            <InfoCell label="Tồn tối thiểu" value={focusedSku?.minStock ?? '—'} />
            <InfoCell label="Tồn tối đa" value={focusedSku?.maxStock ?? '—'} />
            <InfoCell label="Ngày tạo" value={formatProductCreatedAt(product.createdAt)} />
            <InfoCell label="Số SKU" value={skuSummary.count ? String(skuSummary.count) : '—'} />
          </div>
        </div>
      ) : null}

      {activeTab === 'notes' ? (
        <div className="space-y-4 text-sm text-slate-700">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Mô tả</p>
            <p className="mt-1 whitespace-pre-wrap">{product.description?.trim() || 'Chưa có mô tả.'}</p>
          </div>
          {product.brewingGuide ? (
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Hướng dẫn pha</p>
              <p className="mt-1 whitespace-pre-wrap">{product.brewingGuide}</p>
            </div>
          ) : null}
          {product.flavorProfile ? (
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Hương vị</p>
              <p className="mt-1">{product.flavorProfile}</p>
            </div>
          ) : null}
        </div>
      ) : null}

      {activeTab === 'stock_card' ? (
        <p className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
          Lịch sử nhập — xuất — điều chỉnh sẽ hiển thị tại đây khi module thẻ kho hoàn thiện.
        </p>
      ) : null}

      {activeTab === 'inventory' ? (
        <div className="space-y-3">
          <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm sm:grid-cols-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">SKU đang xem</p>
              <p className="mt-1 font-mono text-xs font-bold text-[#356647]">{focusedSku?.skuCode || '—'}</p>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Tên hàng</p>
              <p className="mt-1 truncate font-medium text-slate-800">
                {focusedSku?.variantName || focusedSku?.packagingType || product.name || '—'}
              </p>
            </div>
            <div className="sm:text-right">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{stockLabel}</p>
              <p className="mt-1 font-semibold text-[#356647]">{formatStockQuantity(focusedStock)}</p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2.5">Mã lô</th>
                <th className="px-4 py-2.5">Ngày sản xuất</th>
                <th className="px-4 py-2.5">Hạn sử dụng</th>
                <th className="px-4 py-2.5 text-right">Tồn còn lại</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {!focusedSku ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                    Chưa có SKU.
                  </td>
                </tr>
              ) : inventoryLotsLoading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                    Đang tải lô tồn kho...
                  </td>
                </tr>
              ) : inventoryLotsError ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-red-600">
                    {inventoryLotsError}
                  </td>
                </tr>
              ) : skuLotRows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                    SKU này chưa có lô tồn kho.
                  </td>
                </tr>
              ) : skuLotRows.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-2.5 font-mono text-xs font-bold text-[#356647]">{row.lotCode}</td>
                  <td className="px-4 py-2.5 text-slate-700">
                    {row.productionDate ? formatVietnamDate(row.productionDate) : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-slate-700">
                    {row.expiresAt ? formatVietnamDate(row.expiresAt) : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold text-[#356647]">
                    {formatStockQuantity(row.quantityOnHand)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

          <SkuCodReservationSection skuId={focusedSkuId} />
        </div>
      ) : null}

      {activeTab === 'variants' ? (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2.5">Sản Phẩm</th>
                <th className="px-4 py-2.5 text-right">Giá vốn</th>
                <th className="px-4 py-2.5 text-right">Giá bán</th>
                <th className="px-4 py-2.5 text-center">Bán POS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(product.variants?.length ? product.variants : skus).map((item) => (
                <tr key={item.id} className={rowClass(item.id)}>
                  <td className="px-4 py-2.5">
                    <p className="font-medium text-slate-800">{item.variantName || item.packagingType || '—'}</p>
                    <p className="font-mono text-xs text-slate-500">{item.skuCode}</p>
                  </td>
                  <td className="px-4 py-2.5 text-right">{formatProductPrice(item.costPrice ?? 0)}</td>
                  <td className="px-4 py-2.5 text-right font-medium">{formatProductPrice(item.retailPrice || item.basePrice)}</td>
                  <td className="px-4 py-2.5 text-center">{item.isSellable !== false ? 'Có' : 'Không'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-4">
        {readOnly && canAdjustStock ? (
          <button
            type="button"
            onClick={onToggleBatchSku}
            className={`rounded-lg px-4 py-2 text-sm font-bold ${
              inBatch
                ? 'border border-[#356647]/30 bg-[#356647]/10 text-[#356647]'
                : 'bg-[#538463] text-white hover:bg-[#457053]'
            }`}
          >
            {inBatch ? 'Đã thêm vào lô' : 'Thêm vào lô'}
          </button>
        ) : null}
        {readOnly && canAdjustStock ? (
          <Link
            to="/inventory/stock-requests"
            className="rounded-lg border border-[#356647]/30 px-4 py-2 text-sm font-semibold text-[#356647] hover:bg-[#356647]/5"
          >
            Yêu cầu đã gửi
          </Link>
        ) : null}
        {!readOnly && canHide && !product.isDeleted ? (
          <button
            type="button"
            disabled={isHiding}
            onClick={() => onHide?.(product)}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50"
          >
            Ẩn
          </button>
        ) : null}
      </div>
      </div>
      </div>
    </div>
  )
}
