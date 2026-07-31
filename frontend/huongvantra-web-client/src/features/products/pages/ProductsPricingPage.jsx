import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import PageHeader from '../../../components/shared/PageHeader.jsx'
import PageShell from '../../../components/shared/PageShell.jsx'
import { confirmDialog } from '../../../app/dialog.js'
import { showError, showSuccess } from '../../../app/toast.js'
import { AUTH_SESSION_CHANGED_EVENT, loadAuthSession } from '../../auth/services/authSession.js'
import { canCreateCatalog } from '../../auth/utils/permissions.js'
import { fetchProducts } from '../services/productsApi.js'
import {
  createPriceBook,
  deletePriceBook,
  fetchPriceBooks,
  updatePriceBook,
} from '../services/priceBooksApi.js'
import { formatProductPrice, formatProductPriceInput, parseProductPriceInput } from '../utils/productDisplay.js'

const EMPTY_ENTRY = {
  targetType: 'sku',
  targetId: '',
  price: '',
  startsAt: '',
  endsAt: '',
  isActive: true,
}

const EMPTY_FORM = {
  code: '',
  name: '',
  description: '',
  startsAt: '',
  endsAt: '',
  isActive: true,
  entries: [{ ...EMPTY_ENTRY }],
}

function toInputDateTime(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 16)
}

function entryTargetId(entry) {
  return entry.skuId || entry.variantId || entry.unitId || ''
}

function entryTargetType(entry) {
  if (entry.variantId) return 'variant'
  if (entry.unitId) return 'unit'
  return 'sku'
}

function FieldError({ message }) {
  if (!message) return null
  return <p className="text-xs text-[#b42318]">{message}</p>
}

