import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../../../components/shared/PageHeader.jsx'
import PageShell from '../../../components/shared/PageShell.jsx'
import TablePagination, { TABLE_PAGE_SIZE } from '../../../components/shared/TablePagination.jsx'
import { showError } from '../../../app/toast.js'
import { formatVietnamDateTime } from '../../../utils/vietnamDateTime.js'
import { canOperateSupplierReturn } from '../../auth/utils/permissions.js'
import { loadAuthSession } from '../../auth/services/authSession.js'
import { formatStockQuantity } from '../../products/utils/productDisplay.js'
import { InfoTile, SUPPLIER_RETURN_FLOW_DESCRIPTION } from '../components/SupplierReturnConfirmModal.jsx'
import {
  fetchSupplierReturnRequests,
  getInventoryReturnStatusClass,
  getInventoryReturnStatusLabel,
} from '../services/inventoryReturnApi.js'

function getPrimaryItemSummary(row) {
  if (!row.items?.length) return 'Chưa có dòng sản phẩm'
  if (row.items.length === 1) return `${row.items[0].skuSnapshotName} (${row.items[0].skuCode})`
  return `${row.items.length} dòng sản phẩm`
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
                      <p className="font-semibold text-slate-800">{item.skuSnapshotName}</p>
                      <p className="font-mono text-xs text-slate-500">{item.skuCode}</p>
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
  const [pageSize, setPageSize] = useState(TABLE_PAGE_SIZE)
  const [data, setData] = useState({ items: [], totalItems: 0, totalPages: 1 })
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
        <div className="border-b border-slate-100 bg-slate-50/80 px-6 py-3 text-sm text-slate-600">
          {SUPPLIER_RETURN_FLOW_DESCRIPTION}
        </div>
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
                  <td colSpan={7} className="px-6 py-8 text-slate-500">Đang tải...</td>
                </tr>
              ) : data.items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-slate-500">Chưa có phiếu trả hàng nhập.</td>
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
