import { useEffect, useState } from 'react'
import { showError } from '../../../app/toast.js'
import { fetchPosCustomerContext } from '../services/posApi.js'
import { formatRoleLabel } from '../utils/posSeller.js'

const TABS = [
  { id: 'profile', label: 'Thông tin khách hàng' },
  { id: 'history', label: 'Lịch sử bán / trả hàng' },
  { id: 'debt', label: 'Dư nợ' },
  { id: 'invoice', label: 'Thông tin xuất hóa đơn' },
]

const CUSTOMER_TYPE_LABELS = {
  GENERAL: 'Khách phổ thông',
  RETAIL: 'Khách lẻ',
  VIP: 'Khách VIP',
  CORPORATE: 'Khách doanh nghiệp',
}

function formatMoney(value) {
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(Number(value || 0))
}

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('vi-VN')
}

function formatCashierDisplay(name, role) {
  const trimmedName = (name || '').trim()
  const roleLabel = (role || '')
    .split(',')
    .map((part) => formatRoleLabel(part.trim()))
    .filter(Boolean)
    .join(', ')
  if (!trimmedName) return '—'
  if (!roleLabel) return trimmedName
  return `${trimmedName} · ${roleLabel}`
}

function formatPaymentStatus(status) {
  const normalized = String(status || '').toLowerCase()
  if (normalized === 'paid') return 'Đã thanh toán'
  if (normalized === 'pending_payment') return 'Chờ thanh toán'
  if (normalized === 'unpaid') return 'Chưa thanh toán'
  return status || '—'
}

