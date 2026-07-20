import { useCallback, useEffect, useMemo, useState } from 'react'
import PageHeader from '../../../components/shared/PageHeader.jsx'
import PageShell from '../../../components/shared/PageShell.jsx'
import TablePagination, { TABLE_PAGE_SIZE } from '../../../components/shared/TablePagination.jsx'
import { showError, showSuccess } from '../../../app/toast.js'
import { formatVietnamDateTime } from '../../../utils/vietnamDateTime.js'
import { canWriteInventory } from '../../auth/utils/permissions.js'
import { loadAuthSession } from '../../auth/services/authSession.js'
import { formatStockQuantity } from '../../products/utils/productDisplay.js'
import InventoryNavTabs from '../components/InventoryNavTabs.jsx'
import { fetchStockAdjustmentRequests } from '../services/stockAdjustmentRequestApi.js'
import { fetchSupplierReceipts } from '../services/supplierReceiptApi.js'
import { fetchWarehouseBatches } from '../services/warehouseBatchApi.js'
import {
  approveShelfReturnRequest,
  approveSupplierReturnRequest,
  cancelShelfReturnRequest,
  cancelSupplierReturnRequest,
  createShelfReturnRequest,
  createSupplierReturnRequest,
  fetchShelfReturnRequests,
  fetchSupplierReturnRequests,
  getInventoryReturnModeLabel,
  getInventoryReturnStatusClass,
  getInventoryReturnStatusLabel,
  rejectShelfReturnRequest,
  rejectSupplierReturnRequest,
} from '../services/inventoryReturnApi.js'

const FLOW_OPTIONS = [
  {
    key: 'shelf',
    label: 'Kệ Hàng → Kho',
    description: 'Trả hàng từ Kệ Hàng về Kho hoặc điều chỉnh dữ liệu nhận bổ sung.',
    sourceLocation: 'Shelf',
  },
  {
    key: 'supplier',
    label: 'Kho → Nhà cung cấp',
    description: 'Trả hàng đã nhập kho về nhà cung cấp hoặc điều chỉnh dữ liệu nhập NCC.',
    sourceLocation: 'Warehouse',
  },
]

const STATUS_OPTIONS = [
  { value: '', label: 'Tất cả' },
  { value: 'pending', label: 'Chờ duyệt' },
  { value: 'completed', label: 'Hoàn tất' },
  { value: 'rejected', label: 'Từ chối' },
  { value: 'cancelled', label: 'Đã hủy' },
]

function getFlowConfig(flow) {
  return FLOW_OPTIONS.find((item) => item.key === flow) ?? FLOW_OPTIONS[0]
}

function getReferenceCode(row) {
  if (row.flow === 'supplier') return row.supplierReceiptCode || '—'
  return row.originalStockAdjustmentRequestCode || '—'
}

function getReferenceLabel(row) {
  if (row.flow === 'supplier') return 'Phiếu nhập NCC'
  return 'Phiếu bổ sung Kệ Hàng'
}

function getPrimaryItemSummary(row) {
  if (!row.items?.length) return 'Chưa có dòng SKU'
  if (row.items.length === 1) return `${row.items[0].skuCode} - ${row.items[0].skuSnapshotName}`
  return `${row.items.length} dòng SKU`
}

function buildBatchOptions(batches, sourceLocation) {
  const normalizedLocation = sourceLocation.toLowerCase()
  return batches.flatMap((batch) => {
    const location = String(batch.location || 'Warehouse').toLowerCase()
    if (location !== normalizedLocation) return []

    return (batch.items ?? [])
      .filter((item) => Number(item.quantityOnHand) > 0)
      .map((item) => ({
        key: `${batch.id}:${item.id}`,
        batch,
        item,
      }))
  })
}

