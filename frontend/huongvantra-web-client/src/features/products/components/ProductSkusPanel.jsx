import { useEffect, useState } from 'react'
import { showError, showSuccess } from '../../../app/toast.js'
import AdjustSkuStockModal from './AdjustSkuStockModal.jsx'
import ProductImage, { ProductImagePreview } from './ProductImage.jsx'
import {
  buildStockBySkuIdMap,
  buildWarehouseStockBySkuIdMap,
  fetchSkuStocks,
} from '../../inventory/services/inventoryStockApi.js'
import { INVENTORY_STOCK_CHANGED_EVENT } from '../../inventory/utils/inventoryStockEvents.js'
import { createSku, deleteSku, fetchSkusByProductId, updateSku } from '../services/productSkusApi.js'
import {
  formatProductPrice,
  formatProductPriceInput,
  formatStockQuantity,
  formatWeightGrams,
  getProductStatusMeta,
  parseProductPriceInput,
} from '../utils/productDisplay.js'
import { mapProductApiError, normalizeSkuCodeInput, validateSkuForm } from '../utils/productValidation.js'

const EMPTY_FORM = {
  skuCode: '',
  barcode: '',
  packagingType: '',
  weightInGrams: '',
  basePrice: '',
  costPrice: '',
  retailPrice: '',
  minStock: '',
  maxStock: '',
  isSellable: true,
  allowRewardPoints: true,
  imageUrl: '',
  isActive: true,
}

function FieldError({ message }) {
  if (!message) return null
  return <p className="text-xs text-[#b42318]">{message}</p>
}

