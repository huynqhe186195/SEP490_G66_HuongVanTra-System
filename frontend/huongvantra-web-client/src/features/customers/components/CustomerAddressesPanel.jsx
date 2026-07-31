import { useEffect, useState } from 'react'
import { confirmDialog } from '../../../app/dialog.js'
import { showError, showSuccess } from '../../../app/toast.js'
import {
  createCustomerAddress,
  deleteCustomerAddress,
  fetchCustomerAddresses,
  updateCustomerAddress,
} from '../services/customersApi.js'
import { normalizePhoneInput, validateCustomerAddressForm } from '../utils/customerValidation.js'

const emptyForm = {
  receiverName: '',
  receiverPhone: '',
  addressLine: '',
  ward: '',
  district: '',
  province: '',
  isDefault: false,
}

function CustomerAddressesPanel({ customerId, standalone = false, readOnly = false }) {
  const [addresses, setAddresses] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [fieldErrors, setFieldErrors] = useState({})

  async function loadAddresses() {
    try {
      setIsLoading(true)
      const data = await fetchCustomerAddresses(customerId)
      setAddresses(Array.isArray(data) ? data : [])
    } catch (error) {
      showError(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (!customerId) return undefined
    loadAddresses()
    return undefined
  }, [customerId])

  function resetForm() {
    setForm(emptyForm)
    setEditingId(null)
    setFieldErrors({})
  }

  function startEdit(address) {
    setEditingId(address.id)
    setForm({
      receiverName: address.receiverName,
      receiverPhone: address.receiverPhone,
      addressLine: address.addressLine,
      ward: address.ward,
      district: address.district,
      province: address.province,
      isDefault: address.isDefault,
    })
  }

  async function handleSubmit() {
    const validation = validateCustomerAddressForm(form)
    if (!validation.valid) {
      setFieldErrors(validation.errors)
      showError(validation.message)
      return
    }
    setFieldErrors({})

    try {
      setIsSaving(true)
      const payload = {
        receiverName: form.receiverName.trim(),
        receiverPhone: form.receiverPhone.trim(),
        addressLine: form.addressLine.trim(),
        ward: form.ward.trim(),
        district: form.district.trim(),
        province: form.province.trim(),
        isDefault: form.isDefault,
      }

      if (editingId) {
        await updateCustomerAddress(customerId, editingId, payload)
        showSuccess('Cập nhật địa chỉ thành công.')
      } else {
        await createCustomerAddress(customerId, payload)
        showSuccess('Thêm địa chỉ thành công.')
      }

      resetForm()
      await loadAddresses()
    } catch (error) {
      showError(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete(addressId) {
    if (!(await confirmDialog({ title: 'Xác nhận', message: 'Xóa địa chỉ này?', tone: 'danger' }))) return
    try {
      await deleteCustomerAddress(customerId, addressId)
      showSuccess('Đã xóa địa chỉ.')
      if (editingId === addressId) resetForm()
      await loadAddresses()
    } catch (error) {
      showError(error.message)
    }
  }

  const updateField = (field) => (event) => {
    const value = field === 'isDefault' ? event.target.checked : event.target.value
    const nextValue = field === 'receiverPhone' ? normalizePhoneInput(value) : value
    setForm((current) => ({ ...current, [field]: nextValue }))
    if (fieldErrors[field]) {
      setFieldErrors((current) => {
        const next = { ...current }
        delete next[field]
        return next
      })
    }
  }

  const inputClass = (field) =>
    `w-full rounded-xl bg-[#f0eee6] p-3 text-sm ${fieldErrors[field] ? 'ring-2 ring-[#b42318]/40' : ''}`

  const shellClass = standalone
    ? 'space-y-4 rounded-[24px] border border-[#c1c9c0]/30 bg-white p-4 shadow-sm sm:p-6'
    : 'space-y-4 rounded-[24px] border border-[#c1c9c0]/30 bg-white p-6 shadow-sm'

  return (
    <section className={shellClass}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-[#356647]">Địa chỉ giao hàng</h3>
        {editingId ? (
          <button type="button" className="text-xs font-semibold text-[#717971] hover:text-[#356647]" onClick={resetForm}>
            Hủy chỉnh sửa
          </button>
        ) : null}
      </div>

      {isLoading ? (
        <p className="text-sm text-[#717971]">Đang tải địa chỉ...</p>
      ) : addresses.length === 0 ? (
        <p className="text-sm text-[#717971]">{readOnly ? 'Chưa có địa chỉ.' : 'Chưa có địa chỉ. Thêm địa chỉ bên dưới.'}</p>
      ) : (
        <ul className="space-y-2">
          {addresses.map((address) => (
            <li key={address.id} className="rounded-xl bg-[#f6f4ec] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-[#1b1c17]">
                    {address.receiverName}
                    {address.isDefault ? (
                      <span className="ml-2 rounded-full bg-[#356647]/15 px-2 py-0.5 text-[10px] font-bold uppercase text-[#356647]">
                        Mặc định
                      </span>
                    ) : null}
                  </p>
                  <p className="text-xs text-[#717971]">{address.receiverPhone || '—'}</p>
                  <p className="mt-1 text-sm text-[#414942]">
                    {[address.addressLine, address.ward, address.district, address.province].filter(Boolean).join(', ')}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  {!readOnly ? (
                    <>
                  <button
                    type="button"
                    className="rounded-full p-2 text-[#717971] hover:bg-white hover:text-[#356647]"
                    onClick={() => startEdit(address)}
                  >
                    <span className="material-symbols-outlined text-[18px]">edit</span>
                  </button>
                  <button
                    type="button"
                    className="rounded-full p-2 text-[#717971] hover:bg-white hover:text-[#7e5700]"
                    onClick={() => handleDelete(address.id)}
                  >
                    <span className="material-symbols-outlined text-[18px]">delete</span>
                  </button>
                    </>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {!readOnly ? (
      <>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="space-y-1 md:col-span-2">
          <span className="text-xs font-semibold text-[#717971]">Tên người nhận *</span>
          <input className={inputClass('receiverName')} value={form.receiverName} onChange={updateField('receiverName')} />
          {fieldErrors.receiverName ? <p className="text-xs text-[#b42318]">{fieldErrors.receiverName}</p> : null}
        </label>
        <label className="space-y-1">
          <span className="text-xs font-semibold text-[#717971]">SĐT người nhận</span>
          <input className={inputClass('receiverPhone')} value={form.receiverPhone} onChange={updateField('receiverPhone')} placeholder="0xxxxxxxxx" />
          {fieldErrors.receiverPhone ? <p className="text-xs text-[#b42318]">{fieldErrors.receiverPhone}</p> : null}
        </label>
        <label className="space-y-1">
          <span className="text-xs font-semibold text-[#717971]">Phường / Xã *</span>
          <input className={inputClass('ward')} value={form.ward} onChange={updateField('ward')} />
          {fieldErrors.ward ? <p className="text-xs text-[#b42318]">{fieldErrors.ward}</p> : null}
        </label>
        <label className="space-y-1 md:col-span-2">
          <span className="text-xs font-semibold text-[#717971]">Địa chỉ (số nhà, đường) *</span>
          <input className={inputClass('addressLine')} value={form.addressLine} onChange={updateField('addressLine')} />
          {fieldErrors.addressLine ? <p className="text-xs text-[#b42318]">{fieldErrors.addressLine}</p> : null}
        </label>
        <label className="space-y-1">
          <span className="text-xs font-semibold text-[#717971]">Quận / Huyện *</span>
          <input className={inputClass('district')} value={form.district} onChange={updateField('district')} />
          {fieldErrors.district ? <p className="text-xs text-[#b42318]">{fieldErrors.district}</p> : null}
        </label>
        <label className="space-y-1">
          <span className="text-xs font-semibold text-[#717971]">Tỉnh / TP *</span>
          <input className={inputClass('province')} value={form.province} onChange={updateField('province')} />
          {fieldErrors.province ? <p className="text-xs text-[#b42318]">{fieldErrors.province}</p> : null}
        </label>
        <label className="flex items-center gap-2 md:col-span-2">
          <input type="checkbox" className="accent-[#4a6242]" checked={form.isDefault} onChange={updateField('isDefault')} />
          <span className="text-sm text-[#414942]">Đặt làm địa chỉ mặc định</span>
        </label>
      </div>

      <button
        type="button"
        className="rounded-xl bg-[#4a6242] px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
        disabled={isSaving}
        onClick={handleSubmit}
      >
        {isSaving ? 'Đang lưu...' : editingId ? 'Cập nhật địa chỉ' : 'Thêm địa chỉ'}
      </button>
      </>
      ) : null}
    </section>
  )
}

export default CustomerAddressesPanel
