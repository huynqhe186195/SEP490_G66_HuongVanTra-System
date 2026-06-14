import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { showError } from '../../../app/toast.js'
import ProductImage from './ProductImage.jsx'
import { fetchSkusByProductId } from '../services/productSkusApi.js'
import {
  formatProductCreatedAt,
  formatProductPrice,
  formatStockQuantity,
  formatWeightGrams,
  getProductBrandLabel,
  getProductStatusMeta,
  pickProductImageUrl,
  summarizeProductSkus,
} from '../utils/productDisplay.js'

const TABS = [
  { id: 'info', label: 'Thông tin' },
  { id: 'notes', label: 'Mô tả, ghi chú' },
  { id: 'stock_card', label: 'Thẻ kho' },
  { id: 'inventory', label: 'Tồn kho' },
  { id: 'variants', label: 'Hàng hóa cùng loại' },
]

function InfoCell({ label, value }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-0.5 truncate text-sm font-medium text-slate-800">{value || '—'}</p>
    </div>
  )
}

export default function ProductExpandedPanel({
  product,
  stockBySkuId,
  stockLabel = 'Tồn kho',
  activeSkuId = null,
  readOnly = false,
  canAdjustStock = false,
  canManage = false,
  canHide = false,
  onHide,
  isHiding = false,
}) {
  const [activeTab, setActiveTab] = useState('info')
  const [skus, setSkus] = useState(() => product?.skus ?? [])
  const [isLoadingSkus, setIsLoadingSkus] = useState(false)

  useEffect(() => {
    setActiveTab('info')
    setSkus(product?.skus ?? [])
  }, [product?.id, product?.skus])

  useEffect(() => {
    if (!product?.id) return undefined
    let mounted = true
    async function load() {
      try {
        setIsLoadingSkus(true)
        const items = await fetchSkusByProductId(product.id)
        if (mounted) setSkus(items)
      } catch (error) {
        if (mounted) {
          showError(error.message)
          setSkus(product.skus ?? [])
        }
      } finally {
        if (mounted) setIsLoadingSkus(false)
      }
    }
    load()
    return () => {
      mounted = false
    }
  }, [product?.id, product?.skus])

  if (!product) return null

  const skuSummary = summarizeProductSkus(skus)
  const status = getProductStatusMeta(product.isActive, product.isDeleted)
  const imageUrl = pickProductImageUrl(product)
  const primarySku = skus.find((sku) => sku.isActive) || skus[0]
  const focusedSku =
    (activeSkuId ? skus.find((sku) => sku.id === activeSkuId) : null) || primarySku
  const brand = getProductBrandLabel(product)
  const tags = [product.flavorProfile, product.baseUnit, focusedSku?.packagingType].filter(Boolean)
  const focusedStock = focusedSku ? stockBySkuId.get(focusedSku.id) ?? 0 : 0

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
            onClick={() => setActiveTab(tab.id)}
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
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2.5">Mã SKU</th>
                <th className="px-4 py-2.5">Quy cách</th>
                <th className="px-4 py-2.5 text-right">Giá bán</th>
                <th className="px-4 py-2.5 text-right">{stockLabel}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoadingSkus ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                    Đang tải...
                  </td>
                </tr>
              ) : skus.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                    Chưa có SKU.
                  </td>
                </tr>
              ) : (
                skus.map((sku) => (
                  <tr key={sku.id} className={rowClass(sku.id)}>
                    <td className="px-4 py-2.5 font-mono text-xs font-bold text-[#356647]">{sku.skuCode}</td>
                    <td className="px-4 py-2.5">{sku.packagingType || '—'}</td>
                    <td className="px-4 py-2.5 text-right font-medium">{formatProductPrice(sku.retailPrice || sku.basePrice)}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-[#356647]">
                      {formatStockQuantity(stockBySkuId.get(sku.id) ?? 0)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : null}

      {activeTab === 'variants' ? (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2.5">Mã SKU</th>
                <th className="px-4 py-2.5">Quy cách / biến thể</th>
                <th className="px-4 py-2.5 text-right">Giá vốn</th>
                <th className="px-4 py-2.5 text-right">Giá bán</th>
                <th className="px-4 py-2.5 text-center">Bán POS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(product.variants?.length ? product.variants : skus).map((item) => (
                <tr key={item.id} className={rowClass(item.id)}>
                  <td className="px-4 py-2.5 font-mono text-xs font-bold text-[#356647]">{item.skuCode}</td>
                  <td className="px-4 py-2.5">{item.variantName || item.packagingType || '—'}</td>
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
          <Link
            to={`/products/${product.id}/edit`}
            className="rounded-lg bg-[#538463] px-4 py-2 text-sm font-bold text-white hover:bg-[#457053]"
          >
            Gửi yêu cầu điều chỉnh tồn
          </Link>
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
        {!readOnly && canManage ? (
          <>
            <button
              type="button"
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              title="Tính năng sao chép đang phát triển"
            >
              Sao chép
            </button>
            <Link
              to={`/products/${product.id}/edit`}
              className="rounded-lg bg-[#356647] px-5 py-2 text-sm font-bold text-white hover:bg-[#2d5539]"
            >
              Chỉnh sửa
            </Link>
            <Link
              to={`/products/${product.id}/edit`}
              className="rounded-lg border border-[#356647]/30 px-4 py-2 text-sm font-semibold text-[#356647] hover:bg-[#356647]/5"
            >
              + Thêm hàng cùng loại
            </Link>
          </>
        ) : null}
      </div>
      </div>
      </div>
    </div>
  )
}
