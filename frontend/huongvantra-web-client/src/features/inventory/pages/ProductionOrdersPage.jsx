import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import PageShell from '../../../components/shared/PageShell.jsx'
import PageHeader from '../../../components/shared/PageHeader.jsx'
import StatusFilterChips from '../../../components/shared/StatusFilterChips.jsx'
import TablePagination from '../../../components/shared/TablePagination.jsx'
import { useTotalAwarePageSize } from '../../../utils/totalAwarePageSize.js'
import ReasonSuggestionChips from '../../../components/shared/ReasonSuggestionChips.jsx'
import { showError, showSuccess } from '../../../app/toast.js'
import { applyStatusCounts } from '../../../utils/statusFilterCounts.js'
import { isPersonalProductSkuCode, PERSONAL_PRODUCT_LABEL } from '../../orders/utils/personalProductLabels.js'
import { formatVietnamDate, formatVietnamDateTime } from '../../../utils/vietnamDateTime.js'
import { loadAuthSession } from '../../auth/services/authSession.js'
import {
  canCancelProductionOrder,
  canCompleteProductionOrder,
  canCreateProductionOrder,
} from '../../auth/utils/permissions.js'
import { getReasonSuggestions } from '../../shared/reasonSuggestions.js'
import CreateProductionOrderModal from '../components/CreateProductionOrderModal.jsx'
import ProductionCompleteConfirmModal from '../components/ProductionCompleteConfirmModal.jsx'
import { ProductionOrderDocument, SlipActionButtons, SlipPrintStyles } from '../components/InventorySlipDocument.jsx'
import {
  cancelProductionOrder,
  completeProductionOrder,
  fetchProductionOrders,
  previewProductionOrderAvailability,
  PRODUCTION_STATUS_CLASS,
  PRODUCTION_STATUS_LABEL,
} from '../services/productionOrderApi.js'

const STATUS_TABS = [
  { value: '', label: 'Tất cả' },
  { value: 'Draft', label: 'Chờ hoàn thành' },
  { value: 'Completed', label: 'Hoàn thành' },
  { value: 'Cancelled', label: 'Đã hủy' },
]

const PENDING_COMPLETION_STATUSES = ['Draft', 'PendingApproval', 'Approved', 'Rejected']

