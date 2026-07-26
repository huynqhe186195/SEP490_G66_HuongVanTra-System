import { useCallback, useEffect, useRef, useState } from 'react'
import PageHeader from '../../../components/shared/PageHeader.jsx'
import PageShell from '../../../components/shared/PageShell.jsx'
import TablePagination, { TABLE_PAGE_SIZE } from '../../../components/shared/TablePagination.jsx'
import { showError, showSuccess } from '../../../app/toast.js'
import { loadAuthSession } from '../../auth/services/authSession.js'
import { canManageSuppliers } from '../../auth/utils/permissions.js'
import {
  createSupplier,
  deleteSupplier,
  fetchSuppliers,
  restoreSupplier,
  updateSupplier,
} from '../services/suppliersApi.js'

const EMPTY_FORM = { name: '', phone: '', email: '', address: '', note: '' }

const PHONE_REGEX = /^(0|\+84)(3[2-9]|5[25689]|7[06-9]|8[1-9]|9[0-9])\d{7}$/
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validateField(field, value) {
  const trimmed = (value ?? '').trim()
  switch (field) {
    case 'name':
      if (!trimmed) return 'Tên nhà cung cấp không được để trống.'
      if (trimmed.length < 2) return 'Tên nhà cung cấp phải có ít nhất 2 ký tự.'
      if (trimmed.length > 255) return 'Tên nhà cung cấp tối đa 255 ký tự.'
      return ''
    case 'phone':
      if (!trimmed) return ''
      if (!PHONE_REGEX.test(trimmed.replace(/\s/g, '')))
        return 'Số điện thoại phải đủ 10 số (VD: 0912345678).'
      return ''
    case 'email':
      if (!trimmed) return ''
      if (!EMAIL_REGEX.test(trimmed)) return 'Email không hợp lệ.'
      if (trimmed.length > 255) return 'Email tối đa 255 ký tự.'
      return ''
    case 'address':
      if (trimmed.length > 500) return 'Địa chỉ tối đa 500 ký tự.'
      return ''
    case 'note':
      if (trimmed.length > 1000) return 'Ghi chú tối đa 1000 ký tự.'
      return ''
    default:
      return ''
  }
}

function validateForm(form) {
  const errors = {}
  for (const field of ['name', 'phone', 'email', 'address', 'note']) {
    const msg = validateField(field, form[field])
    if (msg) errors[field] = msg
  }
  return errors
}

