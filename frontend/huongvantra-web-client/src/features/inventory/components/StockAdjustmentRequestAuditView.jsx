import { useCallback, useEffect, useMemo, useState } from 'react'
import ListFilterToolbar, {
  listFilterControlClass,
  listFilterSelectClass,
} from '../../../components/shared/ListFilterToolbar.jsx'
import { TitleInfoButton } from '../../../components/shared/PageHeader.jsx'
import PageShell from '../../../components/shared/PageShell.jsx'
import TablePagination from '../../../components/shared/TablePagination.jsx'
import { useTotalAwarePageSize } from '../../../utils/totalAwarePageSize.js'
import { showError } from '../../../app/toast.js'
import { formatVietnamDateTime } from '../../../utils/vietnamDateTime.js'
import { formatCreatorRole, UNKNOWN_CREATOR_VALUE } from '../utils/inventoryCreatorDisplay.js'
import {
  getStockFlowErrorMessage,
  STOCK_FLOW_TERMS,
} from '../utils/stockFlowLabels.js'
import {
  fetchStockAdjustmentRequestById,
  fetchStockAdjustmentRequestFilterOptions,
  fetchStockAdjustmentRequestTransfers,
  fetchStockAdjustmentRequests,
  getAdjustmentStatusClass,
  getAdjustmentStatusLabel,
} from '../services/stockAdjustmentRequestApi.js'
import StockAdjustmentRequestDetailPanel from './StockAdjustmentRequestDetailPanel.jsx'

const EMPTY_FILTERS = {
  search: '',
  fromDate: '',
  toDate: '',
}

const QUICK_FILTERS = [
  { key: 'all', label: 'Tất cả' },
  { key: 'pending', label: 'Chờ tiếp nhận', status: 'Pending' },
  { key: 'remaining', label: 'Còn thiếu', onlyRemaining: true },
  { key: 'processed', label: 'Đã xử lý', status: 'processed' },
]

const SORT_OPTIONS = [
  { value: '', label: 'Mới nhất trước' },
  { value: 'oldest', label: 'Cũ nhất trước' },
  { value: 'code_asc', label: 'Mã yêu cầu tăng dần' },
  { value: 'code_desc', label: 'Mã yêu cầu giảm dần' },
  { value: 'status', label: 'Theo trạng thái' },
]

function textOrDash(value) {
  const trimmed = String(value ?? '').trim()
  return trimmed || UNKNOWN_CREATOR_VALUE
}

/**
 * Ưu tiên snapshot lưu cùng yêu cầu. Dữ liệu cũ chưa có snapshot thì tra theo danh sách
 * người tạo của chính bộ lọc; không resolve được thì hiển thị "Chưa xác định".
 */
function resolveActor(directory, id, snapshotName, snapshotRole) {
  const fallback = id ? directory.get(String(id).toLowerCase()) : null
  return {
    name: String(snapshotName ?? '').trim() || fallback?.name || '',
    roleName: String(snapshotRole ?? '').trim() || fallback?.roleName || '',
  }
}

/**
 * Giao diện audit chỉ đọc dành cho Admin. Tách khỏi bố cục vận hành của
 * Sale / Quản lý / Thủ kho để Admin không có bất kỳ nút thao tác nghiệp vụ nào.
 */
