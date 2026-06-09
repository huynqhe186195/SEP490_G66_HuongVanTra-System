import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import PageHeader from '../../../components/shared/PageHeader.jsx'
import PageShell from '../../../components/shared/PageShell.jsx'
import { showError, showSuccess } from '../../../app/toast.js'
import { loadAuthSession } from '../../auth/services/authSession.js'
import MembershipTierProgress from '../components/MembershipTierProgress.jsx'
import CustomerDebtHistory from '../components/CustomerDebtHistory.jsx'
import CustomerActivityFeed from '../components/CustomerActivityFeed.jsx'
import {
  changeCustomerStatus,
  createCustomer,
  deleteCustomer,
  fetchCustomerById,
  fetchMembershipTiers,
  updateCustomer,
} from '../services/customersApi.js'
import { TIER_READONLY_HINT } from '../utils/membershipTierUtils.js'
import { DEFAULT_MEMBERSHIP_TIER } from '../utils/customerDisplay.js'
import {
  customerTypeFromTab,
  customerTypeLabel,
  formatDebtVnd,
  formatVnd,
  isAdminSession,
  supportsMembershipTierForTab,
  tabKeyFromCustomerType,
} from '../utils/customerDisplay.js'
import { mapCustomerApiError, normalizeNameInput, normalizePhoneInput, validateCustomerForm } from '../utils/customerValidation.js'

function FieldError({ message }) {
  if (!message) return null
  return <p className="text-xs text-[#b42318]">{message}</p>
}

