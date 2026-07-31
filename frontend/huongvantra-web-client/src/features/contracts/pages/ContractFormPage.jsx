import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import PageHeader from '../../../components/shared/PageHeader.jsx'
import PageShell from '../../../components/shared/PageShell.jsx'
import { confirmDialog } from '../../../app/dialog.js'
import { showError, showSuccess } from '../../../app/toast.js'
import { loadAuthSession } from '../../auth/services/authSession.js'
import { fetchCustomers } from '../../customers/services/customersApi.js'
import {
  createContract,
  fetchContractById,
  submitContract,
  updateContract,
} from '../services/contractsApi.js'

const CONTRACT_TYPE_OPTIONS = [
  { value: 'DaiLy', label: 'Đại lý' },
  { value: 'CungCap', label: 'Cung cấp' },
  { value: 'KhungHopTac', label: 'Khung hợp tác' },
  { value: 'Khac', label: 'Khác' },
]

const EMPTY_FORM = {
  customerId: '',
  title: '',
  contractType: 'DaiLy',
  effectiveDate: '',
  expiryDate: '',
  discountPercent: '',
  creditLimit: '',
  paymentTermDays: '',
  notes: '',
}

function formatCurrency(raw) {
  if (raw === '' || raw == null) return ''
  const num = String(raw).replace(/\D/g, '')
  if (!num) return ''
  return num.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

function parseCurrency(display) {
  return display.replace(/\./g, '')
}

function FieldError({ message }) {
  if (!message) return null
  return <p className="mt-1 text-xs text-[#b42318]">{message}</p>
}

function Label({ children, required }) {
  return (
    <label className="mb-1 block text-sm font-medium text-[#1a1a1a]">
      {children}
      {required && <span className="ml-0.5 text-[#b42318]">*</span>}
    </label>
  )
}

const INPUT = 'w-full rounded-lg border border-[#e8e5de] bg-white px-3 py-2 text-sm outline-none focus:border-[#1a1a1a] disabled:bg-[#f9f7f2] disabled:text-[#717971]'
const INPUT_ERROR = 'w-full rounded-lg border border-[#b42318] bg-white px-3 py-2 text-sm outline-none focus:border-[#b42318] disabled:bg-[#f9f7f2] disabled:text-[#717971]'

function inputCls(error) {
  return error ? INPUT_ERROR : INPUT
}

function ContractFormPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEdit = Boolean(id)
  const session = useMemo(() => loadAuthSession(), [])
  const currentUserId = session?.userId

  const [form, setForm] = useState(EMPTY_FORM)
  const [creditLimitDisplay, setCreditLimitDisplay] = useState('')
  const [errors, setErrors] = useState({})
  const [isLoading, setIsLoading] = useState(isEdit)
  const [isSaving, setIsSaving] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [customerSearch, setCustomerSearch] = useState('')
  const [customerOptions, setCustomerOptions] = useState([])
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)
  const [existingStatus, setExistingStatus] = useState(null)

  // Load existing contract for edit
  useEffect(() => {
    if (!isEdit) return
    setIsLoading(true)
    fetchContractById(id)
      .then((c) => {
        if (!c) return navigate('/contracts')
        if (c.createdByUserId !== currentUserId || c.status !== 'Draft') {
          navigate(`/contracts/${id}`)
          return
        }
        setExistingStatus(c.status)
        setSelectedCustomer({ id: c.customerId, fullName: c.customerName, customerCode: c.customerCode })
        setCreditLimitDisplay(c.creditLimit != null ? formatCurrency(String(c.creditLimit)) : '')
        setForm({
          customerId: c.customerId,
          title: c.title,
          contractType: c.contractType,
          effectiveDate: c.effectiveDate ?? '',
          expiryDate: c.expiryDate ?? '',
          discountPercent: c.discountPercent != null ? String(c.discountPercent) : '',
          creditLimit: c.creditLimit != null ? String(c.creditLimit) : '',
          paymentTermDays: c.paymentTermDays != null ? String(c.paymentTermDays) : '',
          notes: c.notes ?? '',
        })
      })
      .catch(() => {
        showError('Không thể tải hợp đồng.')
        navigate('/contracts')
      })
      .finally(() => setIsLoading(false))
  }, [id, isEdit, currentUserId, navigate])

  // Search B2B customers
  useEffect(() => {
    if (!customerSearch.trim() || isEdit) return
    const timer = setTimeout(async () => {
      try {
        const result = await fetchCustomers({ keyword: customerSearch, customerType: 'CORPORATE' })
        setCustomerOptions(Array.isArray(result) ? result.slice(0, 10) : [])
        setShowCustomerDropdown(true)
      } catch {
        setCustomerOptions([])
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [customerSearch, isEdit])

  function setField(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }))
  }

  function validate() {
    const errs = {}

    // Khách hàng
    if (!form.customerId) errs.customerId = 'Vui lòng chọn khách hàng doanh nghiệp.'

    // Tiêu đề
    const title = form.title.trim()
    if (!title) errs.title = 'Tiêu đề hợp đồng là bắt buộc.'
    else if (title.length < 5) errs.title = 'Tiêu đề phải có ít nhất 5 ký tự.'
    else if (title.length > 200) errs.title = 'Tiêu đề không được vượt quá 200 ký tự.'

    // Ngày
    if (form.effectiveDate && form.expiryDate && form.expiryDate <= form.effectiveDate)
      errs.expiryDate = 'Ngày hết hạn phải sau ngày hiệu lực.'

    // Chiết khấu
    if (form.discountPercent !== '') {
      const v = Number(form.discountPercent)
      if (isNaN(v) || v < 0 || v > 100) errs.discountPercent = 'Chiết khấu phải từ 0 đến 100%.'
      else if (!/^\d+(\.\d{1,2})?$/.test(form.discountPercent.toString().trim()))
        errs.discountPercent = 'Chiết khấu tối đa 2 chữ số thập phân.'
    }

    // Hạn mức công nợ
    if (form.creditLimit !== '') {
      const v = Number(form.creditLimit)
      if (isNaN(v) || v < 0) errs.creditLimit = 'Hạn mức công nợ không được âm.'
      else if (v > 10_000_000_000) errs.creditLimit = 'Hạn mức không được vượt quá 10 tỷ đồng.'
    }

    // Kỳ hạn thanh toán
    if (form.paymentTermDays !== '') {
      const v = Number(form.paymentTermDays)
      if (!Number.isInteger(v) || v <= 0) errs.paymentTermDays = 'Kỳ hạn phải là số nguyên lớn hơn 0.'
      else if (v > 365) errs.paymentTermDays = 'Kỳ hạn không được vượt quá 365 ngày.'
    }

    // Ghi chú
    if (form.notes.length > 4000) errs.notes = 'Ghi chú không được vượt quá 4000 ký tự.'

    return errs
  }

  function buildPayload() {
    return {
      customerId: form.customerId,
      title: form.title.trim(),
      contractType: form.contractType,
      effectiveDate: form.effectiveDate || null,
      expiryDate: form.expiryDate || null,
      discountPercent: form.discountPercent !== '' ? Number(form.discountPercent) : null,
      creditLimit: form.creditLimit !== '' ? Number(form.creditLimit) : null,
      paymentTermDays: form.paymentTermDays !== '' ? Number(form.paymentTermDays) : null,
      notes: form.notes.trim() || null,
    }
  }

  async function handleSaveDraft() {
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setIsSaving(true)
    try {
      const payload = buildPayload()
      if (isEdit) {
        await updateContract(id, payload)
        showSuccess('Đã lưu hợp đồng.')
        navigate(`/contracts/${id}`)
      } else {
        const created = await createContract(payload)
        showSuccess('Đã tạo hợp đồng.')
        navigate(`/contracts/${created.id}`)
      }
    } catch (err) {
      showError(err?.message ?? 'Không thể lưu hợp đồng.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleSubmitForApproval() {
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    if (!(await confirmDialog({
      title: 'Gửi duyệt',
      message: 'Gửi hợp đồng để duyệt? Sau khi gửi bạn sẽ không thể chỉnh sửa cho đến khi Admin xem xét.',
      tone: 'primary',
    }))) return
    setIsSubmitting(true)
    try {
      const payload = buildPayload()
      let contractId = id
      if (isEdit) {
        await updateContract(id, payload)
      } else {
        const created = await createContract(payload)
        contractId = created.id
      }
      await submitContract(contractId)
      showSuccess('Đã gửi hợp đồng chờ duyệt.')
      navigate(`/contracts/${contractId}`)
    } catch (err) {
      showError(err?.message ?? 'Không thể gửi hợp đồng.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <PageShell>
        <div className="flex h-48 items-center justify-center text-sm text-[#717971]">Đang tải...</div>
      </PageShell>
    )
  }

  return (
    <PageShell>
      <div className="mb-4 flex items-center gap-2">
        <Link
          to={isEdit ? `/contracts/${id}` : '/contracts'}
          className="inline-flex items-center gap-1 text-sm text-[#717971] hover:text-[#1a1a1a]"
        >
          <span className="material-symbols-outlined text-base">arrow_back</span>
          Quay lại
        </Link>
      </div>
      <PageHeader
        title={isEdit ? 'Chỉnh sửa hợp đồng' : 'Tạo hợp đồng mới'}
        titleInfo="Hợp đồng dành cho khách doanh nghiệp (B2B)"
      />

      <div className="mx-auto max-w-2xl space-y-6">
        {/* Customer picker */}
        <div>
          <Label required>Khách hàng doanh nghiệp</Label>
          {isEdit ? (
            <p className="rounded-lg border border-[#e8e5de] bg-[#f9f7f2] px-3 py-2 text-sm text-[#1a1a1a]">
              {selectedCustomer?.fullName} ({selectedCustomer?.customerCode})
            </p>
          ) : (
            <div className="relative">
              <input
                type="text"
                className={inputCls(errors.customerId)}
                placeholder="Tìm tên khách hàng doanh nghiệp..."
                value={selectedCustomer ? `${selectedCustomer.fullName} (${selectedCustomer.customerCode})` : customerSearch}
                onChange={(e) => {
                  if (selectedCustomer) {
                    setSelectedCustomer(null)
                    setField('customerId', '')
                  }
                  setCustomerSearch(e.target.value)
                }}
                onFocus={() => customerOptions.length > 0 && setShowCustomerDropdown(true)}
              />
              {showCustomerDropdown && customerOptions.length > 0 && (
                <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-[#e8e5de] bg-white shadow-lg">
                  {customerOptions.map((c) => (
                    <button
                      key={c.customerId}
                      type="button"
                      onClick={() => {
                        setSelectedCustomer(c)
                        setField('customerId', c.customerId)
                        setCustomerSearch('')
                        setShowCustomerDropdown(false)
                      }}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-[#f9f7f2]"
                    >
                      <span className="material-symbols-outlined text-base text-[#717971]">corporate_fare</span>
                      <span>
                        <span className="font-medium">{c.fullName}</span>
                        <span className="ml-2 text-xs text-[#717971]">{c.customerCode}</span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <FieldError message={errors.customerId} />
        </div>

        {/* Title */}
        <div>
          <Label required>Tiêu đề hợp đồng</Label>
          <input
            type="text"
            className={inputCls(errors.title)}
            value={form.title}
            onChange={(e) => setField('title', e.target.value)}
            placeholder="VD: Hợp đồng cung cấp văn phòng phẩm 2026"
            maxLength={200}
          />
          <div className="flex items-start justify-between">
            <FieldError message={errors.title} />
            <span className={`ml-auto mt-1 text-xs ${form.title.length > 190 ? 'text-[#b42318]' : 'text-[#717971]'}`}>
              {form.title.length}/200
            </span>
          </div>
        </div>

        {/* Contract type */}
        <div>
          <Label required>Loại hợp đồng</Label>
          <select
            className={INPUT}
            value={form.contractType}
            onChange={(e) => setField('contractType', e.target.value)}
          >
            {CONTRACT_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Date range */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Ngày hiệu lực</Label>
            <input type="date" className={inputCls(errors.effectiveDate)} value={form.effectiveDate} onChange={(e) => setField('effectiveDate', e.target.value)} />
          <FieldError message={errors.effectiveDate} />
          </div>
          <div>
            <Label>Ngày hết hạn</Label>
            <input type="date" className={inputCls(errors.expiryDate)} value={form.expiryDate} onChange={(e) => setField('expiryDate', e.target.value)} />
          <FieldError message={errors.expiryDate} />
          </div>
        </div>

        {/* Commercial terms */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label>Chiết khấu (%)</Label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              className={inputCls(errors.discountPercent)}
              value={form.discountPercent}
              onChange={(e) => setField('discountPercent', e.target.value)}
              placeholder="0"
            />
            <FieldError message={errors.discountPercent} />
          </div>
          <div>
            <Label>Hạn mức công nợ (đ)</Label>
            <input
              type="text"
              inputMode="numeric"
              className={inputCls(errors.creditLimit)}
              value={creditLimitDisplay}
              onChange={(e) => {
                const raw = parseCurrency(e.target.value)
                if (raw !== '' && !/^\d+$/.test(raw)) return
                setCreditLimitDisplay(formatCurrency(raw))
                setField('creditLimit', raw)
              }}
              placeholder="3.000.000"
            />
            <FieldError message={errors.creditLimit} />
          </div>
          <div>
            <Label>Kỳ hạn TT (ngày)</Label>
            <input
              type="number"
              min="1"
              max="365"
              step="1"
              className={inputCls(errors.paymentTermDays)}
              value={form.paymentTermDays}
              onChange={(e) => setField('paymentTermDays', e.target.value)}
              placeholder="30"
            />
            <FieldError message={errors.paymentTermDays} />
          </div>
        </div>

        {/* Notes */}
        <div>
          <Label>Điều khoản / Ghi chú</Label>
          <textarea
            className={`${errors.notes ? INPUT_ERROR : INPUT} min-h-[100px] resize-y`}
            value={form.notes}
            onChange={(e) => setField('notes', e.target.value)}
            placeholder="Các điều khoản đặc biệt, điều kiện thanh toán..."
            maxLength={4000}
          />
          <div className="flex items-start justify-between">
            <FieldError message={errors.notes} />
            <span className={`ml-auto mt-1 text-xs ${form.notes.length > 3800 ? 'text-[#b42318]' : 'text-[#717971]'}`}>
              {form.notes.length}/4000
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 border-t border-[#f0eee6] pt-4">
          <button
            type="button"
            onClick={() => navigate(isEdit ? `/contracts/${id}` : '/contracts')}
            className="rounded-lg border border-[#e8e5de] px-4 py-2 text-sm font-medium text-[#717971] hover:bg-[#f9f7f2]"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={isSaving || isSubmitting}
            className="rounded-lg border border-[#1a1a1a] px-4 py-2 text-sm font-medium text-[#1a1a1a] hover:bg-[#f9f7f2] disabled:opacity-50"
          >
            {isSaving ? 'Đang lưu...' : 'Lưu nháp'}
          </button>
          <button
            type="button"
            onClick={handleSubmitForApproval}
            disabled={isSaving || isSubmitting}
            className="rounded-lg bg-[#1a1a1a] px-4 py-2 text-sm font-medium text-white hover:bg-[#333] disabled:opacity-50"
          >
            {isSubmitting ? 'Đang gửi...' : 'Gửi duyệt'}
          </button>
        </div>
      </div>
    </PageShell>
  )
}

export default ContractFormPage