function TabButton({ tab, activeTab, onChange }) {
  const isActive = activeTab === tab.id
  return (
    <button
      type="button"
      onClick={() => onChange(tab.id)}
      className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
        isActive ? 'bg-[#356647] text-white' : 'bg-[#f6f4ec] text-[#414942] hover:bg-[#eae8e0]'
      }`}
    >
      {tab.label}
    </button>
  )
}

function CustomerDetailModal({ isOpen, customer, onClose }) {
  const [activeTab, setActiveTab] = useState('profile')
  const [context, setContext] = useState(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!isOpen || !customer?.customerId) {
      setContext(null)
      return undefined
    }

    let cancelled = false

    async function loadContext() {
      setIsLoading(true)
      try {
        const data = await fetchPosCustomerContext(customer.customerId)
        if (!cancelled) {
          setContext(data)
        }
      } catch (error) {
        if (!cancelled) {
          setContext(null)
          showError(error.message)
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    loadContext()
    return () => {
      cancelled = true
    }
  }, [isOpen, customer?.customerId])

  if (!isOpen || !customer) return null

  const customerTypeLabel =
    CUSTOMER_TYPE_LABELS[(context?.customerType || '').toUpperCase()] || context?.customerType || '—'

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="flex w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <header className="flex items-center justify-between border-b border-[#e5e7eb] bg-[#f6f4ec] px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-[#1b1c17]">Chi tiết khách hàng</h2>
            <p className="text-xs text-[#717971]">
              {customer.fullName} · {customer.customerCode}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-1 text-[#717971] hover:bg-[#eae8e0]">
            <span className="material-symbols-outlined">close</span>
          </button>
        </header>

        <div className="flex flex-wrap gap-2 border-b border-[#e5e7eb] p-4">
          {TABS.map((tab) => (
            <TabButton key={tab.id} tab={tab} activeTab={activeTab} onChange={setActiveTab} />
          ))}
        </div>

        <main className="max-h-[65vh] overflow-y-auto bg-[#fbf9f1] p-5">
          {isLoading ? (
            <p className="text-center text-sm text-[#717971]">Đang tải thông tin khách hàng...</p>
          ) : null}

          {!isLoading && activeTab === 'profile' ? (
            <section className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="rounded-xl bg-white p-4">
                <p className="text-xs text-[#717971]">Họ tên</p>
                <p className="mt-1 font-semibold text-[#1b1c17]">{context?.fullName || customer.fullName}</p>
              </div>
              <div className="rounded-xl bg-white p-4">
                <p className="text-xs text-[#717971]">Mã khách hàng</p>
                <p className="mt-1 font-semibold text-[#1b1c17]">{context?.customerCode || customer.customerCode}</p>
              </div>
              <div className="rounded-xl bg-white p-4">
                <p className="text-xs text-[#717971]">Số điện thoại</p>
                <p className="mt-1 font-semibold text-[#1b1c17]">{context?.phone || customer.phone || '—'}</p>
              </div>
              <div className="rounded-xl bg-white p-4">
                <p className="text-xs text-[#717971]">Email</p>
                <p className="mt-1 break-all font-semibold text-[#1b1c17]">{context?.email || '—'}</p>
              </div>
              <div className="rounded-xl bg-white p-4 md:col-span-2">
                <p className="text-xs text-[#717971]">Địa chỉ</p>
                <p className="mt-1 font-semibold text-[#1b1c17]">{context?.address || '—'}</p>
              </div>
              <div className="rounded-xl bg-white p-4">
                <p className="text-xs text-[#717971]">Nhóm khách</p>
                <p className="mt-1 font-semibold text-[#1b1c17]">{customerTypeLabel}</p>
              </div>
              {context?.tierCode ? (
                <div className="rounded-xl bg-white p-4 md:col-span-2">
                  <p className="text-xs text-[#717971]">Hạng thành viên</p>
                  <p className="mt-1 font-semibold text-[#1b1c17]">{context.tierCode}</p>
                </div>
              ) : null}
            </section>
          ) : null}

          {!isLoading && activeTab === 'history' ? (
            <section className="overflow-hidden rounded-xl border border-[#e5e7eb] bg-white">
              {(context?.recentOrders?.length ?? 0) === 0 ? (
                <p className="p-6 text-center text-sm text-[#717971]">Chưa có lịch sử đơn hàng.</p>
              ) : (
                <table className="w-full border-collapse text-left text-sm">
                  <thead className="bg-[#f6f4ec] text-xs uppercase text-[#717971]">
                    <tr>
                      <th className="px-4 py-3">Loại</th>
                      <th className="px-4 py-3">Mã đơn</th>
                      <th className="px-4 py-3">Người phụ trách</th>
                      <th className="px-4 py-3">Thanh toán</th>
                      <th className="px-4 py-3">Ngày</th>
                      <th className="px-4 py-3 text-right">Giá trị</th>
                    </tr>
                  </thead>
                  <tbody>
                    {context.recentOrders.map((row) => (
                      <tr key={`${row.orderCode}-${row.createdAt}`} className="border-t border-[#f0eee6]">
                        <td className="px-4 py-3">{row.entryType}</td>
                        <td className="px-4 py-3 font-semibold">{row.orderCode}</td>
                        <td className="px-4 py-3 text-[#414942]">
                          {formatCashierDisplay(row.cashierName, row.cashierRole)}
                        </td>
                        <td className="px-4 py-3">{formatPaymentStatus(row.paymentStatus)}</td>
                        <td className="px-4 py-3">{formatDate(row.createdAt)}</td>
                        <td className={`px-4 py-3 text-right font-semibold ${row.amount < 0 ? 'text-[#ba1a1a]' : 'text-[#356647]'}`}>
                          {row.amount < 0 ? '-' : ''}
                          {formatMoney(Math.abs(row.amount))} đ
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          ) : null}

          {!isLoading && activeTab === 'debt' ? (
            <section className="space-y-3">
              <div className="rounded-xl bg-white p-4">
                <p className="text-xs text-[#717971]">Dư nợ hiện tại</p>
                <p className="mt-1 text-2xl font-bold text-[#7e5700]">{formatMoney(context?.outstandingBalance ?? 0)} đ</p>
                <p className="mt-2 text-xs leading-relaxed text-[#717971]">
                  Tổng tiền khách còn phải trả từ các đơn chưa thanh toán đủ (ví dụ: chuyển khoản chờ xác nhận, bán ghi nợ).
                  Khách thanh toán đủ tại quầy thường có dư nợ bằng 0.
                </p>
              </div>

              {(context?.unpaidOrders?.length ?? 0) === 0 ? (
                <div className="rounded-xl bg-white p-4 text-sm text-[#717971]">Khách hàng không có đơn nợ.</div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-[#e5e7eb] bg-white">
                  <table className="w-full border-collapse text-left text-sm">
                    <thead className="bg-[#f6f4ec] text-xs uppercase text-[#717971]">
                      <tr>
                        <th className="px-4 py-3">Mã đơn</th>
                        <th className="px-4 py-3">Ngày</th>
                        <th className="px-4 py-3 text-right">Còn nợ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {context.unpaidOrders.map((row) => (
                        <tr key={row.orderCode} className="border-t border-[#f0eee6]">
                          <td className="px-4 py-3 font-semibold">{row.orderCode}</td>
                          <td className="px-4 py-3">{formatDate(row.createdAt)}</td>
                          <td className="px-4 py-3 text-right font-semibold text-[#7e5700]">
                            {formatMoney(row.remainingAmount)} đ
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          ) : null}

          {!isLoading && activeTab === 'invoice' ? (
            <section className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="rounded-xl bg-white p-4">
                <p className="text-xs text-[#717971]">Tên xuất hóa đơn</p>
                <p className="mt-1 font-semibold text-[#1b1c17]">{context?.fullName || customer.fullName}</p>
              </div>
              <div className="rounded-xl bg-white p-4">
                <p className="text-xs text-[#717971]">Email nhận hóa đơn</p>
                <p className="mt-1 font-semibold text-[#1b1c17]">{context?.email || '—'}</p>
              </div>
              <div className="rounded-xl bg-white p-4 md:col-span-2">
                <p className="text-xs text-[#717971]">Địa chỉ xuất hóa đơn</p>
                <p className="mt-1 font-semibold text-[#1b1c17]">{context?.address || '—'}</p>
              </div>
              <div className="rounded-xl bg-[#f6f4ec] p-4 text-xs text-[#717971] md:col-span-2">
                Mã số thuế / tên công ty sẽ bổ sung khi có trường hóa đơn VAT trên hồ sơ khách.
              </div>
            </section>
          ) : null}
        </main>
      </div>
    </div>
  )
}

export default CustomerDetailModal
