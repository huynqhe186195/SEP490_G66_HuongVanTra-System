import { useEffect, useState } from 'react'
import { showError, showSuccess } from '../../../app/toast.js'
import { createCustomerAddress } from '../../customers/services/customersApi.js'
import {
  normalizePhoneInput,
  validateCustomerAddressForm,
} from '../../customers/utils/customerValidation.js'

const emptyForm = {
  receiverName: '',
  receiverPhone: '',
  addressLine: '',
  ward: '',
  district: '',
  province: '',
  isDefault: true,
}

function FieldError({ message }) {
  if (!message) return null
  return <p className="text-xs text-[#b42318]">{message}</p>
}

function inputClass(hasError) {
  return `w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:ring-4 focus:ring-[#538463]/15 ${
    hasError ? 'border-[#b42318] focus:border-[#b42318]' : 'border-gray-200 focus:border-[#538463]'
  }`
}

function AddCustomerAddressModal({
  isOpen,
  onClose,
  onSaved,
  customerId,
  customerName = '',
  customerPhone = '',
  makeDefault = true,
}) {
  const [form, setForm] = useState(emptyForm)
  const [fieldErrors, setFieldErrors] = useState({})
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    setForm({
      ...emptyForm,
      receiverName: String(customerName || '').trim(),
      receiverPhone: normalizePhoneInput(customerPhone || ''),
      isDefault: makeDefault,
    })
    setFieldErrors({})
    setIsSaving(false)
  }, [isOpen, customerName, customerPhone, makeDefault])

  if (!isOpen) return null

  const updateField = (field) => (event) => {
    const raw = field === 'isDefault' ? event.target.checked : event.target.value
    const value = field === 'receiverPhone' ? normalizePhoneInput(raw) : raw
    setForm((current) => ({ ...current, [field]: value }))
    if (fieldErrors[field]) {
      setFieldErrors((current) => {
        const next = { ...current }
        delete next[field]
        return next
      })
    }
  }

  const handleSave = async () => {
    if (isSaving || !customerId) return

    const validation = validateCustomerAddressForm(form)
    if (!validation.valid) {
      setFieldErrors(validation.errors)
      showError(validation.message)
      return
    }
    setFieldErrors({})

    setIsSaving(true)
    try {
      const created = await createCustomerAddress(customerId, {
        receiverName: form.receiverName.trim(),
        receiverPhone: form.receiverPhone.trim(),
        addressLine: form.addressLine.trim(),
        ward: form.ward.trim(),
        district: form.district.trim(),
        province: form.province.trim(),
        isDefault: Boolean(form.isDefault),
      })
      showSuccess('Đã thêm địa chỉ giao hàng.')
      onSaved?.(created)
      onClose()
    } catch (error) {
      showError(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-customer-address-title"
        className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 id="add-customer-address-title" className="text-lg font-bold text-[#1b1c17]">
              Thêm địa chỉ giao hàng
            </h2>
            <p className="mt-1 text-xs text-[#717971]">
              Lưu vào sổ địa chỉ khách{customerName ? ` · ${customerName}` : ''}.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-[#717971] hover:bg-[#f3f5f1] hover:text-[#414942]"
            aria-label="Đóng"
          >
            <span className="material-symbols-outlined text-[22px]">close</span>
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="space-y-1 sm:col-span-2">
            <span className="text-xs font-semibold text-[#717971]">Tên người nhận *</span>
            <input
              className={inputClass(Boolean(fieldErrors.receiverName))}
              value={form.receiverName}
              onChange={updateField('receiverName')}
            />
            <FieldError message={fieldErrors.receiverName} />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold text-[#717971]">SĐT người nhận</span>
            <input
              className={inputClass(Boolean(fieldErrors.receiverPhone))}
              value={form.receiverPhone}
              onChange={updateField('receiverPhone')}
              placeholder="0xxxxxxxxx"
            />
            <FieldError message={fieldErrors.receiverPhone} />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold text-[#717971]">Phường / Xã *</span>
            <input
              className={inputClass(Boolean(fieldErrors.ward))}
              value={form.ward}
              onChange={updateField('ward')}
            />
            <FieldError message={fieldErrors.ward} />
          </label>
          <label className="space-y-1 sm:col-span-2">
            <span className="text-xs font-semibold text-[#717971]">Địa chỉ (số nhà, đường) *</span>
            <input
              className={inputClass(Boolean(fieldErrors.addressLine))}
              value={form.addressLine}
              onChange={updateField('addressLine')}
            />
            <FieldError message={fieldErrors.addressLine} />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold text-[#717971]">Quận / Huyện *</span>
            <input
              className={inputClass(Boolean(fieldErrors.district))}
              value={form.district}
              onChange={updateField('district')}
            />
            <FieldError message={fieldErrors.district} />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold text-[#717971]">Tỉnh / TP *</span>
            <input
              className={inputClass(Boolean(fieldErrors.province))}
              value={form.province}
              onChange={updateField('province')}
            />
            <FieldError message={fieldErrors.province} />
          </label>
          <label className="flex items-center gap-2 sm:col-span-2">
            <input
              type="checkbox"
              className="accent-[#4a6242]"
              checked={form.isDefault}
              onChange={updateField('isDefault')}
            />
            <span className="text-sm text-[#414942]">Đặt làm địa chỉ mặc định</span>
          </label>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[#c1c9c0] px-4 py-2 text-sm font-semibold text-[#414942] hover:bg-[#f3f5f1]"
            disabled={isSaving}
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || !customerId}
            className="rounded-xl bg-[#356647] px-4 py-2 text-sm font-semibold text-white hover:bg-[#2d5a3d] disabled:opacity-50"
          >
            {isSaving ? 'Đang lưu...' : 'Lưu địa chỉ'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default AddCustomerAddressModal
