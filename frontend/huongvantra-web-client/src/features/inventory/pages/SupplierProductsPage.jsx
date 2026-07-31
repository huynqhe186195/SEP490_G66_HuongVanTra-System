import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import PageHeader from '../../../components/shared/PageHeader.jsx'
import PageShell from '../../../components/shared/PageShell.jsx'
import TablePagination, { TABLE_PAGE_SIZE } from '../../../components/shared/TablePagination.jsx'
import { confirmDialog } from '../../../app/dialog.js'
import { showError, showSuccess } from '../../../app/toast.js'
import { formatVnd, formatVndInput, parseVndInput, sanitizeVndInput } from '../../../utils/vietnamCurrency.js'
import { loadAuthSession } from '../../auth/services/authSession.js'
import { canManageSuppliers } from '../../auth/utils/permissions.js'
import { fetchSupplierReceiptSkus } from '../../products/services/productSkusApi.js'
import { isSupplierReceiptEligibleSku } from '../../products/services/productsApi.js'
import { fetchActiveSuppliers } from '../services/suppliersApi.js'
import {
  createSupplierProduct,
  deactivateSupplierProduct,
  fetchSupplierProductPriceHistory,
  fetchSupplierProducts,
  importSupplierProducts,
  restoreSupplierProduct,
  updateSupplierProduct,
  updateSupplierProductPrice,
} from '../services/supplierProductsApi.js'
import {
  downloadSupplierProductsTemplate,
  parseSupplierProductsExcel,
} from '../utils/supplierProductsExcel.js'

const PRODUCT_TYPE_OPTIONS = [
  { value: 'NGUYEN_LIEU', label: 'Nguyên liệu' },
  { value: 'BAO_BI', label: 'Bao bì' },
  { value: 'THANH_PHAM', label: 'Thành phẩm' },
]

const PRODUCT_TYPE_CHIP = {
  NGUYEN_LIEU: 'bg-violet-50 text-violet-700',
  BAO_BI: 'bg-amber-50 text-amber-700',
  THANH_PHAM: 'bg-emerald-50 text-emerald-700',
}

function productTypeLabel(value) {
  return PRODUCT_TYPE_OPTIONS.find((o) => o.value === value)?.label ?? (value || '—')
}

function formatDate(value) {
  if (!value) return '—'
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('vi-VN')
}

function formatDateTime(value) {
  if (!value) return '—'
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('vi-VN')
}

function todayInputValue() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const EMPTY_FORM = {
  skuId: '',
  supplierItemCode: '',
  supplierItemName: '',
  quotedPrice: '',
  isPrimarySource: false,
  note: '',
}

/** BR-07 giá chào > 0 khi có điền. */
function validateField(field, value) {
  const text = String(value ?? '').trim()
  switch (field) {
    case 'skuId':
      return text ? '' : 'Vui lòng chọn mặt hàng.'
    case 'supplierItemCode':
      return text.length > 50 ? 'Mã hàng nhà cung cấp tối đa 50 ký tự.' : ''
    case 'supplierItemName':
      return text.length > 255 ? 'Tên hàng nhà cung cấp tối đa 255 ký tự.' : ''
    case 'quotedPrice': {
      if (!text) return ''
      const price = parseVndInput(text)
      if (!Number.isFinite(price) || price <= 0) return 'Giá chào phải lớn hơn 0.'
      return ''
    }
    case 'note':
      return text.length > 1000 ? 'Ghi chú tối đa 1000 ký tự.' : ''
    default:
      return ''
  }
}

function validateForm(form, { requireSku }) {
  const fields = ['supplierItemCode', 'supplierItemName', 'quotedPrice', 'note']
  if (requireSku) fields.unshift('skuId')
  const errors = {}
  for (const field of fields) {
    const msg = validateField(field, form[field])
    if (msg) errors[field] = msg
  }
  return errors
}

function StatusChip({ isActive }) {
  return isActive ? (
    <span className="rounded-full bg-[#e8f0e9] px-2 py-0.5 text-xs font-semibold text-[#356647]">Đang cung ứng</span>
  ) : (
    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">Đã ngừng</span>
  )
}