function ProductSkusPanel({
  productId,
  productName = '',
  canManage,
  canAdjustStock = false,
  warehouseStockView = false,
  layout = 'default',
  stockOnlyMode = false,
}) {
  const stockLabel = warehouseStockView ? 'Tồn kho tổng' : 'Tồn cửa hàng'
  const isColumnLayout = layout === 'column'
  const formGridClass = isColumnLayout ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'
  const [skus, setSkus] = useState([])
  const [stockBySkuId, setStockBySkuId] = useState(() => new Map())
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [fieldErrors, setFieldErrors] = useState({})
  const [stockModalSku, setStockModalSku] = useState(null)

  async function reload() {
    if (!productId) return
    try {
      setIsLoading(true)
      const [items, stocks] = await Promise.all([
        fetchSkusByProductId(productId),
        fetchSkuStocks().catch(() => []),
      ])
      setSkus(items)
      setStockBySkuId(
        warehouseStockView ? buildWarehouseStockBySkuIdMap(stocks) : buildStockBySkuIdMap(stocks),
      )
    } catch (error) {
      showError(error.message)
      setSkus([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    reload()
  }, [productId, warehouseStockView])

  useEffect(() => {
    const onStockChanged = () => {
      reload()
    }
    window.addEventListener(INVENTORY_STOCK_CHANGED_EVENT, onStockChanged)
    return () => window.removeEventListener(INVENTORY_STOCK_CHANGED_EVENT, onStockChanged)
  }, [productId, warehouseStockView])

  function resetForm() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setFieldErrors({})
  }

  function startEdit(sku) {
    setEditingId(sku.id)
    setForm({
      skuCode: sku.skuCode,
      barcode: sku.barcode || '',
      packagingType: sku.packagingType,
      weightInGrams: String(sku.weightInGrams),
      basePrice: formatProductPriceInput(String(sku.basePrice)),
      costPrice: sku.costPrice || sku.costPrice === 0 ? formatProductPriceInput(String(sku.costPrice)) : '',
      retailPrice: sku.retailPrice || sku.retailPrice === 0 ? formatProductPriceInput(String(sku.retailPrice)) : '',
      minStock: sku.minStock || sku.minStock === 0 ? String(sku.minStock) : '',
      maxStock: sku.maxStock || sku.maxStock === 0 ? String(sku.maxStock) : '',
      isSellable: sku.isSellable !== false,
      allowRewardPoints: sku.allowRewardPoints !== false,
      imageUrl: sku.imageUrl || '',
      isActive: sku.isActive,
    })
    setFieldErrors({})
  }

  function updateField(key) {
    return (event) => {
      setForm((prev) => ({ ...prev, [key]: event.target.value }))
      setFieldErrors((prev) => ({ ...prev, [key]: undefined }))
    }
  }

  function handleSkuCodeBlur(event) {
    setForm((prev) => ({ ...prev, skuCode: normalizeSkuCodeInput(event.target.value) }))
  }

  function updatePriceField(key) {
    return (event) => {
      const value = formatProductPriceInput(event.target.value)
      setForm((prev) => ({ ...prev, [key]: value }))
      setFieldErrors((prev) => ({ ...prev, [key]: undefined }))
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (!canManage) return

    const validation = validateSkuForm(form)
    if (!validation.valid) {
      setFieldErrors(validation.errors)
      showError(validation.message)
      return
    }

    try {
      setIsSaving(true)
      const payload = {
        productId,
        skuCode: normalizeSkuCodeInput(form.skuCode),
        barcode: form.barcode,
        packagingType: form.packagingType,
        weightInGrams: Number(form.weightInGrams),
        basePrice: parseProductPriceInput(form.basePrice),
        costPrice: form.costPrice ? parseProductPriceInput(form.costPrice) : null,
        retailPrice: form.retailPrice ? parseProductPriceInput(form.retailPrice) : null,
        minStock: form.minStock === '' ? null : Number(form.minStock),
        maxStock: form.maxStock === '' ? null : Number(form.maxStock),
        isSellable: form.isSellable,
        allowRewardPoints: form.allowRewardPoints,
        imageUrl: form.imageUrl,
        isActive: form.isActive,
      }

      if (editingId) {
        await updateSku(editingId, payload)
        showSuccess('Đã cập nhật SKU.')
      } else {
        await createSku(payload)
        showSuccess('Đã thêm SKU mới.')
      }

      resetForm()
      await reload()
    } catch (error) {
      const mapped = mapProductApiError(error.message, error.apiErrors)
      if (Object.keys(mapped.errors).length) setFieldErrors((prev) => ({ ...prev, ...mapped.errors }))
      else if (mapped.field) setFieldErrors((prev) => ({ ...prev, [mapped.field]: mapped.message }))
      showError(mapped.message)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete(sku) {
    if (!canManage) return
    if (!window.confirm(`Xóa SKU "${sku.skuCode}"? SKU sẽ được ẩn khỏi hệ thống (soft delete).`)) return
    try {
      await deleteSku(sku.id)
      showSuccess('Đã xóa SKU.')
      if (editingId === sku.id) resetForm()
      await reload()
    } catch (error) {
      showError(error.message)
    }
  }

  return (
    <div className="rounded-[1rem] bg-white p-4 shadow-sm sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-800">
            {stockOnlyMode ? 'Cập nhật số lượng theo SKU' : 'Biến thể, giá & số lượng hiện tại'}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {stockOnlyMode
              ? 'Chọn SKU và gửi yêu cầu (+ nhập từ kho tổng, − giảm tồn cửa hàng). Thủ kho sẽ duyệt trước khi cập nhật số lượng.'
              : 'Mỗi SKU có mã, giá bán và số lượng hiện tại tại cửa hàng.'}
          </p>
        </div>
      </div>

      {canManage ? (
        <form className="mb-8 space-y-4 rounded-xl border border-slate-100 bg-[#fbf9f1] p-4" onSubmit={handleSubmit}>
          <p className="text-sm font-semibold text-[#356647]">{editingId ? 'Sửa SKU' : 'Thêm SKU mới'}</p>
          <div className={`grid gap-4 ${formGridClass}`}>
            <label className="space-y-1">
              <span className="text-xs font-semibold text-[#717971]">Mã SKU</span>
              <input
                className={`w-full rounded-xl border-none bg-white p-3 font-mono text-sm focus:ring-2 focus:ring-[#356647]/20 ${fieldErrors.skuCode ? 'ring-2 ring-[#b42318]/40' : ''}`}
                placeholder="Để trống để tự sinh"
                value={form.skuCode}
                onChange={updateField('skuCode')}
                onBlur={handleSkuCodeBlur}
              />
              <p className="text-[11px] text-slate-500">Nếu bỏ trống, hệ thống tự tạo mã SKU duy nhất.</p>
              <FieldError message={fieldErrors.skuCode} />
            </label>

            <label className="space-y-1">
              <span className="text-xs font-semibold text-[#717971]">Barcode</span>
              <input
                className={`w-full rounded-xl border-none bg-white p-3 font-mono text-sm focus:ring-2 focus:ring-[#356647]/20 ${fieldErrors.barcode ? 'ring-2 ring-[#b42318]/40' : ''}`}
                placeholder="893..."
                value={form.barcode}
                onChange={updateField('barcode')}
              />
              <FieldError message={fieldErrors.barcode} />
            </label>

            <label className="space-y-1">
              <span className="text-xs font-semibold text-[#717971]">Loại đóng gói *</span>
              <input
                className={`w-full rounded-xl border-none bg-white p-3 text-sm focus:ring-2 focus:ring-[#356647]/20 ${fieldErrors.packagingType ? 'ring-2 ring-[#b42318]/40' : ''}`}
                placeholder="Gói 100g, Hộp 250g..."
                value={form.packagingType}
                onChange={updateField('packagingType')}
              />
              <FieldError message={fieldErrors.packagingType} />
            </label>

            <label className="space-y-1">
              <span className="text-xs font-semibold text-[#717971]">Khối lượng (gram) *</span>
              <input
                className={`w-full rounded-xl border-none bg-white p-3 text-sm focus:ring-2 focus:ring-[#356647]/20 ${fieldErrors.weightInGrams ? 'ring-2 ring-[#b42318]/40' : ''}`}
                inputMode="numeric"
                placeholder="100"
                value={form.weightInGrams}
                onChange={updateField('weightInGrams')}
              />
              <FieldError message={fieldErrors.weightInGrams} />
            </label>

            <label className="space-y-1">
              <span className="text-xs font-semibold text-[#717971]">Giá bán *</span>
              <div className="relative">
                <input
                  className={`w-full rounded-xl border-none bg-white p-3 pr-10 text-sm focus:ring-2 focus:ring-[#356647]/20 ${fieldErrors.basePrice ? 'ring-2 ring-[#b42318]/40' : ''}`}
                  inputMode="decimal"
                  placeholder="180.000"
                  value={form.basePrice}
                  onChange={updatePriceField('basePrice')}
                />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-semibold text-[#717971]">
                  đ
                </span>
              </div>
              <FieldError message={fieldErrors.basePrice} />
            </label>

            <label className="space-y-1">
              <span className="text-xs font-semibold text-[#717971]">Giá vốn</span>
              <div className="relative">
                <input
                  className={`w-full rounded-xl border-none bg-white p-3 pr-10 text-sm focus:ring-2 focus:ring-[#356647]/20 ${fieldErrors.costPrice ? 'ring-2 ring-[#b42318]/40' : ''}`}
                  inputMode="decimal"
                  placeholder="120.000"
                  value={form.costPrice}
                  onChange={updatePriceField('costPrice')}
                />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-semibold text-[#717971]">
                  đ
                </span>
              </div>
              <FieldError message={fieldErrors.costPrice} />
            </label>

            <label className="space-y-1">
              <span className="text-xs font-semibold text-[#717971]">Giá bán lẻ</span>
              <div className="relative">
                <input
                  className={`w-full rounded-xl border-none bg-white p-3 pr-10 text-sm focus:ring-2 focus:ring-[#356647]/20 ${fieldErrors.retailPrice ? 'ring-2 ring-[#b42318]/40' : ''}`}
                  inputMode="decimal"
                  placeholder="180.000"
                  value={form.retailPrice}
                  onChange={updatePriceField('retailPrice')}
                />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-semibold text-[#717971]">
                  đ
                </span>
              </div>
              <FieldError message={fieldErrors.retailPrice} />
            </label>

            <label className="space-y-1">
              <span className="text-xs font-semibold text-[#717971]">Tồn tối thiểu</span>
              <input
                className={`w-full rounded-xl border-none bg-white p-3 text-sm focus:ring-2 focus:ring-[#356647]/20 ${fieldErrors.minStock ? 'ring-2 ring-[#b42318]/40' : ''}`}
                inputMode="numeric"
                placeholder="5"
                value={form.minStock}
                onChange={updateField('minStock')}
              />
              <FieldError message={fieldErrors.minStock} />
            </label>

            <label className="space-y-1">
              <span className="text-xs font-semibold text-[#717971]">Tồn tối đa</span>
              <input
                className={`w-full rounded-xl border-none bg-white p-3 text-sm focus:ring-2 focus:ring-[#356647]/20 ${fieldErrors.maxStock ? 'ring-2 ring-[#b42318]/40' : ''}`}
                inputMode="numeric"
                placeholder="100"
                value={form.maxStock}
                onChange={updateField('maxStock')}
              />
              <FieldError message={fieldErrors.maxStock} />
            </label>

            <label className={`space-y-1 ${isColumnLayout ? '' : 'md:col-span-2'}`}>
              <span className="text-xs font-semibold text-[#717971]">URL ảnh</span>
              <input
                className={`w-full rounded-xl border-none bg-white p-3 text-sm focus:ring-2 focus:ring-[#356647]/20 ${fieldErrors.imageUrl ? 'ring-2 ring-[#b42318]/40' : ''}`}
                placeholder="https://example.com/tea.jpg"
                value={form.imageUrl}
                onChange={updateField('imageUrl')}
              />
              <FieldError message={fieldErrors.imageUrl} />
              <ProductImagePreview src={form.imageUrl} alt={form.skuCode || 'Ảnh SKU'} />
            </label>

            <div className={`grid gap-3 ${isColumnLayout ? '' : 'md:col-span-2 md:grid-cols-2'}`}>
              <label className="flex items-center gap-2 rounded-xl bg-white p-3">
                <input
                  type="checkbox"
                  checked={form.isSellable}
                  onChange={(event) => setForm((prev) => ({ ...prev, isSellable: event.target.checked }))}
                />
                <span className="text-sm text-slate-700">Cho phép bán trực tiếp</span>
              </label>
              <label className="flex items-center gap-2 rounded-xl bg-white p-3">
                <input
                  type="checkbox"
                  checked={form.allowRewardPoints}
                  onChange={(event) => setForm((prev) => ({ ...prev, allowRewardPoints: event.target.checked }))}
                />
                <span className="text-sm text-slate-700">Tích điểm thưởng</span>
              </label>
            </div>

            {editingId ? (
              <label className={`flex items-center gap-2 ${isColumnLayout ? '' : 'md:col-span-2'}`}>
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(event) => setForm((prev) => ({ ...prev, isActive: event.target.checked }))}
                />
                <span className="text-sm text-slate-700">Đang bán</span>
              </label>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-xl bg-[#538463] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#457053] disabled:opacity-50"
            >
              {isSaving ? 'Đang lưu...' : editingId ? 'Cập nhật SKU' : 'Thêm SKU'}
            </button>
            {editingId ? (
              <button type="button" className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700" onClick={resetForm}>
                Hủy
              </button>
            ) : null}
          </div>
        </form>
      ) : null}

      {isLoading ? (
        <p className="text-sm text-slate-500">Đang tải SKU...</p>
      ) : skus.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
          Chưa có SKU nào. {canManage ? 'Thêm biến thể đầu tiên ở form phía trên.' : ''}
        </p>
      ) : (
        <div className="space-y-3">
          {skus.map((sku) => {
            const status = getProductStatusMeta(sku.isActive)
            const quantityOnHand = Number(stockBySkuId.get(sku.id) ?? 0)
            return (
              <div key={sku.id} className="flex flex-col gap-3 rounded-xl border border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  {sku.imageUrl ? (
                    <a
                      href={sku.imageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Mở ảnh SKU"
                      className="shrink-0"
                    >
                      <ProductImage src={sku.imageUrl} alt={sku.skuCode} className="h-16 w-16 rounded-xl" />
                    </a>
                  ) : (
                    <ProductImage src="" alt={sku.skuCode} className="h-16 w-16 rounded-xl" />
                  )}
                  <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-mono text-sm font-bold text-[#356647]">{sku.skuCode}</p>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${status.className}`}>{status.label}</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-700">{sku.packagingType}</p>
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
                      quantityOnHand <= 0 ? 'text-[#b42318]' : quantityOnHand <= 5 ? 'text-[#7e5700]' : 'text-[#356647]'
                    }`}
                  >
                    {stockLabel}: {formatStockQuantity(quantityOnHand)}
                  </p>
                  </div>
                </div>

                {canManage || (!warehouseStockView && canAdjustStock) ? (
                  <div className="flex flex-wrap items-center gap-2">
                    {!warehouseStockView && canAdjustStock ? (
                      <button
                        type="button"
                        className="rounded-lg px-3 py-2 text-sm font-semibold text-[#356647] hover:bg-[#356647]/5"
                        onClick={() => setStockModalSku(sku)}
                      >
                        Gửi yêu cầu điều chỉnh
                      </button>
                    ) : null}
                    {canManage ? (
                      <>
                        <button type="button" className="rounded-lg px-3 py-2 text-sm font-semibold text-[#356647] hover:bg-[#356647]/5" onClick={() => startEdit(sku)}>
                          Sửa
                        </button>
                        <button type="button" className="rounded-lg px-3 py-2 text-sm font-semibold text-[#b42318] hover:bg-[#fff5f5]" onClick={() => handleDelete(sku)}>
                          Xóa
                        </button>
                      </>
                    ) : null}
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      )}

      {stockModalSku ? (
        <AdjustSkuStockModal
          sku={stockModalSku}
          productName={productName}
          quantityOnHand={Number(stockBySkuId.get(stockModalSku.id) ?? 0)}
          onClose={() => setStockModalSku(null)}
        />
      ) : null}
    </div>
  )
}

export default ProductSkusPanel
