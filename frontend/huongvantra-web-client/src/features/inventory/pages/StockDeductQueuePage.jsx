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
import { parseApiDateTime } from '../../../utils/vietnamDateTime.js'
import StockDeductPreviewModal from '../components/StockDeductPreviewModal.jsx'
import CustomBundlePreviewModal from '../components/CustomBundlePreviewModal.jsx'
import { fetchPendingStockDeductQueues } from '../services/stockDeductQueueApi.js'
import { fetchCustomBundles, fetchPendingCustomBundles } from '../../orders/services/customBundleApi.js'
import {
  getStockStatusClass,
  getStockStatusLabel,
  resolveStockDeductOrderStatusMeta,
} from '../../orders/utils/orderDisplay.js'
import { PERSONAL_PRODUCT_LABEL } from '../../orders/utils/personalProductLabels.js'

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

function getCreatedAtSortValue(row) {
  return parseApiDateTime(row?.createdAt)?.getTime() || 0
}

function getStockDeductLineSummary(line) {
  const isBackorder = String(line.stockHandlingMode || '').toLowerCase().includes('backorder')
  const scheduledDeliveryQuantity = isBackorder
    ? Math.max(0, line.orderedQuantity - line.finishedDeductedQuantity - line.warehouseTransferQuantity)
    : 0
  const canSanXuat = isBackorder ? 0 : line.pendingBomQuantity

  return `đặt ${line.orderedQuantity}, đã trừ Kệ ${line.finishedDeductedQuantity}, lấy từ Kho ${line.warehouseTransferQuantity}, cần sản xuất ${canSanXuat}, hẹn giao sau ${scheduledDeliveryQuantity}`
}

/** Đọc count từ statusCounts API không phân biệt hoa/thường (key có thể là enum string). */
function readCount(statusCounts, key) {
  if (!statusCounts) return 0
  const found = Object.entries(statusCounts).find(([k]) => String(k).toLowerCase() === key.toLowerCase())
  return found ? Number(found[1]) || 0 : 0
}

function mapCustomBundleToQueueRow(bundle, { packed = false, cancelled = false } = {}) {
  const orderStatus = String(bundle.orderStatus || bundle.OrderStatus || '')
  const packing = String(bundle.packingStatus || bundle.PackingStatus || '').toLowerCase()
  const isCancelled = cancelled
    || packing === 'cancelled'
    || ['cancelled', 'cancellationrequested'].includes(orderStatus.toLowerCase())
  const orderId = bundle.orderId ?? bundle.OrderId ?? ''
  const orderCode = String(bundle.orderCode ?? bundle.OrderCode ?? '').trim()
  return {
    rowKind: 'custom',
    queueId: `custom:${bundle.id ?? bundle.Id}`,
    bundleId: bundle.id ?? bundle.Id,
    orderId,
    // Hiển thị: dùng mã đơn thật; thiếu thì rút gọn orderId (readOrderCode bỏ qua 8 hex → gộp bằng orderId).
    orderCode: orderCode || (orderId ? String(orderId).replace(/-/g, '').slice(0, 8) : '—'),
    queueStatus: isCancelled ? 'Cancelled' : packed ? 'Confirmed' : 'Waiting',
    orderStockStatus: isCancelled
      ? 'custom_cancelled'
      : packed
        ? 'custom_packed'
        : 'pending_custom_pack',
    orderPaymentStatus: orderStatus || (isCancelled ? 'Cancelled' : 'WaitingProduction'),
    createdAt: packed
      ? (bundle.packedAt || bundle.PackedAt || bundle.createdAt || bundle.CreatedAt)
      : (bundle.updatedAt || bundle.UpdatedAt || bundle.createdAt || bundle.CreatedAt),
    totalAmount: Number(bundle.totalPrice ?? bundle.TotalPrice ?? 0),
    isReserved: false,
    label: bundle.label ?? bundle.Label,
    packedAt: bundle.packedAt ?? bundle.PackedAt,
    lines: (bundle.ingredients || bundle.Ingredients || []).map((ing) => ({
      skuId: ing.materialSkuId ?? ing.MaterialSkuId,
      skuCode: ing.materialSkuCode ?? ing.MaterialSkuCode,
      skuName: ing.materialSnapshotName ?? ing.MaterialSnapshotName,
      orderedQuantity: ing.quantity ?? ing.Quantity,
      finishedDeductedQuantity: packed ? (ing.quantity ?? ing.Quantity) : 0,
      pendingBomQuantity: packed || isCancelled ? 0 : (ing.quantity ?? ing.Quantity),
    })),
  }
}

