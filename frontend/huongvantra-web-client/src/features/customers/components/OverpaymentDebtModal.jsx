import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { formatVietnamDateTime } from '../../../utils/vietnamDateTime.js'
import {
  buildAllocationDraft,
  clampAllocationAmount,
  parseAllocationMoneyInput,
  resolveMaxDebtPayable,
  sumAllocationRows,
  toAllocationPayload,
} from '../utils/debtAllocationEditor.js'

export default function OverpaymentDebtModal({
  isOpen,
  excessAmount = 0,
  customerCurrentDebt = 0,
  openDebts = [],
  isLoading = false,
  formatMoney,
  onSkip,
  onConfirm,
  onClose,
  initialSettlement = null,
}) {
  const [payDebtsEnabled, setPayDebtsEnabled] = useState(true)
  const [rows, setRows] = useState([])

  const maxPayable = useMemo(
    () => resolveMaxDebtPayable(excessAmount, customerCurrentDebt),
    [excessAmount, customerCurrentDebt],
  )

  useEffect(() => {
    if (!isOpen) return
    setPayDebtsEnabled(initialSettlement?.payDebtsEnabled ?? true)
    setRows(
      buildAllocationDraft(
        openDebts,
        maxPayable,
        initialSettlement?.allocations ?? [],
      ),
    )
  }, [isOpen, openDebts, maxPayable, initialSettlement])

  const allocatedTotal = useMemo(
    () => (payDebtsEnabled ? sumAllocationRows(rows) : 0),
    [payDebtsEnabled, rows],
  )
  const effectiveAllocatedTotal = useMemo(() => {
    if (!payDebtsEnabled) return 0
    if (allocatedTotal > 0) return allocatedTotal
    if (openDebts.length === 0 && customerCurrentDebt > 0 && maxPayable > 0) return maxPayable
    return 0
  }, [payDebtsEnabled, allocatedTotal, openDebts.length, customerCurrentDebt, maxPayable])
  const creditToCustomer = Math.max(0, excessAmount - effectiveAllocatedTotal)

  if (!isOpen) return null

  function updateRowAmount(orderId, rawValue) {
    setRows((current) => {
      const total = sumAllocationRows(current)
      return current.map((row) => {
        if (row.orderId !== orderId) return row
        const nextAmount = clampAllocationAmount({
          nextAmount: parseAllocationMoneyInput(rawValue),
          remainingDebt: row.remainingDebt,
          maxTotal: maxPayable,
          currentTotal: total,
          currentAmount: row.amount,
        })
        return { ...row, amount: nextAmount }
      })
    })
  }

  function handleConfirm() {
    if (payDebtsEnabled && openDebts.length > 0 && allocatedTotal <= 0) {
      return
    }

    const payload = payDebtsEnabled ? toAllocationPayload(rows) : []
    let amount = payload.reduce((sum, row) => sum + row.amount, 0)

    if (payDebtsEnabled && amount <= 0 && customerCurrentDebt > 0 && maxPayable > 0) {
      amount = maxPayable
    }

    onConfirm?.({
      payDebtsEnabled,
      allocations: amount > 0 && payload.length > 0 ? payload : [],
      allocatedAmount: amount,
      creditToCustomer: Math.max(0, excessAmount - amount),
    })
  }

  const canConfirm =
    !payDebtsEnabled
    || allocatedTotal > 0
    || (openDebts.length === 0 && customerCurrentDebt > 0 && maxPayable > 0)

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Đóng"
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      <div
        className="relative z-10 flex max-h-[min(90vh,720px)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[#c1c9c0] bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="overpayment-debt-title"
      >
        <div className="shrink-0 border-b border-[#e4e3db] px-5 py-4">
          <h3 id="overpayment-debt-title" className="text-lg font-bold text-[#1b1c17]">
            Tiền thừa thanh toán cho các hóa đơn còn nợ
          </h3>
          <p className="mt-1 text-sm text-[#717971]">
            Tiền thừa: <span className="font-bold text-[#356647]">{formatMoney(excessAmount)} đ</span>
            {maxPayable < excessAmount ? (
              <span className="mt-1 block text-xs text-[#7e5700]">
                Tối đa trừ nợ: {formatMoney(maxPayable)} đ (theo công nợ hiện tại)
              </span>
            ) : null}
          </p>
        </div>

        <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <label className="mb-4 flex cursor-pointer items-center gap-2 text-sm font-semibold text-[#1b1c17]">
            <input
              type="checkbox"
              checked={payDebtsEnabled}
              onChange={(event) => setPayDebtsEnabled(event.target.checked)}
              className="size-4 rounded border-[#c1c9c0]"
            />
            Thanh toán hóa đơn nợ
          </label>

          {isLoading ? (
            <p className="text-sm text-[#717971]">Đang tải hóa đơn còn nợ...</p>
          ) : openDebts.length === 0 && customerCurrentDebt <= 0 ? (
            <p className="rounded-xl border border-[#e4e3db] bg-[#fbf9f1] px-4 py-3 text-sm text-[#717971]">
              Khách không có hóa đơn nợ để thanh toán.
            </p>
          ) : openDebts.length === 0 ? (
            <p className="rounded-xl border border-[#e4e3db] bg-[#fff8e8] px-4 py-3 text-sm text-[#7e5700]">
              Chưa có hóa đơn nợ chi tiết. Hệ thống sẽ tự trừ tối đa{' '}
              <span className="font-bold">{formatMoney(maxPayable)} đ</span> theo công nợ hiện tại.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-[#e4e3db]">
              <table className="min-w-full text-sm">
                <thead className="bg-[#f6f4ec] text-left text-xs font-bold uppercase tracking-wide text-[#717971]">
                  <tr>
                    <th className="px-3 py-2.5">Mã hóa đơn</th>
                    <th className="px-3 py-2.5">Thời gian</th>
                    <th className="px-3 py-2.5 text-right">Giá trị hóa đơn</th>
                    <th className="px-3 py-2.5 text-right">Đã thu trước</th>
                    <th className="px-3 py-2.5 text-right">Còn cần thu</th>
                    <th className="px-3 py-2.5 text-right">Tiền thu</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.orderId} className="border-t border-[#f0eee6]">
                      <td className="px-3 py-2.5 font-semibold text-[#1b1c17]">{row.orderCode}</td>
                      <td className="px-3 py-2.5 text-[#717971]">
                        {row.createdAt ? formatVietnamDateTime(row.createdAt) : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{formatMoney(row.originalDebt)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{formatMoney(row.paidAmount)}</td>
                      <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-[#7e5700]">
                        {formatMoney(row.remainingDebt)}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <input
                          type="text"
                          inputMode="numeric"
                          disabled={!payDebtsEnabled}
                          value={row.amount > 0 ? formatMoney(row.amount) : ''}
                          onChange={(event) => updateRowAmount(row.orderId, event.target.value)}
                          className="w-28 rounded-lg border border-[#c1c9c0] bg-[#fbf9f1] px-2 py-1.5 text-right text-sm font-semibold tabular-nums outline-none focus:border-[#356647] disabled:bg-[#f0eee6] disabled:text-[#717971]"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-4 space-y-1.5 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-[#717971]">Tổng thanh toán hóa đơn</span>
              <span className="font-bold tabular-nums text-[#1b1c17]">{formatMoney(effectiveAllocatedTotal)} đ</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#717971]">Còn lại trả khách</span>
              <span className="font-bold tabular-nums text-[#356647]">{formatMoney(creditToCustomer)} đ</span>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 justify-end gap-2 border-t border-[#e4e3db] px-5 py-4">
          <button
            type="button"
            onClick={onSkip}
            className="rounded-xl border border-[#356647] px-5 py-2.5 text-sm font-semibold text-[#356647] hover:bg-[#356647]/5"
          >
            Bỏ qua
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!canConfirm}
            className="rounded-xl bg-[#356647] px-5 py-2.5 text-sm font-bold text-white hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Đồng ý
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
