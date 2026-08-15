import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../../../components/shared/PageHeader.jsx'
import PageShell from '../../../components/shared/PageShell.jsx'
import TablePagination from '../../../components/shared/TablePagination.jsx'
import { useTotalAwarePageSize } from '../../../utils/totalAwarePageSize.js'
import ReasonSuggestionChips from '../../../components/shared/ReasonSuggestionChips.jsx'
import { showError, showSuccess } from '../../../app/toast.js'
import { loadAuthSession } from '../../auth/services/authSession.js'
import { canOperateStockTransfer } from '../../auth/utils/permissions.js'
import { getReasonSuggestions } from '../../shared/reasonSuggestions.js'
import { formatStockQuantity } from '../../products/utils/productDisplay.js'
import { formatVietnamDateTime } from '../../../utils/vietnamDateTime.js'
import {
  dismissShelfReplenishmentSuggestion,
  fetchShelfReplenishmentSuggestions,
  SHELF_SUGGESTION_STATUS_LABELS,
} from '../services/shelfReplenishmentSuggestionApi.js'
import { getStockFlowErrorMessage, STOCK_FLOW_TERMS } from '../utils/stockFlowLabels.js'

const STATUS_TABS = [
  { key: 'Open', label: 'Đang mở' },
  { key: 'Handled', label: 'Đã xử lý' },
  { key: 'Dismissed', label: 'Đã bỏ qua' },
  { key: '', label: 'Tất cả' },
]

const STATUS_CLASS = {
  Open: 'bg-amber-100 text-amber-800',
  Handled: 'bg-[#e8f1eb] text-[#356647]',
  Dismissed: 'bg-slate-100 text-slate-600',
}

