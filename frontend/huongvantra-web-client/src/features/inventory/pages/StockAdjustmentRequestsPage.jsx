import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import PageHeader from '../../../components/shared/PageHeader.jsx'
import PageShell from '../../../components/shared/PageShell.jsx'
import TablePagination, { TABLE_PAGE_SIZE } from '../../../components/shared/TablePagination.jsx'
import { showError, showSuccess } from '../../../app/toast.js'
import { canConfirmStockDeduct } from '../../../app/navigation.js'
import { loadAuthSession } from '../../auth/services/authSession.js'
import { formatStockQuantity } from '../../products/utils/productDisplay.js'
import { formatVietnamDateTime } from '../../../utils/vietnamDateTime.js'
import InventorySimulationBanner from '../components/InventorySimulationBanner.jsx'
import StockAdjustmentRequestDetailPanel from '../components/StockAdjustmentRequestDetailPanel.jsx'
import InventoryNavTabs from '../components/InventoryNavTabs.jsx'
import { notifyInventoryStockChanged } from '../utils/inventoryStockEvents.js'
import { fetchInventorySettings } from '../services/inventoryStockApi.js'
import {
  approveStockAdjustmentRequest,
  cancelStockAdjustmentRequest,
  fetchStockAdjustmentRequestById,
  fetchStockAdjustmentRequests,
  getAdjustmentStatusClass,
  getAdjustmentStatusLabel,
  rejectStockAdjustmentRequest,
} from '../services/stockAdjustmentRequestApi.js'

const TABS = [
  { key: 'pending', label: 'Chờ duyệt', status: 'pending', mine: false },
  { key: 'mine', label: 'Yêu cầu của tôi', status: undefined, mine: true },
  { key: 'processed', label: 'Đã xử lý', status: undefined, mine: false, excludePending: true },
]

const REQUEST_TABS = TABS.map((tab) =>
  tab.key === 'processed'
    ? { ...tab, status: 'processed', excludePending: false }
    : tab,
)

function formatDelta(delta) {
  const value = Number(delta)
  if (!Number.isFinite(value)) return '—'
  if (value > 0) return `+${formatStockQuantity(value)}`
  return formatStockQuantity(value)
}

function getRequestMovementLabel(row) {
  if (row.hasIncrease && row.hasDecrease) return ' · xuất sang CH & giảm'
  if (row.hasIncrease) return ' · xuất sang cửa hàng'
  if (row.hasDecrease) return ' · giảm tồn'
  return ''
}