function SkuPicker({ disabled, hasError, onSelect, skus, value }) {
  const [query, setQuery] = useState('')
  const selected = skus.find((s) => s.id === value) ?? null

  const options = useMemo(() => {
    const text = query.trim().toLowerCase()
    const list = text
      ? skus.filter((s) =>
          `${s.skuCode} ${s.productName} ${s.variantName}`.toLowerCase().includes(text))
      : skus
    return list.slice(0, 30)
  }, [query, skus])

  if (selected) {
    return (
      <div className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 ${hasError ? 'border-red-400' : 'border-[#c1c9c0]'}`}>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[#1b1c17]">{selected.productName}</p>
          <p className="truncate font-mono text-xs text-[#717971]">
            {selected.skuCode} · {productTypeLabel(selected.productType)} · {selected.inventoryUnit || selected.unitName || '—'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => { onSelect(null); setQuery('') }}
          className="shrink-0 text-[#717971] hover:text-[#1b1c17]">
          <span className="material-symbols-outlined text-[18px]">close</span>
        </button>
      </div>
    )
  }

  return (
    <div className="group relative">
      <input
        type="text"
        disabled={disabled}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={disabled ? 'Đang tải danh mục hàng...' : 'Tìm theo mã SKU hoặc tên hàng...'}
        className={`w-full rounded-lg border bg-white px-3 py-2 text-sm text-[#1b1c17] outline-none focus:ring-1 ${
          hasError
            ? 'border-red-400 focus:border-red-500 focus:ring-red-500'
            : 'border-[#c1c9c0] focus:border-[#356647] focus:ring-[#356647]'
        }`}
      />
      <div className="custom-scrollbar absolute left-0 right-0 top-full z-30 mt-1 hidden max-h-60 overflow-y-auto rounded-lg border border-[#c1c9c0] bg-white shadow-lg group-focus-within:block">
        {options.length === 0 ? (
          <p className="px-3 py-3 text-xs text-[#717971]">Không tìm thấy mặt hàng phù hợp.</p>
        ) : (
          options.map((sku) => (
            <button
              key={sku.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onSelect(sku); setQuery('') }}
              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-[#f5f7f4]">
              <span className="min-w-0">
                <span className="block truncate text-sm text-[#1b1c17]">{sku.productName}</span>
                <span className="block truncate font-mono text-xs text-[#717971]">{sku.skuCode}</span>
              </span>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${PRODUCT_TYPE_CHIP[sku.productType] ?? 'bg-slate-100 text-slate-600'}`}>
                {productTypeLabel(sku.productType)}
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  )
}