const EMPTY_GUID_COMPACT = '0'.repeat(32)

/** Chuẩn hóa Guid (bỏ dấu gạch) để so khớp giữa inventory / order service. */
function normalizeOrderId(value) {
  const compact = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[{}]/g, '')
    .replace(/-/g, '')
  if (!compact || compact === EMPTY_GUID_COMPACT) return ''
  return compact
}

function readOrderId(row) {
  return normalizeOrderId(row?.orderId ?? row?.OrderId)
}

function readOrderCode(row) {
  const code = String(row?.orderCode ?? row?.OrderCode ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
  if (!code || code === '—' || code === '-') return ''
  // Bỏ qua mã giả = 8 hex từ GUID (mapper cũ).
  if (/^[0-9a-f]{8}$/.test(code)) return ''
  return code
}

/** Khóa gộp: ưu tiên mã đơn thật; không có thì dùng orderId. */
function orderGroupKey(row) {
  const code = readOrderCode(row)
  if (code) return `code:${code}`
  const id = readOrderId(row)
  return id ? `id:${id}` : ''
}

function rowMatchesCatalogKeys(row, catalogKeys) {
  const code = readOrderCode(row)
  const id = readOrderId(row)
  if (code && catalogKeys.has(`code:${code}`)) return true
  if (id && catalogKeys.has(`id:${id}`)) return true
  return false
}

/** Gộp phiếu thành phẩm + gói cá nhân cùng đơn thành một dòng. */
function mergeCatalogAndCustomRows(catalogRows, customRows) {
  const byCode = new Map()
  const byOrderId = new Map()
  const uniqueGroups = []
  const ungrouped = []

  const register = (group, id, code) => {
    if (id) byOrderId.set(id, group)
    if (code) byCode.set(code, group)
  }

  const takeGroup = (row) => {
    const id = readOrderId(row)
    const code = readOrderCode(row)

    let group = (id && byOrderId.get(id)) || (code && byCode.get(code)) || null
    if (!group) {
      if (!id && !code) {
        ungrouped.push(row)
        return null
      }
      const key = code ? `code:${code}` : `id:${id}`
      group = {
        rowKind: 'mixed',
        queueId: `order:${key}`,
        orderId: row.orderId ?? row.OrderId,
        orderCode: row.orderCode ?? row.OrderCode,
        createdAt: row.createdAt ?? row.CreatedAt,
        catalog: null,
        customBundles: [],
        orderPaymentStatus: row.orderPaymentStatus ?? row.OrderPaymentStatus,
        orderStockStatus: row.orderStockStatus ?? row.OrderStockStatus,
        queueStatus: row.queueStatus ?? row.QueueStatus,
        totalAmount: Number(row.totalAmount ?? row.TotalAmount ?? 0),
      }
      uniqueGroups.push(group)
    }
    register(group, id, code)
    return group
  }

  for (const catalog of catalogRows) {
    const group = takeGroup(catalog)
    if (!group) continue
    // Nhiều phiếu thành phẩm cùng đơn → giữ phiếu mới hơn (đã sort trước khi merge thì last wins).
    group.catalog = catalog
    group.orderId = catalog.orderId ?? catalog.OrderId ?? group.orderId
    const realCode = catalog.orderCode || catalog.OrderCode
    if (realCode && realCode !== '—') group.orderCode = realCode
    group.createdAt = catalog.createdAt || catalog.CreatedAt || group.createdAt
    group.orderPaymentStatus = catalog.orderPaymentStatus || catalog.OrderPaymentStatus || group.orderPaymentStatus
    group.orderStockStatus = catalog.orderStockStatus || catalog.OrderStockStatus || group.orderStockStatus
    group.queueStatus = catalog.queueStatus || catalog.QueueStatus || group.queueStatus
    group.totalAmount = Number(catalog.totalAmount ?? catalog.TotalAmount ?? group.totalAmount ?? 0)
  }

  for (const custom of customRows) {
    const group = takeGroup(custom)
    if (!group) continue
    group.customBundles.push(custom)
    group.orderId = group.orderId || custom.orderId || custom.OrderId
    const customCode = custom.orderCode || custom.OrderCode
    if ((!group.orderCode || group.orderCode === '—') && customCode && customCode !== '—') {
      group.orderCode = customCode
    }
    if (!group.createdAt) group.createdAt = custom.createdAt
    if (!group.orderPaymentStatus) group.orderPaymentStatus = custom.orderPaymentStatus
    group.totalAmount = Number(group.totalAmount || 0) + Number(custom.totalAmount || 0)
  }

  return [...uniqueGroups, ...ungrouped].map((row) => {
    if (row.rowKind !== 'mixed') return row
    const hasCatalog = Boolean(row.catalog)
    const hasCustom = (row.customBundles || []).length > 0
    if (hasCatalog && !hasCustom) {
      return { ...row.catalog, rowKind: 'catalog', customBundles: [] }
    }
    if (!hasCatalog && hasCustom && row.customBundles.length === 1) {
      return row.customBundles[0]
    }
    const catalogStatus = String(row.catalog?.queueStatus || '').toLowerCase()
    const customStatuses = (row.customBundles || []).map((bundle) =>
      String(bundle.queueStatus || '').toLowerCase(),
    )
    const customPending = customStatuses.some((status) => status === 'waiting' || status === 'insufficient')
    const customAllCancelled = hasCustom && customStatuses.every((status) => status === 'cancelled')
    const customAllPacked = hasCustom && customStatuses.every((status) => status === 'confirmed')
    return {
      ...row,
      queueStatus:
        catalogStatus === 'cancelled' || (customAllCancelled && (!hasCatalog || catalogStatus === 'cancelled'))
          ? 'Cancelled'
          : catalogStatus === 'insufficient'
            ? 'Insufficient'
            : catalogStatus === 'waiting' || customPending
              ? 'Waiting'
              : catalogStatus === 'confirmed' && customAllPacked
                ? 'Confirmed'
                : customAllCancelled
                  ? 'Cancelled'
                  : row.queueStatus,
    }
  })
}

function mapCatalogQueueItem(item) {
  return {
    ...item,
    orderId: item.orderId ?? item.OrderId,
    orderCode: item.orderCode ?? item.OrderCode,
    createdAt: item.createdAt ?? item.CreatedAt,
    queueStatus: item.queueStatus ?? item.QueueStatus,
    orderPaymentStatus: item.orderPaymentStatus ?? item.OrderPaymentStatus,
    orderStockStatus: item.orderStockStatus ?? item.OrderStockStatus,
    totalAmount: item.totalAmount ?? item.TotalAmount,
    queueId: item.queueId ?? item.QueueId ?? item.id ?? item.Id,
    rowKind: 'catalog',
  }
}

/** Tab hiển thị của dòng đã gộp: thành phẩm thiếu hàng → Chờ hàng; còn lại (kể cả gói cá nhân) → Chờ đóng gói. */
function getMergedRowTab(row) {
  const catalog = row.rowKind === 'mixed' ? row.catalog : row.rowKind === 'custom' ? null : row
  const status = String(catalog?.queueStatus || row.queueStatus || '').toLowerCase()
  if (status === 'insufficient') return 'insufficient'
  if (status === 'confirmed') return 'confirmed'
  if (status === 'cancelled') return 'cancelled'
  return 'waiting'
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
      const includeCancelledCustom = true // luôn tải để badge «Đã hủy» gồm gói cá nhân
      const siblingStatus = activeTab === 'waiting' ? 'insufficient' : activeTab === 'insufficient' ? 'waiting' : null
      const [queuePage, siblingQueuePage, customPendingPage, customPackedPage, customCancelledPage] = await Promise.all([
        fetchPendingStockDeductQueues({
          status: tab?.status,
          search: searchValue.trim() || undefined,
          page,
          pageSize,
        }),
        siblingStatus
          ? fetchPendingStockDeductQueues({
              status: siblingStatus,
              search: searchValue.trim() || undefined,
              page: 1,
              pageSize: 100,
            }).catch(() => ({ items: [], totalCount: 0 }))
          : Promise.resolve({ items: [], totalCount: 0 }),
        includePendingCustom
          ? fetchPendingCustomBundles({ page: 1, pageSize: 100 }).catch(() => ({ items: [], totalCount: 0 }))
          : Promise.resolve({ items: [], totalCount: 0 }),
        includePackedCustom
          ? fetchCustomBundles({ page: 1, pageSize: 100, packingStatus: 'Packed' }).catch(() => ({ items: [], totalCount: 0 }))
          : Promise.resolve({ items: [], totalCount: 0 }),
        includeCancelledCustom
          ? fetchCustomBundles({ page: 1, pageSize: 100, packingStatus: 'Cancelled' }).catch(() => ({ items: [], totalCount: 0 }))
          : Promise.resolve({ items: [], totalCount: 0 }),
      ])

      const search = searchValue.trim().toLowerCase()
      const isActiveOrder = (bundle) => {
        const status = String(bundle.orderStatus || bundle.OrderStatus || '').toLowerCase()
        return status !== 'cancelled' && status !== 'cancellationrequested'
      }
      const pendingCustomItems = (customPendingPage.items || []).filter(isActiveOrder)
      const packedCustomItems = customPackedPage.items || []
      const cancelledCustomItems = customCancelledPage.items || []
      let customRows = pendingCustomItems.map((b) => mapCustomBundleToQueueRow(b))
      let packedCustomRows = packedCustomItems.map((b) => mapCustomBundleToQueueRow(b, { packed: true }))
      let cancelledCustomRows = cancelledCustomItems.map((b) => mapCustomBundleToQueueRow(b, { cancelled: true }))
      if (search) {
        const match = (row) =>
          String(row.orderCode || '').toLowerCase().includes(search)
          || String(row.label || '').toLowerCase().includes(search)
        customRows = customRows.filter(match)
        packedCustomRows = packedCustomRows.filter(match)
        cancelledCustomRows = cancelledCustomRows.filter(match)
      }
      const customForTab = activeTab === 'confirmed'
        ? packedCustomRows
        : activeTab === 'cancelled'
          ? cancelledCustomRows
          : activeTab === 'all'
            ? [...customRows, ...packedCustomRows, ...cancelledCustomRows]
            : customRows
      const catalogSource = [
        ...(queuePage.items || queuePage.items || []),
        ...(siblingQueuePage.items || siblingQueuePage.items || []),
      ]
      const seenQueueIds = new Set()
      const catalogItems = catalogSource.map(mapCatalogQueueItem).filter((item) => {
        const id = String(item.queueId || '')
        if (id && seenQueueIds.has(id)) return false
        if (id) seenQueueIds.add(id)
        return true
      })
      const merged = mergeCatalogAndCustomRows(catalogItems, customForTab)
        .sort((left, right) => getCreatedAtSortValue(right) - getCreatedAtSortValue(left))
      const visibleRows = activeTab === 'all'
        ? merged
        : merged.filter((row) => getMergedRowTab(row) === activeTab)
      setQueues(visibleRows)
      const catalogKeys = new Set()
      for (const item of catalogItems) {
        const code = readOrderCode(item)
        const id = readOrderId(item)
        if (code) catalogKeys.add(`code:${code}`)
        if (id) catalogKeys.add(`id:${id}`)
      }
      const standaloneCustom = customForTab.filter((row) => !rowMatchesCatalogKeys(row, catalogKeys)).length
      const standaloneOnThisTab = activeTab === 'insufficient'
        ? 0
        : standaloneCustom
      setTotalCount((queuePage.totalCount || queuePage.TotalCount || 0) + standaloneOnThisTab)

      const customWaitingStandalone = customRows.filter((row) => !rowMatchesCatalogKeys(row, catalogKeys)).length
      const packedStandalone = packedCustomRows.filter((row) => !rowMatchesCatalogKeys(row, catalogKeys)).length
      const cancelledStandalone = cancelledCustomRows.filter((row) => !rowMatchesCatalogKeys(row, catalogKeys)).length
      const baseCounts = { ...(queuePage.statusCounts || queuePage.StatusCounts || {}) }
      const bump = (key, delta) => {
        const found = Object.keys(baseCounts).find((k) => k.toLowerCase() === key.toLowerCase())
        if (found) baseCounts[found] = (Number(baseCounts[found]) || 0) + delta
        else if (delta) baseCounts[key] = delta
      }
      bump('Waiting', customWaitingStandalone)
      bump('Confirmed', packedStandalone)
      bump('Cancelled', cancelledStandalone)
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
        hint: `Thiếu tồn Kệ/Kho / nguyên liệu ${PERSONAL_PRODUCT_LABEL.toLowerCase()}, chưa thể trừ`,
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
            ? `Thủ kho xác nhận đóng gói thành phẩm (queue) và ${PERSONAL_PRODUCT_LABEL.toLowerCase()} (trừ NL Kho).`
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
                <th className="px-4 py-4">Trạng thái xử lý Kho</th>
                <th className="px-4 py-4">Trạng thái đơn</th>
                <th className="px-4 py-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {isLoading ? (
                <tr>
                  <td className="px-8 py-10 text-center text-slate-500" colSpan={4}>
                    <span className="inline-flex items-center gap-2 text-sm font-semibold">
                      <span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>
                      Đang tải yêu cầu đóng gói...
                    </span>
                  </td>
                </tr>
              ) : null}
              {!isLoading && queues.length === 0 ? (
                <tr>
                  <td className="px-8 py-12 text-center" colSpan={4}>
                    <p className="font-semibold text-slate-800">
                      {searchValue.trim() || activeTab !== 'waiting'
                        ? 'Không có yêu cầu trong mục này'
                        : 'Chưa có yêu cầu chờ đóng gói'}
                    </p>
                    <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
                      {searchValue.trim() || activeTab !== 'waiting'
                        ? 'Thử đổi tab hoặc xóa mã đơn đang tìm.'
                        : `Đơn bán vượt tồn Kệ hoặc ${PERSONAL_PRODUCT_LABEL.toLowerCase()} chờ đóng gói sẽ hiện tại đây.`}
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
                    const catalogRow = row.rowKind === 'mixed' ? row.catalog : row.rowKind === 'custom' ? null : row
                    const customParts = row.rowKind === 'mixed'
                      ? (row.customBundles || [])
                      : row.rowKind === 'custom'
                        ? [row]
                        : []
                    const isMixed = row.rowKind === 'mixed' || (Boolean(catalogRow) && customParts.length > 0)
                    const normalizedQueueStatus = String(
                      catalogRow?.queueStatus || row.queueStatus || '',
                    ).toLowerCase()
                    const isCompletedQueue = normalizedQueueStatus === 'confirmed'
                      && customParts.every((bundle) => String(bundle.queueStatus || '').toLowerCase() === 'confirmed')
                    const isCancelledQueue = normalizedQueueStatus === 'cancelled'
                    const isBackorderQueue = Boolean(
                      catalogRow?.lines?.some((line) =>
                        String(line.stockHandlingMode || '').toLowerCase().includes('backorder'),
                      ),
                    )
                    const catalogCanConfirm = Boolean(
                      catalogRow && canExecuteDeduct && !isCancelledQueue && !isBackorderQueue
                      && String(catalogRow.queueStatus || '').toLowerCase() !== 'confirmed',
                    )
                    const pendingCustom = customParts.filter((bundle) =>
                      String(bundle.queueStatus || '').toLowerCase() === 'waiting',
                    )
                    const customCanConfirm = canExecuteDeduct && !isCancelledQueue && pendingCustom.length > 0
                    const orderStatusMeta = resolveStockDeductOrderStatusMeta(
                      row.orderPaymentStatus || catalogRow?.orderPaymentStatus,
                      catalogRow?.orderStockStatus || row.orderStockStatus,
                    )
                    const catalogLines = catalogRow?.lines || []
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
                        <div className="mt-1 flex flex-wrap gap-1">
                          {catalogRow ? (
                            <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600">
                              Thành phẩm
                            </span>
                          ) : null}
                          {customParts.map((bundle) => (
                            <span
                              key={bundle.queueId || bundle.bundleId}
                              className="inline-flex rounded-full bg-[#e8f0e9] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#356647]"
                            >
                              {PERSONAL_PRODUCT_LABEL}{bundle.label ? ` · ${bundle.label}` : ''}
                            </span>
                          ))}
                        </div>
                        {catalogLines.length ? (
                          <div className="mt-2 space-y-1 text-xs font-medium text-slate-500">
                            {catalogLines.slice(0, 2).map((line) => (
                              <p key={line.skuId}>
                                {`Thành phẩm · ${line.skuCode || line.skuName}: ${getStockDeductLineSummary(line)}`}
                              </p>
                            ))}
                            {catalogLines.length > 2 ? <p>+{catalogLines.length - 2} dòng thành phẩm khác</p> : null}
                          </div>
                        ) : null}
                        {customParts.length ? (
                          <div className="mt-2 space-y-1 text-xs font-medium text-[#356647]">
                            {customParts.map((bundle) => (
                              <p key={bundle.queueId || bundle.bundleId}>
                                {PERSONAL_PRODUCT_LABEL}
                                {bundle.label ? ` · ${bundle.label}` : ''}
                                {String(bundle.queueStatus || '').toLowerCase() === 'confirmed'
                                  ? ' — đã đóng gói'
                                  : ' — chờ đóng gói / trừ Kho'}
                              </p>
                            ))}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-5">
                        <div className="flex flex-col items-start gap-1.5">
                          {catalogRow ? (
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-semibold ${getStockStatusClass(catalogRow.orderStockStatus)}`}
                            >
                              {catalogRow.orderStockStatus === 'pending_warehouse_transfer'
                                ? 'Thành phẩm: chờ xuất Kho điều chuyển Kệ'
                                : `Thành phẩm: ${getStockStatusLabel(catalogRow.orderStockStatus) || catalogRow.orderStockStatus}`}
                            </span>
                          ) : null}
                          {customParts.map((bundle) => (
                            <span
                              key={`st-${bundle.queueId || bundle.bundleId}`}
                              className={`rounded-full px-3 py-1 text-xs font-semibold ${getStockStatusClass(bundle.orderStockStatus)}`}
                            >
                              {bundle.orderStockStatus === 'pending_custom_pack'
                                ? `Chờ đóng gói ${PERSONAL_PRODUCT_LABEL.toLowerCase()}`
                                : bundle.orderStockStatus === 'custom_packed'
                                  ? `Đã trừ nguyên liệu ${PERSONAL_PRODUCT_LABEL.toLowerCase()}`
                                  : getStockStatusLabel(bundle.orderStockStatus) || bundle.orderStockStatus}
                            </span>
                          ))}
                          {!catalogRow && customParts.length === 0 ? (
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-semibold ${getStockStatusClass(row.orderStockStatus)}`}
                            >
                              {getStockStatusLabel(row.orderStockStatus)}
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-5">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${orderStatusMeta.className}`}
                        >
                          {orderStatusMeta.label}
                        </span>
                      </td>
                      <td className="px-4 py-5 text-right">
                        <div className="flex flex-col items-end gap-1.5">
                          {isMixed && catalogRow ? (
                            <button
                              type="button"
                              onClick={() => setPreviewQueue({ ...catalogRow, customBundles: customParts })}
                              className={`rounded-lg px-3 py-1.5 text-xs font-bold text-white ${
                                catalogCanConfirm || customCanConfirm
                                  ? 'bg-[#538463] hover:bg-[#457053]'
                                  : 'bg-slate-500 hover:bg-slate-600'
                              }`}
                            >
                              {isCancelledQueue || isCompletedQueue
                                ? 'Xem đơn'
                                : catalogCanConfirm || customCanConfirm
                                  ? 'Xem & xác nhận'
                                  : 'Xem'}
                            </button>
                          ) : catalogRow ? (
                            <button
                              type="button"
                              onClick={() => setPreviewQueue(catalogRow)}
                              className={`rounded-lg px-3 py-1.5 text-xs font-bold text-white ${
                                catalogCanConfirm
                                  ? 'bg-[#538463] hover:bg-[#457053]'
                                  : 'bg-slate-500 hover:bg-slate-600'
                              }`}
                            >
                              {isCancelledQueue || isCompletedQueue || isBackorderQueue || !catalogCanConfirm
                                ? (isCancelledQueue || isCompletedQueue || isBackorderQueue ? 'Xem' : canCancelQueue ? 'Xem & xử lý ngoại lệ' : 'Xem')
                                : 'Xem & xác nhận'}
                            </button>
                          ) : customParts.map((bundle) => {
                            const packed = String(bundle.queueStatus || '').toLowerCase() === 'confirmed'
                            return (
                              <button
                                key={`act-${bundle.queueId || bundle.bundleId}`}
                                type="button"
                                onClick={() => setPreviewCustom({
                                  ...bundle,
                                  readOnly: packed,
                                })}
                                className={`rounded-lg px-3 py-1.5 text-xs font-bold text-white ${
                                  customCanConfirm && !packed
                                    ? 'bg-[#538463] hover:bg-[#457053]'
                                    : 'bg-slate-500 hover:bg-slate-600'
                                }`}
                              >
                                {packed
                                  ? `Xem ${PERSONAL_PRODUCT_LABEL.toLowerCase()}`
                                  : 'Xem & xác nhận'}
                              </button>
                            )
                          })}
                        </div>
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

      {previewQueue ? (
        <StockDeductPreviewModal
          queueId={previewQueue.queueId}
          orderCode={previewQueue.orderCode}
          orderPaymentStatus={previewQueue.orderPaymentStatus}
          queueStatus={previewQueue.queueStatus}
          totalAmount={previewQueue.totalAmount}
          createdAt={previewQueue.createdAt}
          canConfirm={canExecuteDeduct}
          canCancel={canCancelQueue}
          customBundles={previewQueue.customBundles || []}
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
          queueStatus={previewCustom.queueStatus}
          totalAmount={previewCustom.totalAmount}
          createdAt={previewCustom.createdAt}
          canConfirm={canExecuteDeduct && !previewCustom.readOnly}
          onClose={() => setPreviewCustom(null)}
          onConfirmed={loadData}
        />
      ) : null}
    </PageShell>
  )
}

export default StockDeductQueuePage
