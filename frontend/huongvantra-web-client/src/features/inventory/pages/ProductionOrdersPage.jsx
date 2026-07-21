import { Fragment, useCallback, useEffect, useState } from 'react'
import PageShell from '../../../components/shared/PageShell.jsx'
import PageHeader from '../../../components/shared/PageHeader.jsx'
import TablePagination, { TABLE_PAGE_SIZE } from '../../../components/shared/TablePagination.jsx'
import { showError, showSuccess } from '../../../app/toast.js'
import { formatVietnamDate, formatVietnamDateTime } from '../../../utils/vietnamDateTime.js'
import CreateProductionOrderModal from '../components/CreateProductionOrderModal.jsx'
import {
  approveProductionOrder,
  cancelProductionOrder,
  completeProductionOrder,
  fetchProductionOrders,
  PRODUCTION_STATUS_CLASS,
  PRODUCTION_STATUS_LABEL,
  rejectProductionOrder,
  submitProductionOrder,
} from '../services/productionOrderApi.js'

const STATUS_TABS = [
  { key: '', label: 'Tất cả' },
  { key: 'Draft', label: 'Chờ xác nhận' },
  { key: 'PendingApproval', label: 'Chờ duyệt' },
  { key: 'Approved', label: 'Đã duyệt' },
  { key: 'Completed', label: 'Hoàn thành' },
  { key: 'Rejected', label: 'Bị từ chối' },
  { key: 'Cancelled', label: 'Đã hủy' },
]

function ConfirmDialog({ message, requiresReason = false, reasonLabel = 'Lý do', onConfirm, onCancel }) {
  const [reason, setReason] = useState('')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onCancel}>
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="mb-4 text-sm text-slate-700">{message}</p>
        {requiresReason && (
          <label className="mb-6 block space-y-1.5 text-sm">
            <span className="text-xs font-semibold text-[#717971]">{reasonLabel}</span>
            <textarea
              rows={3}
              className="w-full rounded-xl border border-slate-200 p-2.5 text-sm text-slate-700"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Nhập lý do..."
            />
          </label>
        )}
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            Không
          </button>
          <button
            onClick={() => onConfirm(reason)}
            disabled={requiresReason && !reason.trim()}
            className="rounded-xl bg-[#538463] px-4 py-2 text-sm font-bold text-white hover:bg-[#457053] disabled:opacity-50"
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

function getConfirmActionMessage(action) {
  const code = action?.order?.productionCode ?? ''
  switch (action?.type) {
    case 'submit':
      return `Gửi duyệt lệnh sản xuất "${code}"? Lệnh sẽ chờ quản lý hoặc admin xác nhận.`
    case 'approve':
      return `Duyệt lệnh sản xuất "${code}"? Sau khi duyệt, thủ kho mới có thể hoàn thành và ghi nhận tồn kho.`
    case 'reject':
      return `Từ chối lệnh sản xuất "${code}"? Vui lòng nhập lý do để người tạo chỉnh sửa.`
    case 'complete':
      return `Hoàn thành lệnh sản xuất "${code}"? Hệ thống sẽ xuất nguyên liệu theo FIFO và nhập thành phẩm theo nơi nhập đã chọn.`
    case 'cancel':
      return `Hủy lệnh sản xuất "${code}"? Thao tác không thể hoàn tác.`
    default:
      return 'Xác nhận thao tác?'
  }
}

function getOutputLines(order) {
  const outputLines = Array.isArray(order.outputLines) ? order.outputLines.filter(Boolean) : []
  return outputLines
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
      return `${name} x${formatQuantity(line.plannedQuantity)}`
    })
    .join(', ')
}

function getOutputName(line, fallback = '-') {
  return line?.finishedSkuSnapshotName || line?.finishedSkuCode || fallback
}

function getOutputSku(line, fallback = '-') {
  return line?.finishedSkuCode || fallback
}

function formatDestinationLocation(value) {
  return value === 'Shelf' ? 'Kệ Hàng' : 'Kho'
}

function getFinishedGoodsLots(outputLines) {
  return outputLines.filter((line) => line.warehouseBatchLotCode || line.warehouseBatchId)
}

