import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../../../components/shared/PageHeader.jsx'
import PageShell from '../../../components/shared/PageShell.jsx'
import TablePagination from '../../../components/shared/TablePagination.jsx'
import { useTotalAwarePageSize } from '../../../utils/totalAwarePageSize.js'
import { showError } from '../../../app/toast.js'
import { formatVietnamDateTime } from '../../../utils/vietnamDateTime.js'
import { canOperateSupplierReturn } from '../../auth/utils/permissions.js'
import { loadAuthSession } from '../../auth/services/authSession.js'
import { formatStockQuantity } from '../../products/utils/productDisplay.js'
import { InfoTile } from '../components/SupplierReturnConfirmModal.jsx'
import {
  fetchSupplierReturnRequests,
  getInventoryReturnStatusClass,
  getInventoryReturnStatusLabel,
} from '../services/inventoryReturnApi.js'

function getPrimaryItemSummary(row) {
  if (!row.items?.length) return 'Chưa có dòng sản phẩm'
  if (row.items.length === 1) {
    const item = row.items[0]
    const name = String(item.skuSnapshotName || '').trim()
    return name ? `${item.skuCode} — ${name}` : (item.skuCode || '—')
  }
  return `${row.items[0].skuCode} +${row.items.length - 1} SKU`
}

