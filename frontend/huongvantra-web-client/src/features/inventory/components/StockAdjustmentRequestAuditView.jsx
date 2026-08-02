import { useCallback, useEffect, useMemo, useState } from 'react'
import PageHeader from '../../../components/shared/PageHeader.jsx'
import PageShell from '../../../components/shared/PageShell.jsx'
import TablePagination, { TABLE_PAGE_SIZE } from '../../../components/shared/TablePagination.jsx'
import { showError } from '../../../app/toast.js'
import { formatVietnamDateTime } from '../../../utils/vietnamDateTime.js'
import { formatCreatorRole, UNKNOWN_CREATOR_VALUE } from '../utils/inventoryCreatorDisplay.js'
import {
  getStockFlowErrorMessage,
  STOCK_FLOW_TERMS,
  STOCK_REQUEST_STATUS_OPTIONS,
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
  status: '',
  createdBy: '',
  creatorRole: '',
  fromDate: '',
  toDate: '',
}

const FIELD_CLASS =
  'min-h-[44px] w-full rounded-xl border border-slate-200 bg-[#fbf9f1] px-4 py-3 text-sm outline-none focus:border-[#538463]'
const LABEL_CLASS = 'mb-1 block text-xs font-bold uppercase tracking-wider text-slate-400'

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
  const [draftFilters, setDraftFilters] = useState(EMPTY_FILTERS)
  const [appliedFilters, setAppliedFilters] = useState(EMPTY_FILTERS)
  const [rows, setRows] = useState([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(TABLE_PAGE_SIZE)
  const [totalCount, setTotalCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [creatorOptions, setCreatorOptions] = useState([])
  const [creatorRoleOptions, setCreatorRoleOptions] = useState([])
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

  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await fetchStockAdjustmentRequests({
        search: appliedFilters.search.trim() || undefined,
        status: appliedFilters.status || undefined,
        createdBy: appliedFilters.createdBy || undefined,
        creatorRole: appliedFilters.creatorRole || undefined,
        fromDate: appliedFilters.fromDate || undefined,
        toDate: appliedFilters.toDate || undefined,
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
  }, [appliedFilters, page, pageSize])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    let mounted = true
    fetchStockAdjustmentRequestFilterOptions()
      .then((options) => {
        if (!mounted) return
        setCreatorOptions(options.creators)
        setCreatorRoleOptions(options.creatorRoles)
      })
      .catch((error) => {
        if (!mounted) return
        setCreatorOptions([])
        setCreatorRoleOptions([])
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
    () => Object.values(appliedFilters).some((value) => String(value).trim() !== ''),
    [appliedFilters],
  )

  function updateDraft(patch) {
    setDraftFilters((prev) => ({ ...prev, ...patch }))
  }

  function handleSubmit(event) {
    event.preventDefault()
    if (draftFilters.fromDate && draftFilters.toDate && draftFilters.toDate < draftFilters.fromDate) {
      showError('Khoảng thời gian không hợp lệ: ngày kết thúc phải sau hoặc bằng ngày bắt đầu.')
      return
    }
    setAppliedFilters(draftFilters)
    setPage(1)
  }

  function handleClearFilters() {
    setDraftFilters(EMPTY_FILTERS)
    setAppliedFilters(EMPTY_FILTERS)
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
    <PageShell>
      <PageHeader
        title={`${STOCK_FLOW_TERMS.request} — Tra soát`}
        titleInfo="Quản trị viên chỉ xem và tra soát. Mọi thao tác duyệt, từ chối, hủy hoặc điều chuyển đều thuộc vai trò nghiệp vụ."
        description="Chế độ chỉ đọc dành cho Quản trị viên."
      />

      <form
        onSubmit={handleSubmit}
        className="mb-6 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"
      >
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-[220px] flex-1">
            <span className={LABEL_CLASS}>Mã yêu cầu / SKU / Tên sản phẩm</span>
            <input
              type="text"
              value={draftFilters.search}
              onChange={(event) => updateDraft({ search: event.target.value })}
              placeholder="Nhập mã yêu cầu, mã SKU hoặc tên sản phẩm"
              className={FIELD_CLASS}
            />
          </label>

          <label className="min-w-[180px]">
            <span className={LABEL_CLASS}>Trạng thái</span>
            <select
              value={draftFilters.status}
              onChange={(event) => updateDraft({ status: event.target.value })}
              className={FIELD_CLASS}
            >
              <option value="">Tất cả trạng thái</option>
              {STOCK_REQUEST_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="min-w-[200px]">
            <span className={LABEL_CLASS}>Người tạo</span>
            <select
              value={draftFilters.createdBy}
              onChange={(event) => updateDraft({ createdBy: event.target.value })}
              className={FIELD_CLASS}
            >
              <option value="">Tất cả người tạo</option>
              {creatorOptions.map((creator) => (
                <option key={creator.id} value={creator.id}>
                  {textOrDash(creator.name)}
                </option>
              ))}
            </select>
          </label>

          <label className="min-w-[180px]">
            <span className={LABEL_CLASS}>Vai trò người tạo</span>
            <select
              value={draftFilters.creatorRole}
              onChange={(event) => updateDraft({ creatorRole: event.target.value })}
              className={FIELD_CLASS}
            >
              <option value="">Tất cả vai trò</option>
              {creatorRoleOptions.map((role) => (
                <option key={role} value={role}>
                  {formatCreatorRole(role)}
                </option>
              ))}
            </select>
          </label>

          <label className="min-w-[150px]">
            <span className={LABEL_CLASS}>Từ ngày</span>
            <input
              type="date"
              value={draftFilters.fromDate}
              onChange={(event) => updateDraft({ fromDate: event.target.value })}
              className={FIELD_CLASS}
            />
          </label>

          <label className="min-w-[150px]">
            <span className={LABEL_CLASS}>Đến ngày</span>
            <input
              type="date"
              value={draftFilters.toDate}
              onChange={(event) => updateDraft({ toDate: event.target.value })}
              className={FIELD_CLASS}
            />
          </label>

          <button
            type="submit"
            className="rounded-xl bg-[#538463] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#457053]"
          >
            Tìm kiếm
          </button>

          {hasActiveFilters ? (
            <button
              type="button"
              onClick={handleClearFilters}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            >
              Xóa bộ lọc
            </button>
          ) : null}
        </div>
      </form>

      <section className="rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="whitespace-nowrap px-4 py-3">Mã yêu cầu</th>
                <th className="whitespace-nowrap px-4 py-3">Trạng thái</th>
                <th className="whitespace-nowrap px-4 py-3">Người tạo</th>
                <th className="whitespace-nowrap px-4 py-3">Chức vụ</th>
                <th className="whitespace-nowrap px-4 py-3">Thời gian gửi</th>
                <th className="whitespace-nowrap px-4 py-3 text-right">Sản phẩm</th>
                <th className="whitespace-nowrap px-4 py-3">Tiến độ</th>
                <th className="whitespace-nowrap px-4 py-3 text-right">Còn thiếu</th>
                <th className="whitespace-nowrap px-4 py-3">Người xử lý gần nhất</th>
                <th className="whitespace-nowrap px-4 py-3">Thời gian xử lý gần nhất</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-sm text-slate-500">
                    Đang tải...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-sm text-slate-500">
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
                        {formatCreatorRole(creator.roleName)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                        {formatVietnamDateTime(row.requestedAt)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-slate-700">
                        {itemCount} sản phẩm
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs font-semibold text-slate-700">
                        {processedItemCount}/{itemCount} sản phẩm hoàn tất
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
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
          totalCount={totalCount}
          itemLabel="yêu cầu"
          disabled={isLoading}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
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
