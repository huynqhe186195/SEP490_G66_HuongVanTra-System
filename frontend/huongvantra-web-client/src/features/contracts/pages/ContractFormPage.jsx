import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import PageHeader from '../../../components/shared/PageHeader.jsx'
import PageShell from '../../../components/shared/PageShell.jsx'
import { confirmDialog } from '../../../app/dialog.js'
import { showError, showSuccess } from '../../../app/toast.js'
import { loadAuthSession } from '../../auth/services/authSession.js'
import { canApproveContracts } from '../../auth/utils/permissions.js'
import { searchCustomersForCheckout } from '../../customers/services/customersApi.js'
import { fetchContractSkus, fetchSkus } from '../../products/services/productSkusApi.js'
import { getProductTypeLabel, getProductTypeTone } from '../../products/utils/productTypes.js'
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
  signedAtLocation: '',
  paymentMethod: '',
  deliveryTerms: '',
  shippingResponsibility: '',
}

const EMPTY_LINE = { skuId: '', skuCode: '', productName: '', unit: '', productType: '', quantity: '', unitPrice: '', note: '' }

const TYPE_BADGE_CLASS = {
  green: 'bg-[#356647]/10 text-[#356647]',
  amber: 'bg-[#946200]/10 text-[#946200]',
  blue: 'bg-[#1d4ed8]/10 text-[#1d4ed8]',
  neutral: 'bg-[#717971]/10 text-[#717971]',
}