function ReturnDetailModal({ request, onClose }) {
  if (!request) return null

  return (
    <div className="inventory-modal fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="max-h-[90dvh] w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-800">{request.returnCode}</h2>
            <p className="mt-1 text-sm text-slate-500">Phiếu nhập NCC: {request.supplierReceiptCode || '—'}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <span className="material-symbols-outlined text-[22px]">close</span>
          </button>
        </div>

        <div className="custom-scrollbar max-h-[calc(90dvh-88px)] overflow-y-auto px-6 py-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <InfoTile label="Trạng thái" value={getInventoryReturnStatusLabel(request.status)} />
            <InfoTile label="Lý do lỗi" value={request.defectReasonLabel || '—'} />
            <InfoTile label="Người tạo" value={request.createdByName || 'Chưa xác định'} />
            <InfoTile label="Thời gian tạo" value={formatVietnamDateTime(request.createdAt)} />
          </div>

          <div className="mt-5 rounded-xl border border-slate-100">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Sản Phẩm</th>
                  <th className="px-4 py-3">Lô nguồn</th>
                  <th className="px-4 py-3 text-right">Số lượng</th>
                  <th className="px-4 py-3 text-right">Tồn Kho sau</th>
                  <th className="px-4 py-3">Phiếu xuất</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {request.items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3">
                      <p className="font-mono font-semibold text-[#356647]">{item.skuCode}</p>
                      <p className="text-xs text-slate-600">{item.skuSnapshotName || '—'}</p>
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-700">{item.warehouseBatchLotCode || '—'}</td>
                    <td className="px-4 py-3 text-right font-semibold">{formatStockQuantity(item.quantity)}</td>
                    <td className="px-4 py-3 text-right text-slate-700">
                      {item.warehouseQtyAfter == null ? '—' : formatStockQuantity(item.warehouseQtyAfter)}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-700">{item.stockExportSlipCode || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <InfoTile label="Mô tả chi tiết" value={request.reason || '—'} />
            <InfoTile label="Ghi chú" value={request.note || '—'} />
          </div>

          {request.evidenceImageUrls.length > 0 ? (
            <div className="mt-5 rounded-xl border border-slate-100 p-4">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                Ảnh hàng lỗi ({request.evidenceImageUrls.length})
              </p>
              <div className="mt-2 flex flex-wrap gap-3">
                {request.evidenceImageUrls.map((url) => (
                  <a key={url} href={url} target="_blank" rel="noreferrer">
                    <img
                      src={url}
                      alt="Ảnh hàng lỗi"
                      className="h-32 w-32 rounded-xl border border-slate-200 object-cover"
                    />
                  </a>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default function InventoryReturnsPage() {
  const navigate = useNavigate()
  const [searchInput, setSearchInput] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState({ items: [], totalItems: 0, totalPages: 1 })
  const { pageSize, setPageSize, pageSizeOptions } = useTotalAwarePageSize(data.totalItems)

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil((data.totalItems || 0) / pageSize) || 1)
    if (page > totalPages) setPage(totalPages)
  }, [data.totalItems, pageSize, page])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedRequest, setSelectedRequest] = useState(null)
  const canCreate = canOperateSupplierReturn(loadAuthSession())

  const loadRequests = useCallback(async () => {
    setIsLoading(true)
    try {
      const result = await fetchSupplierReturnRequests({
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
  }, [page, pageSize, searchInput])

  useEffect(() => {
    const timer = window.setTimeout(loadRequests, 250)
    return () => window.clearTimeout(timer)
  }, [loadRequests])

  function handleSearchChange(value) {
    setSearchInput(value)
    setPage(1)
  }

  return (
    <PageShell>
      <PageHeader
        compact
        title="Trả hàng nhập"
        titleInfo={canCreate
          ? 'Tạo phiếu trả hàng lỗi từ Kho về nhà cung cấp, tồn Kho trừ ngay khi tạo.'
          : 'Xem phiếu trả hàng lỗi từ Kho về nhà cung cấp (chỉ xem).'}
        searchPlaceholder="Tìm mã phiếu, phiếu gốc, sản phẩm, lô..."
        searchValue={searchInput}
        onSearchChange={handleSearchChange}
        rightContent={canCreate ? (
          <button
            type="button"
            onClick={() => navigate('/inventory/returns/create')}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#538463] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#457053]"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            Tạo phiếu trả
          </button>
        ) : null}
      />

      <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-6 py-3">Mã phiếu</th>
                <th className="px-4 py-3">Phiếu gốc</th>
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
                  <td colSpan={7} className="px-6 py-10 text-center text-slate-500">
                    <span className="inline-flex items-center gap-2 text-sm font-semibold">
                      <span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>
                      Đang tải phiếu trả...
                    </span>
                  </td>
                </tr>
              ) : data.items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <p className="font-semibold text-slate-800">
                      {searchInput.trim() ? 'Không tìm thấy phiếu khớp từ khóa' : 'Chưa có phiếu trả hàng nhập'}
                    </p>
                    <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
                      {searchInput.trim()
                        ? 'Thử mã phiếu, phiếu gốc hoặc tên sản phẩm khác.'
                        : 'Tạo phiếu khi cần trả hàng lỗi từ Kho về nhà cung cấp. Tồn Kho trừ ngay khi tạo.'}
                    </p>
                    <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                      {searchInput.trim() ? (
                        <button
                          type="button"
                          onClick={() => handleSearchChange('')}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
                        >
                          <span className="material-symbols-outlined text-[18px]">search_off</span>
                          Xóa tìm kiếm
                        </button>
                      ) : null}
                      {canCreate ? (
                        <button
                          type="button"
                          onClick={() => navigate('/inventory/returns/create')}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-[#538463] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#457053]"
                        >
                          <span className="material-symbols-outlined text-[18px]">add</span>
                          Tạo phiếu trả
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => navigate('/inventory/import')}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
                      >
                        Xem phiếu nhập
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                data.items.map((request) => (
                  <tr key={request.id} className="hover:bg-slate-50/80">
                    <td className="px-6 py-4">
                      <p className="font-mono font-semibold text-[#356647]">{request.returnCode}</p>
                      <p className="text-xs text-slate-500">{request.defectReasonLabel || '—'}</p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-xs text-slate-500">Phiếu nhập NCC</p>
                      <p className="font-mono text-sm text-slate-700">{request.supplierReceiptCode || '—'}</p>
                    </td>
                    <td className="px-4 py-4 text-slate-700">{getPrimaryItemSummary(request)}</td>
                    <td className="px-4 py-4 text-right font-semibold text-slate-800">
                      {formatStockQuantity(request.totalQuantity)}
                    </td>
                    <td className="px-4 py-4">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getInventoryReturnStatusClass(request.status)}`}>
                        {getInventoryReturnStatusLabel(request.status)}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-slate-600">{formatVietnamDateTime(request.createdAt)}</td>
                    <td className="px-4 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedRequest(request)}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Chi tiết
                      </button>
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
          pageSizeOptions={pageSizeOptions}
          totalCount={data.totalItems}
          onPageChange={setPage}
          onPageSizeChange={(size) => { setPageSize(size); setPage(1) }}
          disabled={isLoading}
          itemLabel="phiếu trả hàng nhập"
        />
      </section>

      <ReturnDetailModal request={selectedRequest} onClose={() => setSelectedRequest(null)} />
    </PageShell>
  )
}
