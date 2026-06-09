import { useEffect, useState } from 'react'
import { showError, showSuccess } from '../../../app/toast.js'
import {
  fetchCustomerDebts,
  fetchCustomerDebtSummary,
  recordDebtTransaction,
} from '../services/customersApi.js'
import { formatDebtVnd, formatVnd } from '../utils/customerDisplay.js'

function formatDebtType(type) {
  const normalized = String(type || '').toLowerCase()
  if (normalized.includes('decrease')) return 'Giảm nợ'
  if (normalized.includes('increase')) return 'Tăng nợ'
  return type || '—'
}

function parseAmount(value) {
  const normalized = String(value ?? '').replace(/[^\d]/g, '')
  return normalized ? Number(normalized) : 0
}

function CustomerDebtHistory({ customerId, refreshKey = 0, onDebtChanged }) {
  const [debts, setDebts] = useState([])
  const [summary, setSummary] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRecording, setIsRecording] = useState(false)
  const [debtForm, setDebtForm] = useState({
    type: 'IncreaseDebt',
    amount: '',
    note: '',
  })

  async function loadDebts() {
    if (!customerId) return
    try {
      setIsLoading(true)
      const [debtItems, debtSummary] = await Promise.all([
        fetchCustomerDebts(customerId),
        fetchCustomerDebtSummary(customerId),
      ])
      setDebts(debtItems)
      setSummary(debtSummary)
    } catch (error) {
      showError(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (!customerId) return undefined
    loadDebts()
    return undefined
  }, [customerId, refreshKey])

  async function handleRecordDebt(event) {
    event.preventDefault()
    const amount = parseAmount(debtForm.amount)
    if (amount <= 0) {
      showError('Nhập số tiền lớn hơn 0.')
      return
    }
    if (debtForm.type === 'DecreaseDebt' && summary && amount > Number(summary.currentDebt || 0)) {
      showError('Số tiền giảm nợ không được lớn hơn dư nợ hiện tại.')
      return
    }

    try {
      setIsRecording(true)
      await recordDebtTransaction(customerId, {
        type: debtForm.type,
        amount,
        note: debtForm.note.trim() || undefined,
      })
      showSuccess(debtForm.type === 'DecreaseDebt' ? 'Đã ghi nhận thanh toán công nợ.' : 'Đã ghi nhận phát sinh nợ.')
      setDebtForm({ type: debtForm.type, amount: '', note: '' })
      await loadDebts()
      onDebtChanged?.()
    } catch (error) {
      showError(error.message)
    } finally {
      setIsRecording(false)
    }
  }

  if (isLoading) {
    return <p className="text-sm text-[#717971]">Đang tải lịch sử công nợ...</p>
  }

  return (
    <section className="space-y-4 rounded-[24px] border border-[#c1c9c0]/30 bg-white p-4 shadow-sm sm:p-6">
      <h3 className="text-lg font-semibold text-[#356647]">Lịch sử công nợ</h3>

      {summary ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-xl bg-[#fff8e8] p-3">
            <p className="text-[10px] uppercase text-[#717971]">Dư nợ</p>
            <p className="text-sm font-bold text-[#7e5700]">{formatDebtVnd(summary.currentDebt)}</p>
          </div>
          <div className="rounded-xl bg-[#f6f4ec] p-3">
            <p className="text-[10px] uppercase text-[#717971]">Tổng phát sinh</p>
            <p className="text-sm font-bold text-[#414942]">{formatVnd(summary.totalIncrease)}</p>
          </div>
          <div className="rounded-xl bg-[#f6f4ec] p-3">
            <p className="text-[10px] uppercase text-[#717971]">Tổng thu nợ</p>
            <p className="text-sm font-bold text-[#356647]">{formatVnd(summary.totalDecrease)}</p>
          </div>
          <div className="rounded-xl bg-[#f6f4ec] p-3">
            <p className="text-[10px] uppercase text-[#717971]">Giao dịch</p>
            <p className="text-sm font-bold text-[#414942]">{summary.transactionCount}</p>
          </div>
        </div>
      ) : null}

      <form
        className="rounded-xl border border-dashed border-[#356647]/30 bg-[#f8ffef]/60 p-4"
        onSubmit={handleRecordDebt}
      >
        <p className="mb-3 text-sm font-semibold text-[#356647]">Ghi nhận công nợ thủ công</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="text-xs font-semibold text-[#717971]">Loại giao dịch</span>
            <select
              className="w-full rounded-lg border border-[#c1c9c0]/60 bg-white px-3 py-2 text-sm"
              value={debtForm.type}
              onChange={(e) => setDebtForm((current) => ({ ...current, type: e.target.value }))}
            >
              <option value="IncreaseDebt">Tăng nợ (mua chịu)</option>
              <option value="DecreaseDebt">Giảm nợ (thanh toán)</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold text-[#717971]">Số tiền (VND) *</span>
            <input
              type="text"
              inputMode="numeric"
              className="w-full rounded-lg border border-[#c1c9c0]/60 bg-white px-3 py-2 text-sm"
              value={debtForm.amount}
              onChange={(e) => setDebtForm((current) => ({ ...current, amount: e.target.value }))}
              placeholder="500000"
            />
          </label>
          <label className="space-y-1 sm:col-span-2">
            <span className="text-xs font-semibold text-[#717971]">Ghi chú</span>
            <input
              type="text"
              className="w-full rounded-lg border border-[#c1c9c0]/60 bg-white px-3 py-2 text-sm"
              value={debtForm.note}
              onChange={(e) => setDebtForm((current) => ({ ...current, note: e.target.value }))}
              placeholder="VD: Khách thanh toán chuyển khoản"
            />
          </label>
        </div>
        <button
          type="submit"
          disabled={isRecording}
          className="mt-3 rounded-lg bg-[#356647] px-4 py-2.5 text-sm font-bold text-white hover:opacity-90 disabled:opacity-60"
        >
          {isRecording ? 'Đang lưu...' : debtForm.type === 'DecreaseDebt' ? 'Ghi nhận thanh toán' : 'Ghi nhận phát sinh nợ'}
        </button>
      </form>

      {debts.length === 0 ? (
        <p className="text-sm text-[#717971]">Chưa có giao dịch công nợ.</p>
      ) : (
        <div className="custom-scrollbar max-h-56 overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-[#717971]">
                <th className="pb-2 font-semibold">Loại</th>
                <th className="pb-2 font-semibold">Số tiền</th>
                <th className="pb-2 font-semibold">Dư sau GD</th>
                <th className="pb-2 font-semibold">Ghi chú</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0eee6]">
              {debts.map((item) => (
                <tr key={item.id}>
                  <td className="py-2 pr-2">{formatDebtType(item.type)}</td>
                  <td className="py-2 pr-2 font-semibold">{formatVnd(item.amount)}</td>
                  <td className="py-2 pr-2">{formatDebtVnd(item.balanceAfter)}</td>
                  <td className="py-2 text-[#717971]">{item.note || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

export default CustomerDebtHistory
