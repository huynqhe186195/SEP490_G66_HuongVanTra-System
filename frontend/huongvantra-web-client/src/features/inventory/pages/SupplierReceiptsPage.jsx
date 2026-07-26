import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import PageHeader from '../../../components/shared/PageHeader.jsx'
import PageShell from '../../../components/shared/PageShell.jsx'
import TablePagination, { TABLE_PAGE_SIZE } from '../../../components/shared/TablePagination.jsx'
import { showError, showSuccess } from '../../../app/toast.js'
import { formatVietnamDateTime } from '../../../utils/vietnamDateTime.js'
import { formatStockQuantity } from '../../products/utils/productDisplay.js'
import { loadAuthSession } from '../../auth/services/authSession.js'
import { canReviewSupplierReceipt, canWriteInventory } from '../../auth/utils/permissions.js'
import InventoryNavTabs from '../components/InventoryNavTabs.jsx'
import {
  approveSupplierReceipt,
  cancelSupplierReceipt,
  fetchSupplierReceipts,
  rejectSupplierReceipt,
  submitSupplierReceipt,
} from '../services/supplierReceiptApi.js'

const STATUS_OPTIONS = [
  { value: '', label: 'Tất cả' },
  { value: 'draft', label: 'Nháp' },
  { value: 'pendingapproval', label: 'Chờ duyệt' },
  { value: 'completed', label: 'Đã nhận' },
  { value: 'rejected', label: 'Từ chối' },
  { value: 'cancelled', label: 'Đã hủy' },
]

function getStatusLabel(status) {
  const normalized = String(status || '').toLowerCase()
  if (normalized === 'draft') return 'Nháp'
  if (normalized === 'pendingapproval') return 'Chờ duyệt'
  if (normalized === 'completed') return 'Đã nhận'
  if (normalized === 'rejected') return 'Từ chối'
  if (normalized === 'cancelled') return 'Đã hủy'
  return status || '—'
}

function getStatusClass(status) {
  const normalized = String(status || '').toLowerCase()
  if (normalized === 'completed') return 'bg-emerald-50 text-emerald-700'
  if (normalized === 'pendingapproval') return 'bg-amber-50 text-amber-700'
  if (normalized === 'rejected' || normalized === 'cancelled') return 'bg-rose-50 text-rose-700'
  return 'bg-slate-100 text-slate-700'
}

function getItemSummary(receipt) {
  if (!receipt.items?.length) return 'Chưa có dòng hàng'
  if (receipt.items.length === 1) return `${receipt.items[0].skuCode} - ${receipt.items[0].skuNameSnapshot}`
  return `${receipt.items.length} dòng hàng`
}

