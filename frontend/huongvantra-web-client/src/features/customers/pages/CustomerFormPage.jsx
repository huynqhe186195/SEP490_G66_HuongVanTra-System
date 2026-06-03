import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import PageHeader from '../../../components/shared/PageHeader.jsx'
import { showError, showSuccess } from '../../../app/toast.js'
import { loadAuthSession } from '../../auth/services/authSession.js'
import MembershipTierProgress from '../components/MembershipTierProgress.jsx'
import {
  createCustomer,
  fetchCustomerById,
  fetchMembershipTiers,
  reconcileCustomerDebt,
  updateCustomer,
  upgradeCustomerTierManual,
} from '../services/customersApi.js'
import { fetchMyProfile } from '../../profile/services/profileApi.js'
import { TIER_AUTO_UPGRADE_HINT } from '../utils/membershipTierUtils.js'
import {
  customerTypeFromTab,
  customerTypeLabel,
  formatDebtVnd,
  formatVnd,
  generateCustomerCode,
  isAdminSession,
  supportsMembershipTierForTab,
  tabKeyFromCustomerType,
} from '../utils/customerDisplay.js'

function CustomerFormPage() {
  const navigate = useNavigate()
  const { customerId } = useParams()
  const [searchParams] = useSearchParams()
  const isEditMode = Boolean(customerId)

  const [tiers, setTiers] = useState([])
  const [isLoading, setIsLoading] = useState(isEditMode)
  const [isSaving, setIsSaving] = useState(false)
  const [isReconcilingDebt, setIsReconcilingDebt] = useState(false)
  const [currentDebt, setCurrentDebt] = useState(0)
  const [totalSpend, setTotalSpend] = useState(0)
  const [currentTierCode, setCurrentTierCode] = useState('')
  const [currentTierDiscount, setCurrentTierDiscount] = useState(0)
  const [isUpgradingTier, setIsUpgradingTier] = useState(false)
  const [vipManualTierId, setVipManualTierId] = useState('')
  const isAdmin = isAdminSession(loadAuthSession())
  const [form, setForm] = useState({
    type: ['general', 'vip', 'corporate'].includes(searchParams.get('type'))
      ? searchParams.get('type')
      : 'general',
    name: '',
    phone: '',
    email: '',
    address: '',
    tierId: '',
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

        setForm({
          type: tabKeyFromCustomerType(customer.customerType),
          name: customer.fullName || '',
          phone: customer.phone || '',
          email: customer.email || '',
          address: customer.address || '',
          tierId: customer.tier?.tierId ? String(customer.tier.tierId) : '',
          status: customer.status?.toLowerCase() === 'inactive' ? 'inactive' : 'active',
        })
        setCurrentDebt(Number(customer.currentDebt || 0))
        setTotalSpend(Number(customer.totalSpend || 0))
        setCurrentTierCode(customer.tier?.tierCode || customer.tierCode || '')
        setCurrentTierDiscount(Number(customer.tier?.discountPercent ?? 0))
        setVipManualTierId(customer.tier?.tierId ? String(customer.tier.tierId) : '')
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

  const formTitle = useMemo(
    () => (isEditMode ? `Chỉnh sửa khách hàng #${customerId}` : 'Thêm khách hàng mới'),
    [isEditMode, customerId],
  )

  const updateField = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }))
  }

  const buildPayload = () => ({
    customerCode: isEditMode ? undefined : generateCustomerCode(form.type),
    fullName: form.name.trim(),
    customerType: customerTypeFromTab(form.type),
    phone: form.phone.trim() || null,
    email: form.email.trim() || null,
    address: form.address.trim() || null,
    tierId: supportsMembershipTierForTab(form.type) && form.tierId ? Number(form.tierId) : null,
  })

  const handleTypeChange = (type) => {
    setForm((current) => ({
      ...current,
      type,
      tierId: supportsMembershipTierForTab(type) ? current.tierId : '',
    }))
  }

  const handleManualVipTierUpgrade = async () => {
    if (!customerId || !isAdmin || !vipManualTierId) {
      showError('Chọn hạng cần gán cho khách VIP.')
      return
    }
    setIsUpgradingTier(true)
    try {
      const profile = await fetchMyProfile()
      const empId = profile?.employeeId ?? profile?.EmployeeId
      if (!empId) {
        showError('Không xác định được mã nhân viên. Vui lòng đăng nhập lại.')
        return
      }
      await upgradeCustomerTierManual({
        customerId: Number(customerId),
        newTierId: Number(vipManualTierId),
        updatedByEmpId: Number(empId),
      })
      const customer = await fetchCustomerById(customerId)
      setForm((prev) => ({ ...prev, type: 'vip' }))
      setCurrentTierCode(customer.tier?.tierCode || '')
      setCurrentTierDiscount(Number(customer.tier?.discountPercent ?? 0))
      showSuccess('Đã nâng hạng thủ công và chuyển khách sang VIP.')
    } catch (error) {
      showError(error.message)
    } finally {
      setIsUpgradingTier(false)
    }
  }

  const handleReconcileDebt = async () => {
    if (!customerId || !isAdmin) return
    setIsReconcilingDebt(true)
    try {
      await reconcileCustomerDebt(customerId)
      const customer = await fetchCustomerById(customerId)
      setCurrentDebt(Number(customer.currentDebt || 0))
      showSuccess('Đã đối soát công nợ từ các đơn chưa thanh toán.')
    } catch (error) {
      showError(error.message)
    } finally {
      setIsReconcilingDebt(false)
    }
  }

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      showError('Vui lòng nhập tên khách hàng.')
      return
    }

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
          tierId: payload.tierId,
        })
        showSuccess('Cập nhật khách hàng thành công.')
      } else {
        await createCustomer({
          customerCode: payload.customerCode,
          fullName: payload.fullName,
          customerType: payload.customerType,
          phone: payload.phone,
          email: payload.email,
          address: payload.address,
          tierId: payload.tierId,
        })
        showSuccess('Tạo khách hàng thành công.')
      }

      navigate('/customers')
    } catch (error) {
      showError(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 sm:gap-6 [font-family:'Manrope',sans-serif]">
      <PageHeader
        title={isEditMode ? 'Chỉnh sửa khách hàng' : 'Thêm khách hàng'}
        description="Cập nhật thông tin liên hệ, hạng thành viên và trạng thái tài khoản"
        searchPlaceholder={formTitle}
        rightContent={
          <div className="flex items-center gap-2 rounded-full bg-[#f6f4ec] px-3 py-1.5">
            <span className="text-xs text-[#717971]">Loại khách</span>
            <div className="inline-flex flex-wrap gap-1 rounded-full bg-white p-1">
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
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
          <form className="space-y-4 rounded-[24px] border border-[#c1c9c0]/30 bg-white p-6 shadow-sm" onSubmit={(event) => event.preventDefault()}>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="space-y-2 md:col-span-2">
                <span className="text-xs font-semibold text-[#717971]">{form.type === 'corporate' ? 'Tên công ty' : 'Họ tên khách hàng'}</span>
                <input
                  className="w-full rounded-xl border-none bg-[#f0eee6] p-3 text-sm focus:ring-2 focus:ring-[#356647]/20"
                  placeholder={form.type === 'corporate' ? 'Nhập tên công ty' : 'Nhập họ tên'}
                  type="text"
                  value={form.name}
                  onChange={updateField('name')}
                />
              </label>

              <label className="space-y-2">
                <span className="text-xs font-semibold text-[#717971]">Số điện thoại</span>
                <input
                  className="w-full rounded-xl border-none bg-[#f0eee6] p-3 text-sm focus:ring-2 focus:ring-[#356647]/20"
                  placeholder="Số điện thoại"
                  type="text"
                  value={form.phone}
                  onChange={updateField('phone')}
                />
              </label>

              <label className="space-y-2">
                <span className="text-xs font-semibold text-[#717971]">Email</span>
                <input
                  className="w-full rounded-xl border-none bg-[#f0eee6] p-3 text-sm focus:ring-2 focus:ring-[#356647]/20"
                  placeholder="Email"
                  type="email"
                  value={form.email}
                  onChange={updateField('email')}
                />
              </label>

              <label className="space-y-2 md:col-span-2">
                <span className="text-xs font-semibold text-[#717971]">Địa chỉ</span>
                <input
                  className="w-full rounded-xl border-none bg-[#f0eee6] p-3 text-sm focus:ring-2 focus:ring-[#356647]/20"
                  placeholder="Địa chỉ"
                  type="text"
                  value={form.address}
                  onChange={updateField('address')}
                />
              </label>

              {supportsMembershipTierForTab(form.type) ? (
                <div className="space-y-2 md:col-span-2">
                  <span className="text-xs font-semibold text-[#717971]">Hạng thành viên (Bronze / Silver / Gold)</span>
                  <select
                    className="w-full rounded-xl border-none bg-[#f0eee6] p-3 text-sm focus:ring-2 focus:ring-[#356647]/20"
                    value={form.tierId}
                    onChange={updateField('tierId')}
                  >
                    <option value="">Tự gán Bronze (mặc định)</option>
                    {tiers.map((tier) => (
                      <option key={tier.id} value={tier.id}>
                        {tier.tierCode} — ngưỡng {tier.minTotalSpend.toLocaleString('vi-VN')} đ
                        {tier.discountPercent > 0 ? ` · CK ${tier.discountPercent}%` : ''}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs leading-relaxed text-[#717971]">{TIER_AUTO_UPGRADE_HINT}</p>
                </div>
              ) : form.type === 'vip' && isEditMode && isAdmin ? (
                <div className="space-y-2 md:col-span-2">
                  <span className="text-xs font-semibold text-[#717971]">Nâng hạng VIP thủ công (Admin)</span>
                  <select
                    className="w-full rounded-xl border-none bg-[#f0eee6] p-3 text-sm focus:ring-2 focus:ring-[#356647]/20"
                    value={vipManualTierId}
                    onChange={(event) => setVipManualTierId(event.target.value)}
                  >
                    <option value="">Chọn hạng</option>
                    {tiers.map((tier) => (
                      <option key={tier.id} value={tier.id}>
                        {tier.tierCode}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="rounded-xl border border-[#356647] px-4 py-2 text-sm font-semibold text-[#356647] hover:bg-[#356647]/5 disabled:opacity-50"
                    disabled={isUpgradingTier || !vipManualTierId}
                    onClick={handleManualVipTierUpgrade}
                  >
                    {isUpgradingTier ? 'Đang nâng hạng...' : 'Áp dụng nâng hạng VIP'}
                  </button>
                </div>
              ) : (
                <div className="rounded-xl bg-[#f6f4ec] p-3 text-sm text-[#717971] md:col-span-2">
                  Khách VIP / doanh nghiệp không dùng hạng B/S/G tự động. Admin có thể nâng hạng VIP khi sửa khách VIP.
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

            <div className="flex flex-wrap justify-end gap-3 border-t border-[#c1c9c0]/40 pt-5">
              <Link to="/customers" className="rounded-xl border border-[#356647] px-5 py-2 text-sm font-semibold text-[#356647] hover:bg-[#356647]/5">
                Hủy
              </Link>
              <button
                type="button"
                className="rounded-xl bg-[#4a6242] px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
                disabled={isSaving}
                onClick={handleSubmit}
              >
                {isSaving ? 'Đang lưu...' : isEditMode ? 'Cập nhật' : 'Tạo khách hàng'}
              </button>
            </div>
          </form>

          <aside className="space-y-4 rounded-[24px] border border-[#c1c9c0]/30 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-[#356647]">Xem trước</h3>

            <div className="rounded-xl bg-[#f6f4ec] p-4">
              <p className="text-xs text-[#717971]">Tên</p>
              <p className="text-sm font-bold text-[#1b1c17]">{form.name || '—'}</p>
            </div>

            {isEditMode ? (
              <>
                <div className="rounded-xl bg-[#fff8e8] p-4">
                  <p className="text-xs text-[#717971]">Công nợ hiện tại</p>
                  <p className="text-lg font-bold text-[#7e5700]">{formatDebtVnd(currentDebt)}</p>
                </div>
                {supportsMembershipTierForTab(form.type) && tiers.length > 0 ? (
                  <div className="rounded-xl border border-[#356647]/15 bg-[#f8ffef] p-4">
                    <p className="mb-3 text-xs font-bold uppercase tracking-wider text-[#356647]">Hạng & tiến độ tự động</p>
                    <MembershipTierProgress
                      totalSpend={totalSpend}
                      tierId={form.tierId ? Number(form.tierId) : null}
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
                {isAdmin ? (
                  <button
                    type="button"
                    className="w-full rounded-xl border border-[#7e5700] px-4 py-2 text-sm font-semibold text-[#7e5700] hover:bg-[#fec25b]/20 disabled:opacity-50"
                    disabled={isReconcilingDebt}
                    onClick={handleReconcileDebt}
                  >
                    {isReconcilingDebt ? 'Đang đối soát...' : 'Đối soát công nợ (Admin)'}
                  </button>
                ) : null}
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
    </div>
  )
}

export default CustomerFormPage