function ConfirmDialog({ message, requiresReason = false, reasonLabel = 'Lý do', reasonSuggestions = [], onConfirm, onCancel }) {
  const [reason, setReason] = useState('')

  return (
    <div className="inventory-modal fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onCancel}>
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="mb-4 text-sm text-slate-700">{message}</p>
        {requiresReason && (
          <label className="mb-6 block space-y-1.5 text-sm">
            <span className="text-xs font-semibold text-[#717971]">{reasonLabel}</span>
            <ReasonSuggestionChips
              suggestions={reasonSuggestions}
              value={reason}
              onSelect={setReason}
            />
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
  const code = line?.finishedSkuCode || fallback
  if (isPersonalProductSkuCode(code)) return PERSONAL_PRODUCT_LABEL
  return code
}

function formatDestinationLocation(value) {
  return value === 'Shelf' ? 'Kệ Hàng' : 'Kho'
}

function getFinishedGoodsLots(outputLines) {
  return outputLines.filter((line) => line.warehouseBatchLotCode || line.warehouseBatchId)
}

function ProductionOrdersPage() {
  const session = loadAuthSession()
  const canCreate = canCreateProductionOrder(session)
  const canComplete = canCompleteProductionOrder(session)
  const canCancel = canCancelProductionOrder(session)
  const [activeTab, setActiveTab] = useState('Draft')
  const [orders, setOrders] = useState([])
  const [statusCounts, setStatusCounts] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const { pageSize, setPageSize, pageSizeOptions } = useTotalAwarePageSize(totalCount)

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil((totalCount || 0) / pageSize) || 1)
    if (page > totalPages) setPage(totalPages)
  }, [totalCount, pageSize, page])
  const [expandedId, setExpandedId] = useState(null)
  const printRef = useRef(null)
  const [actingId, setActingId] = useState(null)
  const [confirmAction, setConfirmAction] = useState(null)
  const [availability, setAvailability] = useState(null)
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false)

  const statusChipOptions = useMemo(
    () => applyStatusCounts(STATUS_TABS, statusCounts),
    [statusCounts],
  )
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
      setStatusCounts(result.statusCounts)
    } catch (err) {
      setOrders([])
      setTotalCount(0)
      setStatusCounts(null)
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
    showSuccess(`Đã tạo lệnh sản xuất ${order.productionCode}. Bấm Hoàn thành khi sản xuất xong.`)
    setPage(1)
    loadOrders()
  }

  async function openConfirm(event, type, order) {
    event.stopPropagation()
    setConfirmAction({ type, order })
    setAvailability(null)
    if (type !== 'complete') return
    setIsCheckingAvailability(true)
    try {
      setAvailability(await previewProductionOrderAvailability(order.id))
    } catch (err) {
      showError(err.message)
      setConfirmAction(null)
    } finally {
      setIsCheckingAvailability(false)
    }
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
    if (!PENDING_COMPLETION_STATUSES.includes(order.status)) return null
    const actions = [
      ['complete', 'Hoàn thành', 'primary'],
      ['cancel', 'Hủy', 'secondary'],
    ].filter(([type]) => (
      type === 'complete'
        ? canComplete
        : canCancel && !order.isAutoGeneratedForShelfReplenishment
    ))
    if (actions.length === 0) return null
    return (
      <div className="flex flex-wrap items-center gap-2">
        {actions.map(([type, label, variant]) => renderActionButton(order, type, label, variant))}
      </div>
    )
  }

  return (
    <PageShell className="gap-1.5 sm:gap-1.5">
      <PageHeader
        compact
        title="Quản lý lệnh sản xuất"
        titleInfo="Một lệnh có thể chứa nhiều SKU thành phẩm; hệ thống xuất NVL và nhập lô TP về Kho."
        rightContent={
          <div className="flex items-center gap-3">
            {canCreate ? (
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#538463] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#457053]"
              >
                <span className="material-symbols-outlined text-[18px]">add</span>
                Tạo lệnh sản xuất
              </button>
            ) : null}
          </div>
        }
      />

      <div>
        <StatusFilterChips
          options={statusChipOptions}
          value={activeTab}
          onChange={handleTabChange}
        />
      </div>

      <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs font-semibold text-[#717971]">
              <th className="px-4 py-3">Mã lệnh sản xuất</th>
              <th className="px-4 py-3">Trạng thái</th>
              <th className="px-4 py-3">Thành phẩm đầu ra</th>
              <th className="px-4 py-3 text-right">Tổng SL</th>
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
                  <p className="mt-1 text-xs text-slate-400">Bấm Tạo lệnh sản xuất để bắt đầu.</p>
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
                      <span className="block">{order.productionCode}</span>
                      {order.isAutoGeneratedForShelfReplenishment ? (
                        <span className="mt-1 inline-flex rounded-full bg-amber-50 px-2 py-0.5 font-sans text-[10px] font-bold text-amber-700">
                          Tự động từ yêu cầu bổ sung Kệ Hàng
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <StatusChip status={order.status} />
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
                        <SlipPrintStyles />
                        <SlipActionButtons
                          documentRef={printRef}
                          filename={`${order.productionCode || 'lenh-san-xuat'}.pdf`}
                        />
                        <div ref={printRef} className="mb-4">
                          <ProductionOrderDocument order={order} statusLabel={PRODUCTION_STATUS_LABEL[order.status] || order.status} />
                        </div>

                        {finishedGoodsLots.length > 0 && (
                          <div className="no-print mb-4 rounded-xl border border-emerald-100 bg-white">
                            <div className="border-b border-emerald-100 px-4 py-3">
                              <p className="text-xs font-bold uppercase tracking-wide text-[#717971]">Lô thành phẩm sinh ra</p>
                              <p className="mt-1 text-xs text-slate-500">
                                Mỗi mã Thành phẩm trong Lệnh sản xuất tạo một lô Kho riêng và cùng truy vết về {order.productionCode}.
                              </p>
                            </div>
                            <div className="overflow-x-auto">
                              <table className="min-w-full text-left text-xs">
                                <thead className="bg-emerald-50/60 text-[#717971]">
                                  <tr>
                                    <th className="px-4 py-2 font-semibold">Sản Phẩm</th>
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
                                        <p className="font-medium text-slate-800">{getOutputName(line)}</p>
                                        <p className="mt-0.5 font-mono text-[11px] text-slate-500">{getOutputSku(line)}</p>
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
                          <div className="no-print rounded-xl border border-slate-100 bg-white">
                            <div className="border-b border-slate-100 px-4 py-3">
                              <p className="text-xs font-bold uppercase tracking-wide text-[#717971]">Nguyên liệu/Bao bì cần xuất</p>
                            </div>
                            <div className="overflow-x-auto">
                              <table className="min-w-full text-left text-xs">
                                <thead className="bg-slate-50 text-[#717971]">
                                  <tr>
                                    <th className="px-4 py-2 font-semibold">Sản Phẩm</th>
                                    <th className="px-4 py-2 text-right font-semibold">Số lượng</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {order.lines.map((line) => (
                                    <tr key={line.id}>
                                      <td className="px-4 py-2">
                                        <p className="font-medium text-slate-800">{line.materialSnapshotName || '-'}</p>
                                        <p className="font-mono text-[11px] text-slate-500">{line.materialSkuCode || '-'}</p>
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
                        <div className="no-print mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-500">
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
              pageSizeOptions={pageSizeOptions}
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
      {confirmAction?.type === 'complete' && (
        <ProductionCompleteConfirmModal
          order={confirmAction.order}
          availability={availability}
          isChecking={isCheckingAvailability}
          onConfirm={() => handleAction('complete', confirmAction.order)}
          onClose={() => { setConfirmAction(null); setAvailability(null) }}
        />
      )}
      {confirmAction && confirmAction.type !== 'complete' && (
        <ConfirmDialog
          message={getConfirmActionMessage(confirmAction)}
          requiresReason={confirmAction.type === 'cancel'}
          reasonLabel="Lý do hủy"
          reasonSuggestions={getReasonSuggestions('productionCancel')}
          onConfirm={(reason) => handleAction(confirmAction.type, confirmAction.order, reason)}
          onCancel={() => setConfirmAction(null)}
        />
      )}

      {/* Create modal */}
      {canCreate ? (
        <CreateProductionOrderModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onCreated={handleCreated}
        />
      ) : null}
    </PageShell>
  )
}

export default ProductionOrdersPage