function TypeBadge({ productType }) {
  if (!productType) return null
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${TYPE_BADGE_CLASS[getProductTypeTone(productType)] ?? TYPE_BADGE_CLASS.neutral}`}>
      {getProductTypeLabel(productType)}
    </span>
  )
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
  return <p className="text-xs text-[#b42318]">{message}</p>
}

function Label({ children, required }) {
  return (
    <span className="text-sm font-semibold text-[#1b1c17]">
      {children}
      {required && <span className="ml-0.5 text-[#b42318]">*</span>}
    </span>
  )
}

function fieldCls(error, extra = '') {
  return `w-full rounded-xl border bg-white px-3 py-2.5 text-sm text-[#1b1c17] outline-none transition focus:border-[#356647] focus:ring-2 focus:ring-[#356647]/20 ${
    error ? 'border-[#b42318]/50 ring-2 ring-[#b42318]/20' : 'border-[#c1c9c0]'
  } ${extra}`.trim()
}

function SectionCard({ title, subtitle, children }) {
  return (
    <div className="space-y-4 rounded-2xl border border-[#c1c9c0]/60 bg-[#fafaf7] p-5">
      <div className="border-b border-[#c1c9c0]/40 pb-3">
        <p className="text-sm font-bold text-[#1b1c17]">{title}</p>
        {subtitle ? <p className="mt-0.5 text-xs text-[#8a9186]">{subtitle}</p> : null}
      </div>
      {children}
    </div>
  )
}

function ContractFormPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEdit = Boolean(id)
  const session = useMemo(() => loadAuthSession(), [])
  const currentUserId = session?.userId
  const canApprove = canApproveContracts(session)

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
  const [lineItems, setLineItems] = useState([{ ...EMPTY_LINE }])
  const [skuSearch, setSkuSearch] = useState({})
  const [skuOptions, setSkuOptions] = useState({})
  const [showSkuDropdown, setShowSkuDropdown] = useState({})
  const [skuLoading, setSkuLoading] = useState({})
  const skuTimers = useRef({})

  // Load existing contract for edit
  useEffect(() => {
    if (!isEdit) return
    setIsLoading(true)
    fetchContractById(id)
      .then((c) => {
        if (!c) return navigate('/contracts')
        if (c.createdByUserId !== currentUserId || (c.status !== 'Draft' && c.status !== 'Rejected')) {
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
          signedAtLocation: c.signedAtLocation ?? '',
          paymentMethod: c.paymentMethod ?? '',
          deliveryTerms: c.deliveryTerms ?? '',
          shippingResponsibility: c.shippingResponsibility ?? '',
        })
        if (c.lineItems && c.lineItems.length > 0) {
          setLineItems(c.lineItems.map(l => ({
            skuId: l.skuId,
            skuCode: l.skuCode,
            productName: l.productName,
            unit: l.unit ?? '',
            quantity: String(l.quantity),
            unitPrice: String(l.unitPrice),
            note: l.note ?? '',
          })))
        }
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
        const result = await searchCustomersForCheckout({
          search: customerSearch.trim(),
          customerType: 'CORPORATE',
          pageSize: 10
        })
        setCustomerOptions(Array.isArray(result) ? result : [])
        setShowCustomerDropdown(true)
      } catch {
        setCustomerOptions([])
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [customerSearch, isEdit])

  function searchSkuForRow(rowIdx, text) {
    clearTimeout(skuTimers.current[rowIdx])
    setSkuSearch(prev => ({ ...prev, [rowIdx]: text }))
    if (!text.trim()) {
      setSkuOptions(prev => ({ ...prev, [rowIdx]: [] }))
      setShowSkuDropdown(prev => ({ ...prev, [rowIdx]: false }))
      setSkuLoading(prev => ({ ...prev, [rowIdx]: false }))
      return
    }
    setSkuLoading(prev => ({ ...prev, [rowIdx]: true }))
    setShowSkuDropdown(prev => ({ ...prev, [rowIdx]: true }))
    skuTimers.current[rowIdx] = setTimeout(async () => {
      try {
        let result
        try {
          result = await fetchContractSkus({ search: text, isActive: true, pageSize: 15 })
        } catch {
          result = await fetchSkus({ search: text, isActive: true, pageSize: 15 })
        }
        // Lọc bỏ bao bì (BAO_BI) khỏi kết quả
        const filtered = (result.items ?? []).filter(sku => sku.productType !== 'BAO_BI')
        setSkuOptions(prev => ({ ...prev, [rowIdx]: filtered }))
      } catch (err) {
        console.error('SKU search error:', err)
        setSkuOptions(prev => ({ ...prev, [rowIdx]: [] }))
      } finally {
        setSkuLoading(prev => ({ ...prev, [rowIdx]: false }))
      }
    }, 300)
  }

  function selectSkuForRow(rowIdx, sku) {
    updateLine(rowIdx, {
      skuId: sku.id ?? sku.skuId ?? '',
      skuCode: sku.skuCode ?? '',
      productName: sku.productName ?? '',
      unit: sku.unitName ?? '',
      productType: sku.productType ?? '',
      unitPrice: sku.retailPrice != null && sku.retailPrice > 0 ? String(sku.retailPrice) : '',
    })
    setSkuSearch(prev => ({ ...prev, [rowIdx]: '' }))
    setShowSkuDropdown(prev => ({ ...prev, [rowIdx]: false }))
  }

  function updateLine(rowIdx, patch) {
    setLineItems(prev => prev.map((l, i) => i === rowIdx ? { ...l, ...patch } : l))
  }

  function addLine() {
    setLineItems(prev => [...prev, { ...EMPTY_LINE }])
  }

  function removeLine(rowIdx) {
    setLineItems(prev => prev.filter((_, i) => i !== rowIdx))
  }

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
      signedAtLocation: form.signedAtLocation.trim() || null,
      paymentMethod: form.paymentMethod.trim() || null,
      deliveryTerms: form.deliveryTerms.trim() || null,
      shippingResponsibility: form.shippingResponsibility.trim() || null,
      lineItems: lineItems
        .filter(l => l.skuId)
        .map(l => ({
          skuId: l.skuId,
          quantity: Number(l.quantity) || 0,
          unitPrice: Number(l.unitPrice) || 0,
          note: l.note.trim() || null,
        })),
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
      title: canApprove ? 'Ban hành hợp đồng' : 'Gửi duyệt',
      message: canApprove
        ? 'Ban hành hợp đồng này? Hợp đồng sẽ có hiệu lực ngay và không thể chỉnh sửa.'
        : 'Gửi hợp đồng để duyệt? Sau khi gửi bạn sẽ không thể chỉnh sửa cho đến khi Quản lý phản hồi.',
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
      showSuccess(canApprove ? 'Đã ban hành hợp đồng.' : 'Đã gửi hợp đồng chờ duyệt.')
      navigate(`/contracts/${contractId}`)
    } catch (err) {
      showError(err?.message ?? 'Không thể gửi hợp đồng.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const activeLines = lineItems.filter(l => l.skuId)
  const totalAmount = lineItems.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0), 0)
  const contractTypeLabel = CONTRACT_TYPE_OPTIONS.find(o => o.value === form.contractType)?.label ?? '—'

  if (isLoading) {
    return (
      <PageShell>
        <div className="rounded-[24px] border border-[#c1c9c0]/30 bg-white p-8 text-center text-[#717971] shadow-sm">
          Đang tải hợp đồng...
        </div>
      </PageShell>
    )
  }

  return (
    <PageShell>
      <div className="mb-4 flex items-center gap-2">
        <Link
          to={isEdit ? `/contracts/${id}` : '/contracts'}
          className="inline-flex items-center gap-1 text-sm text-[#717971] hover:text-[#356647]"
        >
          <span className="material-symbols-outlined text-base">arrow_back</span>
          Quay lại
        </Link>
      </div>
      <PageHeader
        title={isEdit ? 'Chỉnh sửa hợp đồng' : 'Tạo hợp đồng mới'}
        titleInfo="Hợp đồng dành cho khách doanh nghiệp (B2B)"
      />

      <section className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
        <form className="space-y-6 rounded-[24px] border border-[#c1c9c0]/30 bg-white p-4 shadow-sm sm:p-6" onSubmit={(e) => e.preventDefault()}>
          {/* 1. Thông tin cơ bản */}
          <SectionCard title="Thông tin cơ bản" subtitle="Khách hàng và định danh hợp đồng">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="space-y-2 md:col-span-2">
                <Label required>Khách hàng doanh nghiệp</Label>
                {isEdit ? (
                  <div className="rounded-xl border border-[#c1c9c0]/40 bg-[#f0eee6] px-3 py-2.5 text-sm text-[#1b1c17]">
                    {selectedCustomer?.fullName} ({selectedCustomer?.customerCode})
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      type="text"
                      className={fieldCls(errors.customerId)}
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
                      <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-[#c1c9c0]/60 bg-white shadow-lg">
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
                            className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-[#f0eee6]"
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
              </label>

              <label className="space-y-2 md:col-span-2">
                <Label required>Tiêu đề hợp đồng</Label>
                <input
                  type="text"
                  className={fieldCls(errors.title)}
                  value={form.title}
                  onChange={(e) => setField('title', e.target.value)}
                  placeholder="VD: Hợp đồng cung cấp văn phòng phẩm 2026"
                  maxLength={200}
                />
                <div className="flex items-start justify-between">
                  <FieldError message={errors.title} />
                  <span className={`ml-auto text-xs ${form.title.length > 190 ? 'text-[#b42318]' : 'text-[#8a9186]'}`}>
                    {form.title.length}/200
                  </span>
                </div>
              </label>

              <label className="space-y-2 md:col-span-2">
                <Label required>Loại hợp đồng</Label>
                <select
                  className={fieldCls(false)}
                  value={form.contractType}
                  onChange={(e) => setField('contractType', e.target.value)}
                >
                  {CONTRACT_TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </label>
            </div>
          </SectionCard>

          {/* 2. Thời hạn hợp đồng */}
          <SectionCard title="Thời hạn hợp đồng" subtitle="Ngày bắt đầu và kết thúc hiệu lực">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <Label>Ngày hiệu lực</Label>
                <input type="date" className={fieldCls(errors.effectiveDate)} value={form.effectiveDate} onChange={(e) => setField('effectiveDate', e.target.value)} />
                <FieldError message={errors.effectiveDate} />
              </label>
              <label className="space-y-2">
                <Label>Ngày hết hạn</Label>
                <input type="date" className={fieldCls(errors.expiryDate)} value={form.expiryDate} onChange={(e) => setField('expiryDate', e.target.value)} />
                <FieldError message={errors.expiryDate} />
              </label>
            </div>
          </SectionCard>

          {/* 3. Điều kiện thương mại */}
          <SectionCard title="Điều kiện thương mại" subtitle="Chiết khấu, công nợ và thanh toán">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <Label>Chiết khấu (%)</Label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  className={fieldCls(errors.discountPercent)}
                  value={form.discountPercent}
                  onChange={(e) => setField('discountPercent', e.target.value)}
                  placeholder="0"
                />
                <FieldError message={errors.discountPercent} />
              </label>
              <label className="space-y-2">
                <Label>Hạn mức công nợ (đ)</Label>
                <input
                  type="text"
                  inputMode="numeric"
                  className={fieldCls(errors.creditLimit)}
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
              </label>
              <label className="space-y-2">
                <Label>Kỳ hạn thanh toán (ngày)</Label>
                <input
                  type="number"
                  min="1"
                  max="365"
                  step="1"
                  className={fieldCls(errors.paymentTermDays)}
                  value={form.paymentTermDays}
                  onChange={(e) => setField('paymentTermDays', e.target.value)}
                  placeholder="30"
                />
                <FieldError message={errors.paymentTermDays} />
              </label>
              <label className="space-y-2">
                <Label>Hình thức thanh toán</Label>
                <select className={fieldCls(false)} value={form.paymentMethod ?? ''}
                  onChange={(e) => setField('paymentMethod', e.target.value)}>
                  <option value="">— Chọn hình thức —</option>
                  <option value="Chuyển khoản ngân hàng">Chuyển khoản ngân hàng</option>
                  <option value="Tiền mặt">Tiền mặt</option>
                </select>
              </label>
            </div>
          </SectionCard>

          {/* 4. Giao hàng & ký kết */}
          <SectionCard title="Giao hàng & ký kết" subtitle="Dùng khi xuất file Word / PDF">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <Label>Địa điểm ký kết</Label>
                <input type="text" className={fieldCls(false)} value={form.signedAtLocation}
                  onChange={(e) => setField('signedAtLocation', e.target.value)}
                  placeholder="VD: Tại trụ sở Công ty TNHH Hương Vân Trà..." maxLength={300} />
              </label>
              <label className="space-y-2">
                <Label>Bên chịu chi phí vận chuyển</Label>
                <input type="text" className={fieldCls(false)} value={form.shippingResponsibility}
                  onChange={(e) => setField('shippingResponsibility', e.target.value)}
                  placeholder="VD: Bên Bán chịu toàn bộ chi phí vận chuyển..." maxLength={300} />
              </label>
              <label className="space-y-2 md:col-span-2">
                <Label>Điều khoản giao hàng</Label>
                <textarea className={`${fieldCls(false)} min-h-[80px] resize-y`} value={form.deliveryTerms}
                  onChange={(e) => setField('deliveryTerms', e.target.value)}
                  placeholder="Địa điểm, thời gian giao hàng..." maxLength={1000} />
              </label>
            </div>
          </SectionCard>

          {/* 5. Ghi chú */}
          <SectionCard title="Điều khoản / Ghi chú" subtitle="Ghi chú bổ sung cho hợp đồng">
            <label className="space-y-2">
              <textarea
                className={`${fieldCls(errors.notes)} min-h-[100px] resize-y`}
                value={form.notes}
                onChange={(e) => setField('notes', e.target.value)}
                placeholder="Các điều khoản đặc biệt, điều kiện thanh toán..."
                maxLength={4000}
              />
              <div className="flex items-start justify-between">
                <FieldError message={errors.notes} />
                <span className={`ml-auto text-xs ${form.notes.length > 3800 ? 'text-[#b42318]' : 'text-[#8a9186]'}`}>
                  {form.notes.length}/4000
                </span>
              </div>
            </label>
          </SectionCard>

          {/* Danh sách hàng hóa */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[#717971]">Danh sách hàng hóa</p>
                <p className="mt-0.5 text-xs text-[#8a9186]">Tìm và chọn SKU có sẵn (kể cả nguyên liệu, bao bì) — đơn giá mặc định theo giá bán lẻ, có thể sửa</p>
              </div>
              <button type="button" onClick={addLine}
                className="inline-flex items-center gap-1 rounded-xl border border-[#356647] px-3 py-1.5 text-sm font-semibold text-[#356647] hover:bg-[#356647]/5">
                <span className="material-symbols-outlined text-base">add</span>
                Thêm dòng
              </button>
            </div>

            <div className="overflow-visible rounded-xl border border-[#c1c9c0]/40">
              <div className="overflow-visible">
                <table className="w-full min-w-[700px] border-collapse text-sm">
                  <thead className="sticky top-0 z-10 bg-[#f0eee6]">
                    <tr>
                      <th className="w-8 px-3 py-2.5 text-center text-xs font-semibold text-[#717971]">#</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-[#717971]">Tên hàng / SKU</th>
                      <th className="w-24 px-3 py-2.5 text-right text-xs font-semibold text-[#717971]">Số lượng</th>
                      <th className="w-32 px-3 py-2.5 text-right text-xs font-semibold text-[#717971]">Đơn giá (đ)</th>
                      <th className="w-32 px-3 py-2.5 text-right text-xs font-semibold text-[#717971]">Thành tiền</th>
                      <th className="w-48 px-3 py-2.5 text-left text-xs font-semibold text-[#717971]">Ghi chú</th>
                      <th className="w-8 px-2 py-2.5"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#c1c9c0]/30 bg-white">
                    {lineItems.map((line, idx) => {
                      const amount = (Number(line.quantity) || 0) * (Number(line.unitPrice) || 0)
                      return (
                        <tr key={idx} className="hover:bg-[#fafaf7]">
                          <td className="px-3 py-2 text-center text-xs text-[#717971]">{idx + 1}</td>
                          <td className="px-3 py-2 min-w-[240px] max-w-[300px]">
                            <div className="relative">
                              <input
                                type="text"
                                className="w-full rounded-lg border border-[#c1c9c0] bg-white px-2.5 py-2 text-sm text-[#1b1c17] outline-none transition focus:border-[#356647] focus:ring-2 focus:ring-[#356647]/20"
                                value={line.skuId ? line.productName : (skuSearch[idx] ?? '')}
                                placeholder="Tìm tên hàng hoặc mã SKU..."
                                onChange={(e) => {
                                  if (line.skuId) updateLine(idx, { skuId: '', skuCode: '', productName: '', unit: '', productType: '' })
                                  searchSkuForRow(idx, e.target.value)
                                }}
                              />
                              {showSkuDropdown[idx] && (
                                <div className="absolute left-0 top-full z-[9999] mt-1 w-72 rounded-lg border border-[#c1c9c0] bg-white shadow-xl max-h-52 overflow-y-auto">
                                  {skuLoading[idx] ? (
                                    <div className="px-3 py-2 text-sm text-[#717971]">Đang tìm...</div>
                                  ) : (skuOptions[idx] ?? []).length === 0 ? (
                                    <div className="px-3 py-2 text-sm text-[#717971]">Không tìm thấy</div>
                                  ) : (
                                    (skuOptions[idx] ?? []).map((sku) => (
                                      <button
                                        key={sku.id ?? sku.skuId}
                                        type="button"
                                        onMouseDown={(e) => {
                                          e.preventDefault()
                                          selectSkuForRow(idx, sku)
                                        }}
                                        className="block w-full px-3 py-2 text-left text-sm hover:bg-[#f0eee6] transition-colors border-b border-[#e5e7eb] last:border-0"
                                      >
                                        {sku.productName}
                                      </button>
                                    ))
                                  )}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2 w-24">
                            <input type="number" min="0.001" step="any"
                              className="w-full rounded-lg border border-[#c1c9c0] bg-white px-2.5 py-2 text-right text-sm outline-none transition focus:border-[#356647] focus:ring-2 focus:ring-[#356647]/20"
                              value={line.quantity}
                              onChange={(e) => updateLine(idx, { quantity: e.target.value })}
                              placeholder="0" />
                          </td>
                          <td className="px-3 py-2 w-32">
                            <input type="text"
                              className="w-full rounded-lg border border-[#c1c9c0] bg-[#f8f9fa] px-2.5 py-2 text-right text-sm cursor-not-allowed"
                              value={line.unitPrice ? Number(line.unitPrice).toLocaleString('vi-VN') : ''}
                              readOnly
                              placeholder="0" />
                          </td>
                          <td className="px-3 py-2 text-right text-sm font-semibold text-[#356647] whitespace-nowrap w-32">
                            {amount > 0 ? `${amount.toLocaleString('vi-VN')} đ` : '—'}
                          </td>
                          <td className="px-3 py-2 min-w-[200px]">
                            <textarea
                              rows={2}
                              className="w-full resize-none rounded-lg border border-[#c1c9c0] bg-white px-2.5 py-2 text-sm outline-none transition focus:border-[#356647] focus:ring-2 focus:ring-[#356647]/20"
                              value={line.note}
                              onChange={(e) => updateLine(idx, { note: e.target.value })}
                              placeholder="Ghi chú..." maxLength={200} />
                          </td>
                          <td className="px-2 py-2">
                            <button type="button" onClick={() => removeLine(idx)}
                              disabled={lineItems.length <= 1}
                              title="Xóa dòng"
                              className="rounded-lg p-1 text-[#b42318] hover:bg-[#b42318]/10 disabled:cursor-not-allowed disabled:opacity-30">
                              <span className="material-symbols-outlined text-base">delete</span>
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {activeLines.length > 0 && (
              <div className="flex items-center justify-between rounded-xl bg-[#f0eee6] px-4 py-3">
                <span className="text-sm font-semibold text-[#1b1c17]">Tổng cộng ({activeLines.length} dòng hàng)</span>
                <span className="text-base font-bold text-[#356647]">{totalAmount.toLocaleString('vi-VN')} đ</span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col-reverse gap-3 border-t border-[#c1c9c0]/40 pt-5 sm:flex-row sm:flex-wrap sm:justify-end">
            <Link
              to={isEdit ? `/contracts/${id}` : '/contracts'}
              className="inline-flex w-full items-center justify-center rounded-xl border border-[#356647] px-5 py-2.5 text-sm font-semibold text-[#356647] hover:bg-[#356647]/5 sm:w-auto"
            >
              Hủy
            </Link>
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={isSaving || isSubmitting}
              className="inline-flex w-full items-center justify-center rounded-xl border border-[#c1c9c0]/60 bg-white px-5 py-2.5 text-sm font-semibold text-[#1b1c17] hover:bg-[#f0eee6] disabled:opacity-60 sm:w-auto"
            >
              {isSaving ? 'Đang lưu...' : 'Lưu nháp'}
            </button>
            <button
              type="button"
              onClick={handleSubmitForApproval}
              disabled={isSaving || isSubmitting}
              className="inline-flex w-full items-center justify-center rounded-xl bg-[#4a6242] px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60 sm:w-auto"
            >
              {isSubmitting ? 'Đang gửi...' : canApprove ? 'Ban hành' : 'Gửi duyệt'}
            </button>
          </div>
        </form>

        {/* Sidebar: contract summary */}
        <aside className="space-y-4 rounded-[24px] border border-[#c1c9c0]/30 bg-white p-4 shadow-sm sm:p-6 xl:sticky xl:top-0 xl:max-h-[calc(100vh-8rem)] xl:overflow-y-auto xl:overscroll-contain">
          <h3 className="text-lg font-semibold text-[#356647]">Tóm tắt hợp đồng</h3>

          <div className="rounded-xl bg-[#f6f4ec] p-4">
            <p className="text-xs text-[#717971]">Khách hàng</p>
            <p className="text-sm font-bold text-[#1b1c17]">{selectedCustomer?.fullName || '—'}</p>
            {selectedCustomer?.customerCode ? (
              <p className="mt-0.5 text-xs text-[#356647]">{selectedCustomer.customerCode}</p>
            ) : null}
          </div>

          <div className="rounded-xl bg-[#f6f4ec] p-4">
            <p className="text-xs text-[#717971]">Loại hợp đồng</p>
            <p className="text-sm font-bold text-[#1b1c17]">{contractTypeLabel}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-[#f6f4ec] p-4">
              <p className="text-xs text-[#717971]">Hiệu lực</p>
              <p className="text-sm font-bold text-[#1b1c17]">{form.effectiveDate || '—'}</p>
            </div>
            <div className="rounded-xl bg-[#f6f4ec] p-4">
              <p className="text-xs text-[#717971]">Hết hạn</p>
              <p className="text-sm font-bold text-[#1b1c17]">{form.expiryDate || '—'}</p>
            </div>
          </div>

          <div className="rounded-xl border border-[#356647]/15 bg-[#f8ffef] p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-[#356647]">Số dòng hàng hóa</p>
            <p className="mt-1 text-lg font-bold text-[#1b1c17]">{activeLines.length}</p>
          </div>

          <div className="rounded-xl border border-[#356647]/15 bg-[#f8ffef] p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-[#356647]">Tổng giá trị hàng hóa</p>
            <p className="mt-1 text-lg font-bold text-[#356647]">{totalAmount.toLocaleString('vi-VN')} đ</p>
          </div>

          {form.discountPercent !== '' || form.creditLimit !== '' || form.paymentTermDays !== '' ? (
            <div className="space-y-2 rounded-xl bg-[#f6f4ec] p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#717971]">Điều kiện thương mại</p>
              {form.discountPercent !== '' ? (
                <p className="text-xs text-[#1b1c17]">Chiết khấu: <span className="font-semibold">{form.discountPercent}%</span></p>
              ) : null}
              {form.creditLimit !== '' ? (
                <p className="text-xs text-[#1b1c17]">Hạn mức công nợ: <span className="font-semibold">{formatCurrency(form.creditLimit)} đ</span></p>
              ) : null}
              {form.paymentTermDays !== '' ? (
                <p className="text-xs text-[#1b1c17]">Kỳ hạn thanh toán: <span className="font-semibold">{form.paymentTermDays} ngày</span></p>
              ) : null}
            </div>
          ) : null}

          {existingStatus ? (
            <p className="rounded-xl border border-[#7e5700]/20 bg-[#fff8e8] px-3 py-2 text-xs text-[#7e5700]">
              Trạng thái hiện tại: {existingStatus === 'Rejected' ? 'Đã từ chối — chỉnh sửa và gửi lại' : existingStatus}
            </p>
          ) : null}
        </aside>
      </section>
    </PageShell>
  )
}

export default ContractFormPage