function SupplierReceiptsPage() {
  const [searchInput, setSearchInput] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(TABLE_PAGE_SIZE)
  const [data, setData] = useState({ items: [], totalItems: 0, totalPages: 1 })
  const [selectedReceipt, setSelectedReceipt] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [actionId, setActionId] = useState(null)
  const session = loadAuthSession()
  const canWrite = canWriteInventory(session)
  const canReview = canReviewSupplierReceipt(session)
  const currentUserId = session?.userId ?? null

  const loadReceipts = useCallback(async () => {
    setIsLoading(true)
    try {
      const result = await fetchSupplierReceipts({
        status: status || undefined,
        search: searchInput.trim() || undefined,
        page,
        pageSize,
      })
      setData(result)
    } catch (error) {
      setData({ items: [], totalItems: 0, totalPages: 1 })
      showError(error.message)
    } finally {
      setIsLoading(false)
    }
  }, [page, pageSize, searchInput, status])

  useEffect(() => {
    const timer = setTimeout(loadReceipts, 250)
    return () => clearTimeout(timer)
  }, [loadReceipts])

  async function runAction(receipt, action, successMessage) {
    setActionId(`${receipt.id}:${action.name}`)
    try {
      const updated = await action(receipt.id)
      showSuccess(successMessage(updated))
      setSelectedReceipt((current) => (current?.id === updated.id ? updated : current))
      await loadReceipts()
    } catch (error) {
      showError(error.message)
    } finally {
      setActionId(null)
    }
  }

  async function handleCancel(receipt) {
    const reason = window.prompt('Nhập lý do hủy phiếu nhập')
    if (!reason?.trim()) return
    await runAction(receipt, (id) => cancelSupplierReceipt(id, reason), (updated) => `Đã hủy ${updated.receiptCode}.`)
  }

  async function handleSubmitForApproval(receipt) {
    await runAction(receipt, submitSupplierReceipt, (updated) => `Đã gửi duyệt ${updated.receiptCode}. Tồn kho chưa thay đổi.`)
  }

  async function handleApprove(receipt) {
    await runAction(receipt, approveSupplierReceipt, (updated) => `Đã duyệt ${updated.receiptCode}. Tồn Kho đã được cập nhật.`)
  }

  async function handleReject(receipt) {
    const reason = window.prompt('Nhập lý do từ chối phiếu nhập')
    if (!reason?.trim()) return
    await runAction(receipt, (id) => rejectSupplierReceipt(id, reason), (updated) => `Đã từ chối ${updated.receiptCode}.`)
  }

  function isOwnReceipt(receipt) {
    return currentUserId != null && String(receipt.createdBy) === String(currentUserId)
  }

  function handleSearchChange(value) {
    setSearchInput(value)
    setPage(1)
  }

  function handleStatusChange(value) {
    setStatus(value)
    setPage(1)
  }

  return (
    <PageShell>
      <PageHeader
        title="Phiếu nhập nhà cung cấp"
        description="Phiếu nhập từ NCC theo quy trình Nháp → Chờ duyệt → Đã nhận. Tồn Kho chỉ tăng khi phiếu được duyệt."
        searchPlaceholder="Tìm mã phiếu, nhà cung cấp, SKU, mã lô..."
        searchValue={searchInput}
        onSearchChange={handleSearchChange}
        rightContent={(
          <div className="flex flex-wrap items-center gap-3">
            <InventoryNavTabs />
            {canWrite ? (
              <Link
                to="/inventory/import/create"
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#538463] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#457053]"
              >
                <span className="material-symbols-outlined text-[18px]">add</span>
                Tạo phiếu nhập
              </Link>
            ) : null}
          </div>
        )}
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          value={status}
          onChange={(event) => handleStatusChange(event.target.value)}
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-6 py-3">Mã phiếu</th>
                <th className="px-4 py-3">Nhà cung cấp</th>
                <th className="px-4 py-3">Nội dung</th>
                <th className="px-4 py-3 text-right">Số lượng</th>
                <th className="px-4 py-3">Trạng thái</th>
                <th className="px-4 py-3">Thời gian</th>
                <th className="px-4 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-slate-500">Đang tải...</td>
                </tr>
              ) : data.items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-slate-500">Chưa có phiếu nhập nhà cung cấp.</td>
                </tr>
              ) : (
                data.items.map((receipt) => (
                  <tr key={receipt.id} className="hover:bg-slate-50/80">
                    <td className="px-6 py-4 font-mono font-semibold text-[#356647]">{receipt.receiptCode}</td>
                    <td className="px-4 py-4 text-slate-700">{receipt.supplierName || '—'}</td>
                    <td className="px-4 py-4 text-slate-700">{getItemSummary(receipt)}</td>
                    <td className="px-4 py-4 text-right font-semibold text-slate-800">
                      {formatStockQuantity(receipt.totalQuantity)}
                    </td>
                    <td className="px-4 py-4">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusClass(receipt.status)}`}>
                        {getStatusLabel(receipt.status)}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-slate-600">{formatVietnamDateTime(receipt.createdAt)}</td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedReceipt(receipt)}
                          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Chi tiết
                        </button>
                        {canWrite && isOwnReceipt(receipt) && (receipt.status === 'draft' || receipt.status === 'rejected') ? (
                          <button
                            type="button"
                            disabled={Boolean(actionId)}
                            onClick={() => handleSubmitForApproval(receipt)}
                            className="rounded-lg border border-[#538463] px-3 py-1.5 text-xs font-semibold text-[#538463] hover:bg-[#f2f7f3] disabled:opacity-50"
                          >
                            Gửi duyệt
                          </button>
                        ) : null}
                        {canReview && receipt.status === 'pendingapproval' && !isOwnReceipt(receipt) ? (
                          <>
                            <button
                              type="button"
                              disabled={Boolean(actionId)}
                              onClick={() => handleApprove(receipt)}
                              className="rounded-lg bg-[#538463] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#457053] disabled:opacity-50"
                            >
                              Duyệt
                            </button>
                            <button
                              type="button"
                              disabled={Boolean(actionId)}
                              onClick={() => handleReject(receipt)}
                              className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                            >
                              Từ chối
                            </button>
                          </>
                        ) : null}
                        {canWrite && (receipt.status === 'draft' || receipt.status === 'pendingapproval' || receipt.status === 'rejected') ? (
                          <button
                            type="button"
                            disabled={Boolean(actionId)}
                            onClick={() => handleCancel(receipt)}
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                          >
                            Hủy
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <TablePagination
          page={page}
          pageSize={pageSize}
          totalCount={data.totalItems}
          onPageChange={setPage}
          onPageSizeChange={(size) => { setPageSize(size); setPage(1) }}
          disabled={isLoading}
          itemLabel="phiếu nhập NCC"
        />
      </section>

      {selectedReceipt ? (
        <div
          className="inventory-modal fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          onClick={() => setSelectedReceipt(null)}
        >
          <div
            className="max-h-[calc(100dvh-2rem)] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-800">{selectedReceipt.receiptCode}</h2>
                <p className="text-sm text-slate-500">{selectedReceipt.supplierName || 'Không có nhà cung cấp'}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedReceipt(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="mb-5 grid grid-cols-1 gap-3 rounded-xl bg-slate-50 p-4 text-sm md:grid-cols-3">
              <div><span className="text-slate-500">Trạng thái:</span> <strong>{getStatusLabel(selectedReceipt.status)}</strong></div>
              <div><span className="text-slate-500">Người tạo:</span> <strong>{selectedReceipt.createdByName || '—'}</strong></div>
              <div><span className="text-slate-500">Người duyệt:</span> <strong>{selectedReceipt.reviewedByName || '—'}</strong></div>
              <div><span className="text-slate-500">Chứng từ NCC:</span> <strong>{selectedReceipt.supplierDocumentNumber || '—'}</strong></div>
              <div><span className="text-slate-500">Ngày nhận:</span> <strong>{selectedReceipt.receivedDate ? formatVietnamDateTime(selectedReceipt.receivedDate) : '—'}</strong></div>
              <div><span className="text-slate-500">Phiếu nhập kho:</span> <strong>{selectedReceipt.stockImportSlipCode || '—'}</strong></div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-100">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">SKU</th>
                    <th className="px-4 py-3">Tên hàng</th>
                    <th className="px-4 py-3">Loại</th>
                    <th className="px-4 py-3 text-right">SL gốc</th>
                    <th className="px-4 py-3">Mã lô</th>
                    <th className="px-4 py-3">Batch</th>
                    <th className="px-4 py-3">Kho trước → sau</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedReceipt.items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-3 font-mono font-semibold text-[#356647]">{item.skuCode}</td>
                      <td className="px-4 py-3">{item.skuNameSnapshot}</td>
                      <td className="px-4 py-3">{item.productTypeSnapshot}</td>
                      <td className="px-4 py-3 text-right">{formatStockQuantity(item.quantity)} {item.inventoryUnitSnapshot}</td>
                      <td className="px-4 py-3 font-mono">{item.lotCode}</td>
                      <td className="px-4 py-3 font-mono">{item.warehouseBatchLotCode || '—'}</td>
                      <td className="px-4 py-3">
                        {item.warehouseQtyBefore == null ? '—' : `${formatStockQuantity(item.warehouseQtyBefore)} → ${formatStockQuantity(item.warehouseQtyAfter)}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </PageShell>
  )
}

export default SupplierReceiptsPage
