import { useMemo, useState } from 'react'
import { showError, showSuccess } from '../../../app/toast.js'
import { loadAuthSession } from '../../auth/services/authSession.js'
import { canSimulateOrderCompleted } from '../../auth/utils/permissions.js'
import {
  simulateOrderCompleted,
  waitForCustomerAfterIntegrationEvent,
} from '../services/integrationEventsApi.js'
import { formatVnd } from '../utils/customerDisplay.js'
import { pushCustomerIntegrationActivity } from '../utils/customerActivity.js'

function parseAmount(value) {
  const normalized = String(value ?? '').replace(/[^\d]/g, '')
  return normalized ? Number(normalized) : 0
}

function SimulateOrderCompletedPanel({
  customerId,
  customerName,
  snapshot,
  onUpdated,
  compact = false,
}) {
  const canSimulate = canSimulateOrderCompleted(loadAuthSession())
  const [totalAmount, setTotalAmount] = useState('500000')
  const [debtAmount, setDebtAmount] = useState('0')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const hint = useMemo(
    () =>
      'Gửi sự kiện OrderCompleted qua RabbitMQ. Customer Service tự cộng chi tiêu, công nợ và nâng hạng.',
    [],
  )

  if (!canSimulate || !customerId) return null

  async function handleSubmit(event) {
    event.preventDefault()
    const amount = parseAmount(totalAmount)
    const debt = parseAmount(debtAmount)

    if (amount <= 0 && debt <= 0) {
      showError('Nhập ít nhất một trong hai: tổng đơn hoặc công nợ phát sinh.')
      return
    }

    try {
      setIsSubmitting(true)
      const accepted = await simulateOrderCompleted({
        customerId,
        totalAmount: amount,
        debtAmount: debt,
      })

      showSuccess('Đã gửi sự kiện hoàn tất đơn. Đang đồng bộ dữ liệu khách hàng...')

      const updated = await waitForCustomerAfterIntegrationEvent(customerId, snapshot)

      const tierUpgraded =
        (updated.tier?.tierId ?? updated.tierId ?? null) !== (snapshot?.tierId ?? null)

      pushCustomerIntegrationActivity({
        customerId,
        customerName: customerName || updated.fullName,
        orderCode: accepted?.orderCode ?? accepted?.OrderCode ?? '—',
        totalAmount: amount,
        debtAmount: debt,
        tierUpgraded,
        tierName: updated.tier?.tierCode ?? updated.tierCode ?? null,
      })

      onUpdated?.(updated)
      showSuccess(
        tierUpgraded
          ? `Đã cập nhật — khách lên hạng ${updated.tier?.tierCode ?? updated.tierCode ?? 'mới'}`
          : 'Đã cập nhật chi tiêu và công nợ từ integration event.',
      )
    } catch (error) {
      showError(error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form
      className={`rounded-xl border border-dashed border-[#356647]/40 bg-[#f8ffef] ${compact ? 'p-3' : 'p-4'}`}
      onSubmit={handleSubmit}
    >
      <div className="mb-3 flex items-start gap-2">
        <span className="material-symbols-outlined text-[20px] text-[#356647]">sync_alt</span>
        <div>
          <p className="text-sm font-bold text-[#356647]">Giả lập hoàn tất đơn (Integration Event)</p>
          <p className="mt-1 text-xs leading-relaxed text-[#717971]">{hint}</p>
        </div>
      </div>

      <div className={`grid gap-3 ${compact ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'}`}>
        <label className="space-y-1">
          <span className="text-xs font-semibold text-[#717971]">Tổng đơn (VND)</span>
          <input
            type="text"
            inputMode="numeric"
            className="w-full rounded-lg border border-[#c1c9c0]/60 bg-white px-3 py-2 text-sm"
            value={totalAmount}
            onChange={(e) => setTotalAmount(e.target.value)}
            placeholder="500000"
          />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-semibold text-[#717971]">Công nợ phát sinh (VND)</span>
          <input
            type="text"
            inputMode="numeric"
            className="w-full rounded-lg border border-[#c1c9c0]/60 bg-white px-3 py-2 text-sm"
            value={debtAmount}
            onChange={(e) => setDebtAmount(e.target.value)}
            placeholder="0"
          />
        </label>
      </div>

      <p className="mt-2 text-[11px] text-[#717971]">
        Chi tiêu hiện tại: <strong>{formatVnd(snapshot?.totalSpend ?? 0)}</strong>
      </p>

      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-3 w-full rounded-lg bg-[#356647] px-4 py-2.5 text-sm font-bold text-white hover:opacity-90 disabled:opacity-60"
      >
        {isSubmitting ? 'Đang xử lý event...' : 'Gửi OrderCompletedEvent'}
      </button>
    </form>
  )
}

export default SimulateOrderCompletedPanel
