import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import OpsActionQueue from '../../../components/shared/OpsActionQueue.jsx'
import PageHeader from '../../../components/shared/PageHeader.jsx'
import PageShell from '../../../components/shared/PageShell.jsx'
import StatusFilterChips from '../../../components/shared/StatusFilterChips.jsx'
import TablePagination from '../../../components/shared/TablePagination.jsx'
import { useTotalAwarePageSize } from '../../../utils/totalAwarePageSize.js'
import { showError } from '../../../app/toast.js'
import { canAccessPath, canCancelStockDeduct, canConfirmStockDeduct } from '../../../app/navigation.js'
import { loadAuthSession } from '../../auth/services/authSession.js'
import { applyStatusCounts } from '../../../utils/statusFilterCounts.js'
import { formatVietnamDateTime } from '../../../utils/vietnamDateTime.js'
import StockDeductPreviewModal from '../components/StockDeductPreviewModal.jsx'
import CustomBundlePreviewModal from '../components/CustomBundlePreviewModal.jsx'
import { fetchPendingStockDeductQueues } from '../services/stockDeductQueueApi.js'
import { fetchCustomBundles, fetchPendingCustomBundles } from '../../orders/services/customBundleApi.js'
import {
  formatVnd,
  getQueueStatusLabel,
  getStockStatusClass,
  getStockStatusLabel,
  resolveStockDeductOrderStatusMeta,
  STOCK_DEDUCT_REMAINING_QTY_LABEL,
} from '../../orders/utils/orderDisplay.js'

const TABS = [
  { value: 'waiting', label: 'Chờ đóng gói', status: 'waiting' },
  { value: 'insufficient', label: 'Chờ hàng', status: 'insufficient' },
  { value: 'confirmed', label: 'Đã trừ', status: 'confirmed' },
  { value: 'cancelled', label: 'Đã hủy', status: 'cancelled' },
  { value: 'all', label: 'Tất cả', status: undefined },
]

function getStockDeductTabLabel(tab) {
  if (tab?.value === 'waiting') return 'Chờ đóng gói'
  if (tab?.value === 'insufficient') return 'Chờ hàng'
  return tab?.label ?? ''
}

/** Đọc count từ statusCounts API không phân biệt hoa/thường (key có thể là enum string). */
function readCount(statusCounts, key) {
  if (!statusCounts) return 0
  const found = Object.entries(statusCounts).find(([k]) => String(k).toLowerCase() === key.toLowerCase())
  return found ? Number(found[1]) || 0 : 0
}

function mapCustomBundleToQueueRow(bundle, { packed = false } = {}) {
  const orderStatus = String(bundle.orderStatus || '')
  const waitingMaterials = orderStatus.toLowerCase() === 'waitingmaterials'
  return {
    rowKind: 'custom',
    queueId: `custom:${bundle.id}`,
    bundleId: bundle.id,
    orderId: bundle.orderId,
    orderCode: bundle.orderCode || bundle.orderId?.slice?.(0, 8) || '—',
    queueStatus: packed ? 'Confirmed' : (waitingMaterials ? 'Insufficient' : 'Waiting'),
    orderStockStatus: packed ? 'custom_packed' : (waitingMaterials ? 'waiting_materials' : 'pending_custom_pack'),
    orderPaymentStatus: orderStatus || 'WaitingProduction',
    createdAt: packed ? (bundle.packedAt || bundle.createdAt) : bundle.createdAt,
    totalAmount: bundle.totalPrice,
    isReserved: false,
    label: bundle.label,
    packedAt: bundle.packedAt,
    lines: (bundle.ingredients || []).map((ing) => ({
      skuId: ing.materialSkuId,
      skuCode: ing.materialSkuCode,
      skuName: ing.materialSnapshotName,
      orderedQuantity: ing.quantity,
      finishedDeductedQuantity: packed ? ing.quantity : 0,
      pendingBomQuantity: packed ? 0 : ing.quantity,
    })),
  }
}

