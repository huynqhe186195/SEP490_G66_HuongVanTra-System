import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import PageHeader from '../../../components/shared/PageHeader.jsx'
import PageShell from '../../../components/shared/PageShell.jsx'
import { confirmDialog } from '../../../app/dialog.js'
import { showError, showSuccess } from '../../../app/toast.js'
import { useAuthSession } from '../../auth/hooks/useAuthSession.js'
import {
  canCreateCustomer,
  canDeleteCustomer,
  canEditCustomer,
  canManageCorporateCustomers,
  canViewAllCustomers,
  canViewCustomer,
} from '../../auth/utils/permissions.js'
import { fetchManagerAssignees, fetchSalesAssignees } from '../../iam/services/employeesApi.js'
import MembershipTierProgress from '../components/MembershipTierProgress.jsx'
import CustomerActivityFeed from '../components/CustomerActivityFeed.jsx'
import CustomerOpenDebtsPanel from '../components/CustomerOpenDebtsPanel.jsx'
import CustomerDebtHistory from '../components/CustomerDebtHistory.jsx'
import CustomerOrderHistory from '../components/CustomerOrderHistory.jsx'
import CustomerContractsPanel from '../components/CustomerContractsPanel.jsx'
import {
  changeCustomerStatus,
  createCustomer,
  deleteCustomer,
  fetchCustomerById,
  fetchCustomerOpenDebts,
  fetchMembershipTiers,
  updateCustomer,
} from '../services/customersApi.js'
import { TIER_READONLY_HINT, formatNonMembershipTierNotice } from '../utils/membershipTierUtils.js'
import { DEFAULT_MEMBERSHIP_TIER } from '../utils/customerDisplay.js'
import {
  customerTypeFromTab,
  customerTypeLabel,
  formatDebtVnd,
  formatVnd,
  supportsMembershipTierForTab,
  tabKeyFromCustomerType,
  CUSTOMER_CORPORATE_ENABLED,
} from '../utils/customerDisplay.js'
import { mapCustomerApiError, normalizeNameInput, normalizePhoneInput, normalizeTaxCodeInput, getPhoneMaxLength, validateCustomerForm } from '../utils/customerValidation.js'

const CUSTOMER_SOURCE_OPTIONS = [
  { value: '', label: '— Chưa chọn —' },
  { value: 'Website', label: 'Website' },
  { value: 'Zalo', label: 'Zalo' },
  { value: 'Phone', label: 'Điện thoại' },
  { value: 'WalkIn', label: 'Tại quầy' },
  { value: 'Referral', label: 'Giới thiệu' },
  { value: 'Other', label: 'Khác' },
]

function FieldError({ message }) {
  if (!message) return null
  return <p className="text-xs text-[#b42318]">{message}</p>
}

