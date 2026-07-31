import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { showError } from '../../../app/toast.js'
import { fetchContracts } from '../../contracts/services/contractsApi.js'
import { loadAuthSession } from '../../auth/services/authSession.js'
import { canCreateContracts } from '../../auth/utils/permissions.js'

const STATUS_BADGES = {
  Draft: { label: 'Nháp', cls: 'bg-[#f2f0e8] text-[#717971]' },
  PendingApproval: { label: 'Chờ duyệt', cls: 'bg-[#fef3c7] text-[#92400e]' },
  Active: { label: 'Hiệu lực', cls: 'bg-[#dcfce7] text-[#166534]' },
  Rejected: { label: 'Từ chối', cls: 'bg-[#fee2e2] text-[#991b1b]' },
}

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('vi-VN')
}

function formatVnd(amount) {
  const value = Number(amount) || 0
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(value)
}

function CustomerContractsPanel({ customerId }) {
  const [items, setItems] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const session = loadAuthSession()
  const canCreate = canCreateContracts(session)

  const load = useCallback(async () => {
    if (!customerId) return
    setIsLoading(true)
    try {
      const result = await fetchContracts({ customerId, page: 1, pageSize: 50 })
      setItems(result.items)
    } catch (err) {
      showError(err?.message ?? 'Không tải được danh sách hợp đồng.')
    } finally {
      setIsLoading(false)
    }
  }, [customerId])

  useEffect(() => {
    const timer = window.setTimeout(() => load(), 0)
    return () => window.clearTimeout(timer)
  }, [load])

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-[#356647]">Hợp đồng</h3>
        {canCreate ? (
          <Link
            className="rounded-lg bg-[#356647] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#2a5238]"
            to={`/contracts/new?customerId=${customerId}`}
          >
            Tạo hợp đồng
          </Link>
        ) : null}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead>
            <tr className="border-b border-[#c1c9c0] text-left text-xs font-semibold text-[#717971]">
              <th className="pb-2 pr-4">Mã HĐ</th>
              <th className="pb-2 pr-4">Tiêu đề</th>
              <th className="pb-2 pr-4">Trạng thái</th>
              <th className="pb-2 pr-4">Hiệu lực</th>
              <th className="pb-2 pr-4 text-right">Chiết khấu</th>
              <th className="pb-2 pr-4 text-right">Hạn mức</th>
              <th className="pb-2 pr-4 text-right">Hạn TT</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-sm text-[#717971]">Đang tải...</td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-sm text-[#717971]">
                  Khách hàng này chưa có hợp đồng nào.
                </td>
              </tr>
            ) : (
              items.map((contract) => {
                const badge = STATUS_BADGES[contract.status] ?? { label: contract.status, cls: 'bg-[#f2f0e8] text-[#717971]' }
                return (
                  <tr key={contract.id} className="border-b border-[#f0f4f0] last:border-0 hover:bg-[#f5f7f4]">
                    <td className="py-3 pr-4">
                      <Link className="font-semibold text-[#356647] hover:underline" to={`/contracts/${contract.id}`}>
                        {contract.contractCode || '—'}
                      </Link>
                    </td>
                    <td className="py-3 pr-4 text-[#1b1c17]">{contract.title || '—'}</td>
                    <td className="py-3 pr-4">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${badge.cls}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-[#414942]">
                      {formatDate(contract.effectiveDate)} → {formatDate(contract.expiryDate)}
                    </td>
                    <td className="py-3 pr-4 text-right text-[#414942]">
                      {Number(contract.discountPercent ?? 0) > 0 ? `${Number(contract.discountPercent)}%` : '—'}
                    </td>
                    <td className="py-3 pr-4 text-right text-[#414942]">
                      {Number(contract.creditLimit ?? 0) > 0 ? formatVnd(contract.creditLimit) : '—'}
                    </td>
                    <td className="py-3 pr-4 text-right text-[#414942]">
                      {Number(contract.paymentTermDays ?? 0) > 0 ? `${Number(contract.paymentTermDays)} ngày` : 'Thu ngay'}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default CustomerContractsPanel