function ReturnDetailModal({ request, onClose }) {
  if (!request) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="max-h-[90dvh] w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-800">{request.returnCode}</h2>
            <p className="mt-1 text-sm text-slate-500">{getReferenceLabel(request)}: {getReferenceCode(request)}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <span className="material-symbols-outlined text-[22px]">close</span>
          </button>
        </div>

        <div className="custom-scrollbar max-h-[calc(90dvh-88px)] overflow-y-auto px-6 py-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <InfoTile label="Trạng thái" value={getInventoryReturnStatusLabel(request.status)} />
            <InfoTile label="Loại xử lý" value={getInventoryReturnModeLabel(request.returnMode)} />
            <InfoTile label="Người tạo" value={request.createdByName || 'Chưa xác định'} />
            <InfoTile label="Thời gian tạo" value={formatVietnamDateTime(request.createdAt)} />
          </div>

          <div className="mt-5 rounded-xl border border-slate-100">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">SKU</th>
                  <th className="px-4 py-3">Lô nguồn</th>
                  <th className="px-4 py-3 text-right">Số lượng</th>
                  <th className="px-4 py-3">Phiếu xuất</th>
                  <th className="px-4 py-3">Phiếu nhập</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {request.items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-800">{item.skuCode}</p>
                      <p className="text-xs text-slate-500">{item.skuSnapshotName}</p>
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-700">
                      {item.shelfLotCode || item.warehouseBatchLotCode || '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">{formatStockQuantity(item.quantity)}</td>
                    <td className="px-4 py-3 font-mono text-slate-700">{item.stockExportSlipCode || '—'}</td>
                    <td className="px-4 py-3 font-mono text-slate-700">{item.stockImportSlipCode || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <InfoTile label="Lý do" value={request.reason || '—'} />
            <InfoTile label="Ghi chú duyệt/hủy" value={request.reviewNote || '—'} />
          </div>
        </div>
      </div>
    </div>
  )
}

function InfoTile({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-800">{value}</p>
    </div>
  )
}

function CreateReturnModal({ flow, onClose, onCreated }) {
  const config = getFlowConfig(flow)
  const isShelf = flow === 'shelf'
  const [returnMode, setReturnMode] = useState('PHYSICAL_RETURN')
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const [originalSearch, setOriginalSearch] = useState('')
  const [originalOptions, setOriginalOptions] = useState([])
  const [selectedOriginal, setSelectedOriginal] = useState(null)
  const [batchSearch, setBatchSearch] = useState('')
  const [batches, setBatches] = useState([])
  const [selectedBatchKey, setSelectedBatchKey] = useState('')
  const [quantity, setQuantity] = useState('')
  const [isLoadingOriginals, setIsLoadingOriginals] = useState(false)
  const [isLoadingBatches, setIsLoadingBatches] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    let mounted = true
    const timer = window.setTimeout(async () => {
      setIsLoadingOriginals(true)
      try {
        const result = isShelf
          ? await fetchStockAdjustmentRequests({
            status: 'processed',
            search: originalSearch.trim() || undefined,
            page: 1,
            pageSize: 8,
          })
          : await fetchSupplierReceipts({
            status: 'completed',
            search: originalSearch.trim() || undefined,
            page: 1,
            pageSize: 8,
          })
        if (mounted) setOriginalOptions(result.items ?? [])
      } catch {
        if (mounted) setOriginalOptions([])
      } finally {
        if (mounted) setIsLoadingOriginals(false)
      }
    }, 250)

    return () => {
      mounted = false
      window.clearTimeout(timer)
    }
  }, [isShelf, originalSearch])

  useEffect(() => {
    let mounted = true
    const timer = window.setTimeout(async () => {
      setIsLoadingBatches(true)
      try {
        const result = await fetchWarehouseBatches({
          search: batchSearch.trim() || undefined,
          availableOnly: true,
        })
        if (mounted) setBatches(result)
      } catch (error) {
        if (mounted) {
          setBatches([])
          showError(error.message)
        }
      } finally {
        if (mounted) setIsLoadingBatches(false)
      }
    }, 250)

    return () => {
      mounted = false
      window.clearTimeout(timer)
    }
  }, [batchSearch])

  const batchOptions = useMemo(() => buildBatchOptions(batches, config.sourceLocation), [batches, config.sourceLocation])
  const selectedBatchOption = batchOptions.find((option) => option.key === selectedBatchKey)
  const parsedQuantity = Number(quantity)

  async function handleSubmit(event) {
    event.preventDefault()
    if (!selectedBatchOption) {
      showError('Vui lòng chọn lô tồn kho cần trả.')
      return
    }
    if (!Number.isInteger(parsedQuantity) || parsedQuantity <= 0) {
      showError('Số lượng trả phải là số nguyên lớn hơn 0.')
      return
    }
    if (parsedQuantity > Number(selectedBatchOption.item.quantityOnHand)) {
      showError('Lô được chọn không đủ tồn để trả.')
      return
    }
    if (returnMode === 'DATA_CORRECTION' && !reason.trim()) {
      showError('Điều chỉnh dữ liệu phải có lý do chi tiết.')
      return
    }

    const line = {
      skuId: selectedBatchOption.item.skuId,
      skuCode: selectedBatchOption.item.skuCode,
      skuSnapshotName: selectedBatchOption.item.productSnapshotName,
      quantity: parsedQuantity,
      batchId: selectedBatchOption.batch.id,
      lotCode: selectedBatchOption.batch.lotCode,
      note: note.trim() || null,
    }

    const basePayload = {
      returnMode,
      reason: reason.trim() || null,
      note: note.trim() || null,
      items: [line],
    }

    const payload = isShelf
      ? {
        ...basePayload,
        originalStockAdjustmentRequestId: selectedOriginal?.id ?? null,
        originalStockAdjustmentRequestCode:
          (selectedOriginal?.requestCode ?? originalSearch.trim()) || null,
      }
      : {
        ...basePayload,
        supplierReceiptId: selectedOriginal?.id ?? null,
        supplierReceiptCode: (selectedOriginal?.receiptCode ?? originalSearch.trim()) || null,
        supplierName: selectedOriginal?.supplierName ?? null,
        supplierReference: selectedOriginal?.supplierReference ?? null,
      }

    setIsSaving(true)
    try {
      const created = isShelf
        ? await createShelfReturnRequest(payload)
        : await createSupplierReturnRequest(payload)
      showSuccess(`Đã tạo yêu cầu ${created.returnCode}.`)
      onCreated?.(created)
      onClose?.()
    } catch (error) {
      showError(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="flex max-h-[90dvh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Tạo yêu cầu trả hàng nhập</h2>
            <p className="mt-1 text-sm text-slate-500">{config.description}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <span className="material-symbols-outlined text-[22px]">close</span>
          </button>
        </div>

        <form className="custom-scrollbar overflow-y-auto px-6 py-5" onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Luồng trả</span>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800">
                {config.label}
              </div>
            </label>
            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Loại xử lý</span>
              <select
                value={returnMode}
                onChange={(event) => setReturnMode(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-[#538463]"
              >
                <option value="PHYSICAL_RETURN">Trả hàng vật lý</option>
                <option value="DATA_CORRECTION">Điều chỉnh dữ liệu</option>
              </select>
            </label>
          </div>

          <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50/70 p-4">
            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {isShelf ? 'Tìm phiếu bổ sung Kệ Hàng gốc' : 'Tìm phiếu nhập NCC gốc'}
              </span>
              <input
                value={originalSearch}
                onChange={(event) => {
                  setOriginalSearch(event.target.value)
                  setSelectedOriginal(null)
                }}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-[#538463]"
                placeholder={isShelf ? 'VD: YC-20260717-0001' : 'VD: PNCC-20260717-0001'}
              />
            </label>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {isLoadingOriginals ? (
                <p className="text-sm text-slate-500">Đang tải phiếu gốc...</p>
              ) : originalOptions.length === 0 ? (
                <p className="text-sm text-slate-500">Có thể để trống nếu không chọn phiếu gốc.</p>
              ) : (
                originalOptions.map((option) => {
                  const code = isShelf ? option.requestCode : option.receiptCode
                  const selected = selectedOriginal?.id === option.id
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => {
                        setSelectedOriginal(option)
                        setOriginalSearch(code)
                      }}
                      className={`rounded-xl border px-3 py-2 text-left text-sm ${
                        selected ? 'border-[#538463] bg-emerald-50 text-[#356647]' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span className="font-mono font-semibold">{code}</span>
                      <span className="ml-2 text-xs text-slate-500">
                        {isShelf ? getInventoryReturnStatusLabel(option.status) : option.supplierName || '—'}
                      </span>
                    </button>
                  )
                })
              )}
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-slate-100 p-4">
            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Tìm lô tồn {config.sourceLocation === 'Shelf' ? 'Kệ Hàng' : 'Kho'}
              </span>
              <input
                value={batchSearch}
                onChange={(event) => {
                  setBatchSearch(event.target.value)
                  setSelectedBatchKey('')
                }}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-[#538463]"
                placeholder="Nhập mã lô, SKU hoặc tên hàng"
              />
            </label>

            <div className="mt-3 max-h-52 overflow-y-auto rounded-xl border border-slate-100">
              {isLoadingBatches ? (
                <p className="px-4 py-3 text-sm text-slate-500">Đang tải lô tồn...</p>
              ) : batchOptions.length === 0 ? (
                <p className="px-4 py-3 text-sm text-slate-500">Không có lô còn tồn ở vị trí này.</p>
              ) : (
                batchOptions.map((option) => (
                  <label
                    key={option.key}
                    className="flex cursor-pointer items-start gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0 hover:bg-slate-50"
                  >
                    <input
                      type="radio"
                      name="return-batch"
                      value={option.key}
                      checked={selectedBatchKey === option.key}
                      onChange={(event) => setSelectedBatchKey(event.target.value)}
                      className="mt-1"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block font-mono text-sm font-semibold text-[#356647]">{option.batch.lotCode}</span>
                      <span className="block text-sm text-slate-700">{option.item.skuCode} - {option.item.productSnapshotName}</span>
                      <span className="block text-xs text-slate-500">Còn {formatStockQuantity(option.item.quantityOnHand)}</span>
                    </span>
                  </label>
                ))
              )}
            </div>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Số lượng trả</span>
              <input
                type="number"
                min="1"
                step="1"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-[#538463]"
              />
            </label>
            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Lý do</span>
              <input
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-[#538463]"
                placeholder="Bắt buộc nếu điều chỉnh dữ liệu"
              />
            </label>
          </div>

          <label className="mt-4 block space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ghi chú</span>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={3}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-[#538463]"
            />
          </label>

          <div className="mt-5 flex justify-end gap-3 border-t border-slate-100 pt-4">
            <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-xl bg-[#538463] px-4 py-2 text-sm font-semibold text-white hover:bg-[#457053] disabled:opacity-60"
            >
              {isSaving ? 'Đang lưu...' : 'Tạo yêu cầu'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function InventoryReturnsPage() {
  const [flow, setFlow] = useState('shelf')
  const [searchInput, setSearchInput] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(TABLE_PAGE_SIZE)
  const [data, setData] = useState({ items: [], totalItems: 0, totalPages: 1 })
  const [isLoading, setIsLoading] = useState(true)
  const [selectedRequest, setSelectedRequest] = useState(null)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [actionId, setActionId] = useState(null)
  const canWrite = canWriteInventory(loadAuthSession())
  const config = getFlowConfig(flow)

  const loadRequests = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = {
        status: status || undefined,
        search: searchInput.trim() || undefined,
        page,
        pageSize,
      }
      const result = flow === 'shelf'
        ? await fetchShelfReturnRequests(params)
        : await fetchSupplierReturnRequests(params)
      setData(result)
    } catch (error) {
      setData({ items: [], totalItems: 0, totalPages: 1 })
      showError(error.message)
    } finally {
      setIsLoading(false)
    }
  }, [flow, page, pageSize, searchInput, status])

  useEffect(() => {
    const timer = window.setTimeout(loadRequests, 250)
    return () => window.clearTimeout(timer)
  }, [loadRequests])

  function handleFlowChange(nextFlow) {
    setFlow(nextFlow)
    setPage(1)
    setSelectedRequest(null)
  }

  function handleSearchChange(value) {
    setSearchInput(value)
    setPage(1)
  }

  function handleStatusChange(value) {
    setStatus(value)
    setPage(1)
  }

  async function runAction(request, action, successMessage) {
    setActionId(`${request.id}:${action.name}`)
    try {
      const updated = await action(request.id)
      showSuccess(successMessage(updated))
      setSelectedRequest((current) => (current?.id === updated.id ? updated : current))
      await loadRequests()
    } catch (error) {
      showError(error.message)
    } finally {
      setActionId(null)
    }
  }

  async function handleApprove(request) {
    const action = request.flow === 'shelf' ? approveShelfReturnRequest : approveSupplierReturnRequest
    await runAction(request, action, (updated) => `Đã duyệt ${updated.returnCode}.`)
  }

  async function handleReject(request) {
    const reason = window.prompt('Nhập lý do từ chối yêu cầu trả hàng nhập')
    if (!reason?.trim()) return
    const action = request.flow === 'shelf'
      ? (id) => rejectShelfReturnRequest(id, reason)
      : (id) => rejectSupplierReturnRequest(id, reason)
    await runAction(request, action, (updated) => `Đã từ chối ${updated.returnCode}.`)
  }

  async function handleCancel(request) {
    const reason = window.prompt('Nhập lý do hủy yêu cầu trả hàng nhập')
    if (!reason?.trim()) return
    const action = request.flow === 'shelf'
      ? (id) => cancelShelfReturnRequest(id, reason)
      : (id) => cancelSupplierReturnRequest(id, reason)
    await runAction(request, action, (updated) => `Đã hủy ${updated.returnCode}.`)
  }

  return (
    <PageShell>
      <PageHeader
        title="Trả hàng nhập"
        description={canWrite
          ? 'Tạo và duyệt yêu cầu trả hàng từ Kệ Hàng về Kho hoặc từ Kho về nhà cung cấp.'
          : 'Xem yêu cầu trả hàng từ Kệ Hàng về Kho hoặc từ Kho về nhà cung cấp (chỉ xem).'}
        searchPlaceholder="Tìm mã yêu cầu, phiếu gốc, SKU, lô..."
        searchValue={searchInput}
        onSearchChange={handleSearchChange}
        rightContent={(
          <div className="flex flex-wrap items-center gap-3">
            <InventoryNavTabs />
            {canWrite ? (
              <button
                type="button"
                onClick={() => setIsCreateOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#538463] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#457053]"
              >
                <span className="material-symbols-outlined text-[18px]">add</span>
                Tạo yêu cầu
              </button>
            ) : null}
          </div>
        )}
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-2">
          {FLOW_OPTIONS.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => handleFlowChange(option.key)}
              className={`rounded-xl px-4 py-2 text-sm font-semibold ${
                flow === option.key
                  ? 'bg-[#538463] text-white'
                  : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        <select
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          value={status}
          onChange={(event) => handleStatusChange(event.target.value)}
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-slate-50/80 px-6 py-3 text-sm text-slate-600">
          {config.description}
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-6 py-3">Mã yêu cầu</th>
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
                  <td colSpan={7} className="px-6 py-8 text-slate-500">Chưa có yêu cầu trả hàng nhập.</td>
                </tr>
              ) : (
                data.items.map((request) => (
                  <tr key={request.id} className="hover:bg-slate-50/80">
                    <td className="px-6 py-4">
                      <p className="font-mono font-semibold text-[#356647]">{request.returnCode}</p>
                      <p className="text-xs text-slate-500">{getInventoryReturnModeLabel(request.returnMode)}</p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-xs text-slate-500">{getReferenceLabel(request)}</p>
                      <p className="font-mono text-sm text-slate-700">{getReferenceCode(request)}</p>
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
                      <div className="flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedRequest(request)}
                          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Chi tiết
                        </button>
                        {canWrite && request.status === 'pending' ? (
                          <>
                            <button
                              type="button"
                              disabled={Boolean(actionId)}
                              onClick={() => handleApprove(request)}
                              className="rounded-lg bg-[#538463] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#457053] disabled:opacity-50"
                            >
                              Duyệt
                            </button>
                            <button
                              type="button"
                              disabled={Boolean(actionId)}
                              onClick={() => handleReject(request)}
                              className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                            >
                              Từ chối
                            </button>
                            <button
                              type="button"
                              disabled={Boolean(actionId)}
                              onClick={() => handleCancel(request)}
                              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                            >
                              Hủy
                            </button>
                          </>
                        ) : null}
                      </div>
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
          itemLabel="yêu cầu trả hàng nhập"
        />
      </section>

      {isCreateOpen && canWrite ? (
        <CreateReturnModal
          flow={flow}
          onClose={() => setIsCreateOpen(false)}
          onCreated={() => {
            setPage(1)
            loadRequests()
          }}
        />
      ) : null}
      <ReturnDetailModal request={selectedRequest} onClose={() => setSelectedRequest(null)} />
    </PageShell>
  )
}