/** Bảng chi tiết SKU của một gợi ý: chỉ hiện số liệu tại thời điểm kiểm kệ, không có số lượng đề xuất. */
function SuggestionItemsTable({ items }) {
  return (
    <div className="overflow-x-auto custom-scrollbar rounded-xl border border-slate-200">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <tr>
            <th className="whitespace-nowrap px-4 py-3">Sản phẩm</th>
            <th className="whitespace-nowrap px-4 py-3 text-right">Tồn {STOCK_FLOW_TERMS.shelf}</th>
            <th className="whitespace-nowrap px-4 py-3 text-right">Đang giữ</th>
            <th className="whitespace-nowrap px-4 py-3 text-right">Ngưỡng tối thiểu</th>
            <th className="whitespace-nowrap px-4 py-3 text-right">Tồn {STOCK_FLOW_TERMS.warehouse}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-500">
                Gợi ý không có sản phẩm nào.
              </td>
            </tr>
          ) : (
            items.map((item) => (
              <tr key={item.id}>
                <td className="px-4 py-3">
                  <span className="block font-mono text-xs font-bold text-[#356647]">{item.skuCode || '—'}</span>
                  <span className="mt-0.5 block text-slate-800">{item.skuSnapshotName || '—'}</span>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right font-bold text-rose-700">
                  {formatStockQuantity(item.shelfQuantityAtStocktake)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right text-slate-600">
                  {formatStockQuantity(item.shelfReservedAtStocktake)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right text-slate-700">
                  {formatStockQuantity(item.shelfLowStockThreshold)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-[#356647]">
                  {formatStockQuantity(item.warehouseQuantityAtStocktake)}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

export default function ShelfReplenishmentSuggestionsPage() {
  const navigate = useNavigate()
  const session = loadAuthSession()
  const canOperate = canOperateStockTransfer(session)

  const [status, setStatus] = useState('Open')
  const [searchValue, setSearchValue] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const { pageSize, setPageSize, pageSizeOptions } = useTotalAwarePageSize(totalCount)

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil((totalCount || 0) / pageSize) || 1)
    if (page > totalPages) setPage(totalPages)
  }, [totalCount, pageSize, page])
  const [isLoading, setIsLoading] = useState(true)
  const [expandedId, setExpandedId] = useState(null)
  const [dismissTarget, setDismissTarget] = useState(null)
  const [dismissReason, setDismissReason] = useState('')
  const [actingId, setActingId] = useState(null)

  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await fetchShelfReplenishmentSuggestions({
        status: status || undefined,
        search: searchValue.trim() || undefined,
        page,
        pageSize,
      })
      setSuggestions(data.items)
      setTotalCount(data.totalCount)
    } catch (error) {
      setSuggestions([])
      setTotalCount(0)
      showError(getStockFlowErrorMessage(error, 'Không tải được danh sách gợi ý bổ sung Kệ Hàng.'))
    } finally {
      setIsLoading(false)
    }
  }, [status, searchValue, page, pageSize])

  useEffect(() => {
    const timer = setTimeout(() => {
      loadData()
    }, 250)
    return () => clearTimeout(timer)
  }, [loadData])

  async function handleDismiss() {
    if (!dismissTarget) return
    if (!dismissReason.trim()) {
      showError('Vui lòng nhập lý do bỏ qua gợi ý.')
      return
    }
    setActingId(dismissTarget.id)
    try {
      await dismissShelfReplenishmentSuggestion(dismissTarget.id, dismissReason)
      showSuccess(`Đã bỏ qua gợi ý ${dismissTarget.suggestionCode}.`)
      setDismissTarget(null)
      setDismissReason('')
      await loadData()
    } catch (error) {
      showError(getStockFlowErrorMessage(error, 'Không bỏ qua được gợi ý.'))
    } finally {
      setActingId(null)
    }
  }

  return (
    <PageShell>
      <PageHeader
        compact
        title="Gợi ý bổ sung Kệ Hàng"
        titleInfo={
          `Sinh tự động khi phiếu kiểm ${STOCK_FLOW_TERMS.shelf} được duyệt và tồn khả dụng chạm ngưỡng tối thiểu.`
        }
        description={
          'Gợi ý chỉ hiển thị số liệu tại thời điểm kiểm kệ — Thủ kho tự quyết số lượng điều chuyển. '
          + 'Gợi ý tự động đóng khi phiếu điều chuyển liên kết được hoàn tất.'
        }
        searchPlaceholder="Tìm mã gợi ý, mã phiếu kiểm kệ, mã SKU..."
        searchValue={searchValue}
        onSearchChange={(value) => {
          setSearchValue(value)
          setPage(1)
        }}
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.key || 'all'}
            type="button"
            onClick={() => {
              setStatus(tab.key)
              setPage(1)
            }}
            className={`rounded-xl px-5 py-2.5 text-sm font-semibold transition-colors ${
              status === tab.key
                ? 'bg-[#538463] text-white shadow-md shadow-[#538463]/20'
                : 'bg-white text-slate-600 hover:bg-slate-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <section className="rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="whitespace-nowrap px-4 py-3">Mã gợi ý</th>
                <th className="whitespace-nowrap px-4 py-3">Phiếu kiểm kệ</th>
                <th className="whitespace-nowrap px-4 py-3">Trạng thái</th>
                <th className="whitespace-nowrap px-4 py-3">Thời điểm sinh</th>
                <th className="whitespace-nowrap px-4 py-3 text-right">Sản phẩm</th>
                <th className="whitespace-nowrap px-4 py-3">Lý do gợi ý</th>
                <th className="whitespace-nowrap px-4 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-500">
                    Đang tải...
                  </td>
                </tr>
              ) : suggestions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-500">
                    Không có gợi ý nào khớp bộ lọc.
                  </td>
                </tr>
              ) : (
                suggestions.map((row) => {
                  const isOpen = row.status === 'Open'
                  const isExpanded = expandedId === row.id
                  return [
                    <tr key={row.id} className="hover:bg-[#fbf9f1]/50">
                      <td className="whitespace-nowrap px-4 py-3">
                        <button
                          type="button"
                          onClick={() => setExpandedId(isExpanded ? null : row.id)}
                          title="Xem chi tiết sản phẩm trong gợi ý"
                          className="font-mono text-xs font-bold text-[#356647] underline-offset-2 hover:underline"
                        >
                          {row.suggestionCode || '—'}
                        </button>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-slate-700">
                        {row.sourceStocktakeCode || '—'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            STATUS_CLASS[row.status] ?? 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {SHELF_SUGGESTION_STATUS_LABELS[row.status] ?? row.status}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                        {formatVietnamDateTime(row.createdAt)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-slate-700">
                        {row.itemCount} sản phẩm
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-900">
                          <span className="material-symbols-outlined text-[14px]">warning</span>
                          Sản phẩm đang dưới ngưỡng cảnh báo — yêu cầu bổ sung
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        {canOperate && isOpen ? (
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                navigate(
                                  `/inventory/stock-transfers/create?sourceSuggestionId=${row.id}`,
                                )
                              }
                              className="rounded-xl bg-[#538463] px-3 py-2 text-xs font-bold text-white hover:bg-[#457053]"
                              title={`Tạo ${STOCK_FLOW_TERMS.transfer}`}
                            >
                              Tạo phiếu
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setDismissTarget(row)
                                setDismissReason('')
                              }}
                              className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              Bỏ qua
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                    </tr>,
                    isExpanded ? (
                      <tr key={`${row.id}-detail`} className="bg-[#fbf9f1]/40">
                        <td colSpan={7} className="px-4 py-4">
                          <SuggestionItemsTable items={row.items} />
                          {row.handledNote ? (
                            <p className="mt-3 text-xs text-slate-600">
                              <strong>Ghi chú xử lý:</strong> {row.handledNote}
                            </p>
                          ) : null}
                        </td>
                      </tr>
                    ) : null,
                  ]
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
          itemLabel="gợi ý"
          disabled={isLoading}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size)
            setPage(1)
          }}
        />
      </section>

      {dismissTarget ? (
        <div className="inventory-modal fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-slate-800">Bỏ qua gợi ý {dismissTarget.suggestionCode}</h3>
            <p className="mt-2 text-sm text-slate-600">
              Bỏ qua không làm thay đổi tồn kho. Gợi ý sẽ chuyển sang trạng thái Đã bỏ qua và không thể mở lại.
            </p>
            <label className="mt-4 block space-y-2">
              <span className="text-xs font-semibold text-slate-500">Lý do bỏ qua *</span>
              <ReasonSuggestionChips
                suggestions={getReasonSuggestions('shelfReplenishmentDismiss')}
                value={dismissReason}
                onSelect={setDismissReason}
              />
              <textarea
                rows={3}
                required
                value={dismissReason}
                onChange={(event) => setDismissReason(event.target.value)}
                className="w-full resize-none rounded-xl border-none bg-[#f0eee6] p-3 text-sm focus:ring-2 focus:ring-[#356647]/20"
                placeholder="VD: Đã bổ sung bằng phiếu điều chuyển khác."
              />
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setDismissTarget(null)
                  setDismissReason('')
                }}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
              >
                Đóng
              </button>
              <button
                type="button"
                disabled={actingId === dismissTarget.id}
                onClick={handleDismiss}
                className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-bold text-white hover:bg-rose-700 disabled:opacity-50"
              >
                Xác nhận bỏ qua
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </PageShell>
  )
}
