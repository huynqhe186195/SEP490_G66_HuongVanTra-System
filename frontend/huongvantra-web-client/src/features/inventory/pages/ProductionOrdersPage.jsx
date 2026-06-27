import { useCallback, useEffect, useState } from 'react'
import PageShell from '../../../components/shared/PageShell.jsx'
import PageHeader from '../../../components/shared/PageHeader.jsx'
import TablePagination, { TABLE_PAGE_SIZE } from '../../../components/shared/TablePagination.jsx'
import { showError, showSuccess } from '../../../app/toast.js'
import { formatVietnamDateTime } from '../../../utils/vietnamDateTime.js'
import InventoryNavTabs from '../components/InventoryNavTabs.jsx'
import CreateProductionOrderModal from '../components/CreateProductionOrderModal.jsx'
import {
  cancelProductionOrder,
  completeProductionOrder,
  fetchProductionOrders,
  PRODUCTION_STATUS_CLASS,
  PRODUCTION_STATUS_LABEL,
} from '../services/productionOrderApi.js'

const STATUS_TABS = [
  { key: '', label: 'Tất cả' },
  { key: 'Draft', label: 'Nháp' },
  { key: 'Completed', label: 'Hoàn thành' },
  { key: 'Cancelled', label: 'Đã hủy' },
]

function ConfirmDialog({ message, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onCancel}>
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="mb-6 text-sm text-slate-700">{message}</p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            Không
          </button>
          <button
            onClick={onConfirm}
            className="rounded-xl bg-[#538463] px-4 py-2 text-sm font-bold text-white hover:bg-[#457053]"
          >
            Xác nhận
          </button>
        </div>
      </div>
    </div>
  )
}

