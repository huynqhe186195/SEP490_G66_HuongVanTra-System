import { useState } from 'react'
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

function AddCustomerModal({ isOpen, onClose, onSaved }) {
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [isSaving, setIsSaving] = useState(false)

  if (!isOpen) return null

  const resetForm = () => {
    setFullName('')
    setPhone('')
    setAddress('')
    setFieldErrors({})
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  const handleSave = async () => {
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
      const customer = await createPosCustomer({
        fullName: name,
        phone: phoneValue,
        address: addressValue || null,
      })
      showSuccess(`Đã thêm khách hàng ${customer.fullName || name}.`)
      onSaved?.(customer)
      resetForm()
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm" onClick={handleClose}>
      <div
        className="flex w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-center justify-between bg-[#538463] px-5 py-4 text-white">
          <h1 className="text-lg font-bold">Thêm khách hàng mới</h1>
          <button type="button" aria-label="Close" onClick={handleClose} className="rounded-full p-1 transition hover:bg-white/10">
            <span className="material-symbols-outlined">close</span>
          </button>
        </header>

        <main className="space-y-4 bg-[#fbf9f1] p-5">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold text-gray-700">
              Số điện thoại <span className="text-red-500">*</span>
            </span>
            <input
              className={inputClass(fieldErrors.phone)}
              inputMode="numeric"
              placeholder="Nhập số điện thoại (10 số, bắt đầu 0)..."
              value={phone}
              onChange={(event) => {
                setPhone(normalizePhoneInput(event.target.value))
                setFieldErrors((prev) => ({ ...prev, phone: undefined }))
              }}
            />
            <FieldError message={fieldErrors.phone} />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold text-gray-700">
              Tên khách hàng <span className="text-red-500">*</span>
            </span>
            <input
              className={inputClass(fieldErrors.fullName)}
              placeholder="Nhập họ và tên..."
              value={fullName}
              onChange={(event) => {
                setFullName(normalizeNameInput(event.target.value))
                setFieldErrors((prev) => ({ ...prev, fullName: undefined }))
              }}
            />
            <FieldError message={fieldErrors.fullName} />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold text-gray-700">Địa chỉ</span>
            <input
              className={inputClass(fieldErrors.address)}
              placeholder="Nhập địa chỉ (tùy chọn)..."
              value={address}
              onChange={(event) => {
                setAddress(event.target.value)
                setFieldErrors((prev) => ({ ...prev, address: undefined }))
              }}
            />
            <FieldError message={fieldErrors.address} />
          </label>
        </main>

        <footer className="flex justify-end gap-3 border-t border-[#e5e7eb] bg-white px-5 py-4">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg border border-[#e5e7eb] px-6 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Hủy bỏ
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="rounded-lg bg-[#538463] px-6 py-2.5 text-sm font-medium text-white hover:bg-[#436b50] disabled:opacity-50"
          >
            {isSaving ? 'Đang lưu...' : 'Lưu khách hàng'}
          </button>
        </footer>
      </div>
    </div>
  )
}

export default AddCustomerModal
