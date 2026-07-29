import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import PageHeader from '../../../components/shared/PageHeader.jsx'
import PageShell from '../../../components/shared/PageShell.jsx'
import TablePagination, { TABLE_PAGE_SIZE } from '../../../components/shared/TablePagination.jsx'
import { showError, showSuccess } from '../../../app/toast.js'
import { formatVietnamDateTime } from '../../../utils/vietnamDateTime.js'
import { formatVnd } from '../../../utils/vietnamCurrency.js'
import { formatStockQuantity } from '../../products/utils/productDisplay.js'
import { loadAuthSession } from '../../auth/services/authSession.js'
import { canOperateSupplierReceipt, canReviewSupplierReceipt } from '../../auth/utils/permissions.js'
import InventoryNavTabs from '../components/InventoryNavTabs.jsx'
import SupplierReceiptDocument from '../components/SupplierReceiptDocument.jsx'
import {
  approveSupplierReceipt,
  cancelSupplierReceipt,
  fetchSupplierReceiptById,
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

function formatReceiptAmount(receipt) {
  if (!receipt.items?.some((item) => item.unitCost !== null && item.unitCost !== undefined)) return '—'
  return formatVnd(receipt.totalAmount || 0)
}

function SupplierReceiptsPage() {
  const { receiptId } = useParams()
  const [searchInput, setSearchInput] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(TABLE_PAGE_SIZE)
  const [data, setData] = useState({ items: [], totalItems: 0, totalPages: 1 })
  const [isLoading, setIsLoading] = useState(true)
  const [actionId, setActionId] = useState(null)
  const [detailReceipt, setDetailReceipt] = useState(null)
  const [detailError, setDetailError] = useState('')
  const [isDetailLoading, setIsDetailLoading] = useState(Boolean(receiptId))
  const session = loadAuthSession()
  const canOperate = canOperateSupplierReceipt(session)
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
    if (receiptId) return undefined
    const timer = setTimeout(loadReceipts, 250)
    return () => clearTimeout(timer)
  }, [loadReceipts, receiptId])

  useEffect(() => {
    if (!receiptId) return undefined
    let cancelled = false
    setIsDetailLoading(true)
    setDetailError('')
    fetchSupplierReceiptById(receiptId)
      .then((receipt) => {
        if (!cancelled) setDetailReceipt(receipt)
      })
      .catch(() => {
        if (cancelled) return
        const message = 'Không tìm thấy Phiếu nhập nguồn.'
        setDetailError(message)
        showError(message)
      })
      .finally(() => {
        if (!cancelled) setIsDetailLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [receiptId])

  async function runAction(receipt, action, successMessage) {
    setActionId(`${receipt.id}:${action.name}`)
    try {
      const updated = await action(receipt.id)
      showSuccess(successMessage(updated))
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

  if (receiptId) {
    return (
      <PageShell>
        <PageHeader
          title="Chi tiết Phiếu nhập nhà cung cấp"
          titleInfo="Màn hình read-only dùng cho Warehouse, Manager, Admin và Accountant."
          rightContent={(
            <>
              <Link
                to="/inventory/supplier-receipts"
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                Danh sách Phiếu nhập
              </Link>
              <InventoryNavTabs />
            </>
          )}
        />
        {isDetailLoading ? (
          <p className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-500">Đang tải Phiếu nhập...</p>
        ) : detailError || !detailReceipt ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-6 text-sm text-amber-800">
            {detailError || 'Không tìm thấy Phiếu nhập nguồn.'}
          </p>
        ) : (
          <SupplierReceiptDocument receipt={detailReceipt} />
        )}
      </PageShell>
    )
  }

  return (
    <PageShell>
      <PageHeader
        title="Phiếu nhập nhà cung cấp"
        titleInfo="Phiếu nhập từ NCC theo quy trình Nháp → Chờ duyệt → Đã nhận. Tồn Kho chỉ tăng khi phiếu được duyệt."
        searchPlaceholder="Tìm mã phiếu, nhà cung cấp, SKU, mã lô..."
        searchValue={searchInput}
        onSearchChange={handleSearchChange}
        rightContent={(
          <>
            {canOperate ? (
              <Link
                to="/inventory/import/create"
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#538463] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#457053]"
              >
                <span className="material-symbols-outlined text-[18px]">add</span>
                Tạo Phiếu Nhập
              </Link>
            ) : null}
            <InventoryNavTabs />
          </>
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
                <th className="px-4 py-3 text-right">Tổng tiền</th>
                <th className="px-4 py-3">Trạng thái</th>
                <th className="px-4 py-3">Người tạo</th>
                <th className="px-4 py-3">Thời gian</th>
                <th className="px-4 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="px-6 py-8 text-slate-500">Đang tải...</td>
                </tr>
              ) : data.items.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-8 text-slate-500">Chưa có phiếu nhập nhà cung cấp.</td>
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
                    <td className="px-4 py-4 text-right font-semibold text-slate-800">{formatReceiptAmount(receipt)}</td>
                    <td className="px-4 py-4">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusClass(receipt.status)}`}>
                        {getStatusLabel(receipt.status)}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-slate-700">{receipt.createdByName || '—'}</td>
                    <td className="px-4 py-4 text-slate-600">{formatVietnamDateTime(receipt.createdAt)}</td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Link
                          to={`/inventory/supplier-receipts/${receipt.id}`}
                          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Chi tiết
                        </Link>
                        {canOperate && isOwnReceipt(receipt) && (receipt.status === 'draft' || receipt.status === 'rejected') ? (
                          <Link
                            to={`/inventory/import/create?receiptId=${receipt.id}`}
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            Chỉnh sửa
                          </Link>
                        ) : null}
                        {canOperate && isOwnReceipt(receipt) && (receipt.status === 'draft' || receipt.status === 'rejected') ? (
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
                        {canOperate && isOwnReceipt(receipt) && receipt.status === 'draft' ? (
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

    </PageShell>
  )
}

export default SupplierReceiptsPage