function SupplierProductFormModal({ initial, onClose, onSaved, skuCatalog, skuCatalogLoading, supplierId, supplierName }) {
  const isEdit = Boolean(initial?.id)
  const [form, setForm] = useState(() => (
    isEdit
      ? {
          skuId: initial.skuId ?? '',
          supplierItemCode: initial.supplierItemCode ?? '',
          supplierItemName: initial.supplierItemName ?? '',
          quotedPrice: initial.quotedPrice == null ? '' : String(initial.quotedPrice),
          isPrimarySource: Boolean(initial.isPrimarySource),
          note: initial.note ?? '',
        }
      : EMPTY_FORM
  ))
  const [errors, setErrors] = useState({})
  const [touched, setTouched] = useState({})
  const [saving, setSaving] = useState(false)

  const set = (field) => (e) => {
    const value = field === 'isPrimarySource'
      ? e.target.checked
      : field === 'quotedPrice'
        ? sanitizeVndInput(e.target.value)
        : e.target.value
    setForm((prev) => ({ ...prev, [field]: value }))
    if (touched[field]) setErrors((prev) => ({ ...prev, [field]: validateField(field, value) }))
  }

  const handleBlur = (field) => () => {
    setTouched((prev) => ({ ...prev, [field]: true }))
    setErrors((prev) => ({ ...prev, [field]: validateField(field, form[field]) }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const nextErrors = validateForm(form, { requireSku: !isEdit })
    setErrors(nextErrors)
    setTouched({
      skuId: true, supplierItemCode: true, supplierItemName: true,
      quotedPrice: true, note: true,
    })
    if (Object.keys(nextErrors).length > 0) {
      showError('Vui lòng kiểm tra lại thông tin đã nhập.')
      return
    }

    const payload = {
      skuId: form.skuId,
      supplierItemCode: form.supplierItemCode,
      supplierItemName: form.supplierItemName,
      quotedPrice: form.quotedPrice === '' ? null : parseVndInput(form.quotedPrice),
      isPrimarySource: form.isPrimarySource,
      note: form.note,
    }

    setSaving(true)
    try {
      const saved = isEdit
        ? await updateSupplierProduct(initial.id, payload)
        : await createSupplierProduct(supplierId, payload)
      showSuccess(isEdit ? 'Đã cập nhật mặt hàng.' : 'Đã thêm mặt hàng vào danh mục.')
      onSaved(saved)
    } catch (err) {
      showError(err?.message ?? 'Lưu thất bại.')
    } finally {
      setSaving(false)
    }
  }

  const inputCls = (field) =>
    `w-full rounded-lg border bg-white px-3 py-2 text-sm text-[#1b1c17] outline-none focus:ring-1 ${
      errors[field]
        ? 'border-red-400 focus:border-red-500 focus:ring-red-500'
        : 'border-[#c1c9c0] focus:border-[#356647] focus:ring-[#356647]'
    }`

  const fieldError = (field) =>
    errors[field] ? <p className="mt-1 text-xs text-red-500">{errors[field]}</p> : null

  return (
    <div className="inventory-modal fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[#c1c9c0] bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-[#1b1c17]">
              {isEdit ? 'Cập nhật mặt hàng cung ứng' : 'Thêm mặt hàng cung ứng'}
            </h2>
            <p className="truncate text-xs text-[#717971]">{supplierName}</p>
          </div>
          <button type="button" onClick={onClose} className="text-[#717971] hover:text-[#1b1c17]">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-[#414942]">
              Mặt hàng <span className="text-red-500">*</span>
            </label>
            {isEdit ? (
              <div className="rounded-lg border border-[#c1c9c0] bg-[#f5f7f4] px-3 py-2">
                <p className="text-sm font-semibold text-[#1b1c17]">{initial.skuNameSnapshot}</p>
                <p className="font-mono text-xs text-[#717971]">
                  {initial.skuCodeSnapshot} · {productTypeLabel(initial.productTypeSnapshot)} · {initial.inventoryUnitSnapshot}
                </p>
              </div>
            ) : (
              <>
                <SkuPicker
                  disabled={skuCatalogLoading}
                  hasError={!!errors.skuId}
                  skus={skuCatalog}
                  value={form.skuId}
                  onSelect={(sku) => {
                    setForm((prev) => ({ ...prev, skuId: sku?.id ?? '' }))
                    setErrors((prev) => ({ ...prev, skuId: undefined }))
                  }}
                />
                {fieldError('skuId')}
              </>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#414942]">Mã hàng của NCC</label>
              <input
                className={inputCls('supplierItemCode')}
                value={form.supplierItemCode}
                onChange={set('supplierItemCode')}
                onBlur={handleBlur('supplierItemCode')}
                maxLength={50}
                placeholder="Có thể để trống"
              />
              {fieldError('supplierItemCode')}
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#414942]">Tên hàng theo NCC</label>
              <input
                className={inputCls('supplierItemName')}
                value={form.supplierItemName}
                onChange={set('supplierItemName')}
                onBlur={handleBlur('supplierItemName')}
                maxLength={255}
                placeholder="Có thể để trống"
              />
              {fieldError('supplierItemName')}
            </div>
          </div>

          {isEdit ? null : (
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#414942]">Giá chào (VNĐ)</label>
              <input
                type="text"
                inputMode="numeric"
                className={inputCls('quotedPrice')}
                value={formatVndInput(form.quotedPrice)}
                onChange={set('quotedPrice')}
                onBlur={handleBlur('quotedPrice')}
                placeholder="Có thể để trống"
              />
              {fieldError('quotedPrice')}
            </div>
          )}

          <label className="flex cursor-pointer items-center gap-2 text-sm text-[#414942]">
            <input
              type="checkbox"
              checked={form.isPrimarySource}
              onChange={set('isPrimarySource')}
              className="accent-[#356647]"
            />
            Đặt làm nguồn cung chính cho mặt hàng này
          </label>
          {form.isPrimarySource ? (
            <p className="-mt-2 text-xs text-[#717971]">
              Mỗi mặt hàng chỉ có một nguồn cung chính — nhà cung cấp đang giữ cờ này sẽ tự động bị bỏ.
            </p>
          ) : null}

          <div>
            <label className="mb-1 block text-xs font-semibold text-[#414942]">Ghi chú</label>
            <textarea
              className={inputCls('note') + ' resize-none'}
              rows={2}
              value={form.note}
              onChange={set('note')}
              onBlur={handleBlur('note')}
              maxLength={1000}
            />
            {fieldError('note')}
          </div>

          {isEdit ? (
            <p className="rounded-lg bg-[#f5f7f4] px-3 py-2 text-xs text-[#717971]">
              Giá chào được đổi riêng ở nút “Đổi giá” để mọi lần thay đổi đều được ghi vào lịch sử giá.
            </p>
          ) : null}

          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[#c1c9c0] px-4 py-2 text-sm text-[#414942] hover:bg-[#f5f7f4]">
              Hủy
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-[#356647] px-5 py-2 text-sm font-bold text-white hover:bg-[#2a5238] disabled:opacity-50">
              {saving ? 'Đang lưu...' : 'Lưu'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function PriceChangeModal({ item, onClose, onSaved }) {
  const [quotedPrice, setQuotedPrice] = useState(item.quotedPrice == null ? '' : String(item.quotedPrice))
  const [effectiveDate, setEffectiveDate] = useState(todayInputValue())
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    const msg = validateField('quotedPrice', quotedPrice)
    setError(msg)
    if (msg) return

    setSaving(true)
    try {
      const saved = await updateSupplierProductPrice(item.id, {
        quotedPrice: quotedPrice === '' ? null : parseVndInput(quotedPrice),
        effectiveDate: effectiveDate || null,
        reason,
      })
      showSuccess('Đã cập nhật giá chào.')
      onSaved(saved)
    } catch (err) {
      showError(err?.message ?? 'Cập nhật giá thất bại.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="inventory-modal fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl border border-[#c1c9c0] bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-[#1b1c17]">Đổi giá chào</h2>
            <p className="truncate text-xs text-[#717971]">{item.skuCodeSnapshot} · {item.skuNameSnapshot}</p>
          </div>
          <button type="button" onClick={onClose} className="text-[#717971] hover:text-[#1b1c17]">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div className="rounded-lg bg-[#f5f7f4] px-3 py-2 text-sm text-[#414942]">
            Giá chào hiện tại: <span className="font-semibold text-[#1b1c17]">{item.quotedPrice == null ? 'Chưa có' : formatVnd(item.quotedPrice)}</span>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-[#414942]">Giá chào mới (VNĐ)</label>
            <input
              type="text"
              inputMode="numeric"
              value={formatVndInput(quotedPrice)}
              onChange={(e) => { setQuotedPrice(sanitizeVndInput(e.target.value)); setError('') }}
              placeholder="Để trống nghĩa là xóa giá chào"
              className={`w-full rounded-lg border bg-white px-3 py-2 text-sm text-[#1b1c17] outline-none focus:ring-1 ${
                error
                  ? 'border-red-400 focus:border-red-500 focus:ring-red-500'
                  : 'border-[#c1c9c0] focus:border-[#356647] focus:ring-[#356647]'
              }`}
            />
            {error ? <p className="mt-1 text-xs text-red-500">{error}</p> : null}
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-[#414942]">Ngày hiệu lực</label>
            <input
              type="date"
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
              className="w-full rounded-lg border border-[#c1c9c0] bg-white px-3 py-2 text-sm text-[#1b1c17] outline-none focus:border-[#356647] focus:ring-1 focus:ring-[#356647]"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-[#414942]">Lý do thay đổi</label>
            <textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
              placeholder="VD: nhà cung cấp báo giá mới theo chứng từ ngày 20/07"
              className="w-full resize-none rounded-lg border border-[#c1c9c0] bg-white px-3 py-2 text-sm text-[#1b1c17] outline-none focus:border-[#356647] focus:ring-1 focus:ring-[#356647]"
            />
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[#c1c9c0] px-4 py-2 text-sm text-[#414942] hover:bg-[#f5f7f4]">
              Hủy
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-[#356647] px-5 py-2 text-sm font-bold text-white hover:bg-[#2a5238] disabled:opacity-50">
              {saving ? 'Đang lưu...' : 'Cập nhật giá'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function PriceHistoryModal({ item, onClose }) {
  const [rows, setRows] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetchSupplierProductPriceHistory(item.id)
      .then((data) => { if (!cancelled) setRows(data) })
      .catch((err) => { if (!cancelled) showError(err?.message ?? 'Không tải được lịch sử giá.') })
      .finally(() => { if (!cancelled) setIsLoading(false) })
    return () => { cancelled = true }
  }, [item.id])

  return (
    <div className="inventory-modal fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[#c1c9c0] bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-[#1b1c17]">Lịch sử giá chào</h2>
            <p className="truncate text-xs text-[#717971]">
              {item.supplierName} · {item.skuCodeSnapshot} · {item.skuNameSnapshot}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-[#717971] hover:text-[#1b1c17]">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {isLoading ? (
          <p className="py-8 text-center text-sm text-[#717971]">Đang tải...</p>
        ) : rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-[#717971]">Chưa có lần đổi giá nào.</p>
        ) : (
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-[#c1c9c0] text-left text-xs font-semibold text-[#717971]">
                <th className="pb-2 pr-4">Ngày hiệu lực</th>
                <th className="pb-2 pr-4 text-right">Giá cũ</th>
                <th className="pb-2 pr-4 text-right">Giá mới</th>
                <th className="pb-2 pr-4">Người đổi</th>
                <th className="pb-2 pr-4">Thời điểm ghi</th>
                <th className="pb-2">Lý do</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-[#f0f4f0] last:border-0">
                  <td className="py-3 pr-4 text-[#414942]">{formatDate(row.effectiveDate)}</td>
                  <td className="py-3 pr-4 text-right text-[#717971]">{row.oldPrice == null ? '—' : formatVnd(row.oldPrice)}</td>
                  <td className="py-3 pr-4 text-right font-semibold text-[#1b1c17]">{row.newPrice == null ? '—' : formatVnd(row.newPrice)}</td>
                  <td className="py-3 pr-4 text-[#414942]">{row.changedByName || '—'}</td>
                  <td className="py-3 pr-4 text-xs text-[#717971]">{formatDateTime(row.changedAt)}</td>
                  <td className="py-3 text-xs text-[#717971]">{row.reason || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

const IMPORT_ROW_PREVIEW_LIMIT = 30

function ImportRowList({ emptyText, rows, tone, title }) {
  const toneCls = tone === 'error'
    ? 'border-[#93000a]/20 bg-[#ffdad6]/30 text-[#93000a]'
    : 'border-[#7e5700]/20 bg-[#fec25b]/15 text-[#7e5700]'
  const shown = rows.slice(0, IMPORT_ROW_PREVIEW_LIMIT)

  return (
    <div className={`rounded-xl border p-4 ${toneCls}`}>
      <p className="text-sm font-bold">{title} ({rows.length})</p>
      {rows.length === 0 ? (
        <p className="mt-1 text-xs opacity-80">{emptyText}</p>
      ) : (
        <>
          <ul className="mt-2 space-y-1 text-xs">
            {shown.map((row) => (
              <li key={`${row.rowNumber}-${row.skuCode}`}>
                <b>Dòng {row.rowNumber}</b>
                {row.skuCode ? ` · ${row.skuCode}` : ''} — {row.messages.join(' ') || 'Không rõ nguyên nhân.'}
              </li>
            ))}
          </ul>
          {rows.length > shown.length ? (
            <p className="mt-2 text-xs opacity-80">
              ... và {rows.length - shown.length} dòng nữa.
            </p>
          ) : null}
        </>
      )}
    </div>
  )
}

/**
 * Import 5 cột từ Excel. Mã SKU được tra sang skuId ngay tại client bằng danh mục
 * đã nạp sẵn của trang — backend chỉ nhận Guid nên không phải gọi thêm ProductService.
 */
function SupplierProductImportModal({ onClose, onImported, skuCatalog, supplierId, supplierName }) {
  const [fileName, setFileName] = useState('')
  const [parsedRows, setParsedRows] = useState([])
  const [unknownRows, setUnknownRows] = useState([])
  const [parseErrors, setParseErrors] = useState([])
  const [result, setResult] = useState(null)
  const [isImporting, setIsImporting] = useState(false)

  const skuByCode = useMemo(() => {
    const map = new Map()
    for (const sku of skuCatalog) {
      if (sku.skuCode) map.set(String(sku.skuCode).trim().toUpperCase(), sku.id)
    }
    return map
  }, [skuCatalog])

  async function handleFileChange(event) {
    const file = event.target.files?.[0]
    setResult(null)
    setParsedRows([])
    setUnknownRows([])
    setParseErrors([])
    setFileName(file?.name ?? '')
    if (!file) return

    try {
      const buffer = await file.arrayBuffer()
      const { rawLines, errors } = parseSupplierProductsExcel(buffer)
      const matched = []
      const unknown = []
      for (const line of rawLines) {
        const skuId = line.skuCode ? skuByCode.get(line.skuCode) : null
        if (skuId) matched.push({ ...line, skuId })
        else {
          unknown.push({
            rowNumber: line.rowNumber,
            skuCode: line.skuCode,
            messages: [line.skuCode
              ? 'Mã SKU không có trong danh mục được phép nhập từ nhà cung cấp.'
              : 'Thiếu mã SKU.'],
          })
        }
      }
      setParsedRows(matched)
      setUnknownRows(unknown)
      setParseErrors(errors)
    } catch {
      setParseErrors(['Không đọc được file. Hãy dùng file mẫu từ nút “Tải file mẫu”.'])
    }
  }

  async function handleImport() {
    if (parsedRows.length === 0) {
      showError('Không có dòng hợp lệ nào để import.')
      return
    }
    setIsImporting(true)
    try {
      const data = await importSupplierProducts(supplierId, parsedRows)
      setResult(data)
      if (data.successCount + data.warningCount > 0) {
        showSuccess(`Đã thêm ${data.successCount + data.warningCount} mặt hàng vào danh mục.`)
        onImported()
      } else {
        showError('Không có dòng nào được thêm. Xem chi tiết lỗi bên dưới.')
      }
    } catch (err) {
      showError(err?.message ?? 'Import thất bại.')
    } finally {
      setIsImporting(false)
    }
  }

  const errorRows = [...unknownRows, ...(result?.rows ?? []).filter((r) => r.status === 'Error')]
  const warningRows = (result?.rows ?? []).filter((r) => r.status === 'Warning')

  return (
    <div
      className="inventory-modal fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={isImporting ? undefined : onClose}
      role="presentation">
      <div
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[#c1c9c0] bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true">
        <div className="flex items-start justify-between border-b border-[#f0f4f0] p-5">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-[#1b1c17]">Import danh mục hàng cung ứng</h2>
            <p className="truncate text-xs text-[#717971]">{supplierName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isImporting}
            aria-label="Đóng"
            className="text-[#717971] hover:text-[#1b1c17] disabled:opacity-50">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="custom-scrollbar flex-1 space-y-4 overflow-y-auto p-5">
          <div>
            <label className="mb-1 block text-xs font-semibold text-[#414942]">File Excel (.xlsx)</label>
            <input
              type="file"
              accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              disabled={isImporting}
              onChange={handleFileChange}
              className="w-full rounded-lg border border-[#c1c9c0] bg-[#f5f7f4] px-3 py-2.5 text-sm text-[#414942] file:mr-3 file:rounded-lg file:border-0 file:bg-[#356647] file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white"
            />
            <p className="mt-1 text-xs text-[#717971]">
              5 cột: Mã SKU (bắt buộc), Mã hàng của NCC, Tên hàng theo NCC, Giá chào (VNĐ), Ghi chú.
              Dòng lỗi sẽ bị bỏ qua, các dòng hợp lệ vẫn được thêm.
            </p>
          </div>

          {parseErrors.length > 0 ? (
            <div className="rounded-xl border border-[#93000a]/20 bg-[#ffdad6]/30 p-4 text-xs text-[#93000a]">
              {parseErrors.map((message) => <p key={message}>{message}</p>)}
            </div>
          ) : null}

          {fileName && parseErrors.length === 0 ? (
            <div className="rounded-lg bg-[#f5f7f4] px-3 py-2 text-sm text-[#414942]">
              <b>{fileName}</b> — {parsedRows.length} dòng sẵn sàng import
              {unknownRows.length > 0 ? `, ${unknownRows.length} dòng không khớp mã SKU` : ''}.
            </div>
          ) : null}

          {result || unknownRows.length > 0 ? (
            <div className="space-y-4">
              {result ? (
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <div className="rounded-xl border border-[#c1c9c0] bg-[#f5f7f4] p-4">
                    <p className="text-xs text-[#717971]">Tổng số dòng</p>
                    <p className="mt-1 text-2xl font-bold text-[#1b1c17]">{result.totalRows + unknownRows.length}</p>
                  </div>
                  <div className="rounded-xl border border-[#356647]/20 bg-[#e8f0e9] p-4">
                    <p className="text-xs text-[#356647]">Thành công</p>
                    <p className="mt-1 text-2xl font-bold text-[#356647]">{result.successCount}</p>
                  </div>
                  <div className="rounded-xl border border-[#7e5700]/20 bg-[#fec25b]/20 p-4">
                    <p className="text-xs text-[#7e5700]">Cảnh báo</p>
                    <p className="mt-1 text-2xl font-bold text-[#7e5700]">{result.warningCount}</p>
                  </div>
                  <div className="rounded-xl border border-[#93000a]/20 bg-[#ffdad6]/40 p-4">
                    <p className="text-xs text-[#93000a]">Lỗi</p>
                    <p className="mt-1 text-2xl font-bold text-[#93000a]">{result.failedCount + unknownRows.length}</p>
                  </div>
                </div>
              ) : null}

              <ImportRowList
                title="Dòng bị bỏ qua"
                emptyText="Không có dòng nào bị bỏ qua."
                rows={errorRows}
                tone="error"
              />
              {result ? (
                <ImportRowList
                  title="Đã thêm kèm cảnh báo"
                  emptyText="Không có cảnh báo."
                  rows={warningRows}
                  tone="warning"
                />
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap justify-end gap-3 border-t border-[#f0f4f0] bg-[#f5f7f4]/60 p-4">
          <button
            type="button"
            disabled={isImporting}
            onClick={() => downloadSupplierProductsTemplate(skuCatalog.slice(0, 3).map((s) => s.skuCode))}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#c1c9c0] bg-white px-4 py-2 text-sm font-semibold text-[#356647] hover:bg-[#e8f0e9] disabled:opacity-50">
            <span className="material-symbols-outlined text-[18px]">download</span>
            Tải file mẫu
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={isImporting}
            className="rounded-lg border border-[#c1c9c0] bg-white px-4 py-2 text-sm text-[#414942] hover:bg-[#f5f7f4] disabled:opacity-50">
            Đóng
          </button>
          <button
            type="button"
            onClick={handleImport}
            disabled={isImporting || parsedRows.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#356647] px-5 py-2 text-sm font-bold text-white hover:bg-[#2a5238] disabled:cursor-not-allowed disabled:opacity-50">
            <span className={`material-symbols-outlined text-[18px] ${isImporting ? 'animate-spin' : ''}`}>upload_file</span>
            {isImporting ? 'Đang import...' : 'Import Excel'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function SupplierProductsPage() {
  const [searchParams, setSearchParams] = useSearchParams()

  const [items, setItems] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [suppliers, setSuppliers] = useState([])
  const [skuCatalog, setSkuCatalog] = useState([])
  const [isSkuCatalogLoading, setIsSkuCatalogLoading] = useState(true)

  const [supplierId, setSupplierId] = useState(searchParams.get('supplierId') ?? '')
  const [search, setSearch] = useState('')
  const [productType, setProductType] = useState('')
  const [includeInactive, setIncludeInactive] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(TABLE_PAGE_SIZE)
  const [totalItems, setTotalItems] = useState(0)

  const [formTarget, setFormTarget] = useState(null)
  const [priceTarget, setPriceTarget] = useState(null)
  const [historyTarget, setHistoryTarget] = useState(null)
  const [isImportOpen, setIsImportOpen] = useState(false)

  const searchTimerRef = useRef(null)
  const canManage = canManageSuppliers(loadAuthSession())

  const selectedSupplier = suppliers.find((s) => s.id === supplierId) ?? null

  const load = useCallback(async (params = {}) => {
    const next = {
      supplierId, search, productType, includeInactive, page, pageSize, ...params,
    }
    setIsLoading(true)
    try {
      const result = await fetchSupplierProducts(next)
      setItems(result.items)
      setTotalItems(result.totalItems)
    } catch (err) {
      showError(err?.message ?? 'Không tải được danh mục sản phẩm nhà cung cấp.')
    } finally {
      setIsLoading(false)
    }
  }, [supplierId, search, productType, includeInactive, page, pageSize])

  useEffect(() => {
    const timer = setTimeout(() => { void load() }, 0)
    return () => clearTimeout(timer)
  }, [load])

  useEffect(() => {
    fetchActiveSuppliers()
      .then(setSuppliers)
      .catch((err) => showError(err?.message ?? 'Không tải được danh sách nhà cung cấp.'))
  }, [])

  useEffect(() => {
    fetchSupplierReceiptSkus()
      .then((data) => setSkuCatalog(data.filter(isSupplierReceiptEligibleSku)))
      .catch((err) => showError(err?.message ?? 'Không tải được danh mục hàng.'))
      .finally(() => setIsSkuCatalogLoading(false))
  }, [])

  function handleSupplierChange(value) {
    setSupplierId(value)
    setPage(1)
    const next = new URLSearchParams(searchParams)
    if (value) next.set('supplierId', value)
    else next.delete('supplierId')
    setSearchParams(next, { replace: true })
  }

  function handleSearchChange(e) {
    const q = e.target.value
    setSearch(q)
    clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => setPage(1), 400)
  }

  function handleSaved() {
    setFormTarget(null)
    setPriceTarget(null)
    load()
  }

  async function handleDeactivate(item) {
    if (!(await confirmDialog({
      title: 'Ngừng cung ứng',
      message: `Ngừng cung ứng "${item.skuNameSnapshot}" từ ${item.supplierName}?`,
      tone: 'danger',
    }))) return
    try {
      await deactivateSupplierProduct(item.id)
      showSuccess('Đã đánh dấu ngừng cung ứng.')
      setIncludeInactive(true)
    } catch (err) {
      showError(err?.message ?? 'Không thể ngừng cung ứng.')
    }
  }

  async function handleRestore(item) {
    try {
      await restoreSupplierProduct(item.id)
      showSuccess('Đã khôi phục mặt hàng.')
      load()
    } catch (err) {
      showError(err?.message ?? 'Không thể khôi phục.')
    }
  }

  const colSpan = canManage ? 8 : 7

  return (
    <PageShell>
      <PageHeader
        title="Sản phẩm theo nhà cung cấp"
        titleInfo="Danh mục mặt hàng mỗi nhà cung cấp đang cung ứng, kèm mã hàng riêng, giá chào và lịch sử giá. Giá chào chỉ là tham chiếu khi lập phiếu nhập, không ghi đè giá vốn."
        rightContent={
          canManage ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={!supplierId}
                onClick={() => setIsImportOpen(true)}
                title={supplierId ? '' : 'Chọn nhà cung cấp trước khi import'}
                className="flex items-center gap-1.5 rounded-lg border border-[#c1c9c0] bg-white px-4 py-2 text-sm font-semibold text-[#356647] hover:bg-[#e8f0e9] disabled:cursor-not-allowed disabled:opacity-50">
                <span className="material-symbols-outlined text-base">upload_file</span>
                Import Excel
              </button>
              <button
                type="button"
                disabled={!supplierId}
                onClick={() => setFormTarget({ mode: 'create' })}
                title={supplierId ? '' : 'Chọn nhà cung cấp trước khi thêm mặt hàng'}
                className="flex items-center gap-1.5 rounded-lg bg-[#356647] px-4 py-2 text-sm font-bold text-white hover:bg-[#2a5238] disabled:cursor-not-allowed disabled:opacity-50">
                <span className="material-symbols-outlined text-base">add</span>
                Thêm mặt hàng
              </button>
            </div>
          ) : null
        }
      />

      <div className="flex flex-wrap items-center gap-3 p-4 pb-0">
        <select
          value={supplierId}
          onChange={(e) => handleSupplierChange(e.target.value)}
          className="min-w-[280px] flex-1 rounded-lg border border-[#c1c9c0] bg-white px-3 py-2 text-sm text-[#1b1c17] outline-none focus:border-[#356647]">
          <option value="">Tất cả nhà cung cấp</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>{s.supplierCode ? `${s.supplierCode} — ${s.name}` : s.name}</option>
          ))}
        </select>

        <select
          value={productType}
          onChange={(e) => { setProductType(e.target.value); setPage(1) }}
          className="min-w-[160px] flex-1 rounded-lg border border-[#c1c9c0] bg-white px-3 py-2 text-sm text-[#1b1c17] outline-none focus:border-[#356647]">
          <option value="">Tất cả loại hàng</option>
          {PRODUCT_TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        <div className="relative min-w-[220px] flex-[2]">
          <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-base text-[#717971]">
            search
          </span>
          <input
            type="text"
            placeholder="Tìm theo mã SKU, tên hàng, mã hàng NCC..."
            value={search}
            onChange={handleSearchChange}
            className="w-full rounded-lg border border-[#c1c9c0] bg-white py-2 pl-9 pr-3 text-sm text-[#1b1c17] outline-none focus:border-[#356647]"
          />
        </div>

        <label className="flex cursor-pointer items-center gap-2 text-sm text-[#414942]">
          <input
            type="checkbox"
            checked={includeInactive}
            onChange={(e) => { setIncludeInactive(e.target.checked); setPage(1) }}
            className="accent-[#356647]"
          />
          Hiện mục đã ngừng
        </label>
      </div>

      <div className="overflow-x-auto p-4">
        <table className="w-full min-w-[1080px] text-sm">
          <thead>
            <tr className="border-b border-[#c1c9c0] text-left text-xs font-semibold text-[#717971]">
              <th className="pb-2 pr-4">Nhà cung cấp</th>
              <th className="pb-2 pr-4">Mã SKU</th>
              <th className="pb-2 pr-4">Tên hàng</th>
              <th className="pb-2 pr-4">Loại</th>
              <th className="pb-2 pr-4">Mã / tên theo NCC</th>
              <th className="pb-2 pr-4 text-right">Giá chào</th>
              <th className="pb-2 pr-4">Trạng thái</th>
              {canManage && <th className="pb-2"></th>}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={colSpan} className="py-8 text-center text-sm text-[#717971]">Đang tải...</td></tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={colSpan} className="py-8 text-center text-sm text-[#717971]">
                  {supplierId ? 'Nhà cung cấp này chưa có mặt hàng nào trong danh mục.' : 'Chưa có mặt hàng nào trong danh mục.'}
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className="border-b border-[#f0f4f0] last:border-0 hover:bg-[#f5f7f4]">
                  <td className="py-3 pr-4">
                    <p className="text-[#1b1c17]">{item.supplierName || '—'}</p>
                    <p className="font-mono text-xs text-[#717971]">{item.supplierCodeSnapshot || '—'}</p>
                  </td>
                  <td className="py-3 pr-4 font-mono text-xs text-[#414942]">{item.skuCodeSnapshot}</td>
                  <td className="py-3 pr-4">
                    <p className="font-semibold text-[#1b1c17]">{item.skuNameSnapshot}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[#717971]">{item.inventoryUnitSnapshot}</span>
                      {item.isPrimarySource ? (
                        <span className="rounded-full bg-[#e8f0e9] px-2 py-0.5 text-[11px] font-semibold text-[#356647]">Nguồn chính</span>
                      ) : null}
                    </div>
                  </td>
                  <td className="py-3 pr-4">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${PRODUCT_TYPE_CHIP[item.productTypeSnapshot] ?? 'bg-slate-100 text-slate-600'}`}>
                      {productTypeLabel(item.productTypeSnapshot)}
                    </span>
                  </td>
                  <td className="py-3 pr-4 max-w-[180px]">
                    <p className="truncate font-mono text-xs text-[#414942]">{item.supplierItemCode || '—'}</p>
                    <p className="truncate text-xs text-[#717971]">{item.supplierItemName || '—'}</p>
                  </td>
                  <td className="py-3 pr-4 text-right text-[#1b1c17]">
                    {item.quotedPrice == null ? '—' : formatVnd(item.quotedPrice)}
                  </td>
                  <td className="py-3 pr-4"><StatusChip isActive={item.isActive} /></td>
                  {canManage && (
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setHistoryTarget(item)}
                          className="rounded-lg border border-[#c1c9c0] px-3 py-1 text-xs font-semibold text-[#414942] hover:border-[#356647] hover:bg-[#e8f0e9] hover:text-[#356647]">
                          Lịch sử giá
                        </button>
                        {item.isActive ? (
                          <>
                            <button
                              type="button"
                              onClick={() => setPriceTarget(item)}
                              className="rounded-lg border border-[#c1c9c0] px-3 py-1 text-xs font-semibold text-[#414942] hover:border-[#356647] hover:bg-[#e8f0e9] hover:text-[#356647]">
                              Đổi giá
                            </button>
                            <button
                              type="button"
                              onClick={() => setFormTarget({ mode: 'edit', item })}
                              className="rounded-lg border border-[#c1c9c0] px-3 py-1 text-xs font-semibold text-[#414942] hover:border-[#356647] hover:bg-[#e8f0e9] hover:text-[#356647]">
                              Sửa
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeactivate(item)}
                              className="rounded-lg border border-[#c1c9c0] px-3 py-1 text-xs font-semibold text-[#414942] hover:border-red-400 hover:bg-red-50 hover:text-red-600">
                              Ngừng
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleRestore(item)}
                            className="rounded-lg border border-[#c1c9c0] px-3 py-1 text-xs font-semibold text-[#414942] hover:border-[#356647] hover:bg-[#e8f0e9] hover:text-[#356647]">
                            Khôi phục
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>

        <TablePagination
          page={page}
          pageSize={pageSize}
          totalCount={totalItems}
          disabled={isLoading}
          itemLabel="mặt hàng"
          onPageChange={setPage}
          onPageSizeChange={(size) => { setPageSize(size); setPage(1) }}
        />
      </div>

      {formTarget ? (
        <SupplierProductFormModal
          initial={formTarget.item ?? null}
          skuCatalog={skuCatalog}
          skuCatalogLoading={isSkuCatalogLoading}
          supplierId={formTarget.item?.supplierId ?? supplierId}
          supplierName={formTarget.item?.supplierName ?? selectedSupplier?.name ?? ''}
          onClose={() => setFormTarget(null)}
          onSaved={handleSaved}
        />
      ) : null}

      {isImportOpen ? (
        <SupplierProductImportModal
          skuCatalog={skuCatalog}
          supplierId={supplierId}
          supplierName={selectedSupplier?.name ?? ''}
          onClose={() => setIsImportOpen(false)}
          onImported={load}
        />
      ) : null}

      {priceTarget ? (
        <PriceChangeModal
          item={priceTarget}
          onClose={() => setPriceTarget(null)}
          onSaved={handleSaved}
        />
      ) : null}

      {historyTarget ? (
        <PriceHistoryModal item={historyTarget} onClose={() => setHistoryTarget(null)} />
      ) : null}
    </PageShell>
  )
}