function CustomerFormPage() {
  const navigate = useNavigate()
  const { customerId } = useParams()
  const [searchParams] = useSearchParams()
  const isEditMode = Boolean(customerId)

  const [tiers, setTiers] = useState([])
  const [isLoading, setIsLoading] = useState(isEditMode)
  const [isSaving, setIsSaving] = useState(false)
  const [currentDebt, setCurrentDebt] = useState(0)
  const [totalSpend, setTotalSpend] = useState(0)
  const [currentTierCode, setCurrentTierCode] = useState('')
  const [currentTierDiscount, setCurrentTierDiscount] = useState(0)
  const [currentTierId, setCurrentTierId] = useState(null)
  const [initialStatus, setInitialStatus] = useState('active')
  const [debtRefreshKey, setDebtRefreshKey] = useState(0)
  const [activityRefreshKey, setActivityRefreshKey] = useState(0)
  const [isDeleting, setIsDeleting] = useState(false)
  const [fieldErrors, setFieldErrors] = useState({})
  const [isNameComposing, setIsNameComposing] = useState(false)
  const isAdmin = isAdminSession(loadAuthSession())
  const [form, setForm] = useState({
    type: ['general', 'vip', 'corporate'].includes(searchParams.get('type'))
      ? searchParams.get('type')
      : 'general',
    customerCode: '',
    name: '',
    phone: '',
    email: '',
    address: '',
    taxCode: '',
    status: 'active',
  })

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

  function applyCustomerToForm(customer) {
    setForm({
      type: tabKeyFromCustomerType(customer.customerType),
      customerCode: customer.customerCode || '',
      name: customer.fullName || '',
      phone: customer.phone || '',
      email: customer.email || '',
      address: customer.address || '',
      taxCode: customer.taxCode || '',
      status: customer.status?.toLowerCase() === 'inactive' ? 'inactive' : 'active',
    })
    setCurrentDebt(Number(customer.currentDebt || 0))
    setTotalSpend(Number(customer.totalSpend || 0))
    setCurrentTierCode(customer.tier?.tierCode || customer.tierCode || '')
    setCurrentTierDiscount(Number(customer.tier?.discountPercent ?? 0))
    setCurrentTierId(customer.tier?.tierId ?? customer.tierId ?? null)
    const loadedStatus = customer.status?.toLowerCase() === 'inactive' ? 'inactive' : 'active'
    setInitialStatus(loadedStatus)
  }

  const updateField = (field) => (event) => {
    const value = event.target.value
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
  })

  const handleTypeChange = (type) => {
    setForm((current) => ({
      ...current,
      type,
    }))
  }

  const handleDelete = async () => {
    if (!customerId || !window.confirm('Ngừng hoạt động khách hàng này? (xóa mềm — có thể khôi phục sau)')) return
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
        })

        if (form.status !== initialStatus) {
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
        title={isEditMode ? 'Chỉnh sửa khách hàng' : 'Thêm khách hàng'}
        description="Cập nhật thông tin liên hệ, hạng thành viên và trạng thái tài khoản"
        rightContent={
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
              <button
                type="button"
                className={`rounded-full px-4 py-1 text-xs font-semibold ${form.type === 'corporate' ? 'bg-[#7e5700] text-white' : 'text-[#414942]'}`}
                onClick={() => handleTypeChange('corporate')}
              >
                Doanh nghiệp
              </button>
            </div>
          </div>
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
                  className={`w-full rounded-xl border-none bg-[#f0eee6] p-3 text-sm focus:ring-2 focus:ring-[#356647]/20 ${fieldErrors.name ? 'ring-2 ring-[#b42318]/40' : ''}`}
                  placeholder={form.type === 'corporate' ? 'Nhập tên công ty' : 'Nhập họ tên'}
                  type="text"
                  value={form.name}
                  onChange={handleNameChange}
                  onCompositionStart={() => setIsNameComposing(true)}
                  onCompositionEnd={handleNameCompositionEnd}
                />
                <FieldError message={fieldErrors.name} />
              </label>

              <label className="space-y-2">
                <span className="text-xs font-semibold text-[#717971]">Số điện thoại *</span>
                <input
                  className={`w-full rounded-xl border-none bg-[#f0eee6] p-3 text-sm focus:ring-2 focus:ring-[#356647]/20 ${fieldErrors.phone ? 'ring-2 ring-[#b42318]/40' : ''}`}
                  placeholder="0xxxxxxxxx"
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  value={form.phone}
                  onChange={handlePhoneChange}
                />
                <FieldError message={fieldErrors.phone} />
              </label>

              <label className="space-y-2">
                <span className="text-xs font-semibold text-[#717971]">Email</span>
                <input
                  className={`w-full rounded-xl border-none bg-[#f0eee6] p-3 text-sm focus:ring-2 focus:ring-[#356647]/20 ${fieldErrors.email ? 'ring-2 ring-[#b42318]/40' : ''}`}
                  placeholder="email@example.com"
                  type="email"
                  value={form.email}
                  onChange={updateField('email')}
                />
                <FieldError message={fieldErrors.email} />
              </label>

              <label className="space-y-2 md:col-span-2">
                <span className="text-xs font-semibold text-[#717971]">Địa chỉ giao hàng *</span>
                <input
                  className={`w-full rounded-xl border-none bg-[#f0eee6] p-3 text-sm focus:ring-2 focus:ring-[#356647]/20 ${fieldErrors.address ? 'ring-2 ring-[#b42318]/40' : ''}`}
                  placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành"
                  type="text"
                  value={form.address}
                  onChange={updateField('address')}
                />
                <FieldError message={fieldErrors.address} />
              </label>

              {form.type === 'corporate' ? (
                <label className="space-y-2 md:col-span-2">
                  <span className="text-xs font-semibold text-[#717971]">Mã số thuế *</span>
                  <input
                    className={`w-full rounded-xl border-none bg-[#f0eee6] p-3 text-sm focus:ring-2 focus:ring-[#356647]/20 ${fieldErrors.taxCode ? 'ring-2 ring-[#b42318]/40' : ''}`}
                    placeholder="Mã số thuế doanh nghiệp"
                    type="text"
                    value={form.taxCode}
                    onChange={updateField('taxCode')}
                  />
                  <FieldError message={fieldErrors.taxCode} />
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
              ) : (
                <div className="rounded-xl bg-[#fff8e8] p-3 text-sm leading-relaxed text-[#744f00] md:col-span-2">
                  Khách VIP không dùng hạng B/S/G và không gán chiết khấu hạng. Ưu đãi (nếu có) qua mã giảm giá, quà tặng hoặc chính sách riêng tại quầy.
                </div>
              )}

              <label className="space-y-2">
                <span className="text-xs font-semibold text-[#717971]">Trạng thái</span>
                <select
                  className="w-full rounded-xl border-none bg-[#f0eee6] p-3 text-sm focus:ring-2 focus:ring-[#356647]/20"
                  value={form.status}
                  onChange={updateField('status')}
                  disabled={!isEditMode}
                >
                  <option value="active">Đang hoạt động</option>
                  <option value="inactive">Ngừng hoạt động</option>
                </select>
              </label>
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-[#c1c9c0]/40 pt-5 sm:flex-row sm:flex-wrap sm:justify-between">
              {isEditMode ? (
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
                  Hủy
                </Link>
                <button
                  type="button"
                  className="inline-flex w-full items-center justify-center rounded-xl bg-[#4a6242] px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60 sm:w-auto"
                  disabled={isSaving}
                  onClick={handleSubmit}
                >
                  {isSaving ? 'Đang lưu...' : isEditMode ? 'Cập nhật' : 'Tạo khách hàng'}
                </button>
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
          <CustomerDebtHistory
            customerId={customerId}
            refreshKey={debtRefreshKey}
            allowManualEntry={isAdmin}
            onDebtChanged={() => {
              setDebtRefreshKey((key) => key + 1)
              setActivityRefreshKey((key) => key + 1)
              fetchCustomerById(customerId).then((customer) => {
                setCurrentDebt(Number(customer.currentDebt || 0))
              }).catch(() => {})
            }}
          />
          <section className="rounded-[24px] border border-[#c1c9c0]/30 bg-white p-4 shadow-sm sm:p-6">
            <h3 className="mb-3 text-lg font-semibold text-[#356647]">Nhật ký hoạt động</h3>
            <div className="custom-scrollbar max-h-[min(50vh,420px)] overflow-y-auto overscroll-contain">
              <CustomerActivityFeed
                customerId={customerId}
                refreshKey={activityRefreshKey}
                emptyMessage="Chưa có hoạt động ghi nhận cho khách hàng này."
              />
            </div>
          </section>
        </>
      ) : null}
    </PageShell>
  )
}

export default CustomerFormPage