function ProductionOrdersPage() {
  const [activeTab, setActiveTab] = useState('')
  const [orders, setOrders] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(TABLE_PAGE_SIZE)
  const [totalCount, setTotalCount] = useState(0)
  const [expandedId, setExpandedId] = useState(null)
  const [actingId, setActingId] = useState(null)
  const [confirmAction, setConfirmAction] = useState(null)
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
    } catch (err) {
      showError(err.message)
    } finally {
      setIsLoading(false)
    }
  }, [activeTab, page, pageSize])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadOrders()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [loadOrders])

  function handleTabChange(key) {
    setActiveTab(key)
    setPage(1)
  }

  async function handleAction(type, order, reason = '') {
    setActingId(order.id)
    setConfirmAction(null)
    try {
      if (type === 'complete') {
        await completeProductionOrder(order.id)
        showSuccess(`Hoàn thành lệnh sản xuất ${order.productionCode}. Tồn kho đã được cập nhật.`)
      } else if (type === 'submit') {
        await submitProductionOrder(order.id)
        showSuccess(`Đã gửi duyệt lệnh sản xuất ${order.productionCode}.`)
      } else if (type === 'approve') {
        await approveProductionOrder(order.id)
        showSuccess(`Đã duyệt lệnh sản xuất ${order.productionCode}.`)
      } else if (type === 'reject') {
        await rejectProductionOrder(order.id, reason)
        showSuccess(`Đã từ chối lệnh sản xuất ${order.productionCode}.`)
      } else if (type === 'cancel') {
        await cancelProductionOrder(order.id, reason)
        showSuccess(`Đã hủy lệnh sản xuất ${order.productionCode}.`)
      }
      loadOrders()
    } catch (err) {
      showError(err.message)
    } finally {
      setActingId(null)
    }
  }

  function handleCreated(order) {
    if (order.status === 'PendingApproval') {
      showSuccess(`Đã tạo và gửi duyệt lệnh sản xuất ${order.productionCode}.`)
    } else {
      showSuccess(`Đã lưu nháp lệnh sản xuất ${order.productionCode}.`)
    }
    setPage(1)
    loadOrders()
  }

  function openConfirm(event, type, order) {
    event.stopPropagation()
    setConfirmAction({ type, order })
  }

  function renderActionButton(order, type, label, variant = 'secondary') {
    const primaryClass = 'rounded-lg bg-[#538463] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#457053] disabled:opacity-50'
    const dangerClass = 'rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50'
    const secondaryClass = 'rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50'
    const className = variant === 'primary' ? primaryClass : variant === 'danger' ? dangerClass : secondaryClass
    return (
      <button
        key={type}
        onClick={(event) => openConfirm(event, type, order)}
        disabled={actingId === order.id}
        className={className}
      >
        {label}
      </button>
    )
  }

  function renderOrderActions(order) {
    const actionsByStatus = {
      Draft: [
        ['submit', 'Gửi duyệt', 'primary'],
        ['cancel', 'Hủy', 'secondary'],
      ],
      Rejected: [
        ['submit', 'Gửi duyệt lại', 'primary'],
        ['cancel', 'Hủy', 'secondary'],
      ],
      PendingApproval: [
        ['approve', 'Duyệt', 'primary'],
        ['reject', 'Từ chối', 'danger'],
        ['cancel', 'Hủy', 'secondary'],
      ],
      Approved: [
        ['complete', 'Hoàn thành', 'primary'],
        ['cancel', 'Hủy', 'secondary'],
      ],
    }
    const actions = actionsByStatus[order.status] ?? []
    if (actions.length === 0) return null
    return (
      <div className="flex flex-wrap items-center gap-2">
        {actions.map(([type, label, variant]) => renderActionButton(order, type, label, variant))}
      </div>
    )
  }

  return (
    <PageShell>
      <PageHeader
        title="Quản lý lệnh sản xuất"
        description="Một lệnh sản xuất có thể chứa nhiều SKU thành phẩm; hệ thống xuất nguyên liệu và nhập lô thành phẩm về kho tổng."
        rightContent={
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#538463] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#457053]"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              Tạo lệnh sản xuất
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
              <th className="px-4 py-3">Mã lệnh sản xuất</th>
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
                  <p className="mt-1 text-xs text-slate-400">Bấm Tạo lệnh sản xuất để bắt đầu Workflow 1.</p>
                </td>
              </tr>
            ) : (
              orders.map((order) => {
                const outputLines = getOutputLines(order)
                const isMultiOutput = outputLines.length > 1
                const totalOutputQuantity = outputLines.reduce((sum, line) => sum + Number(line.plannedQuantity || 0), 0)
                const finishedGoodsLots = getFinishedGoodsLots(outputLines)
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
                          <p className="font-medium text-slate-800">{getOutputName(outputLines[0])}</p>
                          <p className="text-xs text-[#717971]">
                            {getOutputSku(outputLines[0])} · {formatQuantity(outputLines[0]?.plannedQuantity)} đơn vị
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
                        formatQuantity(outputLines[0]?.plannedQuantity)
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusChip status={order.status} />
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {order.createdAt ? formatVietnamDateTime(order.createdAt) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {renderOrderActions(order)}
                    </td>
                  </tr>

                  {expandedId === order.id && (
                    <tr key={`${order.id}-detail`} className="bg-slate-50/40">
                      <td colSpan={6} className="px-6 py-4">
                        <div className="mb-4 rounded-xl border border-slate-100 bg-white p-4">
                          <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="text-xs font-bold uppercase tracking-wide text-[#717971]">Chi tiết lệnh sản xuất</p>
                              <p className="mt-1 font-mono text-sm font-bold text-[#356647]">{order.productionCode}</p>
                            </div>
                            <StatusChip status={order.status} />
                          </div>
                          <div className="grid gap-3 text-xs text-slate-600 sm:grid-cols-2 lg:grid-cols-4">
                            <div>
                              <p className="font-semibold text-[#717971]">Ngày tạo</p>
                              <p className="mt-1 text-slate-800">{order.createdAt ? formatVietnamDateTime(order.createdAt) : '-'}</p>
                            </div>
                            <div>
                              <p className="font-semibold text-[#717971]">Hoàn thành</p>
                              <p className="mt-1 text-slate-800">{order.completedAt ? formatVietnamDateTime(order.completedAt) : '-'}</p>
                            </div>
                            <div>
                              <p className="font-semibold text-[#717971]">Người tạo</p>
                              <p className="mt-1 text-slate-800">{order.createdByName || order.createdBy || '-'}</p>
                              {order.createdByRoleName && (
                                <p className="text-[11px] text-slate-500">{order.createdByRoleName}</p>
                              )}
                            </div>
                            <div>
                              <p className="font-semibold text-[#717971]">Tổng SKU / SL</p>
                              <p className="mt-1 text-slate-800">
                                {outputLines.length} SKU · {formatQuantity(totalOutputQuantity)} đơn vị
                              </p>
                            </div>
                            {order.note && (
                              <div className="sm:col-span-2 lg:col-span-4">
                                <p className="font-semibold text-[#717971]">Ghi chú</p>
                                <p className="mt-1 italic text-slate-800">{order.note}</p>
                              </div>
                            )}
                          </div>
                        </div>

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
                                  <th className="px-4 py-2 text-right font-semibold">Số lượng SX</th>
                                  <th className="px-4 py-2 font-semibold">Nơi nhập</th>
                                  <th className="px-4 py-2 font-semibold">Hạn sử dụng</th>
                                  <th className="px-4 py-2 font-semibold">Lô thành phẩm sinh ra</th>
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
                                      {formatQuantity(line.plannedQuantity)}
                                    </td>
                                    <td className="px-4 py-2 text-slate-600">
                                      {formatDestinationLocation(line.destinationLocation)}
                                    </td>
                                    <td className="px-4 py-2 text-slate-600">
                                      {line.expiresAt ? formatVietnamDate(line.expiresAt) : '-'}
                                    </td>
                                    <td className="px-4 py-2 text-slate-600">
                                      <span className="font-mono">{line.warehouseBatchLotCode || '-'}</span>
                                      {line.warehouseBatchId ? (
                                        <span className="block break-all text-[11px] text-slate-400">
                                          WarehouseBatchId: {line.warehouseBatchId}
                                        </span>
                                      ) : null}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {finishedGoodsLots.length > 0 && (
                          <div className="mb-4 rounded-xl border border-emerald-100 bg-white">
                            <div className="border-b border-emerald-100 px-4 py-3">
                              <p className="text-xs font-bold uppercase tracking-wide text-[#717971]">Lô thành phẩm sinh ra</p>
                              <p className="mt-1 text-xs text-slate-500">
                                Mỗi SKU thành phẩm trong lệnh sản xuất tạo một WarehouseBatch riêng và cùng trace về {order.productionCode}.
                              </p>
                            </div>
                            <div className="overflow-x-auto">
                              <table className="min-w-full text-left text-xs">
                                <thead className="bg-emerald-50/60 text-[#717971]">
                                  <tr>
                                    <th className="px-4 py-2 font-semibold">SKU thành phẩm</th>
                                    <th className="px-4 py-2 text-right font-semibold">Số lượng</th>
                                    <th className="px-4 py-2 font-semibold">Nơi nhập</th>
                                    <th className="px-4 py-2 font-semibold">Mã lô thành phẩm</th>
                                    <th className="px-4 py-2 font-semibold">Mã lệnh sản xuất</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {finishedGoodsLots.map((line) => (
                                    <tr key={`${line.id}-lot`}>
                                      <td className="px-4 py-2">
                                        <p className="font-mono font-semibold text-[#356647]">{getOutputSku(line)}</p>
                                        <p className="mt-0.5 text-slate-600">{getOutputName(line)}</p>
                                      </td>
                                      <td className="px-4 py-2 text-right font-semibold text-slate-800">
                                        {formatQuantity(line.plannedQuantity)}
                                      </td>
                                      <td className="px-4 py-2 text-slate-700">{formatDestinationLocation(line.destinationLocation)}</td>
                                      <td className="px-4 py-2 font-mono text-slate-700">{line.warehouseBatchLotCode || '-'}</td>
                                      <td className="px-4 py-2 font-mono text-slate-700">{order.productionCode}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {order.lines.length > 0 && (
                          <div className="rounded-xl border border-slate-100 bg-white">
                            <div className="border-b border-slate-100 px-4 py-3">
                              <p className="text-xs font-bold uppercase tracking-wide text-[#717971]">Nguyên liệu cần xuất theo BOM</p>
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
              itemLabel="lệnh sản xuất"
            />
          </div>
        )}
      </div>

      {/* Confirm dialog */}
      {confirmAction && (
        <ConfirmDialog
          message={getConfirmActionMessage(confirmAction)}
          requiresReason={['reject', 'cancel'].includes(confirmAction.type)}
          reasonLabel={confirmAction.type === 'reject' ? 'Lý do từ chối' : 'Lý do hủy'}
          onConfirm={(reason) => handleAction(confirmAction.type, confirmAction.order, reason)}
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