function SupplierFormModal({ initial, onClose, onSaved }) {
  const [form, setForm] = useState(initial ?? EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})
  const [touched, setTouched] = useState({})
  const nameRef = useRef(null)

  useEffect(() => {
    nameRef.current?.focus()
  }, [])

  const set = (field) => (e) => {
    let value = e.target.value
    if (field === 'phone') {
      value = value.replace(/[^\d+]/g, '')
      value = value.startsWith('+') ? '+' + value.slice(1).replace(/\+/g, '') : value.replace(/\+/g, '')
      value = value.slice(0, value.startsWith('+') ? 12 : 11)
    }
    setForm((prev) => ({ ...prev, [field]: value }))
    if (touched[field]) {
      setErrors((prev) => ({ ...prev, [field]: validateField(field, value) }))
    }
  }

  const handleBlur = (field) => () => {
    setTouched((prev) => ({ ...prev, [field]: true }))
    setErrors((prev) => ({ ...prev, [field]: validateField(field, form[field]) }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const nextErrors = validateForm(form)
    setErrors(nextErrors)
    setTouched({ name: true, phone: true, email: true, address: true, note: true })
    if (Object.keys(nextErrors).length > 0) {
      showError('Vui lòng kiểm tra lại thông tin đã nhập.')
      return
    }
    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      address: form.address.trim(),
      note: form.note.trim(),
    }
    setSaving(true)
    try {
      const saved = initial?.id
        ? await updateSupplier(initial.id, payload)
        : await createSupplier(payload)
      showSuccess(initial?.id ? 'Đã cập nhật nhà cung cấp.' : 'Đã thêm nhà cung cấp.')
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

  const FieldError = ({ field }) =>
    errors[field] ? <p className="mt-1 text-xs text-red-500">{errors[field]}</p> : null

  return (
    <div className="inventory-modal fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-2xl border border-[#c1c9c0] bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#1b1c17]">
            {initial?.id ? 'Cập nhật nhà cung cấp' : 'Thêm nhà cung cấp'}
          </h2>
          <button type="button" onClick={onClose} className="text-[#717971] hover:text-[#1b1c17]">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-[#414942]">
              Tên nhà cung cấp <span className="text-red-500">*</span>
            </label>
            <input
              ref={nameRef}
              className={inputCls('name')}
              value={form.name}
              onChange={set('name')}
              onBlur={handleBlur('name')}
              maxLength={255}
            />
            <FieldError field="name" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#414942]">Số điện thoại</label>
              <input
                className={inputCls('phone')}
                value={form.phone}
                onChange={set('phone')}
                onBlur={handleBlur('phone')}
                inputMode="tel"
                maxLength={12}
              />
              <FieldError field="phone" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#414942]">Email</label>
              <input
                className={inputCls('email')}
                type="email"
                value={form.email}
                onChange={set('email')}
                onBlur={handleBlur('email')}
                maxLength={255}
              />
              <FieldError field="email" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-[#414942]">Địa chỉ</label>
            <input
              className={inputCls('address')}
              value={form.address}
              onChange={set('address')}
              onBlur={handleBlur('address')}
              maxLength={500}
            />
            <FieldError field="address" />
          </div>
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
            <FieldError field="note" />
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
              {saving ? 'Đang lưu...' : 'Lưu'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function StatusChip({ isDeleted }) {
  return isDeleted ? (
    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">Đã ẩn</span>
  ) : (
    <span className="rounded-full bg-[#e8f0e9] px-2 py-0.5 text-xs font-semibold text-[#356647]">Hoạt động</span>
  )
}

export default function SuppliersPage() {
  const [items, setItems] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [includeDeleted, setIncludeDeleted] = useState(false)
  const [page, setPage] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [modalSupplier, setModalSupplier] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const searchTimerRef = useRef(null)

  const canManage = canManageSuppliers(loadAuthSession())

  const load = useCallback(
    async (p = 1, q = search, showDeleted = includeDeleted) => {
      setIsLoading(true)
      try {
        const result = await fetchSuppliers({ search: q, includeDeleted: showDeleted, page: p, pageSize: TABLE_PAGE_SIZE })
        setItems(result.items)
        setTotalItems(result.totalItems)
        setTotalPages(result.totalPages)
        setPage(p)
      } catch (err) {
        showError(err?.message ?? 'Không tải được danh sách nhà cung cấp.')
      } finally {
        setIsLoading(false)
      }
    },
    [search, includeDeleted],
  )

  useEffect(() => {
    load(1)
  }, [includeDeleted])

  function handleSearchChange(e) {
    const q = e.target.value
    setSearch(q)
    clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => load(1, q, includeDeleted), 400)
  }

  function openCreate() {
    setModalSupplier(null)
    setShowModal(true)
  }

  function openEdit(s) {
    setModalSupplier(s)
    setShowModal(true)
  }

  function handleSaved(saved) {
    setShowModal(false)
    load(page)
  }

  async function handleDelete(s) {
    if (!window.confirm(`Ẩn nhà cung cấp "${s.name}"?`)) return
    try {
      await deleteSupplier(s.id)
      showSuccess('Đã ẩn nhà cung cấp.')
      load(page)
    } catch (err) {
      showError(err?.message ?? 'Không thể ẩn.')
    }
  }

  async function handleRestore(s) {
    try {
      await restoreSupplier(s.id)
      showSuccess('Đã khôi phục nhà cung cấp.')
      load(page)
    } catch (err) {
      showError(err?.message ?? 'Không thể khôi phục.')
    }
  }

  return (
    <PageShell>
      <PageHeader
        title="Nhà cung cấp"
        rightContent={
          canManage ? (
            <button
              type="button"
              onClick={openCreate}
              className="flex items-center gap-1.5 rounded-lg bg-[#356647] px-4 py-2 text-sm font-bold text-white hover:bg-[#2a5238]">
              <span className="material-symbols-outlined text-base">add</span>
              Thêm nhà cung cấp
            </button>
          ) : null
        }
      />

      <div className="flex flex-wrap items-center gap-3 p-4 pb-0">
        <div className="relative min-w-[220px] flex-1">
          <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-base text-[#717971]">
            search
          </span>
          <input
            type="text"
            placeholder="Tìm theo tên, SĐT, email, địa chỉ..."
            value={search}
            onChange={handleSearchChange}
            className="w-full rounded-lg border border-[#c1c9c0] bg-white py-2 pl-9 pr-3 text-sm text-[#1b1c17] outline-none focus:border-[#356647]"
          />
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-[#414942]">
          <input
            type="checkbox"
            checked={includeDeleted}
            onChange={(e) => { setIncludeDeleted(e.target.checked); setPage(1) }}
            className="accent-[#356647]"
          />
          Hiện đã ẩn
        </label>
      </div>

      <div className="overflow-x-auto p-4">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-[#c1c9c0] text-left text-xs font-semibold text-[#717971]">
              <th className="pb-2 pr-4">Tên nhà cung cấp</th>
              <th className="pb-2 pr-4">Số điện thoại</th>
              <th className="pb-2 pr-4">Email</th>
              <th className="pb-2 pr-4">Địa chỉ</th>
              <th className="pb-2 pr-4 text-right">Số phiếu nhập</th>
              <th className="pb-2 pr-4">Trạng thái</th>
              {canManage && <th className="pb-2"></th>}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={canManage ? 7 : 6} className="py-8 text-center text-sm text-[#717971]">
                  Đang tải...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={canManage ? 7 : 6} className="py-8 text-center text-sm text-[#717971]">
                  Không có nhà cung cấp nào.
                </td>
              </tr>
            ) : (
              items.map((s) => (
                <tr
                  key={s.id}
                  className="border-b border-[#f0f4f0] last:border-0 hover:bg-[#f5f7f4]">
                  <td className="py-3 pr-4">
                    <p className="font-semibold text-[#1b1c17]">{s.name}</p>
                    {s.note ? <p className="text-xs text-[#717971] line-clamp-1">{s.note}</p> : null}
                  </td>
                  <td className="py-3 pr-4 text-[#414942]">{s.phone || '—'}</td>
                  <td className="py-3 pr-4 text-[#414942]">{s.email || '—'}</td>
                  <td className="py-3 pr-4 text-[#414942] max-w-[180px] truncate">{s.address || '—'}</td>
                  <td className="py-3 pr-4 text-right text-[#414942]">{s.totalReceiptCount}</td>
                  <td className="py-3 pr-4">
                    <StatusChip isDeleted={s.isDeleted} />
                  </td>
                  {canManage && (
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        {!s.isDeleted ? (
                          <>
                            <button
                              type="button"
                              onClick={() => openEdit(s)}
                              className="rounded-lg border border-[#c1c9c0] px-3 py-1 text-xs font-semibold text-[#414942] hover:bg-[#e8f0e9] hover:border-[#356647] hover:text-[#356647]">
                              Sửa
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(s)}
                              className="rounded-lg border border-[#c1c9c0] px-3 py-1 text-xs font-semibold text-[#414942] hover:bg-red-50 hover:border-red-400 hover:text-red-600">
                              Ẩn
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleRestore(s)}
                            className="rounded-lg border border-[#c1c9c0] px-3 py-1 text-xs font-semibold text-[#414942] hover:bg-[#e8f0e9] hover:border-[#356647] hover:text-[#356647]">
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

        {totalPages > 1 ? (
          <TablePagination
            page={page}
            totalPages={totalPages}
            totalItems={totalItems}
            onPageChange={(p) => load(p)}
          />
        ) : null}
      </div>

      {showModal ? (
        <SupplierFormModal
          initial={modalSupplier}
          onClose={() => setShowModal(false)}
          onSaved={handleSaved}
        />
      ) : null}
    </PageShell>
  )
}
