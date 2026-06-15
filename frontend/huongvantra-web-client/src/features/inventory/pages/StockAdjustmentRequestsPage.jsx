import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import PageHeader from '../../../components/shared/PageHeader.jsx'
import PageShell from '../../../components/shared/PageShell.jsx'
import TablePagination, { TABLE_PAGE_SIZE } from '../../../components/shared/TablePagination.jsx'
import { showError, showSuccess } from '../../../app/toast.js'
import { canConfirmStockDeduct } from '../../../app/navigation.js'
import { loadAuthSession } from '../../auth/services/authSession.js'
import { formatStockQuantity } from '../../products/utils/productDisplay.js'
import { formatVietnamDateTime } from '../../../utils/vietnamDateTime.js'
import InventorySimulationBanner from '../components/InventorySimulationBanner.jsx'
import { inventoryNavTabs } from '../utils/inventoryNavTabs.js'
import { fetchInventorySettings } from '../services/inventoryStockApi.js'
import {
  approveStockAdjustmentRequest,
  cancelStockAdjustmentRequest,
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

function StockAdjustmentRequestsPage() {
  const navigate = useNavigate()
  const canReview = canConfirmStockDeduct(loadAuthSession())
  const [activeTab, setActiveTab] = useState(canReview ? 'pending' : 'mine')
  const [searchValue, setSearchValue] = useState('')
  const [requests, setRequests] = useState([])
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
    } catch (error) {
      setRequests([])
      setTotalCount(0)
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
      const slipCode = result?.exportSlipCode ?? result?.ExportSlipCode
      showSuccess(
        slipCode
          ? `Đã duyệt. Đã tạo phiếu xuất kho ${slipCode}.`
          : 'Đã duyệt và cập nhật tồn cửa hàng.',
      )
      await loadData()
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
        title="Yêu cầu điều chỉnh tồn"
        description={
          canReview
            ? 'Duyệt yêu cầu từ cửa hàng — nhập hàng sẽ xuất từ kho tổng và tạo phiếu xuất kho'
            : 'Theo dõi yêu cầu điều chỉnh tồn bạn đã gửi'
        }
        searchPlaceholder="Tìm mã yêu cầu, SKU..."
        searchValue={searchValue}
        onSearchChange={(value) => {
          setSearchValue(value)
          setPage(1)
        }}
        rightContent={
          <div className="flex flex-wrap items-center gap-2">
            {inventoryNavTabs.map((tab) => (
              <Link
                key={tab.to}
                to={tab.to}
                className={`rounded-xl px-4 py-2 text-sm font-semibold ${
                  tab.to === '/inventory/stock-requests'
                    ? 'bg-[#538463] text-white'
                    : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {tab.label}
              </Link>
            ))}
          </div>
        }
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
          to="/products"
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

      <section className="rounded-3xl border border-slate-100 bg-white shadow-sm">
        <div className="border-b border-slate-50 p-6">
          <h2 className="text-xl font-bold text-slate-800">
            {REQUEST_TABS.find((t) => t.key === activeTab)?.label}
          </h2>
        </div>

        <div className="custom-scrollbar overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-[#fbf9f1]/50 text-xs font-bold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-8 py-4">Mã yêu cầu</th>
                <th className="px-4 py-4">SKU</th>
                <th className="px-4 py-4">Thay đổi</th>
                {canReview ? null : <th className="px-4 py-4">Tồn CH lúc gửi</th>}
                <th className="px-4 py-4">Phiếu xuất</th>
                <th className="px-4 py-4">Trạng thái</th>
                <th className="px-4 py-4">Ngày gửi</th>
                <th className="px-4 py-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {isLoading ? (
                <tr>
                  <td className="px-8 py-10 text-slate-500" colSpan={canReview ? 7 : 8}>
                    Đang tải...
                  </td>
                </tr>
              ) : null}
              {!isLoading && requests.length === 0 ? (
                <tr>
                  <td className="px-8 py-10 text-slate-500" colSpan={canReview ? 7 : 8}>
                    Không có yêu cầu trong mục này.
                  </td>
                </tr>
              ) : null}
              {!isLoading
                ? requests.map((row) => (
                    <tr key={row.id} className="transition-colors hover:bg-[#fbf9f1]/30">
                      <td className="px-8 py-5 font-bold text-slate-700">{row.requestCode}</td>
                      <td className="px-4 py-5">
                        <p className="font-mono text-sm font-semibold text-[#356647]">{row.skuCode}</p>
                        <p className="mt-0.5 text-xs text-slate-500">{row.skuSnapshotName}</p>
                        {row.reason ? (
                          <p className="mt-1 text-xs text-slate-600">Lý do: {row.reason}</p>
                        ) : null}
                        {row.reviewNote ? (
                          <p className="mt-1 text-xs text-rose-600">Ghi chú duyệt: {row.reviewNote}</p>
                        ) : null}
                      </td>
                      <td className="px-4 py-5">
                        <span
                          className={`font-bold ${
                            row.quantityDelta > 0 ? 'text-emerald-700' : 'text-rose-700'
                          }`}
                        >
                          {formatDelta(row.quantityDelta)}
                        </span>
                      </td>
                      {canReview ? null : (
                        <td className="px-4 py-5 text-sm text-slate-600">
                          {formatStockQuantity(row.quantityOnHandSnapshot)}
                        </td>
                      )}
                      <td className="px-4 py-5 text-sm">
                        {row.exportSlipCode ? (
                          <button
                            type="button"
                            className="font-semibold text-[#356647] hover:underline"
                            onClick={() => navigate('/inventory/export', { state: { search: row.exportSlipCode } })}
                          >
                            {row.exportSlipCode}
                          </button>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-5">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${getAdjustmentStatusClass(row.status)}`}
                        >
                          {getAdjustmentStatusLabel(row.status)}
                        </span>
                      </td>
                      <td className="px-4 py-5 text-sm text-slate-600">
                        {formatVietnamDateTime(row.requestedAt)}
                      </td>
                      <td className="px-4 py-5 text-right">
                        {row.status === 'pending' && canReview && activeTab !== 'mine' ? (
                          <div className="flex flex-wrap justify-end gap-2">
                            <button
                              type="button"
                              disabled={actingId === row.id}
                              onClick={() => handleApprove(row.id)}
                              className="rounded-lg bg-[#538463] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#457053] disabled:opacity-50"
                            >
                              Duyệt
                            </button>
                            <button
                              type="button"
                              disabled={actingId === row.id}
                              onClick={() => setRejectTarget(row)}
                              className="rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                            >
                              Từ chối
                            </button>
                          </div>
                        ) : null}
                        {row.status === 'pending' && activeTab === 'mine' ? (
                          <button
                            type="button"
                            disabled={actingId === row.id}
                            onClick={() => handleCancel(row.id)}
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                          >
                            Hủy
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))
                : null}
            </tbody>
          </table>
        </div>
        <TablePagination
          page={page}
          pageSize={pageSize}
          totalCount={totalCount}
          itemLabel="yêu cầu"
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      </section>

      {rejectTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-slate-800">Từ chối {rejectTarget.requestCode}</h3>
            <p className="mt-2 text-sm text-slate-600">
              SKU {rejectTarget.skuCode} — thay đổi {formatDelta(rejectTarget.quantityDelta)}
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
