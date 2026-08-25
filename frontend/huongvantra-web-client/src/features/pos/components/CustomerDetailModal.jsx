import { useEffect, useMemo, useRef, useState } from 'react'
import { showError, showSuccess } from '../../../app/toast.js'
import MembershipTierProgress from '../../customers/components/MembershipTierProgress.jsx'
import { isVipCustomerType, supportsMembershipTierForCustomerType, isCorporateCustomerType } from '../../customers/utils/customerDisplay.js'
import { canManageCorporateCustomers } from '../../auth/utils/permissions.js'
import { loadAuthSession } from '../../auth/services/authSession.js'
import {
  applyCustomerDebtPayment,
  fetchCustomerDebts,
  fetchCustomerOpenDebts,
  fetchMembershipTiers,
  previewCustomerDebtPayment,
} from '../../customers/services/customersApi.js'
import CustomerOpenDebtsPanel from '../../customers/components/CustomerOpenDebtsPanel.jsx'
import { buildDebtReceiptFromPayment } from '../../customers/utils/debtPaymentUtils.js'
import { fetchPosCustomerContext } from '../services/posApi.js'
import { printDebtReceiptFromData } from '../utils/printReceipt.js'
import { loadPosSeller } from '../utils/posSeller.js'
import { formatRoleLabel } from '../utils/posSeller.js'
import { formatVietnamDateTime } from '../../../utils/vietnamDateTime.js'
import CustomScrollArea from '../../../components/shared/CustomScrollArea.jsx'
import { safeRandomUUID } from '../../../utils/safeUuid.js'

