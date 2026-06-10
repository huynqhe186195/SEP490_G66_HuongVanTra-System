import { useEffect, useMemo, useState } from 'react'
import { showError, showSuccess } from '../../../app/toast.js'
import OverpaymentDebtModal from '../../customers/components/OverpaymentDebtModal.jsx'
import {
  applyCustomerDebtPayment,
  fetchCustomerById,
  fetchCustomerOpenDebts,
} from '../../customers/services/customersApi.js'
import { clampDebtSettlement } from '../../customers/utils/debtAllocationEditor.js'
import { buildDebtReceiptFromPayment } from '../../customers/utils/debtPaymentUtils.js'
import { printReceiptSequence } from '../../pos/utils/printReceipt.js'
import { verifyCodPayment } from '../services/ordersApi.js'
import { formatVnd } from '../utils/orderDisplay.js'

function formatMoneyInput(value) {
  const amount = Number(value) || 0
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(amount)
}

export default function CodVerifyModal({ isOpen, order, onClose, onVerified }) {
  const [customerDebt, setCustomerDebt] = useState(0)
  const [openDebts, setOpenDebts] = useState([])
  const [isLoadingDebt, setIsLoadingDebt] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [overpaymentAction, setOverpaymentAction] = useState('return_change')
  const [debtAllocationModalOpen, setDebtAllocationModalOpen] = useState(false)
  const [debtModalMode, setDebtModalMode] = useState('configure')
  const [confirmedDebtSettlement, setConfirmedDebtSettlement] = useState(null)

  const formatMoney = (value) =>
    new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(Number(value || 0))

  const finalAmount = Number(order?.finalAmount || 0)
  const codPayment = order?.payments?.find((row) => String(row.paymentMethod).toUpperCase() === 'COD')
  const expectedFromOrder = Number(order?.codExpectedAmount || codPayment?.amount || 0)
  const collected =
    expectedFromOrder >= finalAmount && expectedFromOrder > 0 ? expectedFromOrder : finalAmount
  const change = Math.max(collected - finalAmount, 0)
  const canApplyOverpayToDebt = change > 0 && customerDebt > 0

  useEffect(() => {
    if (!isOpen || !order) return undefined
    setCustomerDebt(0)
    setOpenDebts([])
    setDebtAllocationModalOpen(false)

    const preset = order.codDebtSettlement
    if (preset?.payDebtsEnabled && Number(preset.allocatedAmount || 0) > 0) {
      setOverpaymentAction('apply_to_debt')
      setConfirmedDebtSettlement(preset)
    } else {
      setOverpaymentAction('return_change')
      setConfirmedDebtSettlement(null)
    }

    if (!order.customerId) return undefined

    let mounted = true
    setIsLoadingDebt(true)
    Promise.all([
      fetchCustomerById(order.customerId),
      fetchCustomerOpenDebts(order.customerId).catch(() => []),
    ])
      .then(([customer, debts]) => {
        if (!mounted) return
        setCustomerDebt(Number(customer?.currentDebt || 0))
        setOpenDebts(Array.isArray(debts) ? debts : [])
      })
      .catch(() => {
        if (!mounted) return
        setCustomerDebt(0)
        setOpenDebts([])
      })
      .finally(() => {
        if (mounted) setIsLoadingDebt(false)
      })

    return () => {
      mounted = false
    }
  }, [isOpen, order])

  const canSubmit = useMemo(() => {
    if (!order?.codPaymentId) return false
    if (finalAmount <= 0) return true
    return collected >= finalAmount
  }, [order?.codPaymentId, finalAmount, collected])

  if (!isOpen || !order) return null

  const openDebtAllocationModal = (mode = 'configure') => {
    if (!canApplyOverpayToDebt) return
    setDebtModalMode(mode)
    setDebtAllocationModalOpen(true)
  }

  async function finalizeCodCollection(debtSettlement = null) {
    if (!order.codPaymentId || !canSubmit) return

    const rawSettlement = debtSettlement ?? confirmedDebtSettlement
    const maxPayable = Math.min(change, customerDebt)
    const settlement = clampDebtSettlement(rawSettlement, maxPayable, openDebts, change)
    const debtApplyAmount = settlement?.payDebtsEnabled
      ? Number(settlement.allocatedAmount || 0)
      : 0
    const displayChange = Math.max(change - debtApplyAmount, 0)

    setIsSubmitting(true)
    try {
      const codAlreadyVerified = String(codPayment?.paymentStatus).toUpperCase() === 'SUCCESS'
        || codPayment?.isCodVerified === true

      if (!codAlreadyVerified) {
        await verifyCodPayment(order.codPaymentId, {
          collectedAmount: collected,
        })
      }

      let debtReceipt = null
      if (debtApplyAmount > 0 && order.customerId) {
        const payment = await applyCustomerDebtPayment(order.customerId, {
          amount: debtApplyAmount,
          note: `Trừ từ tiền thừa đơn COD ${order.orderCode}`,
          sourceOrderId: order.id,
          allocations: settlement?.allocations ?? null,
        })
        debtReceipt = buildDebtReceiptFromPayment({
          payment,
          customerName: order.customerSnapshotName?.split(' · ')[0] || '',
          customerCode: order.customerSnapshotName?.split(' · ')[1] || '',
          paymentMethodLabel: 'COD',
          balanceBefore: customerDebt,
          relatedOrderCode: order.orderCode,
        })
      }

      const message =
        debtApplyAmount > 0
          ? `Đã thu COD ${formatVnd(collected)} · trừ nợ ${formatMoneyInput(debtApplyAmount)} đ`
          : displayChange > 0
            ? `Đã thu COD ${formatVnd(collected)} · thừa ${formatMoneyInput(displayChange)} đ`
            : `Đã xác nhận thu COD đơn ${order.orderCode}`
      showSuccess(message)

      if (debtReceipt) {
        await printReceiptSequence([debtReceipt])
      }

      onVerified?.()
      onClose()
    } catch (error) {
      showError(error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleConfirm() {
    if (!canSubmit) return
    if (canApplyOverpayToDebt && overpaymentAction === 'apply_to_debt') {
      if (confirmedDebtSettlement?.payDebtsEnabled && Number(confirmedDebtSettlement.allocatedAmount || 0) > 0) {
        void finalizeCodCollection(confirmedDebtSettlement)
        return
      }
      showError('Vui lòng bấm "Tính vào công nợ" để chọn hóa đơn cần trừ.')
      openDebtAllocationModal('configure')
      return
    }
    void finalizeCodCollection()
  }

  return (
    <>
      <button
        type="button"
        aria-label="Đóng"
        className="fixed inset-0 z-[70] bg-black/40"
        onClick={onClose}
      />
      <div
        className="fixed inset-x-4 top-1/2 z-[71] mx-auto max-w-md -translate-y-1/2 rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:inset-x-auto"
        role="dialog"
        aria-modal="true"
      >
        <h3 className="text-lg font-bold text-slate-900">Xác nhận thu COD</h3>
        <p className="mt-1 text-sm text-slate-500">
          Đơn <span className="font-semibold text-slate-700">{order.orderCode}</span> · Thành tiền{' '}
          <span className="font-semibold text-[#538463]">{formatVnd(finalAmount)}</span>
        </p>

        <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Số tiền khách trả</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{formatVnd(collected)}</p>
          <p className="mt-1 text-xs text-slate-500">Đã nhập lúc tạo đơn tại POS.</p>
        </div>

        {change > 0 ? (
          <div className="mt-3 space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm">
            <p className="font-semibold text-amber-900">Tiền thừa: {formatMoneyInput(change)} đ</p>
            {canApplyOverpayToDebt ? (
              <>
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="cod-overpayment-action"
                    checked={overpaymentAction === 'return_change'}
                    onChange={() => {
                      setOverpaymentAction('return_change')
                      setConfirmedDebtSettlement(null)
                    }}
                    className="size-4"
                  />
                  <span className="flex flex-1 items-center justify-between gap-2">
                    <span className="font-semibold text-slate-900">Tiền thừa trả khách</span>
                    <span className="font-bold tabular-nums text-[#356647]">{formatMoneyInput(change)} đ</span>
                  </span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setOverpaymentAction('apply_to_debt')
                    openDebtAllocationModal('configure')
                  }}
                  className="flex w-full items-center gap-2 text-left"
                >
                  <span
                    className={`size-4 shrink-0 rounded-full border-2 ${
                      overpaymentAction === 'apply_to_debt'
                        ? 'border-[#356647] bg-[#356647] shadow-[inset_0_0_0_3px_white]'
                        : 'border-slate-300 bg-white'
                    }`}
                    aria-hidden
                  />
                  <span className="font-semibold text-[#356647] underline decoration-[#356647]/35 underline-offset-2 hover:decoration-[#356647]">
                    Tính vào công nợ
                  </span>
                </button>
                {overpaymentAction === 'apply_to_debt' &&
                confirmedDebtSettlement?.payDebtsEnabled &&
                Number(confirmedDebtSettlement.allocatedAmount || 0) > 0 ? (
                  <p className="pl-6 text-xs text-[#356647]">
                    Đã chọn trừ {formatMoneyInput(confirmedDebtSettlement.allocatedAmount)} đ ·{' '}
                    <button
                      type="button"
                      onClick={() => openDebtAllocationModal('configure')}
                      className="font-semibold underline underline-offset-2"
                    >
                      Sửa
                    </button>
                  </p>
                ) : null}
              </>
            ) : isLoadingDebt ? (
              <p className="text-xs text-amber-800">Đang tải công nợ...</p>
            ) : (
              <p className="text-xs text-amber-800">Khách không có công nợ để trừ.</p>
            )}
          </div>
        ) : null}

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            Hủy
          </button>
          <button
            type="button"
            disabled={!canSubmit || isSubmitting}
            onClick={handleConfirm}
            className="flex-1 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {isSubmitting ? 'Đang xử lý...' : 'Xác nhận đã giao & thu'}
          </button>
        </div>
      </div>

      <OverpaymentDebtModal
        isOpen={debtAllocationModalOpen}
        excessAmount={change}
        customerCurrentDebt={customerDebt}
        openDebts={openDebts}
        isLoading={isLoadingDebt}
        formatMoney={formatMoney}
        initialSettlement={confirmedDebtSettlement}
        onClose={() => setDebtAllocationModalOpen(false)}
        onSkip={() => {
          setDebtAllocationModalOpen(false)
          if (debtModalMode === 'configure') {
            setOverpaymentAction('return_change')
            setConfirmedDebtSettlement(null)
            return
          }
          void finalizeCodCollection({
            payDebtsEnabled: false,
            allocations: [],
            allocatedAmount: 0,
            creditToCustomer: change,
          })
        }}
        onConfirm={(result) => {
          setDebtAllocationModalOpen(false)
          if (debtModalMode === 'configure') {
            setConfirmedDebtSettlement(result)
            setOverpaymentAction('apply_to_debt')
            return
          }
          void finalizeCodCollection(result)
        }}
      />
    </>
  )
}
