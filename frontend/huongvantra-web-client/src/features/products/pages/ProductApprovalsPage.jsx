import { useEffect, useState } from 'react'
import PageShell from '../../../components/shared/PageShell.jsx'
import { showError, showSuccess } from '../../../app/toast.js'
import {
  authorizeProductApprovalRequest,
  cancelProductApprovalRequest,
  createProductApprovalRequest,
  fetchProductApprovals,
} from '../services/productsApi.js'

const DEFAULT_APPROVAL_JSON = JSON.stringify(
  {
    categoryId: 1,
    name: 'Sản phẩm mới chờ duyệt',
    origin: null,
    flavorProfile: null,
    brewingGuide: null,
    description: null,
    baseUnit: 'cái',
    weightValue: null,
    weightUnit: 'g',
    isVariantParent: false,
    productType: 'THANH_PHAM',
    images: [],
    units: [
      {
        variantId: null,
        unitName: 'cái',
        conversionRate: 1,
        price: 100000,
        barcode: null,
        isDirectSell: true,
        isBaseUnit: true,
      },
    ],
    variants: [
      {
        skuCode: '',
        barcode: null,
        variantName: 'Sản phẩm mới chờ duyệt - cái',
        optionValuesJson: '{"Unit":"cái"}',
        costPrice: 0,
        retailPrice: 100000,
        minStock: 0,
        maxStock: 999999999,
        isSellable: true,
        allowRewardPoints: true,
        isActive: true,
        imageUrl: null,
        units: [],
        bomLines: [],
      },
    ],
    variantGenerator: null,
  },
  null,
  2,
)

function statusLabel(status) {
  switch (status) {
    case 'Draft':
      return 'Nháp'
    case 'AwaitingWarehouseConfirmation':
      return 'Đã cấp mã'
    case 'Completed':
      return 'Đã dùng'
    case 'Cancelled':
      return 'Đã hủy'
    case 'Rejected':
      return 'Từ chối'
    case 'Expired':
      return 'Hết hạn'
    default:
      return status || '—'
  }
}

function formatDateTime(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export default function ProductApprovalsPage() {
  const [items, setItems] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [snapshotJson, setSnapshotJson] = useState(DEFAULT_APPROVAL_JSON)
  const [adminNotes, setAdminNotes] = useState('')

  async function loadItems() {
    try {
      setIsLoading(true)
      const result = await fetchProductApprovals({ page: 1, pageSize: 50, status: 'all' })
      setItems(result.items)
    } catch (error) {
      showError(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadItems()
  }, [])

  async function handleCreate(event) {
    event.preventDefault()
    let product
    try {
      product = JSON.parse(snapshotJson)
    } catch {
      showError('JSON snapshot sản phẩm không hợp lệ.')
      return
    }

    try {
      setIsSaving(true)
      const created = await createProductApprovalRequest({ product, adminNotes })
      showSuccess(`Đã tạo biên bản ${created.approvalCode}.`)
      setAdminNotes('')
      await loadItems()
    } catch (error) {
      showError(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleAuthorize(item) {
    try {
      setIsSaving(true)
      const updated = await authorizeProductApprovalRequest(item.id)
      showSuccess(`Đã cấp mã ${updated.approvalCode}.`)
      await loadItems()
    } catch (error) {
      showError(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleCancel(item) {
    const reason = window.prompt(`Lý do hủy mã ${item.approvalCode}?`)
    if (!reason?.trim()) return

    try {
      setIsSaving(true)
      await cancelProductApprovalRequest(item.id, reason)
      showSuccess('Đã hủy biên bản phê duyệt.')
      await loadItems()
    } catch (error) {
      showError(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <PageShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800">Duyệt sản phẩm mới</h1>
          <p className="mt-1 text-sm text-slate-500">Admin tạo biên bản, cấp mã, sau đó Thủ kho dùng mã tại trang tạo hàng hóa.</p>
        </div>

        <section className="rounded-[1rem] bg-white p-4 shadow-sm sm:p-6">
          <h2 className="text-lg font-bold text-slate-800">Tạo biên bản phê duyệt</h2>
          <form onSubmit={handleCreate} className="mt-4 space-y-4">
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Product snapshot JSON</span>
              <textarea
                className="mt-1 min-h-80 w-full rounded-xl border border-slate-200 bg-slate-950 px-3 py-2.5 font-mono text-xs text-slate-100 outline-none focus:border-[#538463]"
                value={snapshotJson}
                onChange={(event) => setSnapshotJson(event.target.value)}
              />
            </label>
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Ghi chú Admin</span>
              <textarea
                className="mt-1 min-h-20 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#538463]"
                value={adminNotes}
                onChange={(event) => setAdminNotes(event.target.value)}
              />
            </label>
            <div className="flex justify-end">
              <button type="submit" disabled={isSaving} className="rounded-xl bg-[#538463] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#457053] disabled:opacity-50">
                {isSaving ? 'Đang lưu...' : 'Tạo biên bản'}
              </button>
            </div>
          </form>
        </section>

        <section className="rounded-[1rem] bg-white p-4 shadow-sm sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-slate-800">Danh sách biên bản</h2>
            <button type="button" onClick={loadItems} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              Làm mới
            </button>
          </div>

          <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Mã</th>
                  <th className="px-4 py-3 font-semibold">Sản phẩm</th>
                  <th className="px-4 py-3 font-semibold">Trạng thái</th>
                  <th className="px-4 py-3 font-semibold">Cấp mã lúc</th>
                  <th className="px-4 py-3 text-right font-semibold">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-400">Đang tải...</td>
                  </tr>
                ) : items.length ? items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-[#356647]">{item.approvalCode}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">{item.productName}</td>
                    <td className="px-4 py-3">{statusLabel(item.status)}</td>
                    <td className="px-4 py-3 text-slate-600">{formatDateTime(item.authorisedAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        {item.status === 'Draft' ? (
                          <button type="button" disabled={isSaving} onClick={() => handleAuthorize(item)} className="rounded-lg bg-[#538463] px-3 py-2 text-xs font-bold text-white hover:bg-[#457053] disabled:opacity-50">
                            Cấp mã
                          </button>
                        ) : null}
                        {item.status !== 'Completed' && item.status !== 'Cancelled' ? (
                          <button type="button" disabled={isSaving} onClick={() => handleCancel(item)} className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 disabled:opacity-50">
                            Hủy
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-400">Chưa có biên bản phê duyệt.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </PageShell>
  )
}