function ProductsPricingPage() {
  const [session, setSession] = useState(() => loadAuthSession())
  const canManage = canCreateCatalog(session)
  const [priceBooks, setPriceBooks] = useState([])
  const [products, setProducts] = useState([])
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('active')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [fieldErrors, setFieldErrors] = useState({})

  useEffect(() => {
    const sync = () => setSession(loadAuthSession())
    window.addEventListener(AUTH_SESSION_CHANGED_EVENT, sync)
    return () => window.removeEventListener(AUTH_SESSION_CHANGED_EVENT, sync)
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput.trim()), 300)
    return () => window.clearTimeout(timer)
  }, [searchInput])

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true)
      const [books, productResult] = await Promise.all([
        fetchPriceBooks({
          search: search || undefined,
          isActive: statusFilter === 'active' ? true : statusFilter === 'inactive' ? false : undefined,
          page: 1,
          pageSize: 100,
        }),
        fetchProducts({ page: 1, pageSize: 100, isActive: true }),
      ])
      setPriceBooks(books.items)
      setProducts(productResult.items)
    } catch (error) {
      setPriceBooks([])
      showError(error.message)
    } finally {
      setIsLoading(false)
    }
  }, [search, statusFilter])

  useEffect(() => {
    loadData()
  }, [loadData])

  const targetOptions = useMemo(() => {
    const options = []
    products.forEach((product) => {
      ;(product.skus || []).forEach((sku) => {
        options.push({
          value: `sku:${sku.id}`,
          label: `${product.name} — ${sku.packagingType || sku.skuCode} (${sku.skuCode})`,
        })
      })
      ;(product.variants || []).forEach((variant) => {
        options.push({
          value: `variant:${variant.id}`,
          label: `${product.name} — ${variant.variantName} (${variant.skuCode})`,
        })
        ;(variant.units || []).forEach((unit) => {
          options.push({
            value: `unit:${unit.id}`,
            label: `${product.name} — ${variant.variantName} / ${unit.unitName}`,
          })
        })
      })
      ;(product.units || [])
        .filter((unit) => !unit.variantId)
        .forEach((unit) => {
          options.push({
            value: `unit:${unit.id}`,
            label: `${product.name} — ${unit.unitName}`,
          })
        })
    })
    return options
  }, [products])

  const targetLabelByValue = useMemo(
    () => new Map(targetOptions.map((option) => [option.value, option.label])),
    [targetOptions],
  )

  function validateForm() {
    const errors = {}
    if (!form.name.trim()) errors.name = 'Tên bảng giá là bắt buộc.'
    const filledEntries = form.entries.filter((entry) => entry.targetId || entry.price)
    filledEntries.forEach((entry, index) => {
      if (!entry.targetId) errors.entries = `Dòng giá #${index + 1} cần chọn SKU/biến thể/đơn vị.`
      const price = parseProductPriceInput(entry.price)
      if (!Number.isFinite(price) || price <= 0) errors.entries = `Giá dòng #${index + 1} phải lớn hơn 0.`
    })
    const messages = Object.values(errors)
    return { valid: messages.length === 0, errors, message: messages[0] || '' }
  }

  function resetForm() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setFieldErrors({})
  }

  function updateForm(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setFieldErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  function updateEntry(index, key, value) {
    setForm((prev) => ({
      ...prev,
      entries: prev.entries.map((entry, entryIndex) => {
        if (entryIndex !== index) return entry
        if (key === 'target') {
          const [targetType, targetId] = String(value).split(':')
          return { ...entry, targetType: targetType || 'sku', targetId: targetId || '' }
        }
        return { ...entry, [key]: value }
      }),
    }))
    setFieldErrors((prev) => ({ ...prev, entries: undefined }))
  }

  function addEntry() {
    setForm((prev) => ({ ...prev, entries: [...prev.entries, { ...EMPTY_ENTRY }] }))
  }

  function removeEntry(index) {
    setForm((prev) => ({
      ...prev,
      entries: prev.entries.length === 1 ? [{ ...EMPTY_ENTRY }] : prev.entries.filter((_, itemIndex) => itemIndex !== index),
    }))
  }

  function startEdit(priceBook) {
    setEditingId(priceBook.id)
    setForm({
      code: priceBook.code || '',
      name: priceBook.name || '',
      description: priceBook.description || '',
      startsAt: toInputDateTime(priceBook.startsAt),
      endsAt: toInputDateTime(priceBook.endsAt),
      isActive: priceBook.isActive !== false,
      entries: priceBook.entries.length
        ? priceBook.entries.map((entry) => ({
            targetType: entryTargetType(entry),
            targetId: entryTargetId(entry),
            price: formatProductPriceInput(String(entry.price)),
            startsAt: toInputDateTime(entry.startsAt),
            endsAt: toInputDateTime(entry.endsAt),
            isActive: entry.isActive !== false,
          }))
        : [{ ...EMPTY_ENTRY }],
    })
    setFieldErrors({})
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (!canManage) return

    const validation = validateForm()
    if (!validation.valid) {
      setFieldErrors(validation.errors)
      showError(validation.message)
      return
    }

    setIsSaving(true)
    try {
      const payload = {
        ...form,
        entries: form.entries
          .filter((entry) => entry.targetId && entry.price)
          .map((entry) => ({
            ...entry,
            price: parseProductPriceInput(entry.price),
          })),
      }
      if (editingId) {
        await updatePriceBook(editingId, payload)
        showSuccess('Đã cập nhật bảng giá.')
      } else {
        await createPriceBook(payload)
        showSuccess('Đã tạo bảng giá mới.')
      }
      resetForm()
      await loadData()
    } catch (error) {
      showError(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete(priceBook) {
    if (!canManage) return
    if (!(await confirmDialog({
      title: 'Xác nhận',
      message: `Xóa bảng giá "${priceBook.name}"?`,
      tone: 'danger',
    }))) return
    setIsSaving(true)
    try {
      await deletePriceBook(priceBook.id)
      showSuccess('Đã xóa bảng giá.')
      if (editingId === priceBook.id) resetForm()
      await loadData()
    } catch (error) {
      showError(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <PageShell>
      <PageHeader
        title="Bảng giá sản phẩm"
        titleInfo="Quản lý price_books và price_book_entries cho SKU, biến thể hoặc đơn vị quy đổi."
        searchPlaceholder="Tìm bảng giá theo mã hoặc tên..."
        searchValue={searchInput}
        onSearchChange={setSearchInput}
        rightContent={
          <Link
            to="/inventory/products"
            className="inline-flex items-center gap-2 rounded-xl border border-[#356647]/30 bg-white px-4 py-2.5 text-sm font-semibold text-[#356647] hover:bg-[#356647]/5"
          >
            <span className="material-symbols-outlined text-[18px]">inventory_2</span>
            Danh sách sản phẩm
          </Link>
        }
      />

      {canManage ? (
        <section className="mb-6 rounded-[1rem] border border-slate-100 bg-white p-4 shadow-sm sm:p-6">
          <h2 className="text-lg font-bold text-slate-800">{editingId ? 'Sửa bảng giá' : 'Tạo bảng giá mới'}</h2>
          <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
            <div className="grid gap-4 lg:grid-cols-2">
              <label className="space-y-1">
                <span className="text-xs font-semibold text-[#717971]">Mã bảng giá</span>
                <input
                  className="w-full rounded-xl border-none bg-[#f0eee6] p-3 font-mono text-sm focus:ring-2 focus:ring-[#356647]/20"
                  value={form.code}
                  onChange={(event) => updateForm('code', event.target.value.toUpperCase())}
                  placeholder="Để trống để tự sinh"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-semibold text-[#717971]">Tên bảng giá *</span>
                <input
                  className={`w-full rounded-xl border-none bg-[#f0eee6] p-3 text-sm focus:ring-2 focus:ring-[#356647]/20 ${fieldErrors.name ? 'ring-2 ring-[#b42318]/40' : ''}`}
                  value={form.name}
                  onChange={(event) => updateForm('name', event.target.value)}
                  placeholder="Bảng giá bán lẻ / đại lý / khuyến mại"
                />
                <FieldError message={fieldErrors.name} />
              </label>
              <label className="space-y-1 lg:col-span-2">
                <span className="text-xs font-semibold text-[#717971]">Mô tả</span>
                <input
                  className="w-full rounded-xl border-none bg-[#f0eee6] p-3 text-sm focus:ring-2 focus:ring-[#356647]/20"
                  value={form.description}
                  onChange={(event) => updateForm('description', event.target.value)}
                  placeholder="Ghi chú áp dụng bảng giá"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-semibold text-[#717971]">Hiệu lực từ</span>
                <input
                  type="datetime-local"
                  className="w-full rounded-xl border-none bg-[#f0eee6] p-3 text-sm focus:ring-2 focus:ring-[#356647]/20"
                  value={form.startsAt}
                  onChange={(event) => updateForm('startsAt', event.target.value)}
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-semibold text-[#717971]">Hiệu lực đến</span>
                <input
                  type="datetime-local"
                  className="w-full rounded-xl border-none bg-[#f0eee6] p-3 text-sm focus:ring-2 focus:ring-[#356647]/20"
                  value={form.endsAt}
                  onChange={(event) => updateForm('endsAt', event.target.value)}
                />
              </label>
            </div>

            <div className="rounded-xl border border-slate-100 p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-bold text-slate-800">Dòng bảng giá</p>
                  <p className="text-xs text-slate-500">Chọn một SKU, biến thể hoặc đơn vị quy đổi cho mỗi dòng.</p>
                </div>
                <button type="button" className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700" onClick={addEntry}>
                  Thêm dòng
                </button>
              </div>
              <div className="space-y-3">
                {form.entries.map((entry, index) => (
                  <div key={index} className="grid gap-3 rounded-xl bg-[#fbf9f1] p-3 lg:grid-cols-[1.4fr_0.6fr_0.6fr_0.6fr_auto]">
                    <label className="space-y-1">
                      <span className="text-xs font-semibold text-[#717971]">Đối tượng</span>
                      <select
                        className="w-full rounded-xl border-none bg-white p-3 text-sm focus:ring-2 focus:ring-[#356647]/20"
                        value={entry.targetId ? `${entry.targetType}:${entry.targetId}` : ''}
                        onChange={(event) => updateEntry(index, 'target', event.target.value)}
                      >
                        <option value="">Chọn SKU/biến thể/đơn vị</option>
                        {targetOptions.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs font-semibold text-[#717971]">Giá *</span>
                      <input
                        className="w-full rounded-xl border-none bg-white p-3 text-sm focus:ring-2 focus:ring-[#356647]/20"
                        inputMode="decimal"
                        value={entry.price}
                        onChange={(event) => updateEntry(index, 'price', formatProductPriceInput(event.target.value))}
                        placeholder="180.000"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs font-semibold text-[#717971]">Từ</span>
                      <input
                        type="datetime-local"
                        className="w-full rounded-xl border-none bg-white p-3 text-sm focus:ring-2 focus:ring-[#356647]/20"
                        value={entry.startsAt}
                        onChange={(event) => updateEntry(index, 'startsAt', event.target.value)}
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs font-semibold text-[#717971]">Đến</span>
                      <input
                        type="datetime-local"
                        className="w-full rounded-xl border-none bg-white p-3 text-sm focus:ring-2 focus:ring-[#356647]/20"
                        value={entry.endsAt}
                        onChange={(event) => updateEntry(index, 'endsAt', event.target.value)}
                      />
                    </label>
                    <div className="flex items-end gap-2">
                      <label className="mb-3 flex items-center gap-2 text-xs text-slate-600">
                        <input
                          type="checkbox"
                          checked={entry.isActive}
                          onChange={(event) => updateEntry(index, 'isActive', event.target.checked)}
                        />
                        Bật
                      </label>
                      <button type="button" className="mb-1 rounded-lg px-2 py-2 text-rose-600 hover:bg-rose-50" onClick={() => removeEntry(index)}>
                        <span className="material-symbols-outlined text-[18px]">delete</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <FieldError message={fieldErrors.entries} />
            </div>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(event) => updateForm('isActive', event.target.checked)}
              />
              <span className="text-sm text-slate-700">Bảng giá đang hoạt động</span>
            </label>

            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={isSaving}
                className="rounded-xl bg-[#538463] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#457053] disabled:opacity-50"
              >
                {isSaving ? 'Đang lưu...' : editingId ? 'Cập nhật bảng giá' : 'Tạo bảng giá'}
              </button>
              {editingId ? (
                <button type="button" className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700" onClick={resetForm}>
                  Hủy
                </button>
              ) : null}
            </div>
          </form>
        </section>
      ) : null}

      <section className="rounded-[1rem] bg-white p-4 shadow-sm sm:p-6 lg:p-8">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-bold text-slate-800">Danh sách bảng giá</h2>
          <select
            className="h-11 min-w-[200px] rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm text-slate-700 outline-none focus:border-[#356647]"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="active">Đang hoạt động</option>
            <option value="inactive">Đã tắt</option>
          </select>
        </div>

        {isLoading ? (
          <p className="text-sm text-slate-500">Đang tải bảng giá...</p>
        ) : priceBooks.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
            Chưa có bảng giá nào.
          </p>
        ) : (
          <div className="space-y-4">
            {priceBooks.map((priceBook) => (
              <article key={priceBook.id} className="rounded-xl border border-slate-100 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-base font-bold text-slate-900">{priceBook.name}</p>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-slate-600">{priceBook.code}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${priceBook.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                        {priceBook.isActive ? 'Đang hoạt động' : 'Đã tắt'}
                      </span>
                    </div>
                    {priceBook.description ? <p className="mt-1 text-sm text-slate-500">{priceBook.description}</p> : null}
                    <p className="mt-1 text-xs text-slate-500">
                      Hiệu lực: {priceBook.startsAt ? new Date(priceBook.startsAt).toLocaleString('vi-VN') : '—'} → {priceBook.endsAt ? new Date(priceBook.endsAt).toLocaleString('vi-VN') : '—'}
                    </p>
                  </div>
                  {canManage ? (
                    <div className="flex shrink-0 gap-2">
                      <button type="button" className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700" onClick={() => startEdit(priceBook)}>
                        Sửa
                      </button>
                      <button type="button" className="rounded-lg border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50" onClick={() => handleDelete(priceBook)}>
                        Xóa
                      </button>
                    </div>
                  ) : null}
                </div>

                {priceBook.entries.length ? (
                  <div className="mt-4 overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-100 text-left text-sm">
                      <thead className="bg-slate-50 text-slate-500">
                        <tr>
                          <th className="px-4 py-3 font-semibold">Đối tượng</th>
                          <th className="px-4 py-3 font-semibold">Giá</th>
                          <th className="px-4 py-3 font-semibold">Hiệu lực</th>
                          <th className="px-4 py-3 font-semibold">Trạng thái</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {priceBook.entries.map((entry) => {
                          const value = `${entryTargetType(entry)}:${entryTargetId(entry)}`
                          return (
                            <tr key={entry.id}>
                              <td className="px-4 py-3 text-slate-700">{targetLabelByValue.get(value) || value}</td>
                              <td className="px-4 py-3 font-semibold text-[#356647]">{formatProductPrice(entry.price)}</td>
                              <td className="px-4 py-3 text-xs text-slate-500">
                                {entry.startsAt ? new Date(entry.startsAt).toLocaleString('vi-VN') : '—'} → {entry.endsAt ? new Date(entry.endsAt).toLocaleString('vi-VN') : '—'}
                              </td>
                              <td className="px-4 py-3">
                                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${entry.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                                  {entry.isActive ? 'Bật' : 'Tắt'}
                                </span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="mt-4 rounded-xl border border-dashed border-slate-200 p-4 text-center text-sm text-slate-500">
                    Bảng giá chưa có dòng giá.
                  </p>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </PageShell>
  )
}

export default ProductsPricingPage