function CustomerFormPage() {
  const navigate = useNavigate()
  const { customerId } = useParams()
  const [searchParams] = useSearchParams()
  const isEditMode = Boolean(customerId)
  const isViewMode = isEditMode && searchParams.get('mode') === 'view'

  const [tiers, setTiers] = useState([])
  const [isLoading, setIsLoading] = useState(isEditMode)
  const [isSaving, setIsSaving] = useState(false)
  const [currentDebt, setCurrentDebt] = useState(0)
  const [totalSpend, setTotalSpend] = useState(0)
  const [currentTierCode, setCurrentTierCode] = useState('')
  const [currentTierDiscount, setCurrentTierDiscount] = useState(0)
  const [currentTierId, setCurrentTierId] = useState(null)
  const [initialStatus, setInitialStatus] = useState('active')
  const [isDeleting, setIsDeleting] = useState(false)
  const [openDebts, setOpenDebts] = useState([])
  const [isLoadingOpenDebts, setIsLoadingOpenDebts] = useState(false)
  const [fieldErrors, setFieldErrors] = useState({})
  const [isNameComposing, setIsNameComposing] = useState(false)
  const [saleOptions, setSaleOptions] = useState([])
  const [managerOptions, setManagerOptions] = useState([])
  const [profileTab, setProfileTab] = useState('overview')
  const session = useAuthSession()
  const canAssignSale = canViewAllCustomers(session)
  const canManageProfile = canEditCustomer(session)
  const canViewProfile = canViewCustomer(session)
  const canRemoveCustomer = canDeleteCustomer(session)
  const canManageCorporate = canManageCorporateCustomers(session)
  const requestedType = searchParams.get('type')
  const initialType =
    requestedType === 'corporate' && (!CUSTOMER_CORPORATE_ENABLED || !canManageCorporate)
      ? 'general'
      : ['general', 'vip', 'corporate'].includes(requestedType)
        ? requestedType
        : 'general'
  const [form, setForm] = useState({
    type: initialType,
    customerCode: '',
    name: '',
    phone: '',
    email: '',
    address: '',
    taxCode: '',
    source: '',
    assignedEmployeeId: '',
    status: 'active',
  })
  const isCorporateProfile = form.type === 'corporate'
  const isCorporateLocked = isCorporateProfile && !canManageCorporate
  const isReadOnly = isViewMode || (isEditMode && !canManageProfile) || isCorporateLocked
  /** Khi chỉnh sửa: khóa thông tin định danh; chỉ sửa email, nguồn, người phụ trách. */
  const isPrimaryLocked = isEditMode && !isViewMode && canManageProfile && !isCorporateLocked
  const isFieldLocked = isReadOnly || isPrimaryLocked

  useEffect(() => {
    if (!isEditMode && !canCreateCustomer(session)) {
      navigate('/customers', { replace: true })
    }
  }, [isEditMode, navigate, session])

  useEffect(() => {
    if (!isEditMode || canManageProfile || canViewProfile) return
    navigate('/customers', { replace: true })
  }, [canManageProfile, canViewProfile, isEditMode, navigate])

  useEffect(() => {
    if (!isEditMode && form.type === 'corporate' && !canManageCorporate) {
      navigate('/customers', { replace: true })
    }
  }, [canManageCorporate, form.type, isEditMode, navigate])

  useEffect(() => {
    let mounted = true

    async function loadTiers() {
      try {
        const data = await fetchMembershipTiers()
        if (mounted) setTiers(Array.isArray(data) ? data : [])
      } catch (error) {
        if (mounted) showError(error.message)
      }
    }

    loadTiers()
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    if (!canAssignSale) return undefined

    let mounted = true

    async function loadAssignees() {
      try {
        const [sales, managers] = await Promise.all([
          fetchSalesAssignees(),
          fetchManagerAssignees(),
        ])
        if (!mounted) return
        setSaleOptions(sales)
        setManagerOptions(managers)
      } catch (error) {
        if (mounted) {
          setSaleOptions([])
          setManagerOptions([])
          showError(error.message || 'Không tải được danh sách nhân sự phụ trách.')
        }
      }
    }

    loadAssignees()
    return () => {
      mounted = false
    }
  }, [canAssignSale])

  useEffect(() => {
    if (!isEditMode) return undefined

    let mounted = true

    async function loadCustomer() {
      try {
        setIsLoading(true)
        const customer = await fetchCustomerById(customerId)
        if (!mounted) return
        applyCustomerToForm(customer)
      } catch (error) {
        if (mounted) showError(error.message)
      } finally {
        if (mounted) setIsLoading(false)
      }
    }

    loadCustomer()
    return () => {
      mounted = false
    }
  }, [customerId, isEditMode])

  useEffect(() => {
    if (!isEditMode || !customerId) return undefined

    let mounted = true

    async function loadOpenDebts() {
      try {
        setIsLoadingOpenDebts(true)
        const debts = await fetchCustomerOpenDebts(customerId)
        if (mounted) setOpenDebts(Array.isArray(debts) ? debts : [])
      } catch {
        if (mounted) setOpenDebts([])
      } finally {
        if (mounted) setIsLoadingOpenDebts(false)
      }
    }

    loadOpenDebts()
    return () => {
      mounted = false
    }
  }, [customerId, isEditMode, currentDebt])

  useEffect(() => {
    if (!isEditMode || !customerId) return undefined

    async function refreshCustomerDebt() {
      try {
        const customer = await fetchCustomerById(customerId)
        setCurrentDebt(Number(customer.currentDebt || 0))
      } catch {
        // ignore background refresh errors
      }
    }

    function onVisible() {
      if (document.visibilityState === 'visible') refreshCustomerDebt()
    }

    window.addEventListener('focus', refreshCustomerDebt)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('focus', refreshCustomerDebt)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [customerId, isEditMode])

  const formatMoney = (value) =>
    new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(Number(value || 0))

  function applyCustomerToForm(customer) {
    setForm({
      type: tabKeyFromCustomerType(customer.customerType),
      customerCode: customer.customerCode || '',
      name: customer.fullName || '',
      phone: customer.phone || '',
      email: customer.email || '',
      address: customer.address || '',
      taxCode: customer.taxCode || '',
      source: customer.source || '',
      assignedEmployeeId: customer.assignedEmployeeId || '',
      status: customer.status?.toLowerCase() === 'inactive' ? 'inactive' : 'active',
    })
    setCurrentDebt(Number(customer.currentDebt || 0))
    setTotalSpend(Number(customer.totalSpend || 0))
    setCurrentTierCode(tabKeyFromCustomerType(customer.customerType) === 'vip' ? '' : customer.tier?.tierCode || customer.tierCode || '')
    setCurrentTierDiscount(tabKeyFromCustomerType(customer.customerType) === 'vip' ? 0 : Number(customer.tier?.discountPercent ?? 0))
    setCurrentTierId(tabKeyFromCustomerType(customer.customerType) === 'vip' ? null : customer.tier?.tierId ?? customer.tierId ?? null)
    const loadedStatus = customer.status?.toLowerCase() === 'inactive' ? 'inactive' : 'active'
    setInitialStatus(loadedStatus)
  }

  const updateField = (field) => (event) => {
    const value = field === 'taxCode' ? normalizeTaxCodeInput(event.target.value) : event.target.value
    setForm((current) => ({ ...current, [field]: value }))
    setFieldErrors((current) => ({ ...current, [field]: undefined }))
  }

  const handlePhoneChange = (event) => {
    const value = normalizePhoneInput(event.target.value)
    setForm((current) => ({ ...current, phone: value }))
    setFieldErrors((current) => ({ ...current, phone: undefined }))
  }

  const handleNameChange = (event) => {
    const raw = event.target.value
    const value = isNameComposing ? raw : normalizeNameInput(raw)
    setForm((current) => ({ ...current, name: value }))
    setFieldErrors((current) => ({ ...current, name: undefined }))
  }

  const handleNameCompositionEnd = (event) => {
    setIsNameComposing(false)
    const value = normalizeNameInput(event.target.value)
    setForm((current) => ({ ...current, name: value }))
  }

  const buildPayload = () => ({
    fullName: form.name.trim(),
    customerType: customerTypeFromTab(form.type),
    phone: form.phone.trim() || null,
    email: form.email.trim() || null,
    address: form.address.trim(),
    taxCode: form.type === 'corporate' ? form.taxCode.trim() : null,
    source: form.source || null,
    assignedSaleId: form.assignedEmployeeId || null,
    tierId: null,
  })

  const handleTypeChange = (type) => {
    if (type === 'corporate' && (!CUSTOMER_CORPORATE_ENABLED || !canManageCorporate)) return
    setForm((current) => ({
      ...current,
      type,
    }))
  }

  const handleDelete = async () => {
    if (!customerId) return
    if (!(await confirmDialog({
      title: 'Ngừng hoạt động',
      message: 'Ngừng hoạt động khách hàng này? (xóa mềm — có thể khôi phục sau)',
      tone: 'danger',
    }))) return
    try {
      setIsDeleting(true)
      await deleteCustomer(customerId)
      showSuccess('Đã ngừng hoạt động khách hàng (xóa mềm).')
      navigate('/customers')
    } catch (error) {
      showError(error.message)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleSubmit = async () => {
    if (isSaving) return

    const validation = validateCustomerForm({
      name: form.name,
      phone: form.phone,
      email: form.email,
      address: form.address,
      customerType: customerTypeFromTab(form.type),
      taxCode: form.taxCode,
    })

    if (!validation.valid) {
      setFieldErrors(validation.errors)
      showError(validation.message)
      return
    }

    setFieldErrors({})

    try {
      setIsSaving(true)
      const payload = buildPayload()

      if (isEditMode) {
        await updateCustomer(customerId, {
          fullName: payload.fullName,
          customerType: payload.customerType,
          phone: payload.phone,
          email: payload.email,
          address: payload.address,
          taxCode: payload.taxCode,
          source: payload.source,
          assignedSaleId: payload.assignedSaleId,
          tierId: payload.tierId,
        })

        if (canManageProfile && form.status !== initialStatus) {
          await changeCustomerStatus(
            customerId,
            form.status === 'inactive' ? 'INACTIVE' : 'ACTIVE',
          )
        }

        showSuccess('Cập nhật khách hàng thành công.')
      } else {
        await createCustomer({
          fullName: payload.fullName,
          customerType: payload.customerType,
          phone: payload.phone,
          email: payload.email,
          address: payload.address,
          taxCode: payload.taxCode,
          source: payload.source,
          assignedSaleId: payload.assignedSaleId,
          tierId: payload.tierId,
        })
        showSuccess('Tạo khách hàng thành công.')
      }

      navigate('/customers')
    } catch (error) {
      const mapped = mapCustomerApiError(error.message)
      if (mapped.field) {
        setFieldErrors((current) => ({ ...current, [mapped.field]: mapped.message }))
      }
      showError(mapped.message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <PageShell className="[font-family:'Manrope',sans-serif]">
      <PageHeader
        title={isViewMode || isReadOnly ? 'Xem khách hàng' : isEditMode ? 'Chỉnh sửa khách hàng' : 'Thêm khách hàng'}
        titleInfo={
          isViewMode
            ? 'Xem đầy đủ thông tin khách hàng (chỉ đọc).'
            : isReadOnly
            ? isCorporateLocked
              ? 'Chỉ Quản lý, Kế toán hoặc Admin được chỉnh sửa khách doanh nghiệp. Bạn đang xem ở chế độ chỉ đọc.'
              : 'Xem thông tin liên hệ, hạng thành viên và lịch sử giao dịch'
            : isEditMode
              ? 'Có thể sửa mọi thông tin, riêng Họ tên/Tên công ty giữ nguyên.'
              : 'Cập nhật thông tin liên hệ, hạng thành viên và trạng thái tài khoản'
        }
        rightContent={
          isReadOnly || isCorporateProfile || isEditMode ? null : (
          <div className="flex w-full flex-col gap-2 sm:w-auto">
            <span className="text-xs font-medium text-[#717971]">Loại khách</span>
            <div className="inline-flex max-w-full flex-wrap gap-1 rounded-full bg-[#f6f4ec] p-1">
              <button
                type="button"
                className={`rounded-full px-4 py-1 text-xs font-semibold ${form.type === 'general' ? 'bg-[#4a6242] text-white' : 'text-[#414942]'}`}
                onClick={() => handleTypeChange('general')}
              >
                Phổ thông
              </button>
              <button
                type="button"
                className={`rounded-full px-4 py-1 text-xs font-semibold ${form.type === 'vip' ? 'bg-[#4a6242] text-white' : 'text-[#414942]'}`}
                onClick={() => handleTypeChange('vip')}
              >
                VIP
              </button>
              {CUSTOMER_CORPORATE_ENABLED && canManageCorporate ? (
                <button
                  type="button"
                  className={`rounded-full px-4 py-1 text-xs font-semibold ${form.type === 'corporate' ? 'bg-[#7e5700] text-white' : 'text-[#414942]'}`}
                  onClick={() => handleTypeChange('corporate')}
                >
                  Doanh nghiệp
                </button>
              ) : null}
            </div>
          </div>
          )
        }
      />

      {isLoading ? (
        <div className="rounded-[24px] border border-[#c1c9c0]/30 bg-white p-8 text-center text-[#717971] shadow-sm">
          Đang tải thông tin khách hàng...
        </div>
      ) : (
        <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
          <form className="space-y-4 rounded-[24px] border border-[#c1c9c0]/30 bg-white p-4 shadow-sm sm:p-6" onSubmit={(event) => event.preventDefault()}>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="space-y-2 md:col-span-2">
                <span className="text-xs font-semibold text-[#717971]">
                  {form.type === 'corporate' ? 'Tên công ty *' : 'Họ tên khách hàng *'}
                </span>
                <input
                  className={`w-full rounded-xl border-none bg-[#f0eee6] p-3 text-sm focus:ring-2 focus:ring-[#356647]/20 ${fieldErrors.name ? 'ring-2 ring-[#b42318]/40' : ''} ${isFieldLocked ? 'cursor-default opacity-90' : ''}`}
                  placeholder={form.type === 'corporate' ? 'Nhập tên công ty' : 'Nhập họ tên'}
                  type="text"
                  value={form.name}
                  onChange={handleNameChange}
                  onCompositionStart={() => setIsNameComposing(true)}
                  onCompositionEnd={handleNameCompositionEnd}
                  readOnly={isFieldLocked}
                  disabled={isFieldLocked}
                />
                {isPrimaryLocked ? (
                  <p className="text-[11px] text-[#717971]">Thông tin định danh — không chỉnh sửa sau khi tạo.</p>
                ) : null}
                <FieldError message={fieldErrors.name} />
              </label>

              <label className="space-y-2">
                <span className="text-xs font-semibold text-[#717971]">Số điện thoại *</span>
                <input
                  className={`w-full rounded-xl border-none bg-[#f0eee6] p-3 text-sm focus:ring-2 focus:ring-[#356647]/20 ${fieldErrors.phone ? 'ring-2 ring-[#b42318]/40' : ''} ${isReadOnly ? 'cursor-default opacity-90' : ''}`}
                  placeholder="0xxxxxxxxx hoặc 02xxxxxxxx"
                  type="tel"
                  inputMode="numeric"
                  maxLength={getPhoneMaxLength(form.phone)}
                  value={form.phone}
                  onChange={handlePhoneChange}
                  readOnly={isReadOnly}
                  disabled={isReadOnly}
                />
                <FieldError message={fieldErrors.phone} />
              </label>

              <label className="space-y-2">
                <span className="text-xs font-semibold text-[#717971]">Email</span>
                <input
                  className={`w-full rounded-xl border-none bg-[#f0eee6] p-3 text-sm focus:ring-2 focus:ring-[#356647]/20 ${fieldErrors.email ? 'ring-2 ring-[#b42318]/40' : ''} ${isReadOnly ? 'cursor-default opacity-90' : ''}`}
                  placeholder="email@example.com"
                  type="email"
                  value={form.email}
                  onChange={updateField('email')}
                  readOnly={isReadOnly}
                  disabled={isReadOnly}
                />
                <FieldError message={fieldErrors.email} />
              </label>

              <label className="space-y-2 md:col-span-2">
                <span className="text-xs font-semibold text-[#717971]">Địa chỉ giao hàng *</span>
                <input
                  className={`w-full rounded-xl border-none bg-[#f0eee6] p-3 text-sm focus:ring-2 focus:ring-[#356647]/20 ${fieldErrors.address ? 'ring-2 ring-[#b42318]/40' : ''} ${isReadOnly ? 'cursor-default opacity-90' : ''}`}
                  placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành"
                  type="text"
                  value={form.address}
                  onChange={updateField('address')}
                  readOnly={isReadOnly}
                  disabled={isReadOnly}
                />
                <FieldError message={fieldErrors.address} />
              </label>

              {form.type === 'corporate' ? (
                <label className="space-y-2 md:col-span-2">
                  <span className="text-xs font-semibold text-[#717971]">Mã số thuế *</span>
                  <input
                    className={`w-full rounded-xl border-none bg-[#f0eee6] p-3 text-sm focus:ring-2 focus:ring-[#356647]/20 ${fieldErrors.taxCode ? 'ring-2 ring-[#b42318]/40' : ''} ${isReadOnly ? 'cursor-default opacity-90' : ''}`}
                    placeholder="VD: 0312345678 hoặc 0312345678-001"
                    type="text"
                    value={form.taxCode}
                    onChange={updateField('taxCode')}
                    readOnly={isReadOnly}
                    disabled={isReadOnly}
                  />
                  <FieldError message={fieldErrors.taxCode} />
                </label>
              ) : null}

              <label className="space-y-2">
                <span className="text-xs font-semibold text-[#717971]">Nguồn khách hàng</span>
                <select
                  className={`w-full rounded-xl border-none bg-[#f0eee6] p-3 text-sm focus:ring-2 focus:ring-[#356647]/20 ${isReadOnly ? 'cursor-default opacity-90' : ''}`}
                  value={form.source}
                  onChange={updateField('source')}
                  disabled={isReadOnly}
                >
                  {CUSTOMER_SOURCE_OPTIONS.map((option) => (
                    <option key={option.value || 'empty'} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              {canAssignSale ? (
                <label className="space-y-2">
                  <span className="text-xs font-semibold text-[#717971]">
                    {isCorporateProfile ? 'Chi nhánh phụ trách' : 'Sale phụ trách'}
                  </span>
                  <select
                    className={`w-full rounded-xl border-none bg-[#f0eee6] p-3 text-sm focus:ring-2 focus:ring-[#356647]/20 ${isReadOnly ? 'cursor-default opacity-90' : ''}`}
                    value={form.assignedEmployeeId}
                    onChange={updateField('assignedEmployeeId')}
                    disabled={isReadOnly}
                  >
                    <option value="">— Chưa gán —</option>
                    {(isCorporateProfile ? managerOptions : saleOptions).map((assignee) => (
                      <option key={assignee.userId} value={assignee.userId}>
                        {assignee.fullName}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              {supportsMembershipTierForTab(form.type) ? (
                <div className="space-y-2 md:col-span-2">
                  <span className="text-xs font-semibold text-[#717971]">Hạng thành viên</span>
                  <div className="rounded-xl border border-[#c1c9c0]/40 bg-[#f0eee6] px-3 py-2.5">
                    <p className="text-sm font-semibold text-[#356647]">
                      {isEditMode
                        ? currentTierCode || DEFAULT_MEMBERSHIP_TIER
                        : tiers[0]?.tierCode || DEFAULT_MEMBERSHIP_TIER}
                      {!isEditMode ? (
                        <span className="ml-1 text-xs font-normal text-[#717971]">(mặc định khi tạo)</span>
                      ) : null}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-[#717971]">{TIER_READONLY_HINT}</p>
                  </div>
                </div>
              ) : form.type === 'vip' || form.type === 'corporate' ? (
                <div className="rounded-xl border border-[#7e5700]/20 bg-[#fff8e8] p-3 text-sm leading-relaxed text-[#744f00] md:col-span-2">
                  {formatNonMembershipTierNotice(tiers)}. Chiết khấu và quyền lợi áp dụng thủ công trên đơn (POS).
                </div>
              ) : null}

              {isEditMode ? (
                <label className="space-y-2">
                  <span className="text-xs font-semibold text-[#717971]">Trạng thái</span>
                  {isReadOnly ? (
                    <div className="rounded-xl border border-[#c1c9c0]/40 bg-[#f0eee6] px-3 py-2.5 text-sm text-[#1b1c17]">
                      {form.status === 'inactive' ? 'Ngừng hoạt động' : 'Đang hoạt động'}
                    </div>
                  ) : (
                    <select
                      className="w-full rounded-xl border-none bg-[#f0eee6] p-3 text-sm focus:ring-2 focus:ring-[#356647]/20"
                      value={form.status}
                      onChange={updateField('status')}
                    >
                      <option value="active">Đang hoạt động</option>
                      <option value="inactive">Ngừng hoạt động</option>
                    </select>
                  )}
                </label>
              ) : null}
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-[#c1c9c0]/40 pt-5 sm:flex-row sm:flex-wrap sm:justify-between">
              {isEditMode && canRemoveCustomer && !isReadOnly ? (
                <button
                  type="button"
                  className="w-full rounded-xl border border-[#b42318] px-5 py-2.5 text-sm font-semibold text-[#b42318] hover:bg-[#b42318]/5 disabled:opacity-60 sm:w-auto"
                  disabled={isDeleting || isSaving}
                  onClick={handleDelete}
                >
                  {isDeleting ? 'Đang xử lý...' : 'Ngừng hoạt động'}
                </button>
              ) : (
                <span />
              )}
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-end">
                <Link to="/customers" className="inline-flex w-full items-center justify-center rounded-xl border border-[#356647] px-5 py-2.5 text-sm font-semibold text-[#356647] hover:bg-[#356647]/5 sm:w-auto">
                  {isReadOnly ? 'Quay lại danh sách' : 'Hủy'}
                </Link>
                {isViewMode && canManageProfile && !isCorporateLocked ? (
                  <Link
                    to={`/customers/${customerId}/edit`}
                    className="inline-flex w-full items-center justify-center rounded-xl bg-[#4a6242] px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 sm:w-auto"
                  >
                    Chỉnh sửa thông tin phụ
                  </Link>
                ) : null}
                {!isReadOnly ? (
                  <button
                    type="button"
                    className="inline-flex w-full items-center justify-center rounded-xl bg-[#4a6242] px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60 sm:w-auto"
                    disabled={isSaving}
                    onClick={handleSubmit}
                  >
                    {isSaving ? 'Đang lưu...' : isEditMode ? 'Cập nhật' : 'Tạo khách hàng'}
                  </button>
                ) : null}
              </div>
            </div>
          </form>

          <aside className="space-y-4 rounded-[24px] border border-[#c1c9c0]/30 bg-white p-4 shadow-sm sm:p-6 xl:sticky xl:top-0 xl:max-h-[calc(100vh-8rem)] xl:overflow-y-auto xl:overscroll-contain">
            <h3 className="text-lg font-semibold text-[#356647]">Xem trước</h3>

            <div className="rounded-xl bg-[#f6f4ec] p-4">
              <p className="text-xs text-[#717971]">Tên</p>
              <p className="text-sm font-bold text-[#1b1c17]">{form.name || '—'}</p>
            </div>

            <div className="rounded-xl bg-[#f6f4ec] p-4">
              <p className="text-xs text-[#717971]">Mã khách hàng</p>
              <p className="text-sm font-bold text-[#356647]">
                {form.customerCode || (isEditMode ? '—' : 'Tự động (KH000001, …)')}
              </p>
            </div>

            {isEditMode ? (
              <>
                <div className="rounded-xl bg-[#fff8e8] p-4">
                  <p className="text-xs text-[#717971]">Công nợ hiện tại</p>
                  <p className="text-lg font-bold text-[#7e5700]">{formatDebtVnd(currentDebt)}</p>
                </div>
                <CustomerOpenDebtsPanel
                  openDebts={openDebts}
                  isLoading={isLoadingOpenDebts}
                  formatMoney={formatMoney}
                  compact
                  title="Hóa đơn chưa trả"
                  subtitle="Liên kết từ đơn bán ghi nợ"
                />
                {!isLoadingOpenDebts && Number(currentDebt) > 0 && openDebts.length === 0 ? (
                  <p className="rounded-xl border border-[#7e5700]/20 bg-[#fff8e8] px-3 py-2 text-xs text-[#7e5700]">
                    Có công nợ nhưng chưa có hóa đơn đơn hàng liên kết (có thể từ nhập thủ công hoặc đồng bộ chưa xong).
                  </p>
                ) : null}
                {supportsMembershipTierForTab(form.type) && tiers.length > 0 ? (
                  <div className="rounded-xl border border-[#356647]/15 bg-[#f8ffef] p-4">
                    <p className="mb-3 text-xs font-bold uppercase tracking-wider text-[#356647]">Hạng & chi tiêu tích lũy</p>
                    <MembershipTierProgress
                      totalSpend={totalSpend}
                      tierId={currentTierId}
                      tierCode={currentTierCode}
                      tierDiscountPercent={currentTierDiscount}
                      tiers={tiers}
                      showHint={false}
                    />
                  </div>
                ) : (
                  <div className="rounded-xl bg-[#f6f4ec] p-4">
                    <p className="text-xs text-[#717971]">Tổng chi tiêu tích lũy</p>
                    <p className="text-sm font-bold text-[#356647]">{formatVnd(totalSpend)}</p>
                  </div>
                )}
              </>
            ) : null}

            <div className="rounded-xl bg-[#f6f4ec] p-4">
              <p className="text-xs text-[#717971]">Loại</p>
              <p className="text-sm font-bold text-[#1b1c17]">{customerTypeLabel(form.type)}</p>
            </div>

            <div className="rounded-xl bg-[#f6f4ec] p-4">
              <p className="text-xs text-[#717971]">Liên hệ</p>
              <p className="text-sm font-bold text-[#1b1c17]">{form.phone || '—'}</p>
              <p className="text-xs text-[#414942]">{form.email || '—'}</p>
            </div>
          </aside>
        </section>
      )}

      {isEditMode && !isLoading ? (
        <>
          <section className="rounded-[24px] border border-[#c1c9c0]/30 bg-white p-4 shadow-sm sm:p-6">
            <div className="mb-4 flex flex-wrap gap-2">
              {[
                { key: 'overview', label: 'Tổng quan' },
                { key: 'orders', label: 'Lịch sử đơn' },
                { key: 'debts', label: 'Lịch sử công nợ' },
                ...(form.type === 'corporate' ? [{ key: 'contracts', label: 'Hợp đồng' }] : []),
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  className={`rounded-full px-4 py-1.5 text-xs font-semibold ${
                    profileTab === tab.key ? 'bg-[#4a6242] text-white' : 'bg-[#f6f4ec] text-[#414942]'
                  }`}
                  onClick={() => setProfileTab(tab.key)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {profileTab === 'overview' ? (
              <>
                <h3 className="mb-3 text-lg font-semibold text-[#356647]">Nhật ký hoạt động</h3>
                <div className="custom-scrollbar max-h-[min(50vh,420px)] overflow-y-auto overscroll-contain">
                  <CustomerActivityFeed
                    customerId={customerId}
                    emptyMessage="Chưa có hoạt động ghi nhận cho khách hàng này."
                  />
                </div>
              </>
            ) : null}

            {profileTab === 'orders' ? <CustomerOrderHistory customerId={customerId} /> : null}

            {profileTab === 'debts' ? (
              <CustomerDebtHistory customerId={customerId} />
            ) : null}

            {profileTab === 'contracts' && form.type === 'corporate' ? (
              <CustomerContractsPanel customerId={customerId} />
            ) : null}
          </section>
        </>
      ) : null}
    </PageShell>
  )
}

export default CustomerFormPage
