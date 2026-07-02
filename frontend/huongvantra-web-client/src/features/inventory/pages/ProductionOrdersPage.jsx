import { Fragment, useCallback, useEffect, useState } from 'react'
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

function getOutputLines(order) {
  const outputLines = Array.isArray(order.outputLines) ? order.outputLines.filter(Boolean) : []
  if (outputLines.length > 0) return outputLines

  return [
    {
      id: `${order.id}-legacy-output`,
      finishedSkuId: order.finishedSkuId,
      finishedSkuCode: order.finishedSkuCode,
      finishedSkuSnapshotName: order.finishedSkuSnapshotName,
      quantity: order.quantity,
      warehouseBatchId: null,
      warehouseBatchLotCode: null,
    },
  ].filter((line) => line.finishedSkuId || line.finishedSkuCode || line.finishedSkuSnapshotName)
}

function formatQuantity(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return '0'
  return number.toLocaleString('vi-VN')
}

function formatOutputCompact(outputLines) {
  return outputLines
    .map((line) => {
      const name = line.finishedSkuCode || line.finishedSkuSnapshotName
      return `${name} x${formatQuantity(line.quantity)}`
    })
    .join(', ')
}

function getOutputName(line, fallback = '-') {
  return line?.finishedSkuSnapshotName || line?.finishedSkuCode || fallback
}

function getOutputSku(line, fallback = '-') {
  return line?.finishedSkuCode || fallback
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

      <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs font-semibold text-[#717971]">
              <th className="px-4 py-3">Mã lệnh</th>
              <th className="px-4 py-3">Thành phẩm đầu ra</th>
              <th className="px-4 py-3 text-right">Tổng SL</th>
              <th className="px-4 py-3">Trạng thái</th>
              <th className="px-4 py-3">Ngày tạo</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-sm text-slate-400">
                  Đang tải lệnh sản xuất...
                </td>
              </tr>
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-sm text-slate-500">
                  <p className="font-semibold text-slate-700">Chưa có lệnh sản xuất.</p>
                  <p className="mt-1 text-xs text-slate-400">Bấm Tạo lệnh để tạo ProductionOrder cho Workflow 1.</p>
                </td>
              </tr>
            ) : (
              orders.map((order) => {
                const outputLines = getOutputLines(order)
                const isMultiOutput = outputLines.length > 1
                const totalOutputQuantity = outputLines.reduce((sum, line) => sum + Number(line.quantity || 0), 0)
                return (
                <Fragment key={order.id}>
                  <tr
                    className="cursor-pointer border-b border-slate-50 align-top hover:bg-slate-50/60"
                    onClick={() => setExpandedId(expandedId === order.id ? null : order.id)}
                  >
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-[#356647]">
                      {order.productionCode}
                    </td>
                    <td className="px-4 py-3">
                      {isMultiOutput ? (
                        <>
                          <p className="inline-flex rounded-full bg-[#f3f7f4] px-2.5 py-1 text-xs font-bold text-[#356647]">
                            {outputLines.length} thành phẩm đầu ra
                          </p>
                          <p className="mt-1 max-w-md truncate text-xs text-[#717971]">
                            {formatOutputCompact(outputLines)}
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="font-medium text-slate-800">{getOutputName(outputLines[0], order.finishedSkuSnapshotName)}</p>
                          <p className="text-xs text-[#717971]">
                            {getOutputSku(outputLines[0], order.finishedSkuCode)} · {formatQuantity(outputLines[0]?.quantity ?? order.quantity)} đơn vị
                          </p>
                        </>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-800">
                      {isMultiOutput ? (
                        <span title="Tổng số lượng các dòng thành phẩm">
                          {formatQuantity(totalOutputQuantity)} tổng
                        </span>
                      ) : (
                        formatQuantity(outputLines[0]?.quantity ?? order.quantity)
                      )}
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

                  {expandedId === order.id && (
                    <tr key={`${order.id}-detail`} className="bg-slate-50/40">
                      <td colSpan={6} className="px-6 py-4">
                        <div className="mb-4 rounded-xl border border-slate-100 bg-white">
                          <div className="border-b border-slate-100 px-4 py-3">
                            <p className="text-xs font-bold uppercase tracking-wide text-[#717971]">Thành phẩm đầu ra</p>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="min-w-full text-left text-xs">
                              <thead className="bg-slate-50 text-[#717971]">
                                <tr>
                                  <th className="px-4 py-2 font-semibold">SKU</th>
                                  <th className="px-4 py-2 font-semibold">Tên thành phẩm</th>
                                  <th className="px-4 py-2 text-right font-semibold">Số lượng</th>
                                  <th className="px-4 py-2 font-semibold">Lô thành phẩm</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {outputLines.map((line) => (
                                  <tr key={line.id}>
                                    <td className="px-4 py-2 font-mono font-semibold text-[#356647]">
                                      {getOutputSku(line)}
                                    </td>
                                    <td className="px-4 py-2 font-medium text-slate-800">{getOutputName(line)}</td>
                                    <td className="px-4 py-2 text-right font-semibold text-slate-800">
                                      {formatQuantity(line.quantity)}
                                    </td>
                                    <td className="px-4 py-2 text-slate-600">
                                      <span className="font-mono">{line.warehouseBatchLotCode || '-'}</span>
                                      {line.warehouseBatchId ? (
                                        <span className="block break-all text-[11px] text-slate-400">
                                          {line.warehouseBatchId}
                                        </span>
                                      ) : null}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                        {order.lines.length > 0 && (
                          <div className="rounded-xl border border-slate-100 bg-white">
                            <div className="border-b border-slate-100 px-4 py-3">
                              <p className="text-xs font-bold uppercase tracking-wide text-[#717971]">Nguyên liệu cần xuất</p>
                            </div>
                            <div className="overflow-x-auto">
                              <table className="min-w-full text-left text-xs">
                                <thead className="bg-slate-50 text-[#717971]">
                                  <tr>
                                    <th className="px-4 py-2 font-semibold">SKU</th>
                                    <th className="px-4 py-2 font-semibold">Nguyên liệu</th>
                                    <th className="px-4 py-2 text-right font-semibold">Số lượng</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {order.lines.map((line) => (
                                    <tr key={line.id}>
                                      <td className="px-4 py-2 font-mono font-semibold text-[#356647]">
                                        {line.materialSkuCode || '-'}
                                      </td>
                                      <td className="px-4 py-2 font-medium text-slate-800">
                                        {line.materialSnapshotName || '-'}
                                      </td>
                                      <td className="px-4 py-2 text-right font-semibold text-slate-800">
                                        {formatQuantity(line.plannedQuantity)}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-500">
                          {order.completedAt && <span>Hoàn thành: {formatVietnamDateTime(order.completedAt)}</span>}
                          {order.note && <span className="italic">Ghi chú: {order.note}</span>}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
                )
              })
            )}
          </tbody>
        </table>
        </div>

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
