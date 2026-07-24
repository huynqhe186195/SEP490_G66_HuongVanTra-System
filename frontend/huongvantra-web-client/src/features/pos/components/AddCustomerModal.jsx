import { useEffect, useState } from 'react'
import { showError, showSuccess } from '../../../app/toast.js'
import {
  mapCustomerApiError,
  normalizeNameInput,
  normalizePhoneInput,
  validatePosCustomerForm,
} from '../../customers/utils/customerValidation.js'
import { createPosCustomer } from '../services/posApi.js'

function FieldError({ message }) {
  if (!message) return null
  return <p className="text-xs text-[#b42318]">{message}</p>
}

function inputClass(hasError) {
  return `w-full rounded-lg border px-4 py-3 text-sm outline-none focus:ring-4 focus:ring-[#538463]/15 ${
    hasError ? 'border-[#b42318] focus:border-[#b42318]' : 'border-gray-200 focus:border-[#538463]'
  }`
}

function AddCustomerModal({ isOpen, onClose, onSaved, initialPhone = '' }) {
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    setFullName('')
    setPhone(normalizePhoneInput(initialPhone) || '')
    setAddress('')
    setFieldErrors({})
    setIsSaving(false)
  }, [isOpen, initialPhone])

  if (!isOpen) return null

  const handleClose = () => {
    onClose()
  }

  const handleSave = async () => {
    if (isSaving) return

    const validation = validatePosCustomerForm({ fullName, phone, address })
    if (!validation.valid) {
      setFieldErrors(validation.errors)
      showError(validation.message)
      return
    }

    const name = fullName.trim()
    const phoneValue = phone.trim()
    const addressValue = address.trim()

    setIsSaving(true)
    try {
      const result = await createPosCustomer({
        fullName: name,
        phone: phoneValue,
        address: addressValue || null,
      })
      const customer = result?.customer ?? result
      const reusedExisting = Boolean(result?.reusedExisting)
      showSuccess(
        reusedExisting
          ? `Khách ${customer.fullName || name} đã có — đã chọn vào đơn.`
          : `Đã thêm khách hàng ${customer.fullName || name}.`,
      )
      onSaved?.(customer)
      onClose()
    } catch (error) {
      const mapped = mapCustomerApiError(error.message)
      if (mapped.field) {
        setFieldErrors((prev) => ({ ...prev, [mapped.field]: mapped.message }))
      }
      showError(mapped.message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-[#1b1c17]">Thêm khách hàng nhanh</h2>
            <p className="mt-1 text-sm text-[#717971]">Dùng cho khách vãng lai tại quầy POS.</p>
          </div>
          <button type="button" onClick={handleClose} className="rounded-lg p-1 text-[#717971] hover:bg-[#f6f4ec]">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="space-y-3">
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-[#717971]">Họ tên</span>
            <input
              className={inputClass(Boolean(fieldErrors.fullName))}
              value={fullName}
              onChange={(event) => {
                setFullName(normalizeNameInput(event.target.value))
                setFieldErrors((prev) => ({ ...prev, fullName: undefined }))
              }}
              placeholder="Nguyễn Văn A"
            />
            <FieldError message={fieldErrors.fullName} />
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-semibold text-[#717971]">Số điện thoại</span>
            <input
              className={inputClass(Boolean(fieldErrors.phone))}
              value={phone}
              onChange={(event) => {
                setPhone(normalizePhoneInput(event.target.value))
                setFieldErrors((prev) => ({ ...prev, phone: undefined }))
              }}
              placeholder="09xxxxxxxx"
              inputMode="tel"
            />
            <FieldError message={fieldErrors.phone} />
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-semibold text-[#717971]">Địa chỉ (tuỳ chọn)</span>
            <input
              className={inputClass(Boolean(fieldErrors.address))}
              value={address}
              onChange={(event) => {
                setAddress(event.target.value)
                setFieldErrors((prev) => ({ ...prev, address: undefined }))
              }}
              placeholder="Địa chỉ giao hàng"
            />
            <FieldError message={fieldErrors.address} />
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-xl border border-[#c1c9c0] px-4 py-2.5 text-sm font-semibold text-[#414942] hover:bg-[#f6f4ec]"
          >
            Huỷ
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={handleSave}
            className="rounded-xl bg-[#356647] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#2d553b] disabled:opacity-60"
          >
            {isSaving ? 'Đang lưu...' : 'Lưu khách'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default AddCustomerModal