export default function StockAdjustmentRequestAuditView() {
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [activeTab, setActiveTab] = useState('all')
  const [sort, setSort] = useState('')
  const [rows, setRows] = useState([])
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const { pageSize, setPageSize, pageSizeOptions } = useTotalAwarePageSize(totalCount)

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil((totalCount || 0) / pageSize) || 1)
    if (page > totalPages) setPage(totalPages)
  }, [totalCount, pageSize, page])
  const [isLoading, setIsLoading] = useState(true)
  const [creatorOptions, setCreatorOptions] = useState([])
  const [detailId, setDetailId] = useState(null)
  const [detail, setDetail] = useState(null)
  const [detailTransfers, setDetailTransfers] = useState([])
  const [isLoadingDetail, setIsLoadingDetail] = useState(false)

  // Danh bạ phụ trợ lấy từ chính tùy chọn bộ lọc của Inventory; không gọi sang IAM.
  const userDirectory = useMemo(() => {
    const directory = new Map()
    creatorOptions.forEach((creator) => {
      if (!creator?.id) return
      directory.set(String(creator.id).toLowerCase(), {
        name: String(creator.name ?? '').trim(),
        roleName: String(creator.roleName ?? '').trim(),
      })
    })
    return directory
  }, [creatorOptions])

  const activeQuickFilter = QUICK_FILTERS.find((tab) => tab.key === activeTab) ?? QUICK_FILTERS[0]

  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await fetchStockAdjustmentRequests({
        search: filters.search.trim() || undefined,
        status: activeQuickFilter.status || undefined,
        onlyRemaining: Boolean(activeQuickFilter.onlyRemaining),
        fromDate: filters.fromDate || undefined,
        toDate: filters.toDate || undefined,
        sort: sort || undefined,
        page,
        pageSize,
      })
      setRows(data.items)
      setTotalCount(data.totalCount)
    } catch (error) {
      setRows([])
      setTotalCount(0)
      showError(getStockFlowErrorMessage(error, 'Không tải được danh sách yêu cầu.'))
    } finally {
      setIsLoading(false)
    }
  }, [activeQuickFilter, filters, page, pageSize, sort])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    let mounted = true
    fetchStockAdjustmentRequestFilterOptions()
      .then((options) => {
        if (!mounted) return
        setCreatorOptions(options.creators)
      })
      .catch((error) => {
        if (!mounted) return
        setCreatorOptions([])
        showError(getStockFlowErrorMessage(error, 'Không tải được tùy chọn bộ lọc.'))
      })
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    if (!detailId) {
      setDetail(null)
      setDetailTransfers([])
      return undefined
    }

    let mounted = true
    setIsLoadingDetail(true)
    Promise.all([
      fetchStockAdjustmentRequestById(detailId),
      fetchStockAdjustmentRequestTransfers(detailId).catch(() => []),
    ])
      .then(([request, transfers]) => {
        if (!mounted) return
        setDetail(request)
        setDetailTransfers(transfers)
      })
      .catch((error) => {
        if (!mounted) return
        setDetail(null)
        setDetailTransfers([])
        showError(getStockFlowErrorMessage(error, 'Không tải được chi tiết yêu cầu.'))
      })
      .finally(() => {
        if (mounted) setIsLoadingDetail(false)
      })

    return () => {
      mounted = false
    }
  }, [detailId])

  const hasActiveFilters = useMemo(
    () => Object.values(filters).some((value) => String(value).trim() !== '') || activeTab !== 'all' || sort !== '',
    [activeTab, filters, sort],
  )

  function updateDraft(patch) {
    setFilters((prev) => ({ ...prev, ...patch }))
    setPage(1)
  }

  function handleClearFilters() {
    setFilters(EMPTY_FILTERS)
    setActiveTab('all')
    setSort('')
    setPage(1)
  }

  const detailCreator = resolveActor(
    userDirectory,
    detail?.requestedBy,
    detail?.requestedByName,
    detail?.requestedByRoleName,
  )
  const detailReviewer = resolveActor(
    userDirectory,
    detail?.reviewedBy,
    detail?.reviewedByName,
    detail?.reviewedByRoleName,
  )

  return (
    <PageShell className="-mt-3 !gap-2 sm:-mt-4 sm:!gap-3">
      <header className="rounded-2xl border border-[#c1c9c0]/40 bg-[linear-gradient(180deg,#fdfcf6_0%,#fbf9f1_100%)] px-5 py-3 shadow-[0_10px_30px_rgba(27,28,23,0.04)] sm:px-6">
        <div className="flex items-center gap-3">
          <span className="h-8 w-1 shrink-0 rounded-full bg-[#538463]" aria-hidden="true" />
          <h1 className="text-xl font-semibold leading-tight tracking-[-0.03em] text-[#1f241f] sm:text-[1.75rem] lg:text-[2rem]">
            {STOCK_FLOW_TERMS.request} — Tra soát
          </h1>
          <TitleInfoButton text="Quản trị viên chỉ xem và tra soát. Mọi thao tác duyệt, từ chối, hủy hoặc điều chuyển đều thuộc vai trò nghiệp vụ." />
        </div>
        <p className="mt-1.5 text-sm leading-6 text-[#707a72]">Chế độ chỉ đọc dành cho Quản trị viên.</p>
      </header>

      <ListFilterToolbar className="!mb-0">
          <label className="w-[24rem] shrink-0">
            <span className="sr-only">Mã yêu cầu / SKU / Tên sản phẩm</span>
            <input
              type="text"
              value={filters.search}
              onChange={(event) => updateDraft({ search: event.target.value })}
              placeholder="Tìm mã yêu cầu, mã SKU, tên sản phẩm..."
              className={`${listFilterControlClass} w-full`}
            />
          </label>
          {QUICK_FILTERS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => {
                setActiveTab(tab.key)
                setPage(1)
              }}
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${activeTab === tab.key ? 'border-[#356647] bg-[#356647] text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-[#356647]/40 hover:bg-[#f6f4ec]'}`}
            >
              {tab.label}
            </button>
          ))}
          <label className="min-w-[150px]">
            <span className="sr-only">Từ ngày</span>
            <input
              type="date"
              value={filters.fromDate}
              onChange={(event) => updateDraft({ fromDate: event.target.value })}
              className={listFilterControlClass}
            />
          </label>

          <label className="min-w-[150px]">
            <span className="sr-only">Đến ngày</span>
            <input
              type="date"
              value={filters.toDate}
              onChange={(event) => updateDraft({ toDate: event.target.value })}
              className={listFilterControlClass}
            />
          </label>

          <label className="min-w-[180px]">
            <span className="sr-only">Sắp xếp</span>
            <select
              value={sort}
              onChange={(event) => {
                setSort(event.target.value)
                setPage(1)
              }}
              className={`${listFilterSelectClass} min-w-[9.5rem]`}
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value || 'default'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          {hasActiveFilters ? (
            <button
              type="button"
              onClick={handleClearFilters}
              className={`${listFilterControlClass} font-semibold hover:bg-slate-50`}
            >
              Xóa lọc
            </button>
          ) : null}
      </ListFilterToolbar>

      <section className="rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="min-w-[1180px] w-full table-fixed text-left text-sm">
            <colgroup>
              <col className="w-[13%]" />
              <col className="w-[12%]" />
              <col className="w-[12%]" />
              <col className="w-[16%]" />
              <col className="w-[6%]" />
              <col className="w-[6%]" />
              <col className="w-[8%]" />
              <col className="w-[14%]" />
              <col className="w-[13%]" />
            </colgroup>
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="whitespace-nowrap px-4 py-3">Mã yêu cầu</th>
                <th className="whitespace-nowrap px-4 py-3">Trạng thái</th>
                <th className="whitespace-nowrap px-4 py-3">Người tạo</th>
                <th className="whitespace-nowrap px-4 py-3">Thời gian gửi</th>
                <th className="whitespace-nowrap px-4 py-3 text-center">Sản phẩm</th>
                <th className="whitespace-nowrap px-4 py-3 text-center">Tiến độ</th>
                <th className="whitespace-nowrap px-4 py-3 text-center">Còn thiếu</th>
                <th className="whitespace-nowrap px-4 py-3">Người xử lý gần nhất</th>
                <th className="whitespace-nowrap px-4 py-3">Thời gian xử lý gần nhất</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-sm text-slate-500">
                    Đang tải...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-sm text-slate-500">
                    Không có yêu cầu nào khớp bộ lọc.
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const creator = resolveActor(
                    userDirectory,
                    row.requestedBy,
                    row.requestedByName,
                    row.requestedByRoleName,
                  )
                  const reviewer = resolveActor(
                    userDirectory,
                    row.reviewedBy,
                    row.reviewedByName,
                    row.reviewedByRoleName,
                  )
                  // Đếm theo dòng sản phẩm; không cộng số lượng giữa các SKU khác đơn vị.
                  const itemCount = Number(row.itemCount ?? 0)
                  const processedItemCount = Number(row.processedItemCount ?? 0)
                  const remainingItemCount = Number(row.remainingItemCount ?? 0)
                  return (
                    <tr key={row.id} className="hover:bg-[#fbf9f1]/50">
                      <td className="whitespace-nowrap px-4 py-3">
                        <button
                          type="button"
                          onClick={() => setDetailId(row.id)}
                          title="Xem chi tiết yêu cầu"
                          className="font-mono text-xs font-bold text-[#356647] underline-offset-2 hover:underline"
                        >
                          {row.requestCode || '—'}
                        </button>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${getAdjustmentStatusClass(row.status)}`}
                        >
                          {getAdjustmentStatusLabel(row.status)}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-800">
                        {textOrDash(creator.name)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                        {formatVietnamDateTime(row.requestedAt)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-center text-slate-700">
                        {itemCount}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-center text-xs font-semibold text-slate-700">
                        {processedItemCount}/{itemCount}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-center">
                        <span
                          className={
                            remainingItemCount > 0
                              ? 'rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800'
                              : 'text-xs font-semibold text-slate-400'
                          }
                        >
                          {remainingItemCount} sản phẩm
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                        {textOrDash(reviewer.name)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                        {row.reviewedAt ? formatVietnamDateTime(row.reviewedAt) : '—'}
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
          pageSizeOptions={pageSizeOptions}
          totalCount={totalCount}
          itemLabel="yêu cầu"
          disabled={isLoading}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size)
            setPage(1)
          }}
        />
      </section>

      {detailId ? (
        <div className="inventory-modal fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4">
          <div className="my-8 w-full max-w-4xl rounded-2xl bg-white p-6 shadow-xl sm:p-8">
            <div className="mb-6 flex items-start justify-between gap-3">
              <h3 className="text-lg font-bold text-slate-800">Chi tiết yêu cầu (chỉ xem)</h3>
              <button
                type="button"
                onClick={() => setDetailId(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Đóng
              </button>
            </div>

            {isLoadingDetail ? (
              <p className="text-sm text-slate-500">Đang tải chi tiết...</p>
            ) : detail ? (
              <>
                <div className="mb-6 grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Người tạo</p>
                    <p className="mt-1 text-sm font-medium text-slate-800">
                      {textOrDash(detailCreator.name)}
                      {detailCreator.roleName ? ` · ${formatCreatorRole(detailCreator.roleName)}` : ''}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      Người xử lý gần nhất
                    </p>
                    <p className="mt-1 text-sm font-medium text-slate-800">
                      {textOrDash(detailReviewer.name)}
                      {detailReviewer.roleName ? ` · ${formatCreatorRole(detailReviewer.roleName)}` : ''}
                    </p>
                  </div>
                </div>

                <StockAdjustmentRequestDetailPanel
                  request={detail}
                  relatedTransfers={detailTransfers}
                  canReview={false}
                  canCancel={false}
                  canCancelAny={false}
                  currentUserId=""
                  activeTab="audit"
                  actingId={null}
                />
              </>
            ) : (
              <p className="text-sm text-slate-500">
                Không tải được chi tiết yêu cầu. Vui lòng đóng và thử lại.
              </p>
            )}
          </div>
        </div>
      ) : null}
    </PageShell>
  )
}