function StatusChip({ status }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${PRODUCTION_STATUS_CLASS[status] ?? 'bg-slate-100 text-slate-500'}`}>
      {PRODUCTION_STATUS_LABEL[status] ?? status}
    </span>
  )
}

function ProductionOrdersPage() {
  const [activeTab, setActiveTab] = useState('')
  const [orders, setOrders] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(TABLE_PAGE_SIZE)
  const [totalCount, setTotalCount] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [expandedId, setExpandedId] = useState(null)
  const [actingId, setActingId] = useState(null)
  const [confirmAction, setConfirmAction] = useState(null) // { type: 'complete'|'cancel', order }
  const [showCreateModal, setShowCreateModal] = useState(false)

  const loadOrders = useCallback(async () => {
    setIsLoading(true)
    try {
      const result = await fetchProductionOrders({
        status: activeTab || undefined,
        page,
        pageSize,
      })
      setOrders(result.items)
      setTotalCount(result.totalCount)
      setTotalPages(result.totalPages)
    } catch (err) {
      showError(err.message)
    } finally {
      setIsLoading(false)
    }
  }, [activeTab, page, pageSize])

  useEffect(() => {
    loadOrders()
  }, [loadOrders])

  function handleTabChange(key) {
    setActiveTab(key)
    setPage(1)
  }

  async function handleAction(type, order) {
    setActingId(order.id)
    setConfirmAction(null)
    try {
      if (type === 'complete') {
        await completeProductionOrder(order.id)
        showSuccess(`Hoàn thành lệnh ${order.productionCode}. Kho đã được cập nhật.`)
      } else {
        await cancelProductionOrder(order.id)
        showSuccess(`Đã hủy lệnh ${order.productionCode}.`)
      }
      loadOrders()
    } catch (err) {
      showError(err.message)
    } finally {
      setActingId(null)
    }
  }

  function handleCreated(order) {
    showSuccess(`Đã tạo lệnh sản xuất ${order.productionCode}.`)
    setPage(1)
    loadOrders()
  }

  return (
    <PageShell>
      <PageHeader
        title="Lệnh sản xuất"
        description="Quản lý lệnh Make-to-Stock — xuất nguyên liệu và nhập thành phẩm tự động"
        rightContent={
          <div className="flex items-center gap-3">
            <InventoryNavTabs />
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#538463] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#457053]"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              Tạo lệnh
            </button>
          </div>
        }
      />

      {/* Status tabs */}
      <div className="flex flex-wrap gap-2">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => handleTabChange(tab.key)}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
              activeTab === tab.key
                ? 'bg-[#538463] text-white'
                : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs font-semibold text-[#717971]">
              <th className="px-4 py-3">Mã lệnh</th>
              <th className="px-4 py-3">Thành phẩm</th>
              <th className="px-4 py-3 text-right">Số lượng</th>
              <th className="px-4 py-3">Trạng thái</th>
              <th className="px-4 py-3">Ngày tạo</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-sm text-slate-400">
                  Đang tải...
                </td>
              </tr>
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-sm text-slate-400">
                  Không có lệnh sản xuất nào.
                </td>
              </tr>
            ) : (
              orders.map((order) => (
                <>
                  <tr
                    key={order.id}
                    className="cursor-pointer border-b border-slate-50 hover:bg-slate-50/60"
                    onClick={() => setExpandedId(expandedId === order.id ? null : order.id)}
                  >
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-[#356647]">
                      {order.productionCode}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">{order.finishedSkuSnapshotName}</p>
                      <p className="text-xs text-[#717971]">{order.finishedSkuCode}</p>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-800">
                      {order.quantity.toLocaleString('vi-VN')}
                    </td>
                    <td className="px-4 py-3">
                      <StatusChip status={order.status} />
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {order.createdAt ? formatVietnamDateTime(order.createdAt) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {order.status === 'Draft' && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setConfirmAction({ type: 'complete', order })
                            }}
                            disabled={actingId === order.id}
                            className="rounded-lg bg-[#538463] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#457053] disabled:opacity-50"
                          >
                            Hoàn thành
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setConfirmAction({ type: 'cancel', order })
                            }}
                            disabled={actingId === order.id}
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                          >
                            Hủy
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>

                  {/* Expanded BOM lines */}
                  {expandedId === order.id && order.lines.length > 0 && (
                    <tr key={`${order.id}-detail`} className="bg-slate-50/40">
                      <td colSpan={6} className="px-6 py-4">
                        <p className="mb-2 text-xs font-semibold text-[#717971]">Nguyên liệu:</p>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          {order.lines.map((line) => (
                            <div
                              key={line.id}
                              className="rounded-lg border border-slate-100 bg-white px-3 py-2 text-xs"
                            >
                              <p className="font-medium text-slate-800">{line.materialSnapshotName}</p>
                              <p className="text-[#717971]">
                                {line.materialSkuCode} · {line.plannedQuantity.toLocaleString('vi-VN')} đơn vị
                              </p>
                            </div>
                          ))}
                        </div>
                        {order.completedAt && (
                          <p className="mt-2 text-xs text-slate-400">
                            Hoàn thành: {formatVietnamDateTime(order.completedAt)}
                          </p>
                        )}
                        {order.note && (
                          <p className="mt-2 text-xs italic text-slate-500">Ghi chú: {order.note}</p>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              ))
            )}
          </tbody>
        </table>

        {totalCount > pageSize && (
          <div className="border-t border-slate-100 px-4 py-3">
            <TablePagination
              page={page}
              pageSize={pageSize}
              totalCount={totalCount}
              onPageChange={setPage}
              onPageSizeChange={(size) => { setPageSize(size); setPage(1) }}
              disabled={isLoading}
              itemLabel="lệnh"
            />
          </div>
        )}
      </div>

      {/* Confirm dialog */}
      {confirmAction && (
        <ConfirmDialog
          message={
            confirmAction.type === 'complete'
              ? `Hoàn thành lệnh "${confirmAction.order.productionCode}"? Hệ thống sẽ tự động xuất nguyên liệu theo FIFO và nhập thành phẩm vào kho tổng.`
              : `Hủy lệnh "${confirmAction.order.productionCode}"? Thao tác không thể hoàn tác.`
          }
          onConfirm={() => handleAction(confirmAction.type, confirmAction.order)}
          onCancel={() => setConfirmAction(null)}
        />
      )}

      {/* Create modal */}
      <CreateProductionOrderModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={handleCreated}
      />
    </PageShell>
  )
}

export default ProductionOrdersPage
