import { useCallback, useEffect, useState } from 'react'
import PageHeader from '../../../components/shared/PageHeader.jsx'
import PageShell from '../../../components/shared/PageShell.jsx'
import { showSuccess } from '../../../app/toast.js'
import { formatProductPrice } from '../../products/utils/productDisplay.js'
import {
  approvePriceProposalMock,
  cancelPriceProposalMock,
  fetchPriceProposalsMock,
  getStatusLabel,
  rejectPriceProposalMock,
} from '../services/priceProposalMockApi.js'

const STATUS_OPTIONS = [
  { value: '', label: 'Tat ca' },
  { value: 'pending', label: 'Cho duyet' },
  { value: 'approved', label: 'Da duyet' },
  { value: 'rejected', label: 'Tu choi' },
  { value: 'cancelled', label: 'Da huy' },
]

export default function AccountantPriceProposalsPage({ adminMode = false }) {
  const [status, setStatus] = useState(adminMode ? 'pending' : '')
  const [items, setItems] = useState([])

  const loadData = useCallback(async () => {
    const result = await fetchPriceProposalsMock({
      status: status || undefined,
      mine: !adminMode,
    })
    setItems(result.items)
  }, [adminMode, status])

  useEffect(() => {
    loadData()
  }, [loadData])

  async function handleCancel(id) {
    await cancelPriceProposalMock(id)
    showSuccess('Da huy de xuat.')
    await loadData()
  }

  async function handleApprove(id) {
    await approvePriceProposalMock(id)
    showSuccess('Da duyet de xuat.')
    await loadData()
  }

  async function handleReject(id) {
    const note = window.prompt('Nhap ly do tu choi:', 'Can xem lai gia de xuat')
    await rejectPriceProposalMock(id, note || 'Can xem lai gia de xuat')
    showSuccess('Da tu choi de xuat.')
    await loadData()
  }

  const summary = {
    total: items.length,
    pending: items.filter((it) => it.status === 'pending').length,
    approved: items.filter((it) => it.status === 'approved').length,
    rejected: items.filter((it) => it.status === 'rejected').length,
  }

  return (
    <PageShell>
      <PageHeader
        title={adminMode ? 'Duyet gia ban' : 'De xuat gia cua toi'}
        description={adminMode ? 'Chủ hợp tác xã duyệt hoặc từ chối đề xuất giá từ kế toán.' : 'Theo dõi các đề xuất đã gửi và trạng thái xử lý.'}
        rightContent={(
          <select
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        )}
      />

      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Du lieu trang nay dang luu tam trong local storage de demo giao dien.
      </div>

      <section className="grid gap-3 sm:grid-cols-4">
        <article className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-xs uppercase text-slate-500">Tong de xuat</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{summary.total}</p>
        </article>
        <article className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-xs uppercase text-slate-500">Cho duyet</p>
          <p className="mt-1 text-2xl font-bold text-amber-600">{summary.pending}</p>
        </article>
        <article className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-xs uppercase text-slate-500">Da duyet</p>
          <p className="mt-1 text-2xl font-bold text-emerald-600">{summary.approved}</p>
        </article>
        <article className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-xs uppercase text-slate-500">Tu choi</p>
          <p className="mt-1 text-2xl font-bold text-rose-600">{summary.rejected}</p>
        </article>
      </section>

      <section className="overflow-x-auto rounded-2xl bg-white p-4 shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-3 py-2 text-left">Ma hang</th>
              <th className="px-3 py-2 text-left">Ten san pham</th>
              <th className="px-3 py-2 text-right">Gia dang ban</th>
              <th className="px-3 py-2 text-right">Gia de xuat</th>
              <th className="px-3 py-2 text-center">Trang thai</th>
              <th className="px-3 py-2 text-left">Ghi chu</th>
              <th className="px-3 py-2 text-right">Thao tac</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.length === 0 ? (
              <tr>
                <td className="px-3 py-6 text-center text-slate-500" colSpan={7}>Chua co du lieu.</td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id}>
                  <td className="px-3 py-2 font-mono text-xs">{item.skuCode}</td>
                  <td className="px-3 py-2">{item.productName}</td>
                  <td className="px-3 py-2 text-right">{formatProductPrice(item.currentRetailPrice)}</td>
                  <td className="px-3 py-2 text-right font-semibold text-[#356647]">{formatProductPrice(item.proposedRetailPrice)}</td>
                  <td className="px-3 py-2 text-center">{getStatusLabel(item.status)}</td>
                  <td className="px-3 py-2 text-xs text-slate-600">{item.reviewNote || '—'}</td>
                  <td className="px-3 py-2 text-right">
                    {!adminMode && item.status === 'pending' ? (
                      <button type="button" onClick={() => handleCancel(item.id)} className="rounded border px-2 py-1 text-xs">
                        Huy
                      </button>
                    ) : null}
                    {adminMode && item.status === 'pending' ? (
                      <div className="inline-flex gap-2">
                        <button type="button" onClick={() => handleApprove(item.id)} className="rounded border border-emerald-200 px-2 py-1 text-xs text-emerald-700">
                          Duyet
                        </button>
                        <button type="button" onClick={() => handleReject(item.id)} className="rounded border border-rose-200 px-2 py-1 text-xs text-rose-700">
                          Tu choi
                        </button>
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </PageShell>
  )
}