const TABS = [
  { id: 'profile', label: 'Thông tin khách hàng' },
  { id: 'history', label: 'Lịch sử bán / trả hàng' },
  { id: 'debt', label: 'Công nợ' },
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

function CustomerDetailModal({ isOpen, customer, onClose, onCustomerUpdated }) {
  const session = useMemo(() => loadAuthSession(), [])
  const canManageCorporate = canManageCorporateCustomers(session)
  const canCollectCorporateDebt =
    !isCorporateCustomerType(customer?.customerType) || canManageCorporate
  const [activeTab, setActiveTab] = useState('profile')
  const [context, setContext] = useState(null)
  const [membershipTiers, setMembershipTiers] = useState([])
  const [debtHistory, setDebtHistory] = useState([])
  const [openDebts, setOpenDebts] = useState([])
  const [debtPayPreview, setDebtPayPreview] = useState(null)
  const [debtPayAmount, setDebtPayAmount] = useState('')
  const [debtPayNote, setDebtPayNote] = useState('')
  const [debtPayMethod, setDebtPayMethod] = useState('Cash')
  const [isPayingDebt, setIsPayingDebt] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [seller, setSeller] = useState({ name: 'NV POS', role: '' })
  const debtPaymentAttemptRef = useRef(null)

  useEffect(() => {
    if (!isOpen) return undefined
    loadPosSeller().then((info) => setSeller(info))
    return undefined
  }, [isOpen])

  useEffect(() => {
    if (!isOpen || !customer?.customerId) {
      setContext(null)
      return undefined
    }

    let cancelled = false

    async function loadContext() {
      setIsLoading(true)
      try {
        const [data, tiers, debts, openDebtItems] = await Promise.all([
          fetchPosCustomerContext(customer.customerId),
          fetchMembershipTiers().catch(() => []),
          fetchCustomerDebts(customer.customerId).catch(() => []),
          fetchCustomerOpenDebts(customer.customerId).catch(() => []),
        ])
        if (!cancelled) {
          setContext(data)
          setMembershipTiers(Array.isArray(tiers) ? tiers : [])
          setDebtHistory(Array.isArray(debts) ? debts.slice(0, 10) : [])
          setOpenDebts(Array.isArray(openDebtItems) ? openDebtItems : [])
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

  useEffect(() => {
    const amount = Number(String(debtPayAmount).replace(/\D/g, ''))
    if (!customer?.customerId || amount <= 0) {
      setDebtPayPreview(null)
      return undefined
    }

    let cancelled = false
    previewCustomerDebtPayment(customer.customerId, amount)
      .then((preview) => {
        if (!cancelled) setDebtPayPreview(preview)
      })
      .catch(() => {
        if (!cancelled) setDebtPayPreview(null)
      })

    return () => {
      cancelled = true
    }
  }, [customer?.customerId, debtPayAmount])

  if (!isOpen || !customer) return null

  const customerTypeLabel =
    CUSTOMER_TYPE_LABELS[(context?.customerType || '').toUpperCase()] || context?.customerType || '—'

  async function handleDebtPayment(event) {
    event.preventDefault()
    if (isPayingDebt) return
    const amount = Number(String(debtPayAmount).replace(/\D/g, ''))
    const currentDebt = Number(context?.currentDebt ?? 0)

    if (!amount || amount <= 0) {
      showError('Nhập số tiền thu công nợ.')
      return
    }
    if (amount > currentDebt) {
      showError(`Số tiền vượt công nợ hiện tại (${formatMoney(currentDebt)} đ).`)
      return
    }

    try {
      setIsPayingDebt(true)
      const attemptSignature = JSON.stringify({
        customerId: customer.customerId,
        amount,
        paymentMethod: debtPayMethod,
        note: debtPayNote.trim(),
      })
      if (debtPaymentAttemptRef.current?.signature !== attemptSignature) {
        debtPaymentAttemptRef.current = {
          signature: attemptSignature,
          idempotencyKey: safeRandomUUID(),
        }
      }
      const payment = await applyCustomerDebtPayment(customer.customerId, {
        amount,
        note: debtPayNote.trim() || 'Thu công nợ tại POS',
        paymentMethod: debtPayMethod,
        idempotencyKey: debtPaymentAttemptRef.current.idempotencyKey,
      })
      const refreshed = await fetchPosCustomerContext(customer.customerId)
      const [debts, openDebtItems] = await Promise.all([
        fetchCustomerDebts(customer.customerId).catch(() => []),
        fetchCustomerOpenDebts(customer.customerId).catch(() => []),
      ])
      setContext(refreshed)
      setDebtHistory(Array.isArray(debts) ? debts.slice(0, 10) : [])
      setOpenDebts(Array.isArray(openDebtItems) ? openDebtItems : [])
      setDebtPayAmount('')
      setDebtPayNote('')
      setDebtPayMethod('Cash')
      setDebtPayPreview(null)
      debtPaymentAttemptRef.current = null
      showSuccess(`Đã thu ${formatMoney(payment?.allocatedAmount ?? amount)} đ công nợ. Đang in phiếu thu nợ...`)
      await printDebtReceiptFromData(
        buildDebtReceiptFromPayment({
          payment,
          customerName: refreshed?.fullName || customer.fullName,
          customerCode: refreshed?.customerCode || customer.customerCode,
          paymentMethodLabel: debtPayMethod === 'Cash' ? 'Tiền mặt' : 'Chuyển khoản',
          balanceBefore: currentDebt,
          sellerName: seller.name,
          sellerRole: seller.role,
        }),
      )
      onCustomerUpdated?.({
        ...customer,
        currentDebt: Number(refreshed?.currentDebt ?? 0),
      })
    } catch (error) {
      showError(error.message)
    } finally {
      setIsPayingDebt(false)
    }
  }

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

        <CustomScrollArea contentClassName="max-h-[65vh] bg-[#fbf9f1] p-5">
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
                {isVipCustomerType(context?.customerType) ? (
                  <span className="mt-1 inline-flex rounded-full bg-[#fec25b] px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-[#744f00]">
                    Khách VIP
                  </span>
                ) : (
                  <p className="mt-1 font-semibold text-[#1b1c17]">{customerTypeLabel}</p>
                )}
              </div>
              {supportsMembershipTierForCustomerType(context?.customerType) &&
              (context?.tierCode || membershipTiers.length > 0) ? (
                <div className="rounded-xl bg-white p-4 md:col-span-2">
                  <p className="mb-2 text-xs text-[#717971]">Hạng thành viên</p>
                  {membershipTiers.length > 0 ? (
                    <MembershipTierProgress
                      totalSpend={context?.totalSpend ?? customer.totalSpend ?? 0}
                      tierId={context?.tierId ?? customer.tierId ?? null}
                      tierCode={context?.tierCode || customer.tierCode}
                      tierDiscountPercent={context?.tierDiscountPercent ?? customer.tierDiscountPercent ?? 0}
                      tiers={membershipTiers}
                      compact
                      showHint
                    />
                  ) : (
                    <p className="font-semibold text-[#1b1c17]">{context?.tierCode || '—'}</p>
                  )}
                </div>
              ) : null}
              <div className="rounded-xl bg-white p-4 md:col-span-2">
                <p className="text-xs text-[#717971]">Công nợ (hệ thống)</p>
                <p className="mt-1 text-lg font-bold text-[#7e5700]">{formatMoney(context?.currentDebt ?? 0)} đ</p>
              </div>
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
                        <td className="px-4 py-3">{formatVietnamDateTime(row.createdAt)}</td>
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
                <p className="text-xs text-[#717971]">Công nợ hiện tại</p>
                <p className="mt-1 text-2xl font-bold text-[#7e5700]">{formatMoney(context?.currentDebt ?? 0)} đ</p>
                <p className="mt-2 text-xs leading-relaxed text-[#717971]">
                  Phát sinh khi bán chưa thu đủ. Có thể thu trả tại đây hoặc trừ từ tiền thừa khi thanh toán đơn.
                </p>
              </div>

              <CustomerOpenDebtsPanel
                openDebts={openDebts}
                formatMoney={formatMoney}
                allocationPreview={debtPayPreview?.allocations ?? []}
                highlightAllocations={(debtPayPreview?.allocations?.length ?? 0) > 0}
                title="Hóa đơn / đơn chưa trả tiền"
                subtitle={
                  debtPayPreview?.allocations?.length
                    ? 'Số tiền thu sẽ trừ theo đơn cũ nhất'
                    : 'Các đơn mua chịu chưa thu đủ'
                }
              />

              {Number(context?.currentDebt ?? 0) > 0 && canCollectCorporateDebt ? (
                <form className="rounded-xl border border-[#356647]/25 bg-white p-4" onSubmit={handleDebtPayment}>
                  <p className="text-sm font-semibold text-[#356647]">Thu trả công nợ</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-[#717971]" htmlFor="debt-pay-amount">
                        Số tiền thu
                      </label>
                      <input
                        id="debt-pay-amount"
                        type="text"
                        inputMode="numeric"
                        value={debtPayAmount}
                        onChange={(event) => setDebtPayAmount(event.target.value.replace(/\D/g, ''))}
                        className="w-full rounded-lg border border-[#c1c9c0] px-3 py-2 text-sm outline-none focus:border-[#356647]"
                        placeholder="VD: 500000"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-[#717971]" htmlFor="debt-pay-method">
                        Phương thức
                      </label>
                      <select
                        id="debt-pay-method"
                        value={debtPayMethod}
                        onChange={(event) => setDebtPayMethod(event.target.value)}
                        className="w-full rounded-lg border border-[#c1c9c0] px-3 py-2 text-sm outline-none focus:border-[#356647]"
                      >
                        <option value="Cash">Tiền mặt</option>
                        <option value="BankTransfer">Chuyển khoản đã xác nhận</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-[#717971]" htmlFor="debt-pay-note">
                        Ghi chú
                      </label>
                      <input
                        id="debt-pay-note"
                        type="text"
                        value={debtPayNote}
                        onChange={(event) => setDebtPayNote(event.target.value)}
                        className="w-full rounded-lg border border-[#c1c9c0] px-3 py-2 text-sm outline-none focus:border-[#356647]"
                        placeholder="Tiền mặt / CK..."
                      />
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setDebtPayAmount(String(Math.round(Number(context?.currentDebt ?? 0))))}
                      className="rounded-lg bg-[#f6f4ec] px-3 py-1.5 text-xs font-semibold text-[#414942] hover:bg-[#eae8e0]"
                    >
                      Thu hết nợ
                    </button>
                    <button
                      type="submit"
                      disabled={isPayingDebt}
                      className="rounded-lg bg-[#356647] px-4 py-2 text-sm font-bold text-white hover:brightness-110 disabled:opacity-50"
                    >
                      {isPayingDebt ? 'Đang lưu...' : 'Ghi nhận thu nợ'}
                    </button>
                  </div>
                </form>
              ) : Number(context?.currentDebt ?? 0) > 0 && isCorporateCustomerType(customer?.customerType) ? (
                <p className="rounded-xl border border-[#7e5700]/20 bg-[#fff8e8] px-4 py-3 text-xs leading-relaxed text-[#744f00]">
                  Khách doanh nghiệp: chỉ Admin được thu/ghi công nợ thủ công.
                </p>
              ) : null}

              <div className="rounded-xl border border-[#e5e7eb] bg-white p-4">
                <p className="text-xs text-[#717971]">Chi tiết theo đơn (chưa thanh toán đủ)</p>
                <p className="mt-1 text-lg font-semibold text-[#1b1c17]">{formatMoney(context?.outstandingBalance ?? 0)} đ</p>
              </div>

              {debtHistory.length > 0 ? (
                <div className="overflow-hidden rounded-xl border border-[#e5e7eb] bg-white">
                  <p className="border-b border-[#e5e7eb] bg-[#f6f4ec] px-4 py-2 text-xs font-semibold uppercase text-[#717971]">
                    Lịch sử công nợ gần đây
                  </p>
                  <table className="w-full border-collapse text-left text-sm">
                    <thead className="bg-white text-xs uppercase text-[#717971]">
                      <tr>
                        <th className="px-4 py-2">Loại</th>
                        <th className="px-4 py-2">Ngày</th>
                        <th className="px-4 py-2 text-right">Số tiền</th>
                        <th className="px-4 py-2 text-right">Còn nợ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {debtHistory.map((row) => (
                        <tr key={row.id} className="border-t border-[#f0eee6]">
                          <td className="px-4 py-2">
                            {row.type === 'DecreaseDebt' ? 'Giảm nợ' : 'Phát sinh nợ'}
                          </td>
                          <td className="px-4 py-2">{formatVietnamDateTime(row.createdAt)}</td>
                          <td className="px-4 py-2 text-right font-semibold">
                            {formatMoney(row.amount)} đ
                          </td>
                          <td className="px-4 py-2 text-right">{formatMoney(row.balanceAfter)} đ</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}

              {(context?.unpaidOrders?.length ?? 0) === 0 ? (
                <div className="rounded-xl bg-white p-4 text-sm text-[#717971]">Không có đơn chưa thanh toán đủ trong 50 đơn gần nhất.</div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-[#e5e7eb] bg-white">
                  <table className="w-full border-collapse text-left text-sm">
                    <thead className="bg-[#f6f4ec] text-xs uppercase text-[#717971]">
                      <tr>
                        <th className="px-4 py-3">Mã đơn</th>
                        <th className="px-4 py-3">Trạng thái TT</th>
                        <th className="px-4 py-3">Ngày</th>
                        <th className="px-4 py-3 text-right">Còn phải thu</th>
                      </tr>
                    </thead>
                    <tbody>
                      {context.unpaidOrders.map((row) => (
                        <tr key={row.orderCode} className="border-t border-[#f0eee6]">
                          <td className="px-4 py-3 font-semibold">{row.orderCode}</td>
                          <td className="px-4 py-3">{formatPaymentStatus(row.paymentStatus)}</td>
                          <td className="px-4 py-3">{formatVietnamDateTime(row.createdAt)}</td>
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
        </CustomScrollArea>
      </div>
    </div>
  )
}

export default CustomerDetailModal
