import { useEffect, useMemo, useState } from 'react'
import { showError, showSuccess } from '../../../app/toast.js'
import { vietnamNowLabel } from '../../../utils/vietnamDateTime.js'
import { fetchCustomerById, recordDebtTransaction } from '../../customers/services/customersApi.js'
import { buildDebtReceiptCode } from '../../pos/utils/buildDebtReceiptPaperHtml.js'
import { printReceiptSequence } from '../../pos/utils/printReceipt.js'
import { verifyCodPayment } from '../services/ordersApi.js'
import { formatVnd } from '../utils/orderDisplay.js'

function formatMoneyInput(value) {
  const amount = Number(value) || 0
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(amount)
}

export default function CodVerifyModal({ isOpen, order, onClose, onVerified }) {
  const [customerDebt, setCustomerDebt] = useState(0)
  const [isLoadingDebt, setIsLoadingDebt] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const finalAmount = Number(order?.finalAmount || 0)
  const codPayment = order?.payments?.find((row) => String(row.paymentMethod).toUpperCase() === 'COD')
  const expectedFromOrder = Number(order?.codExpectedAmount || codPayment?.amount || 0)
  const collected =
    expectedFromOrder >= finalAmount && expectedFromOrder > 0 ? expectedFromOrder : finalAmount
  const change = Math.max(collected - finalAmount, 0)
  const debtReduction = change > 0 && customerDebt > 0 ? Math.min(change, customerDebt) : 0
  const displayChange = Math.max(change - debtReduction, 0)

  useEffect(() => {
    if (!isOpen || !order) return undefined
    setCustomerDebt(0)

    if (!order.customerId) return undefined

    let mounted = true
    setIsLoadingDebt(true)
    fetchCustomerById(order.customerId)
      .then((customer) => {
        if (mounted) setCustomerDebt(Number(customer?.currentDebt || 0))
      })
      .catch(() => {
        if (mounted) setCustomerDebt(0)
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

  async function handleConfirm() {
    if (!order.codPaymentId || !canSubmit) return
    setIsSubmitting(true)
    try {
      await verifyCodPayment(order.codPaymentId, {
        collectedAmount: collected,
      })

      let debtReceipt = null
      if (debtReduction > 0 && order.customerId) {
        const transaction = await recordDebtTransaction(order.customerId, {
          type: 'DecreaseDebt',
          amount: debtReduction,
          note: `Trừ từ tiền thừa đơn COD ${order.orderCode}`,
        })
        debtReceipt = {
          kind: 'debt',
          receiptCode: buildDebtReceiptCode(transaction?.id),
          customerName: order.customerSnapshotName?.split(' · ')[0] || '',
          customerCode: order.customerSnapshotName?.split(' · ')[1] || '',
          paymentMethodLabel: 'COD',
          createdAtLabel: vietnamNowLabel(),
          amount: debtReduction,
          balanceBefore: customerDebt,
          balanceAfter: Number(transaction?.balanceAfter ?? customerDebt - debtReduction),
          relatedOrderCode: order.orderCode,
          note: transaction?.note || `Trừ từ tiền thừa đơn COD ${order.orderCode}`,
        }
      }

      const message =
        debtReduction > 0
          ? `Đã thu COD ${formatVnd(collected)} · trừ nợ ${formatMoneyInput(debtReduction)} đ`
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
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm">
            <p className="font-semibold text-amber-900">Tiền thừa: {formatMoneyInput(change)} đ</p>
            {isLoadingDebt ? (
              <p className="mt-1 text-xs text-amber-800">Đang tải công nợ...</p>
            ) : debtReduction > 0 ? (
              <p className="mt-1 text-xs text-amber-800">
                Sẽ trừ nợ {formatMoneyInput(debtReduction)} đ
                {displayChange > 0 ? ` · còn thừa ${formatMoneyInput(displayChange)} đ` : ''}
              </p>
            ) : customerDebt <= 0 ? (
              <p className="mt-1 text-xs text-amber-800">Khách không có công nợ để trừ.</p>
            ) : null}
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
    </>
  )
}