function StockDeductQueuePage() {
  const session = loadAuthSession()
  const canExecuteDeduct = canConfirmStockDeduct(session)
  const canCancelQueue = canCancelStockDeduct(session)
  const canOpenOrders = canAccessPath(session, '/orders')
  const [searchParams, setSearchParams] = useSearchParams()
  const tabFromUrl = searchParams.get('tab')
  const [activeTab, setActiveTab] = useState(
    TABS.some((t) => t.value === tabFromUrl) ? tabFromUrl : 'waiting',
  )
  const [searchValue, setSearchValue] = useState('')
  const [queues, setQueues] = useState([])
  const [statusCounts, setStatusCounts] = useState(null)
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const { pageSize, setPageSize, pageSizeOptions } = useTotalAwarePageSize(totalCount)

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil((totalCount || 0) / pageSize) || 1)
    if (page > totalPages) setPage(totalPages)
  }, [totalCount, pageSize, page])
  const [isLoading, setIsLoading] = useState(true)
  const [previewQueue, setPreviewQueue] = useState(null)
  const [previewCustom, setPreviewCustom] = useState(null)

  const tabChipOptions = useMemo(() => {
    if (!statusCounts) return TABS.map((tab) => ({ value: tab.value, label: getStockDeductTabLabel(tab) }))
    const seen = new Set()
    let all = 0
    for (const [key, value] of Object.entries(statusCounts)) {
      const lower = String(key).toLowerCase()
      if (seen.has(lower)) continue
      seen.add(lower)
      all += Number(value) || 0
    }
    return applyStatusCounts(
      TABS.map((tab) => ({ value: tab.value, label: getStockDeductTabLabel(tab) })),
      { ...statusCounts, all },
    )
  }, [statusCounts])

  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const tab = TABS.find((t) => t.value === activeTab)
      const includePendingCustom = activeTab === 'waiting' || activeTab === 'insufficient' || activeTab === 'all'
      const includePackedCustom = activeTab === 'confirmed' || activeTab === 'all'
      const [queuePage, customPendingPage, customPackedPage] = await Promise.all([
        fetchPendingStockDeductQueues({
          status: tab?.status,
          search: searchValue.trim() || undefined,
          page,
          pageSize,
        }),
        includePendingCustom
          ? fetchPendingCustomBundles({ page: 1, pageSize: 100 }).catch(() => ({ items: [], totalCount: 0 }))
          : Promise.resolve({ items: [], totalCount: 0 }),
        includePackedCustom
          ? fetchCustomBundles({ page: 1, pageSize: 100, packingStatus: 'Packed' }).catch(() => ({ items: [], totalCount: 0 }))
          : Promise.resolve({ items: [], totalCount: 0 }),
      ])

      const search = searchValue.trim().toLowerCase()
      let customRows = (customPendingPage.items || []).map((b) => mapCustomBundleToQueueRow(b))
      let packedCustomRows = (customPackedPage.items || []).map((b) => mapCustomBundleToQueueRow(b, { packed: true }))
      if (search) {
        const match = (row) =>
          String(row.orderCode || '').toLowerCase().includes(search)
          || String(row.label || '').toLowerCase().includes(search)
        customRows = customRows.filter(match)
        packedCustomRows = packedCustomRows.filter(match)
      }
      if (activeTab === 'waiting') {
        customRows = customRows.filter((row) => row.queueStatus === 'Waiting')
      } else if (activeTab === 'insufficient') {
        customRows = customRows.filter((row) => row.queueStatus === 'Insufficient')
      }

      // Trang 1: hiện gói custom trước queue TP; trang sau chỉ queue (tránh lặp custom).
      const customForTab = activeTab === 'confirmed'
        ? packedCustomRows
        : activeTab === 'all'
          ? [...customRows, ...packedCustomRows]
          : customRows
      const merged = page === 1 ? [...customForTab, ...(queuePage.items || [])] : (queuePage.items || [])
      setQueues(merged)
      setTotalCount((queuePage.totalCount || 0) + customForTab.length)

      const customWaiting = (customPendingPage.items || []).filter(
        (b) => String(b.orderStatus || '').toLowerCase() !== 'waitingmaterials',
      ).length
      const customInsufficient = (customPendingPage.items || []).filter(
        (b) => String(b.orderStatus || '').toLowerCase() === 'waitingmaterials',
      ).length
      const baseCounts = { ...(queuePage.statusCounts || {}) }
      const bump = (key, delta) => {
        const found = Object.keys(baseCounts).find((k) => k.toLowerCase() === key.toLowerCase())
        if (found) baseCounts[found] = (Number(baseCounts[found]) || 0) + delta
        else if (delta) baseCounts[key] = delta
      }
      bump('Waiting', customWaiting)
      bump('Insufficient', customInsufficient)
      bump('Confirmed', packedCustomRows.length)
      setStatusCounts(baseCounts)
    } catch (error) {
      setQueues([])
      setTotalCount(0)
      setStatusCounts(null)
      showError(error.message)
    } finally {
      setIsLoading(false)
    }
  }, [activeTab, searchValue, page, pageSize])

  useEffect(() => {
    const timer = setTimeout(() => {
      loadData()
    }, 250)
    return () => clearTimeout(timer)
  }, [loadData])

  useEffect(() => {
    const urlTab = searchParams.get('tab')
    if (urlTab && TABS.some((t) => t.value === urlTab) && urlTab !== activeTab) {
      setActiveTab(urlTab)
      setPage(1)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  const selectTab = useCallback((value) => {
    setActiveTab(value)
    setPage(1)
    const next = new URLSearchParams(searchParams)
    if (value === 'waiting') next.delete('tab')
    else next.set('tab', value)
    setSearchParams(next, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  const waitingCount = readCount(statusCounts, 'waiting')
  const insufficientCount = readCount(statusCounts, 'insufficient')

  const actionItems = useMemo(
    () => [
      canExecuteDeduct && {
        id: 'confirm-waiting',
        title: 'Xác nhận đóng gói',
        hint: 'Yêu cầu đang chờ đóng gói / trừ Kho',
        icon: 'inventory_2',
        iconBg: 'bg-[#eaf4eb]',
        iconColor: 'text-[#356647]',
        count: waitingCount,
        onClick: () => selectTab('waiting'),
      },
      {
        id: 'insufficient-material',
        title: 'Chờ hàng',
        hint: 'Thiếu tồn Kệ/Kho / nguyên liệu custom, chưa thể trừ',
        icon: 'warning',
        iconBg: 'bg-amber-50',
        iconColor: 'text-amber-700',
        count: insufficientCount,
        onClick: () => selectTab('insufficient'),
      },
      canOpenOrders && {
        id: 'view-orders',
        title: 'Xem tất cả đơn hàng',
        hint: 'Theo dõi toàn bộ đơn hàng trong hệ thống',
        icon: 'receipt_long',
        alwaysShow: true,
        to: '/orders',
      },
    ].filter(Boolean),
    [canExecuteDeduct, canOpenOrders, waitingCount, insufficientCount, selectTab],
  )

  return (
    <PageShell className="gap-1.5 sm:gap-1.5">
      <PageHeader
        compact
        title="Chờ đóng gói / trừ Kho"
        titleInfo={
          canExecuteDeduct
            ? 'Thủ kho xác nhận đóng gói thành phẩm (queue) và gói custom (trừ NL Kho).'
            : canCancelQueue
              ? 'Theo dõi yêu cầu đóng gói; Quản lý hoặc Admin chỉ hủy khi xử lý ngoại lệ.'
              : 'Theo dõi yêu cầu đóng gói theo quyền được cấp.'
        }
        searchPlaceholder="Tìm mã đơn..."
        searchValue={searchValue}
        onSearchChange={(value) => {
          setSearchValue(value)
          setPage(1)
        }}
      />

      <OpsActionQueue items={actionItems} layout="horizontal" />

      <div className="flex flex-wrap items-center gap-3">
        <StatusFilterChips
          options={tabChipOptions}
          value={activeTab}
          onChange={selectTab}
        />
        {canOpenOrders ? (
          <Link
            className="ml-auto rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            to="/orders"
          >
            Tất cả đơn hàng
          </Link>
        ) : null}
      </div>

      <section className="rounded-3xl border border-slate-100 bg-white shadow-sm">
        <div className="border-b border-slate-50 p-6">
          <h2 className="text-xl font-bold text-slate-800">
            {getStockDeductTabLabel(TABS.find((t) => t.value === activeTab))}
          </h2>
        </div>

        <div className="custom-scrollbar overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-[#fbf9f1]/50 text-xs font-bold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-8 py-4">Mã đơn</th>
                <th className="px-4 py-4">Trạng thái đóng gói</th>
                <th className="px-4 py-4">Tồn cần đối soát</th>
                <th className="px-4 py-4">Trạng thái đơn</th>
                <th className="px-4 py-4">Ngày tạo yêu cầu</th>
                <th className="px-8 py-4 text-right">Tổng tiền</th>
                <th className="px-4 py-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {isLoading ? (
                <tr>
                  <td className="px-8 py-10 text-center text-slate-500" colSpan={7}>
                    <span className="inline-flex items-center gap-2 text-sm font-semibold">
                      <span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>
                      Đang tải yêu cầu đóng gói...
                    </span>
                  </td>
                </tr>
              ) : null}
              {!isLoading && queues.length === 0 ? (
                <tr>
                  <td className="px-8 py-12 text-center" colSpan={7}>
                    <p className="font-semibold text-slate-800">
                      {searchValue.trim() || activeTab !== 'waiting'
                        ? 'Không có yêu cầu trong mục này'
                        : 'Chưa có yêu cầu chờ đóng gói'}
                    </p>
                    <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
                      {searchValue.trim() || activeTab !== 'waiting'
                        ? 'Thử đổi tab hoặc xóa mã đơn đang tìm.'
                        : 'Đơn bán vượt tồn Kệ hoặc gói custom chờ đóng gói sẽ hiện tại đây.'}
                    </p>
                    <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                      {searchValue.trim() || activeTab !== 'waiting' ? (
                        <button
                          type="button"
                          onClick={() => {
                            setSearchValue('')
                            selectTab('waiting')
                          }}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
                        >
                          <span className="material-symbols-outlined text-[18px]">filter_alt_off</span>
                          Về mục chờ đóng gói
                        </button>
                      ) : null}
                      {canOpenOrders ? (
                        <Link
                          to="/orders"
                          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
                        >
                          <span className="material-symbols-outlined text-[18px]">receipt_long</span>
                          Xem đơn hàng
                        </Link>
                      ) : null}
                      <Link
                        to="/inventory"
                        className="inline-flex items-center gap-1.5 rounded-xl bg-[#538463] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#457053]"
                      >
                        <span className="material-symbols-outlined text-[18px]">warehouse</span>
                        Kiểm tra tồn Kho
                      </Link>
                    </div>
                  </td>
                </tr>
              ) : null}
              {!isLoading
                ? queues.map((row) => {
                    const orderStatusMeta = resolveStockDeductOrderStatusMeta(
                      row.orderPaymentStatus,
                      row.orderStockStatus,
                    )
                    return (
                    <tr key={row.queueId} className="transition-colors hover:bg-[#fbf9f1]/30">
                      <td className="px-8 py-5 font-bold text-slate-700">
                        {canOpenOrders ? (
                          <Link className="hover:text-[#538463] hover:underline" to={`/orders/${row.orderId}`}>
                            {row.orderCode}
                          </Link>
                        ) : (
                          <span>{row.orderCode}</span>
                        )}
                        {row.rowKind === 'custom' ? (
                          <span className="ml-2 inline-flex rounded-full bg-[#e8f0e9] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#356647]">
                            Custom{row.label ? ` · ${row.label}` : ''}
                          </span>
                        ) : null}
                        {row.lines?.length ? (
                          <div className="mt-2 space-y-1 text-xs font-medium text-slate-500">
                            {row.lines.slice(0, 2).map((line) => (
                              <p key={line.skuId}>
                                {row.rowKind === 'custom'
                                  ? `${line.skuCode || line.skuName}: ×${line.orderedQuantity}`
                                  : `${line.skuCode || line.skuName}: bán ${line.orderedQuantity}, đã trừ ${line.finishedDeductedQuantity}, ${STOCK_DEDUCT_REMAINING_QTY_LABEL.toLowerCase()} ${line.pendingBomQuantity}`}
                              </p>
                            ))}
                            {row.lines.length > 2 ? <p>+{row.lines.length - 2} dòng khác</p> : null}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-5">
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                          {row.rowKind === 'custom'
                            ? (row.queueStatus === 'Confirmed'
                              ? 'Đã đóng gói custom'
                              : row.queueStatus === 'Insufficient'
                                ? 'Chờ hàng (custom)'
                                : 'Chờ đóng gói custom')
                            : getQueueStatusLabel(row.queueStatus)}
                        </span>
                        {row.isReserved ? (
                          <span
                            className="mt-1 block w-fit rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700"
                            title="Đơn COD đang giữ chỗ tồn Kệ Hàng — tồn khả bán đã trừ phần giữ chỗ này"
                          >
                            Đang giữ chỗ tồn
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-5">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${getStockStatusClass(row.orderStockStatus)}`}
                        >
                          {row.rowKind === 'custom' && row.orderStockStatus === 'pending_custom_pack'
                            ? 'Gói custom'
                            : row.rowKind === 'custom' && row.orderStockStatus === 'custom_packed'
                              ? 'Đã trừ NL custom'
                              : getStockStatusLabel(row.orderStockStatus)}
                        </span>
                      </td>
                      <td className="px-4 py-5">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${orderStatusMeta.className}`}
                        >
                          {orderStatusMeta.label}
                        </span>
                      </td>
                      <td className="px-4 py-5 text-sm text-slate-600">
                        {formatVietnamDateTime(row.createdAt)}
                      </td>
                      <td className="px-8 py-5 text-right font-bold text-slate-800">
                        {formatVnd(row.totalAmount)}
                      </td>
                      <td className="px-4 py-5 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            if (row.rowKind === 'custom') {
                              setPreviewCustom({
                                ...row,
                                readOnly: row.queueStatus === 'Confirmed',
                              })
                            } else setPreviewQueue(row)
                          }}
                          className={`rounded-lg px-3 py-1.5 text-xs font-bold text-white ${
                            canExecuteDeduct && row.queueStatus !== 'cancelled' && row.queueStatus !== 'Confirmed'
                              ? 'bg-[#538463] hover:bg-[#457053]'
                              : 'bg-slate-500 hover:bg-slate-600'
                          }`}
                        >
                          {row.queueStatus === 'cancelled'
                            ? 'Xem'
                            : row.queueStatus === 'Confirmed'
                              ? 'Xem chi tiết'
                              : canExecuteDeduct
                                ? 'Xem & xác nhận'
                                : canCancelQueue
                                  ? 'Xem & xử lý ngoại lệ'
                                  : 'Xem'}
                        </button>
                      </td>
                    </tr>
                    )
                  })
                : null}
            </tbody>
          </table>
        </div>
        <TablePagination
          page={page}
          pageSize={pageSize}
          pageSizeOptions={pageSizeOptions}
          totalCount={totalCount}
          itemLabel="yêu cầu đóng gói"
          onPageChange={setPage}
          onPageSizeChange={(size) => { setPageSize(size); setPage(1) }}
        />
      </section>

      {previewQueue && previewQueue.rowKind !== 'custom' ? (
        <StockDeductPreviewModal
          queueId={previewQueue.queueId}
          orderCode={previewQueue.orderCode}
          orderPaymentStatus={previewQueue.orderPaymentStatus}
          canConfirm={canExecuteDeduct}
          canCancel={canCancelQueue}
          onClose={() => setPreviewQueue(null)}
          onConfirmed={loadData}
        />
      ) : null}

      {previewCustom ? (
        <CustomBundlePreviewModal
          bundleId={previewCustom.bundleId}
          orderCode={previewCustom.orderCode}
          orderId={previewCustom.orderId}
          orderStatus={previewCustom.orderPaymentStatus}
          orderStockStatus={previewCustom.orderStockStatus}
          canConfirm={canExecuteDeduct && !previewCustom.readOnly}
          onClose={() => setPreviewCustom(null)}
          onConfirmed={loadData}
        />
      ) : null}
    </PageShell>
  )
}

export default StockDeductQueuePage
