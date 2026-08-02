import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import PageHeader from '../../../components/shared/PageHeader.jsx'
import PageShell from '../../../components/shared/PageShell.jsx'
import TablePagination, { TABLE_PAGE_SIZE } from '../../../components/shared/TablePagination.jsx'
import { promptDialog } from '../../../app/dialog.js'
import { showError, showSuccess } from '../../../app/toast.js'
import { getReasonSuggestions } from '../../shared/reasonSuggestions.js'
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

const ACTION_BTN =
  'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-40'

function ReceiptRowActions({
  receipt,
  canOperate,
  canReview,
  isOwn,
  actionId,
  onSubmit,
  onApprove,
  onReject,
  onCancel,
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 })
  const menuRef = useRef(null)
  const triggerRef = useRef(null)
  const busy = actionId === receipt.id
  const anyBusy = Boolean(actionId)

  const canEdit = canOperate && isOwn && (receipt.status === 'draft' || receipt.status === 'rejected')
  const canSubmit = canEdit
  const canCancel = canOperate && isOwn && receipt.status === 'draft'
  const canDecide = canReview && receipt.status === 'pendingapproval' && !isOwn
  const hasMenu = canEdit || canSubmit || canCancel || canDecide

  function updateMenuPosition() {
    const rect = triggerRef.current?.getBoundingClientRect()
    if (!rect) return
    setMenuPos({
      top: rect.bottom + 4,
      right: Math.max(8, window.innerWidth - rect.right),
    })
  }

  useEffect(() => {
    if (!menuOpen) return undefined
    updateMenuPosition()
    function onPointerDown(event) {
      if (
        !menuRef.current?.contains(event.target)
        && !triggerRef.current?.contains(event.target)
      ) {
        setMenuOpen(false)
      }
    }
    function onKeyDown(event) {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    function onReposition() {
      updateMenuPosition()
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('resize', onReposition)
    window.addEventListener('scroll', onReposition, true)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('resize', onReposition)
      window.removeEventListener('scroll', onReposition, true)
    }
  }, [menuOpen])

  function runAction(action) {
    setMenuOpen(false)
    action()
  }

  return (
    <div className="mx-auto inline-grid grid-cols-2 items-center justify-items-center gap-0.5">
      <Link
        to={`/inventory/supplier-receipts/${receipt.id}`}
        title="Chi tiết"
        aria-label="Chi tiết"
        className={ACTION_BTN}
      >
        <span className="material-symbols-outlined text-[18px]">visibility</span>
      </Link>

      {hasMenu ? (
        <button
          ref={triggerRef}
          type="button"
          title="Thao tác khác"
          aria-label="Thao tác khác"
          aria-expanded={menuOpen}
          disabled={anyBusy && !busy}
          onClick={() => {
            if (!menuOpen) updateMenuPosition()
            setMenuOpen((open) => !open)
          }}
          className={`${ACTION_BTN} ${menuOpen ? 'bg-slate-100 text-slate-800' : ''}`}
        >
          <span className={`material-symbols-outlined text-[18px] ${busy ? 'animate-spin' : ''}`}>
            {busy ? 'progress_activity' : 'more_horiz'}
          </span>
        </button>
      ) : (
        <span className="inline-block h-8 w-8" aria-hidden="true" />
      )}

      {menuOpen && hasMenu ? (
        <div
          ref={menuRef}
          role="menu"
          style={{ top: menuPos.top, right: menuPos.right }}
          className="fixed z-50 min-w-[11rem] overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
        >
          {canEdit ? (
            <Link
              role="menuitem"
              to={`/inventory/import/create?receiptId=${receipt.id}`}
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              <span className="material-symbols-outlined text-[16px] text-[#356647]">edit</span>
              Chỉnh sửa
            </Link>
          ) : null}
          {canSubmit ? (
            <button
              type="button"
              role="menuitem"
              disabled={anyBusy}
              onClick={() => runAction(onSubmit)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[16px] text-[#356647]">send</span>
              Gửi duyệt
            </button>
          ) : null}
          {canDecide ? (
            <>
              <button
                type="button"
                role="menuitem"
                disabled={anyBusy}
                onClick={() => runAction(onApprove)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[16px]">check_circle</span>
                Duyệt
              </button>
              <button
                type="button"
                role="menuitem"
                disabled={anyBusy}
                onClick={() => runAction(onReject)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50 disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[16px]">cancel</span>
                Từ chối
              </button>
            </>
          ) : null}
          {canCancel ? (
            <button
              type="button"
              role="menuitem"
              disabled={anyBusy}
              onClick={() => runAction(onCancel)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[16px]">delete</span>
              Hủy
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
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
    const reason = await promptDialog({
      title: 'Nhập lý do',
      message: 'Nhập lý do hủy phiếu nhập',
      required: true,
      tone: 'danger',
      suggestions: getReasonSuggestions('supplierReceiptCancel'),
    })
    if (reason == null) return
    await runAction(receipt, (id) => cancelSupplierReceipt(id, reason), (updated) => `Đã hủy ${updated.receiptCode}.`)
  }

  async function handleSubmitForApproval(receipt) {
    await runAction(receipt, submitSupplierReceipt, (updated) => `Đã gửi duyệt ${updated.receiptCode}. Tồn kho chưa thay đổi.`)
  }

  async function handleApprove(receipt) {
    await runAction(receipt, approveSupplierReceipt, (updated) => `Đã duyệt ${updated.receiptCode}. Tồn Kho đã được cập nhật.`)
  }

  async function handleReject(receipt) {
    const reason = await promptDialog({
      title: 'Nhập lý do',
      message: 'Nhập lý do từ chối phiếu nhập',
      required: true,
      tone: 'danger',
      suggestions: getReasonSuggestions('supplierReceiptReject'),
    })
    if (reason == null) return
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

      <section className="rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] table-fixed text-left text-sm">
            <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="w-[11%] px-4 py-3 xl:px-6">Mã phiếu</th>
                <th className="w-[16%] px-3 py-3 xl:px-4">Nhà cung cấp</th>
                <th className="w-[16%] px-3 py-3 xl:px-4">Nội dung</th>
                <th className="w-[9%] px-3 py-3 text-right xl:px-4">Số lượng</th>
                <th className="w-[11%] px-3 py-3 text-right xl:px-4">Tổng tiền</th>
                <th className="w-[10%] px-3 py-3 xl:px-4">Trạng thái</th>
                <th className="w-[10%] px-3 py-3 xl:px-4">Người tạo</th>
                <th className="w-[12%] px-3 py-3 xl:px-4">Thời gian</th>
                <th className="sticky right-0 z-10 w-[4.75rem] bg-slate-50 px-1 py-3 text-center shadow-[-6px_0_8px_-6px_rgba(15,23,42,0.12)]">
                  Thao tác
                </th>
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
                data.items.map((receipt) => {
                  const itemSummary = getItemSummary(receipt)
                  return (
                    <tr key={receipt.id} className="group hover:bg-slate-50/80">
                      <td className="truncate px-4 py-3 font-mono text-xs font-semibold text-[#356647] xl:px-6 xl:text-sm">
                        {receipt.receiptCode}
                      </td>
                      <td className="truncate px-3 py-3 text-slate-700 xl:px-4" title={receipt.supplierName || ''}>
                        {receipt.supplierName || '—'}
                      </td>
                      <td className="truncate px-3 py-3 text-slate-700 xl:px-4" title={itemSummary}>
                        {itemSummary}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right font-semibold text-slate-800 xl:px-4">
                        {formatStockQuantity(receipt.totalQuantity)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right font-semibold text-slate-800 xl:px-4">
                        {formatReceiptAmount(receipt)}
                      </td>
                      <td className="px-3 py-3 xl:px-4">
                        <span className={`inline-flex max-w-full truncate rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusClass(receipt.status)}`}>
                          {getStatusLabel(receipt.status)}
                        </span>
                      </td>
                      <td className="truncate px-3 py-3 text-slate-700 xl:px-4" title={receipt.createdByName || ''}>
                        {receipt.createdByName || '—'}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-xs text-slate-600 xl:px-4 xl:text-sm">
                        {formatVietnamDateTime(receipt.createdAt)}
                      </td>
                      <td className="sticky right-0 z-10 bg-white px-1 py-2 text-center shadow-[-6px_0_8px_-6px_rgba(15,23,42,0.12)] group-hover:bg-slate-50">
                        <div className="flex justify-center">
                          <ReceiptRowActions
                            receipt={receipt}
                            canOperate={canOperate}
                            canReview={canReview}
                            isOwn={isOwnReceipt(receipt)}
                            actionId={actionId}
                            onSubmit={() => handleSubmitForApproval(receipt)}
                            onApprove={() => handleApprove(receipt)}
                            onReject={() => handleReject(receipt)}
                            onCancel={() => handleCancel(receipt)}
                          />
                        </div>
                      </td>
                    </tr>
                  )
                })
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
