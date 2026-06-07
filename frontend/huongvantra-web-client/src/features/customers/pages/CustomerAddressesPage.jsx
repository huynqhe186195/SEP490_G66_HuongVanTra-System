import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import PageHeader from '../../../components/shared/PageHeader.jsx'
import PageShell from '../../../components/shared/PageShell.jsx'
import { showError } from '../../../app/toast.js'
import CustomerAddressesPanel from '../components/CustomerAddressesPanel.jsx'
import { fetchCustomerById, fetchCustomers } from '../services/customersApi.js'
import { customerTypeLabelFromType, formatVnd, getInitials } from '../utils/customerDisplay.js'

function CustomerAddressesPage() {
  const navigate = useNavigate()
  const { customerId: routeCustomerId } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const queryCustomerId = searchParams.get('customerId') || ''
  const selectedCustomerId = routeCustomerId || queryCustomerId || ''

  const [searchValue, setSearchValue] = useState('')
  const [customerOptions, setCustomerOptions] = useState([])
  const [isLoadingOptions, setIsLoadingOptions] = useState(true)
  const [customer, setCustomer] = useState(null)
  const [isLoadingCustomer, setIsLoadingCustomer] = useState(false)

  useEffect(() => {
    let mounted = true

    async function loadOptions() {
      try {
        setIsLoadingOptions(true)
        const items = await fetchCustomers()
        if (mounted) setCustomerOptions(Array.isArray(items) ? items : [])
      } catch (error) {
        if (mounted) showError(error.message)
      } finally {
        if (mounted) setIsLoadingOptions(false)
      }
    }

    loadOptions()
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    if (!selectedCustomerId) {
      setCustomer(null)
      return undefined
    }

    let mounted = true

    async function loadCustomer() {
      try {
        setIsLoadingCustomer(true)
        const detail = await fetchCustomerById(selectedCustomerId)
        if (mounted) setCustomer(detail)
      } catch (error) {
        if (mounted) {
          setCustomer(null)
          showError(error.message)
        }
      } finally {
        if (mounted) setIsLoadingCustomer(false)
      }
    }

    loadCustomer()
    return () => {
      mounted = false
    }
  }, [selectedCustomerId])

  const filteredOptions = useMemo(() => {
    const keyword = searchValue.trim().toLowerCase()
    if (!keyword) return customerOptions.slice(0, 30)
    return customerOptions
      .filter((item) => {
        const name = String(item.fullName || '').toLowerCase()
        const phone = String(item.phone || '').toLowerCase()
        const code = String(item.customerCode || '').toLowerCase()
        return name.includes(keyword) || phone.includes(keyword) || code.includes(keyword)
      })
      .slice(0, 30)
  }, [customerOptions, searchValue])

  function handleSelectCustomer(id) {
    if (routeCustomerId) {
      if (id !== routeCustomerId) navigate(`/customers/${id}/addresses`)
      return
    }
    setSearchParams(id ? { customerId: id } : {}, { replace: true })
  }

  const pageTitle = routeCustomerId && customer?.fullName
    ? `Địa chỉ — ${customer.fullName}`
    : 'Quản lý địa chỉ giao hàng'

  return (
    <PageShell>
      <PageHeader
        title={pageTitle}
        description="Thêm, sửa và đặt địa chỉ mặc định cho khách hàng"
        rightContent={
          <div className="flex flex-wrap gap-2">
            <Link
              to="/customers"
              className="inline-flex items-center gap-2 rounded-xl border border-[#c1c9c0] px-4 py-2.5 text-sm font-semibold text-[#414942] hover:bg-[#f6f4ec]"
            >
              <span className="material-symbols-outlined text-[18px]">groups</span>
              Danh sách khách
            </Link>
            {selectedCustomerId ? (
              <Link
                to={`/customers/${selectedCustomerId}/edit`}
                className="inline-flex items-center gap-2 rounded-xl border border-[#356647] px-4 py-2.5 text-sm font-semibold text-[#356647] hover:bg-[#356647]/5"
              >
                <span className="material-symbols-outlined text-[18px]">person</span>
                Chi tiết khách
              </Link>
            ) : null}
          </div>
        }
      />

      <div className="flex flex-col gap-4">
        {!routeCustomerId ? (
          <section className="rounded-[24px] border border-[#c1c9c0]/30 bg-white p-4 shadow-sm sm:p-6">
            <h2 className="text-base font-semibold text-[#1b1c17]">Chọn khách hàng</h2>
            <p className="mt-1 text-sm text-[#717971]">Tìm theo tên, mã KH hoặc số điện thoại.</p>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <input
                className="w-full rounded-xl bg-[#f0eee6] px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#356647]/30"
                placeholder="Tìm khách hàng..."
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
              />
              {selectedCustomerId ? (
                <button
                  type="button"
                  className="shrink-0 rounded-xl border border-[#c1c9c0] px-4 py-3 text-sm font-semibold text-[#717971] hover:bg-[#f6f4ec]"
                  onClick={() => handleSelectCustomer('')}
                >
                  Bỏ chọn
                </button>
              ) : null}
            </div>

            {isLoadingOptions ? (
              <p className="mt-4 text-sm text-[#717971]">Đang tải danh sách khách...</p>
            ) : (
              <ul className="custom-scrollbar mt-4 max-h-[280px] space-y-2 overflow-y-auto">
                {filteredOptions.length === 0 ? (
                  <li className="rounded-xl bg-[#f6f4ec] p-4 text-sm text-[#717971]">Không tìm thấy khách phù hợp.</li>
                ) : (
                  filteredOptions.map((item) => {
                    const isActive = item.customerId === selectedCustomerId
                    return (
                      <li key={item.customerId}>
                        <button
                          type="button"
                          className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
                            isActive
                              ? 'border-[#356647] bg-[#356647]/5'
                              : 'border-[#eae8e0] bg-white hover:border-[#356647]/40 hover:bg-[#f6f4ec]/50'
                          }`}
                          onClick={() => handleSelectCustomer(item.customerId)}
                        >
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#ceebc1] text-sm font-bold text-[#354d2e]">
                            {getInitials(item.fullName)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-semibold text-[#1b1c17]">{item.fullName}</p>
                            <p className="text-xs text-[#717971]">
                              {item.customerCode || '—'} · {item.phone || '—'}
                            </p>
                          </div>
                          {isActive ? (
                            <span className="material-symbols-outlined text-[#356647]">check_circle</span>
                          ) : null}
                        </button>
                      </li>
                    )
                  })
                )}
              </ul>
            )}
          </section>
        ) : null}

        {selectedCustomerId ? (
          <>
            {isLoadingCustomer ? (
              <p className="text-sm text-[#717971]">Đang tải thông tin khách...</p>
            ) : customer ? (
              <section className="grid grid-cols-1 gap-3 rounded-[24px] border border-[#c1c9c0]/30 bg-[#f6f4ec]/40 p-4 sm:grid-cols-3 sm:p-5">
                <div>
                  <p className="text-xs uppercase tracking-wide text-[#717971]">Khách hàng</p>
                  <p className="font-bold text-[#1b1c17]">{customer.fullName}</p>
                  <p className="text-xs text-[#414942]">{customerTypeLabelFromType(customer.customerType)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-[#717971]">Liên hệ</p>
                  <p className="font-semibold text-[#1b1c17]">{customer.phone || '—'}</p>
                  <p className="text-xs text-[#414942]">{customer.customerCode || '—'}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-[#717971]">Chi tiêu</p>
                  <p className="font-bold text-[#356647]">{formatVnd(customer.totalSpend)}</p>
                </div>
              </section>
            ) : null}

            <CustomerAddressesPanel customerId={selectedCustomerId} standalone />
          </>
        ) : (
          <section className="rounded-[24px] border border-dashed border-[#c1c9c0] bg-white p-8 text-center shadow-sm">
            <span className="material-symbols-outlined text-[48px] text-[#356647]/40">location_on</span>
            <p className="mt-3 text-base font-semibold text-[#1b1c17]">Chưa chọn khách hàng</p>
            <p className="mt-1 text-sm text-[#717971]">Chọn một khách ở trên để quản lý địa chỉ giao hàng.</p>
          </section>
        )}
      </div>
    </PageShell>
  )
}

export default CustomerAddressesPage