function StockAdjustmentRequestsPage() {
  const location = useLocation()
  const canReview = canConfirmStockDeduct(loadAuthSession())
  const [activeTab, setActiveTab] = useState(canReview ? 'pending' : 'mine')
  const [searchValue, setSearchValue] = useState(() => location.state?.search ?? '')
  const [requests, setRequests] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [selectedDetail, setSelectedDetail] = useState(null)
  const [isLoadingDetail, setIsLoadingDetail] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(TABLE_PAGE_SIZE)
  const [totalCount, setTotalCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [actingId, setActingId] = useState(null)
  const [rejectTarget, setRejectTarget] = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const [simulateWarehouse, setSimulateWarehouse] = useState(true)

  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const tab = REQUEST_TABS.find((t) => t.key === activeTab) ?? REQUEST_TABS[0]
      const data = await fetchStockAdjustmentRequests({
        status: tab.status,
        mine: tab.mine,
        search: searchValue.trim() || undefined,
        page,
        pageSize,
      })
      const filtered = tab.excludePending ? data.items.filter((row) => row.status !== 'pending') : data.items
      setRequests(filtered)
      setTotalCount(data.totalCount)
      setSelectedId((prev) => {
        if (prev && filtered.some((row) => row.id === prev)) return prev
        return filtered[0]?.id ?? null
      })
    } catch (error) {
      setRequests([])
      setTotalCount(0)
      setSelectedId(null)
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
    fetchInventorySettings().then((s) => setSimulateWarehouse(s.simulateWarehouse)).catch(() => {})
  }, [])

  useEffect(() => {
    const nextSearch = location.state?.search
    if (!nextSearch) return
    setSearchValue(nextSearch)
    setActiveTab(canReview ? 'pending' : 'mine')
    setPage(1)
  }, [canReview, location.key, location.state])

  useEffect(() => {
    if (!selectedId) {
      setSelectedDetail(null)
      return undefined
    }

    const cached = requests.find((row) => row.id === selectedId)
    if (cached) setSelectedDetail(cached)

    let mounted = true
    async function loadDetail() {
      setIsLoadingDetail(true)
      try {
        const detail = await fetchStockAdjustmentRequestById(selectedId)
        if (mounted) setSelectedDetail(detail)
      } catch (error) {
        if (mounted && cached) setSelectedDetail(cached)
        else if (mounted) {
          setSelectedDetail(null)
          showError(error.message)
        }
      } finally {
        if (mounted) setIsLoadingDetail(false)
      }
    }

    loadDetail()
    return () => {
      mounted = false
    }
  }, [selectedId, requests])

  const stats = useMemo(() => {
    const pending = requests.filter((r) => r.status === 'pending').length
    const approved = requests.filter((r) => r.status === 'approved').length
    return [
      { label: 'Chờ duyệt', value: String(pending), note: 'Trong danh sách hiện tại' },
      { label: 'Đã duyệt', value: String(approved), note: 'Trong danh sách hiện tại' },
      { label: 'Tổng hiển thị', value: String(requests.length), note: 'Theo bộ lọc' },
    ]
  }, [requests])

  async function handleApprove(id) {
    setActingId(id)
    try {
      const result = await approveStockAdjustmentRequest(id)
      const slips = result?.exportSlips ?? []
      if (slips.length === 1) {
        showSuccess(`Đã duyệt lô. Đã tạo phiếu xuất kho ${slips[0].exportSlipCode}.`)
      } else if (slips.length > 1) {
        showSuccess(`Đã duyệt lô. Đã tạo ${slips.length} phiếu xuất kho.`)
      } else {
        showSuccess('Đã duyệt lô và cập nhật tồn cửa hàng.')
      }
      notifyInventoryStockChanged()
      await loadData()
      if (selectedId === id) {
        const detail = await fetchStockAdjustmentRequestById(id)
        setSelectedDetail(detail)
      }
    } catch (error) {
      showError(error.message)
    } finally {
      setActingId(null)
    }
  }

  async function handleReject() {
    if (!rejectTarget) return
    setActingId(rejectTarget.id)
    try {
      await rejectStockAdjustmentRequest(rejectTarget.id, rejectReason)
      showSuccess('Đã từ chối yêu cầu.')
      setRejectTarget(null)
      setRejectReason('')
      await loadData()
    } catch (error) {
      showError(error.message)
    } finally {
      setActingId(null)
    }
  }

  async function handleCancel(id) {
    setActingId(id)
    try {
      await cancelStockAdjustmentRequest(id)
      showSuccess('Đã hủy yêu cầu.')
      await loadData()
    } catch (error) {
      showError(error.message)
    } finally {
      setActingId(null)
    }
  }

  return (
    <PageShell>
      <PageHeader
        title="Yêu cầu tồn & xuất sang cửa hàng"
        description={
          canReview
            ? 'Duyệt lô xuất kho tổng sang cửa hàng hoặc điều chỉnh tồn — bấm thẻ để xem chi tiết từng lô'
            : 'Theo dõi lô yêu cầu bạn đã gửi — bấm thẻ để xem chi tiết'
        }
        searchPlaceholder="Tìm mã yêu cầu, SKU..."
        searchValue={searchValue}
        onSearchChange={(value) => {
          setSearchValue(value)
          setPage(1)
        }}
        rightContent={<InventoryNavTabs />}
      />

      <InventorySimulationBanner simulateWarehouse={simulateWarehouse} warehouseView={canReview} />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => {
              setActiveTab(tab.key)
              setPage(1)
            }}
            className={`rounded-xl px-5 py-2.5 text-sm font-semibold transition-colors ${
              activeTab === tab.key
                ? 'bg-[#538463] text-white shadow-md shadow-[#538463]/20'
                : 'bg-white text-slate-600 hover:bg-slate-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
        <Link
          className="ml-auto rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          to="/inventory/products"
        >
          Sản phẩm &amp; số lượng
        </Link>
      </div>

      <section className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">{stat.label}</p>
            <p className="mt-1 text-2xl font-bold text-slate-800">{stat.value}</p>
            <p className="mt-1 text-xs text-slate-400">{stat.note}</p>
          </div>
        ))}
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <section className="flex flex-col rounded-2xl border border-slate-100 bg-white shadow-sm lg:col-span-5">
          <div className="border-b border-slate-50 px-6 py-4">
            <h2 className="text-lg font-bold text-slate-800">
              {REQUEST_TABS.find((t) => t.key === activeTab)?.label}
            </h2>
            <p className="mt-1 text-xs text-slate-500">Bấm thẻ để xem chi tiết lô</p>
          </div>

          <div className="min-h-[280px] flex-1 overflow-y-auto custom-scrollbar">
            {isLoading ? (
              <p className="px-6 py-8 text-sm text-slate-500">Đang tải...</p>
            ) : requests.length === 0 ? (
              <p className="px-6 py-8 text-sm text-slate-500">Không có yêu cầu trong mục này.</p>
            ) : (
              <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-1">
                {requests.map((row) => {
                  const preview = row.items[0]
                  const isSelected = selectedId === row.id
                  return (
                    <button
                      key={row.id}
                      type="button"
                      onClick={() => setSelectedId(row.id)}
                      className={`rounded-xl border p-4 text-left transition-all hover:shadow-md ${
                        isSelected
                          ? 'border-[#356647]/40 bg-[#f0f7f2] shadow-sm ring-1 ring-[#356647]/20'
                          : 'border-slate-100 bg-white hover:border-[#356647]/20 hover:bg-[#fbf9f1]/40'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-mono text-sm font-bold text-[#356647]">{row.requestCode}</p>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${getAdjustmentStatusClass(row.status)}`}
                        >
                          {getAdjustmentStatusLabel(row.status)}
                        </span>
                      </div>
                      <p className="mt-2 text-sm font-semibold text-slate-800">
                        {row.itemCount} SKU
                        {getRequestMovementLabel(row)}
                      </p>
                      {preview ? (
                        <p className="mt-1 truncate text-xs text-slate-500">
                          {preview.skuCode}
                          {row.itemCount > 1 ? ` +${row.itemCount - 1} SKU` : ''}
                          {' · '}
                          {formatDelta(preview.quantityDelta)}
                        </p>
                      ) : null}
                      {row.reason ? (
                        <p className="mt-2 line-clamp-2 text-xs text-slate-600">Lý do: {row.reason}</p>
                      ) : null}
                      <p className="mt-2 text-[11px] text-slate-400">
                        {formatVietnamDateTime(row.requestedAt)}
                      </p>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <div className="border-t border-slate-50 px-4 py-3">
            <TablePagination
              page={page}
              pageSize={pageSize}
              totalCount={totalCount}
              itemLabel="yêu cầu"
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </div>
        </section>

        <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm sm:p-8 lg:col-span-7">
          <h2 className="mb-6 text-lg font-bold text-slate-800">Chi tiết yêu cầu</h2>
          {isLoadingDetail && selectedId ? (
            <p className="text-sm text-slate-500">Đang tải chi tiết...</p>
          ) : (
            <StockAdjustmentRequestDetailPanel
              request={selectedDetail}
              canReview={canReview}
              activeTab={activeTab}
              actingId={actingId}
              onApprove={handleApprove}
              onReject={setRejectTarget}
              onCancel={handleCancel}
            />
          )}
        </section>
      </div>

      {rejectTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-slate-800">Từ chối lô {rejectTarget.requestCode}</h3>
            <p className="mt-2 text-sm text-slate-600">
              {rejectTarget.itemCount} SKU trong lô
              {rejectTarget.hasIncrease && rejectTarget.hasDecrease
                ? ' (có xuất sang cửa hàng và giảm tồn)'
                : rejectTarget.hasIncrease
                  ? ' (xuất sang cửa hàng)'
                  : rejectTarget.hasDecrease
                    ? ' (giảm tồn)'
                    : ''}
            </p>
            <label className="mt-4 block space-y-2">
              <span className="text-xs font-semibold text-slate-500">Lý do từ chối (tùy chọn)</span>
              <textarea
                rows={3}
                value={rejectReason}
                onChange={(event) => setRejectReason(event.target.value)}
                className="w-full resize-none rounded-xl border-none bg-[#f0eee6] p-3 text-sm focus:ring-2 focus:ring-[#356647]/20"
              />
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setRejectTarget(null)
                  setRejectReason('')
                }}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
              >
                Đóng
              </button>
              <button
                type="button"
                disabled={actingId === rejectTarget.id}
                onClick={handleReject}
                className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-bold text-white hover:bg-rose-700 disabled:opacity-50"
              >
                Xác nhận từ chối
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </PageShell>
  )
}

export default StockAdjustmentRequestsPage
