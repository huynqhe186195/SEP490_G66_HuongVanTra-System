import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import PageHeader from '../../../components/shared/PageHeader.jsx'
import { showError, showSuccess } from '../../../app/toast.js'
import {
  createCustomer,
  fetchCustomerById,
  fetchMembershipTiers,
  updateCustomer,
} from '../services/customersApi.js'
import { generateCustomerCode, tabKeyFromCustomerType } from '../utils/customerDisplay.js'

function CustomerFormPage() {
  const navigate = useNavigate()
  const { customerId } = useParams()
  const [searchParams] = useSearchParams()
  const isEditMode = Boolean(customerId)

  const [tiers, setTiers] = useState([])
  const [isLoading, setIsLoading] = useState(isEditMode)
  const [isSaving, setIsSaving] = useState(false)
  const [form, setForm] = useState({
    type: searchParams.get('type') === 'vip' ? 'vip' : 'corporate',
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
    customerType: form.type === 'corporate' ? 'CORPORATE' : 'VIP',
    phone: form.phone.trim() || null,
    email: form.email.trim() || null,
    address: form.address.trim() || null,
    tierId: form.tierId ? Number(form.tierId) : null,
  })

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
    <div className="flex min-h-0 flex-1 flex-col gap-6 [font-family:'Manrope',sans-serif]">
      <PageHeader
        title={isEditMode ? 'Chỉnh sửa khách hàng' : 'Thêm khách hàng'}
        description="Cập nhật thông tin liên hệ, hạng thành viên và trạng thái tài khoản"
        searchPlaceholder={formTitle}
        rightContent={
          <div className="flex items-center gap-2 rounded-full bg-[#f6f4ec] px-3 py-1.5">
            <span className="text-xs text-[#717971]">Loại khách</span>
            <div className="inline-flex gap-1 rounded-full bg-white p-1">
              <button
                type="button"
                className={`rounded-full px-4 py-1 text-xs font-semibold ${form.type === 'vip' ? 'bg-[#4a6242] text-white' : 'text-[#414942]'}`}
                onClick={() => setForm((current) => ({ ...current, type: 'vip' }))}
              >
                VIP
              </button>
              <button
                type="button"
                className={`rounded-full px-4 py-1 text-xs font-semibold ${form.type === 'corporate' ? 'bg-[#7e5700] text-white' : 'text-[#414942]'}`}
                onClick={() => setForm((current) => ({ ...current, type: 'corporate' }))}
              >
                Corporate
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

              <label className="space-y-2">
                <span className="text-xs font-semibold text-[#717971]">Hạng thành viên</span>
                <select
                  className="w-full rounded-xl border-none bg-[#f0eee6] p-3 text-sm focus:ring-2 focus:ring-[#356647]/20"
                  value={form.tierId}
                  onChange={updateField('tierId')}
                >
                  <option value="">Chưa gán hạng</option>
                  {tiers.map((tier) => (
                    <option key={tier.id} value={tier.id}>
                      {tier.tierCode}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-xs font-semibold text-[#717971]">Trạng thái</span>
                <select
                  className="w-full rounded-xl border-none bg-[#f0eee6] p-3 text-sm focus:ring-2 focus:ring-[#356647]/20"
                  value={form.status}
                  onChange={updateField('status')}
                  disabled={!isEditMode}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
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

            <div className="rounded-xl bg-[#f6f4ec] p-4">
              <p className="text-xs text-[#717971]">Loại</p>
              <p className="text-sm font-bold text-[#1b1c17]">{form.type === 'corporate' ? 'Khách doanh nghiệp' : 'Khách VIP'}</p>
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
