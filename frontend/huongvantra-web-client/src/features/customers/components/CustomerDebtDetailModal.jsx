import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { showError, showSuccess } from '../../../app/toast.js'
import { useAuthSession } from '../../auth/hooks/useAuthSession.js'
import {
  canEditCustomer,
  canManageCorporateCustomers,
} from '../../auth/utils/permissions.js'
import {
  applyCustomerDebtPayment,
  fetchCustomerById,
  fetchCustomerOpenDebts,
  previewCustomerDebtPayment,
} from '../services/customersApi.js'
import {
  customerTypeLabelFromType,
  formatDebtVnd,
  isCorporateCustomerType,
} from '../utils/customerDisplay.js'
import CustomerOpenDebtsPanel from './CustomerOpenDebtsPanel.jsx'

function formatMoney(value) {
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(Number(value || 0))
}

export default function CustomerDebtDetailModal({ customer, onClose, onUpdated }) {
  const session = useAuthSession()
  const canManageCorporate = canManageCorporateCustomers(session)
  const canEdit = canEditCustomer(session)
  const canCollect =
    canEdit && (!isCorporateCustomerType(customer?.customerType) || canManageCorporate)

  const [detail, setDetail] = useState(customer)
  const [openDebts, setOpenDebts] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [debtPayAmount, setDebtPayAmount] = useState('')
  const [debtPayNote, setDebtPayNote] = useState('')
  const [debtPayMethod, setDebtPayMethod] = useState('Cash')
  const [debtPayPreview, setDebtPayPreview] = useState(null)
  const [isPayingDebt, setIsPayingDebt] = useState(false)

  const currentDebt = Number(detail?.currentDebt ?? customer?.currentDebt ?? 0)

  const title = useMemo(
    () => detail?.fullName || customer?.fullName || 'Khách hàng',
    [customer?.fullName, detail?.fullName],
  )

  useEffect(() => {
    if (!customer?.customerId) return undefined
    let mounted = true

    async function load() {
      try {
        setIsLoading(true)
        const [fresh, debts] = await Promise.all([
          fetchCustomerById(customer.customerId),
          fetchCustomerOpenDebts(customer.customerId),
        ])
        if (!mounted) return
        setDetail(fresh || customer)
        setOpenDebts(Array.isArray(debts) ? debts : [])
      } catch (error) {
        if (mounted) {
          setDetail(customer)
          setOpenDebts([])
          showError(error.message || 'Không tải được công nợ.')
        }
      } finally {
        if (mounted) setIsLoading(false)
      }
    }

    load()
    return () => {
      mounted = false
    }
  }, [customer])

  useEffect(() => {
    if (!customer?.customerId || !debtPayAmount) {
      setDebtPayPreview(null)
      return undefined
    }
    let mounted = true
    const timer = setTimeout(async () => {
      try {
        const preview = await previewCustomerDebtPayment(customer.customerId, debtPayAmount)
        if (mounted) setDebtPayPreview(preview)
      } catch {
        if (mounted) setDebtPayPreview(null)
      }
    }, 300)
    return () => {
      mounted = false
      clearTimeout(timer)
    }
  }, [customer?.customerId, debtPayAmount])

  async function handleDebtPayment(event) {
    event.preventDefault()
    if (!canCollect || !customer?.customerId || isPayingDebt) return
    const amount = Math.round(Number(debtPayAmount) || 0)
    if (amount <= 0) {
      showError('Nhập số tiền thu hợp lệ.')
      return
    }
    try {
      setIsPayingDebt(true)
      await applyCustomerDebtPayment(customer.customerId, {
        amount,
        note: debtPayNote,
        paymentMethod: debtPayMethod,
        allocations: debtPayPreview?.allocations ?? null,
      })
      showSuccess('Đã ghi nhận thu công nợ.')
      setDebtPayAmount('')
      setDebtPayNote('')
      const [fresh, debts] = await Promise.all([
        fetchCustomerById(customer.customerId),
        fetchCustomerOpenDebts(customer.customerId),
      ])
      setDetail(fresh)
      setOpenDebts(Array.isArray(debts) ? debts : [])
      onUpdated?.(fresh)
    } catch (error) {
      showError(error.message || 'Thu công nợ thất bại.')
    } finally {
      setIsPayingDebt(false)
    }
  }

  if (!customer) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl sm:p-7"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#717971]">Công nợ khách hàng</p>
            <h2 className="mt-1 text-xl font-bold text-[#356647] sm:text-2xl">{title}</h2>
            <p className="mt-1 text-sm text-[#414942]">
              {detail?.customerCode || '—'} · {detail?.phone || customer.phone || '—'} ·{' '}
              {customerTypeLabelFromType(detail?.customerType || customer.customerType)}
            </p>
          </div>
          <button
            type="button"
            className="rounded-full p-2 text-[#717971] hover:bg-[#eae8e0]"
            onClick={onClose}
            title="Đóng"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="mt-5 rounded-2xl bg-[#fff8e8] p-4">
          <p className="text-xs text-[#717971]">Công nợ hiện tại</p>
          <p className="mt-1 text-3xl font-bold text-[#7e5700]">{formatDebtVnd(currentDebt)}</p>
        </div>

        <div className="mt-4">
          <CustomerOpenDebtsPanel
            openDebts={openDebts}
            isLoading={isLoading}
            formatMoney={formatMoney}
            allocationPreview={debtPayPreview?.allocations ?? []}
            highlightAllocations={(debtPayPreview?.allocations?.length ?? 0) > 0}
            title="Hóa đơn / đơn chưa trả"
            subtitle="Các đơn mua chịu chưa thu đủ"
          />
        </div>

        {currentDebt > 0 && canCollect ? (
          <form className="mt-4 rounded-2xl border border-[#356647]/25 bg-[#f8ffef] p-4" onSubmit={handleDebtPayment}>
            <p className="text-sm font-semibold text-[#356647]">Thu trả công nợ</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#717971]" htmlFor="cust-debt-amount">
                  Số tiền thu
                </label>
                <input
                  id="cust-debt-amount"
                  type="text"
                  inputMode="numeric"
                  value={debtPayAmount}
                  onChange={(event) => setDebtPayAmount(event.target.value.replace(/\D/g, ''))}
                  className="w-full rounded-lg border border-[#c1c9c0] px-3 py-2 text-sm outline-none focus:border-[#356647]"
                  placeholder="VD: 500000"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#717971]" htmlFor="cust-debt-method">
                  Phương thức
                </label>
                <select
                  id="cust-debt-method"
                  value={debtPayMethod}
                  onChange={(event) => setDebtPayMethod(event.target.value)}
                  className="w-full rounded-lg border border-[#c1c9c0] px-3 py-2 text-sm outline-none focus:border-[#356647]"
                >
                  <option value="Cash">Tiền mặt</option>
                  <option value="BankTransfer">Chuyển khoản đã xác nhận</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#717971]" htmlFor="cust-debt-note">
                  Ghi chú
                </label>
                <input
                  id="cust-debt-note"
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
                onClick={() => setDebtPayAmount(String(Math.round(currentDebt)))}
                className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-[#414942] hover:bg-[#eae8e0]"
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
        ) : currentDebt > 0 && isCorporateCustomerType(detail?.customerType || customer.customerType) ? (
          <p className="mt-4 rounded-xl border border-[#7e5700]/20 bg-[#fff8e8] px-4 py-3 text-xs leading-relaxed text-[#744f00]">
            Khách doanh nghiệp: chỉ Admin/Quản lý được thu công nợ thủ công tại đây.
          </p>
        ) : null}

        <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-[#eae8e0] pt-4">
          <Link
            to={`/customers/${customer.customerId}/edit?mode=view`}
            className="inline-flex items-center gap-1 rounded-xl border border-[#356647] px-4 py-2 text-sm font-semibold text-[#356647] hover:bg-[#356647]/5"
            onClick={onClose}
          >
            <span className="material-symbols-outlined text-[18px]">visibility</span>
            Xem hồ sơ
          </Link>
          <button
            type="button"
            className="rounded-xl bg-[#4a6242] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
            onClick={onClose}
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  )
}
