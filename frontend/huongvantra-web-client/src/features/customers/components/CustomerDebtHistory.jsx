import { useEffect, useState } from 'react'
import { showError } from '../../../app/toast.js'
import { formatVietnamDateTime } from '../../../utils/vietnamDateTime.js'
import { fetchCustomerDebts, fetchCustomerDebtSummary } from '../services/customersApi.js'
import { formatDebtVnd, formatVnd } from '../utils/customerDisplay.js'

function formatDebtType(type) {
  const normalized = String(type || '').toLowerCase()
  if (normalized.includes('decrease')) return 'Giảm nợ'
  if (normalized.includes('increase')) return 'Tăng nợ'
  return type || '—'
}

function CustomerDebtHistory({ customerId, refreshKey = 0 }) {
  const [debts, setDebts] = useState([])
  const [summary, setSummary] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

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

      {debts.length === 0 ? (
        <p className="text-sm text-[#717971]">Chưa có giao dịch công nợ.</p>
      ) : (
        <div className="custom-scrollbar max-h-56 overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-[#717971]">
                <th className="pb-2 font-semibold">Thời gian</th>
                <th className="pb-2 font-semibold">Loại</th>
                <th className="pb-2 font-semibold">Số tiền</th>
                <th className="pb-2 font-semibold">Dư sau GD</th>
                <th className="pb-2 font-semibold">Ghi chú</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0eee6]">
              {debts.map((item) => (
                <tr key={item.id}>
                  <td className="py-2 pr-2 whitespace-nowrap text-[#717971]">
                    {item.createdAt ? formatVietnamDateTime(item.createdAt) : '—'}
                  </td>
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
