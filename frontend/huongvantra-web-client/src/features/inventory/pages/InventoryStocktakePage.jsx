import { useCallback, useEffect, useMemo, useState } from 'react'
import PageHeader from '../../../components/shared/PageHeader.jsx'
import PageShell from '../../../components/shared/PageShell.jsx'
import TablePagination, { TABLE_PAGE_SIZE } from '../../../components/shared/TablePagination.jsx'
import { showError, showSuccess } from '../../../app/toast.js'
import { formatVietnamDateTime } from '../../../utils/vietnamDateTime.js'
import { formatStockQuantity } from '../../products/utils/productDisplay.js'
import { fetchAllActiveSkus, fetchAllActiveStoreSkus } from '../../products/services/productSkusApi.js'
import { loadAuthSession } from '../../auth/services/authSession.js'
import { isWarehouseRole, canWriteInventory } from '../../auth/utils/permissions.js'
import InventoryNavTabs from '../components/InventoryNavTabs.jsx'
import { fetchSkuStocks, fetchStoreSkuStocks } from '../services/inventoryStockApi.js'
import {
  approveStocktakeRequest,
  cancelStocktakeRequest,
  createStocktakeRequest,
  fetchStocktakeRequestById,
  fetchStocktakeRequests,
  rejectStocktakeRequest,
  submitStocktakeRequest,
} from '../services/stocktakeApi.js'
import { notifyInventoryStockChanged } from '../utils/inventoryStockEvents.js'

const LOCATION_OPTIONS = [
  { value: 'Warehouse', label: 'Kho' },
  { value: 'Shelf', label: 'Kệ Hàng' },
]

const STATUS_OPTIONS = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: 'Draft', label: 'Nháp' },
  { value: 'PendingApproval', label: 'Chờ duyệt' },
  { value: 'Completed', label: 'Hoàn thành' },
  { value: 'Rejected', label: 'Đã từ chối' },
  { value: 'Cancelled', label: 'Đã hủy' },
]

const REASON_OPTIONS = [
  { value: 'NATURAL_SHRINKAGE', label: 'Hao hụt tự nhiên' },
  { value: 'SPOILAGE_OR_DAMAGE', label: 'Hư hỏng' },
  { value: 'LOSS_OR_THEFT', label: 'Mất mát' },
  { value: 'DATA_ENTRY_ERROR', label: 'Sai lệch nhập liệu' },
  { value: 'PRODUCTION_WASTE', label: 'Hao hụt sản xuất' },
  { value: 'FOUND_STOCK', label: 'Tìm thấy tồn' },
  { value: 'INBOUND_NOT_RECORDED', label: 'Nhập kho chưa ghi nhận' },
  { value: 'OTHER', label: 'Khác' },
]

function getLocationLabel(location) {
  return LOCATION_OPTIONS.find((item) => item.value === location)?.label || location || '—'
}

function getStatusLabel(status) {
  return STATUS_OPTIONS.find((item) => item.value === status)?.label || status || '—'
}

function getStatusClass(status) {
  if (status === 'Completed') return 'bg-emerald-50 text-emerald-700 ring-emerald-100'
  if (status === 'PendingApproval') return 'bg-amber-50 text-amber-700 ring-amber-100'
  if (status === 'Rejected' || status === 'Cancelled') return 'bg-rose-50 text-rose-700 ring-rose-100'
  return 'bg-slate-100 text-slate-700 ring-slate-200'
}

function getReasonLabel(code) {
  return REASON_OPTIONS.find((item) => item.value === code)?.label || code || '—'
}

function getSkuName(sku) {
  const parts = [sku?.productName, sku?.variantName].filter(Boolean)
  return parts.join(' - ') || sku?.skuCode || '—'
}

function getSystemQuantity(stock, location) {
  if (!stock) return 0
  return location === 'Warehouse'
    ? Number(stock.warehouseQuantityOnHand ?? 0)
    : Number(stock.quantityOnHand ?? 0)
}

function toCsvValue(value) {
  const text = String(value ?? '')
  return `"${text.replaceAll('"', '""')}"`
}

function downloadCsv(filename, rows) {
  const csv = rows.map((row) => row.map(toCsvValue).join(',')).join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function parseCsv(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map((line) => line.split(',').map((cell) => cell.trim().replace(/^"|"$/g, '').replaceAll('""', '"')))
    .filter((row) => row.some(Boolean))
}

function buildStocktakeCsvRows(request) {
  return [
    ['RequestCode', 'Location', 'Status', 'SkuCode', 'SkuName', 'SystemQuantity', 'ActualQuantity', 'Variance', 'ReasonCode', 'ImportSlip', 'ExportSlip', 'LotCode'],
    ...(request?.items ?? []).map((line) => [
      request.requestCode,
      getLocationLabel(request.location),
      getStatusLabel(request.status),
      line.skuCode,
      line.skuSnapshotName,
      line.systemQuantitySnapshot,
      line.actualQuantity,
      line.variance,
      line.reasonCode,
      line.stockImportSlipCode,
      line.stockExportSlipCode,
      line.warehouseBatchLotCode,
    ]),
  ]
}

function StocktakeDetailModal({ request, onClose, onAction }) {
  if (!request) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="flex max-h-[min(92dvh,780px)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex shrink-0 items-start justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-[#538463]">Phiếu kiểm kê</p>
            <h2 className="mt-1 text-xl font-bold text-slate-900">{request.requestCode}</h2>
            <p className="mt-1 text-sm text-slate-500">
              {getLocationLabel(request.location)} · {getStatusLabel(request.status)} · {formatVietnamDateTime(request.createdAt)}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
            <span className="material-symbols-outlined text-[22px]">close</span>
          </button>
        </div>

        <div className="custom-scrollbar flex-1 overflow-y-auto p-6">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase text-slate-500">Người tạo</p>
              <p className="mt-1 font-semibold text-slate-800">{request.createdByName || '—'}</p>
              <p className="text-xs text-slate-500">{request.createdByRoleName || '—'}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase text-slate-500">Người duyệt</p>
              <p className="mt-1 font-semibold text-slate-800">{request.reviewedByName || '—'}</p>
              <p className="text-xs text-slate-500">{request.reviewedByRoleName || '—'}</p>
            </div>
            <div className="rounded-xl bg-emerald-50 p-4">
              <p className="text-xs font-semibold uppercase text-emerald-700">Tăng tồn</p>
              <p className="mt-1 text-xl font-bold text-emerald-800">+{formatStockQuantity(request.totalPositiveVariance)}</p>
            </div>
            <div className="rounded-xl bg-rose-50 p-4">
              <p className="text-xs font-semibold uppercase text-rose-700">Giảm tồn</p>
              <p className="mt-1 text-xl font-bold text-rose-800">-{formatStockQuantity(request.totalNegativeVariance)}</p>
            </div>
          </div>

          <div className="mt-5 overflow-hidden rounded-xl border border-slate-100">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">SKU</th>
                  <th className="px-4 py-3 text-right">Hệ thống</th>
                  <th className="px-4 py-3 text-right">Thực đếm</th>
                  <th className="px-4 py-3 text-right">Chênh lệch</th>
                  <th className="px-4 py-3">Lý do</th>
                  <th className="px-4 py-3">Chứng từ</th>
                  <th className="px-4 py-3">Lô điều chỉnh</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {request.items.map((line) => (
                  <tr key={line.id}>
                    <td className="px-4 py-3">
                      <p className="font-mono font-semibold text-[#356647]">{line.skuCode}</p>
                      <p className="text-xs text-slate-500">{line.skuSnapshotName}</p>
                    </td>
                    <td className="px-4 py-3 text-right">{formatStockQuantity(line.systemQuantitySnapshot)}</td>
                    <td className="px-4 py-3 text-right">{formatStockQuantity(line.actualQuantity)}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${line.variance >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {line.variance > 0 ? '+' : ''}{formatStockQuantity(line.variance)}
                    </td>
                    <td className="px-4 py-3">{getReasonLabel(line.reasonCode)}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">
                      {line.stockImportSlipCode || line.stockExportSlipCode || '—'}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{line.warehouseBatchLotCode || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-6 py-4">
          <button
            type="button"
            onClick={() => downloadCsv(`${request.requestCode || 'stocktake'}.csv`, buildStocktakeCsvRows(request))}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
            Xuất CSV
          </button>
          <div className="flex flex-wrap justify-end gap-2">
            {request.status === 'Draft' || request.status === 'Rejected' ? (
              <button type="button" onClick={() => onAction('submit', request)} className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-bold text-white hover:bg-amber-700">
                Gửi duyệt
              </button>
            ) : null}
            {request.status === 'PendingApproval' ? (
              <>
                <button type="button" onClick={() => onAction('reject', request)} className="rounded-xl border border-rose-200 px-4 py-2 text-sm font-bold text-rose-700 hover:bg-rose-50">
                  Từ chối
                </button>
                <button type="button" onClick={() => onAction('approve', request)} className="rounded-xl bg-[#538463] px-4 py-2 text-sm font-bold text-white hover:bg-[#426d50]">
                  Duyệt và áp tồn
                </button>
              </>
            ) : null}
            {request.status !== 'Completed' && request.status !== 'Cancelled' ? (
              <button type="button" onClick={() => onAction('cancel', request)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">
                Hủy
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

function CreateStocktakeModal({ onClose, onSaved }) {
  const [location, setLocation] = useState('Warehouse')
  const [countDate, setCountDate] = useState(new Date().toISOString().slice(0, 10))
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const [skus, setSkus] = useState([])
  const [stocks, setStocks] = useState([])
  const [rows, setRows] = useState([])
  const [selectedSkuId, setSelectedSkuId] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    let mounted = true
    async function loadOptions() {
      setIsLoading(true)
      try {
        const isWarehouse = isWarehouseRole(loadAuthSession())
        const [skuItems, stockItems] = await Promise.all([
          isWarehouse ? fetchAllActiveSkus(200) : fetchAllActiveStoreSkus(200),
          isWarehouse ? fetchSkuStocks() : fetchStoreSkuStocks(),
        ])
        if (!mounted) return
        setSkus(skuItems)
        setStocks(stockItems)
      } catch (error) {
        if (mounted) showError(error.message)
      } finally {
        if (mounted) setIsLoading(false)
      }
    }
    loadOptions()
    return () => { mounted = false }
  }, [])

  const skuById = useMemo(() => new Map(skus.map((sku) => [sku.id, sku])), [skus])
  const stockBySkuId = useMemo(() => new Map(stocks.map((stock) => [stock.skuId, stock])), [stocks])
  const rowErrors = useMemo(() => {
    const errors = new Map()
    rows.forEach((row, index) => {
      const messages = []
      if (!row.skuId || !skuById.has(row.skuId)) messages.push('SKU không hợp lệ')
      const actual = Number(row.actualQuantity)
      if (!Number.isInteger(actual) || actual < 0) messages.push('Thực đếm phải là số nguyên không âm')
      if (!row.reasonCode) messages.push('Thiếu lý do')
      if (messages.length) errors.set(index, messages.join('; '))
    })
    return errors
  }, [rows, skuById])
  const canSubmit = rows.length > 0 && rowErrors.size === 0

  function addSelectedSku() {
    if (!selectedSkuId) return
    if (rows.some((row) => row.skuId === selectedSkuId)) {
      showError('SKU đã có trong phiếu kiểm kê.')
      return
    }
    setRows((current) => [
      ...current,
      {
        skuId: selectedSkuId,
        actualQuantity: '',
        reasonCode: 'OTHER',
        note: '',
      },
    ])
    setSelectedSkuId('')
  }

  function updateRow(index, patch) {
    setRows((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)))
  }

  function removeRow(index) {
    setRows((current) => current.filter((_, rowIndex) => rowIndex !== index))
  }

  function downloadTemplate() {
    downloadCsv('stocktake-template.csv', [
      ['SkuCode', 'ActualQuantity', 'ReasonCode', 'Note'],
      ['FG-TRA-NHAI-50G', '0', 'OTHER', ''],
    ])
  }

  async function importCsv(file) {
    if (!file) return
    const text = await file.text()
    const rowsFromFile = parseCsv(text)
    const [, ...dataRows] = rowsFromFile
    const skuByCode = new Map(skus.map((sku) => [String(sku.skuCode || '').toUpperCase(), sku]))
    const imported = []
    const errors = []
    dataRows.forEach((row, index) => {
      const [skuCode, actualQuantity, reasonCode = 'OTHER', note = ''] = row
      const sku = skuByCode.get(String(skuCode || '').toUpperCase())
      if (!sku) {
        errors.push(`Dòng ${index + 2}: không tìm thấy SKU ${skuCode}`)
        return
      }
      imported.push({
        skuId: sku.id,
        actualQuantity: String(actualQuantity ?? '').trim(),
        reasonCode: REASON_OPTIONS.some((option) => option.value === String(reasonCode).trim().toUpperCase())
          ? String(reasonCode).trim().toUpperCase()
          : 'OTHER',
        note,
      })
    })
    if (errors.length) showError(errors.slice(0, 3).join(' '))
    setRows((current) => {
      const bySkuId = new Map(current.map((row) => [row.skuId, row]))
      imported.forEach((row) => bySkuId.set(row.skuId, row))
      return [...bySkuId.values()]
    })
  }

  async function handleSave(submitNow) {
    if (!canSubmit) {
      showError(rows.length === 0 ? 'Phiếu kiểm kê cần ít nhất một SKU.' : 'Vui lòng sửa lỗi ở các dòng kiểm kê.')
      return
    }

    setIsSaving(true)
    try {
      const payload = {
        location,
        countDate: countDate || null,
        reason: reason.trim() || null,
        note: note.trim() || null,
        items: rows.map((row) => {
          const sku = skuById.get(row.skuId)
          return {
            skuId: row.skuId,
            skuCode: sku?.skuCode,
            skuSnapshotName: getSkuName(sku),
            actualQuantity: Number(row.actualQuantity),
            reasonCode: row.reasonCode,
            note: row.note?.trim() || null,
          }
        }),
      }
      const created = await createStocktakeRequest(payload)
      const result = submitNow ? await submitStocktakeRequest(created.id) : created
      showSuccess(submitNow ? `Đã gửi duyệt ${result.requestCode}.` : `Đã lưu nháp ${result.requestCode}.`)
      onSaved?.(result)
      onClose?.()
    } catch (error) {
      showError(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="flex max-h-[min(92dvh,820px)] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex shrink-0 items-start justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-[#538463]">Kiểm kê tồn kho</p>
            <h2 className="mt-1 text-xl font-bold text-slate-900">Tạo phiếu kiểm kê</h2>
            <p className="mt-1 text-sm text-slate-500">Không thay đổi tồn cho tới khi phiếu được duyệt.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
            <span className="material-symbols-outlined text-[22px]">close</span>
          </button>
        </div>

        <div className="custom-scrollbar flex-1 overflow-y-auto p-6">
          <div className="grid gap-4 md:grid-cols-4">
            <label className="space-y-1">
              <span className="text-xs font-semibold uppercase text-slate-500">Vị trí kiểm kê</span>
              <select value={location} onChange={(event) => setLocation(event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">
                {LOCATION_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-xs font-semibold uppercase text-slate-500">Ngày kiểm kê</span>
              <input type="date" value={countDate} onChange={(event) => setCountDate(event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            </label>
            <label className="space-y-1 md:col-span-2">
              <span className="text-xs font-semibold uppercase text-slate-500">Lý do / ghi chú chung</span>
              <input value={reason} onChange={(event) => setReason(event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="VD: Kiểm kê cuối ca" />
            </label>
          </div>

          <div className="mt-4 flex flex-wrap items-end gap-3 rounded-xl bg-slate-50 p-4">
            <label className="min-w-[260px] flex-1 space-y-1">
              <span className="text-xs font-semibold uppercase text-slate-500">Thêm SKU</span>
              <select value={selectedSkuId} onChange={(event) => setSelectedSkuId(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" disabled={isLoading}>
                <option value="">{isLoading ? 'Đang tải SKU...' : 'Chọn SKU'}</option>
                {skus.map((sku) => (
                  <option key={sku.id} value={sku.id}>{sku.skuCode} · {getSkuName(sku)}</option>
                ))}
              </select>
            </label>
            <button type="button" onClick={addSelectedSku} className="rounded-xl bg-[#538463] px-4 py-2 text-sm font-bold text-white hover:bg-[#426d50]">
              Thêm dòng
            </button>
            <button type="button" onClick={downloadTemplate} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">
              Tải mẫu CSV
            </button>
            <label className="cursor-pointer rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">
              Import CSV
              <input type="file" accept=".csv,text/csv" className="hidden" onChange={(event) => importCsv(event.target.files?.[0])} />
            </label>
          </div>

          <div className="mt-4 overflow-hidden rounded-xl border border-slate-100">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">SKU</th>
                  <th className="px-4 py-3 text-right">Tồn hệ thống</th>
                  <th className="px-4 py-3 text-right">Thực đếm</th>
                  <th className="px-4 py-3 text-right">Chênh lệch</th>
                  <th className="px-4 py-3">Lý do</th>
                  <th className="px-4 py-3">Ghi chú</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-slate-500">Chưa có dòng kiểm kê.</td></tr>
                ) : rows.map((row, index) => {
                  const sku = skuById.get(row.skuId)
                  const systemQuantity = getSystemQuantity(stockBySkuId.get(row.skuId), location)
                  const actual = Number(row.actualQuantity)
                  const variance = Number.isFinite(actual) ? actual - systemQuantity : 0
                  return (
                    <tr key={row.skuId} className={rowErrors.has(index) ? 'bg-rose-50/40' : ''}>
                      <td className="px-4 py-3">
                        <p className="font-mono font-semibold text-[#356647]">{sku?.skuCode || '—'}</p>
                        <p className="text-xs text-slate-500">{getSkuName(sku)}</p>
                        {rowErrors.has(index) ? <p className="mt-1 text-xs text-rose-600">{rowErrors.get(index)}</p> : null}
                      </td>
                      <td className="px-4 py-3 text-right">{formatStockQuantity(systemQuantity)}</td>
                      <td className="px-4 py-3 text-right">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={row.actualQuantity}
                          onChange={(event) => updateRow(index, { actualQuantity: event.target.value })}
                          className="w-28 rounded-lg border border-slate-200 px-3 py-2 text-right"
                        />
                      </td>
                      <td className={`px-4 py-3 text-right font-semibold ${variance >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {variance > 0 ? '+' : ''}{formatStockQuantity(variance)}
                      </td>
                      <td className="px-4 py-3">
                        <select value={row.reasonCode} onChange={(event) => updateRow(index, { reasonCode: event.target.value })} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
                          {REASON_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <input value={row.note} onChange={(event) => updateRow(index, { note: event.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button type="button" onClick={() => removeRow(index)} className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600">
                          <span className="material-symbols-outlined text-[20px]">delete</span>
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <textarea value={note} onChange={(event) => setNote(event.target.value)} className="mt-4 min-h-20 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Ghi chú nội bộ..." />
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-6 py-4">
          <p className="text-sm text-slate-500">{rows.length} SKU · {getLocationLabel(location)}</p>
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">
              Đóng
            </button>
            <button type="button" disabled={isSaving} onClick={() => handleSave(false)} className="rounded-xl border border-[#538463] px-4 py-2 text-sm font-bold text-[#356647] hover:bg-emerald-50 disabled:opacity-60">
              Lưu nháp
            </button>
            <button type="button" disabled={isSaving} onClick={() => handleSave(true)} className="rounded-xl bg-[#538463] px-4 py-2 text-sm font-bold text-white hover:bg-[#426d50] disabled:opacity-60">
              {isSaving ? 'Đang lưu...' : 'Tạo và gửi duyệt'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function InventoryStocktakePage() {
  const [searchInput, setSearchInput] = useState('')
  const [status, setStatus] = useState('')
  const [location, setLocation] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(TABLE_PAGE_SIZE)
  const [data, setData] = useState({ items: [], totalItems: 0, totalPages: 1 })
  const [isLoading, setIsLoading] = useState(true)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [detail, setDetail] = useState(null)
  const session = loadAuthSession()
  const currentUserId = session?.userId
  const canWrite = canWriteInventory(session)

  const loadRequests = useCallback(async () => {
    setIsLoading(true)
    try {
      const result = await fetchStocktakeRequests({
        search: searchInput.trim() || undefined,
        status: status || undefined,
        location: location || undefined,
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
  }, [location, page, pageSize, searchInput, status])

  useEffect(() => {
    const timer = window.setTimeout(loadRequests, 250)
    return () => window.clearTimeout(timer)
  }, [loadRequests])

  function resetPageAndSet(setter, value) {
    setter(value)
    setPage(1)
  }

  async function openDetail(id) {
    try {
      const request = await fetchStocktakeRequestById(id)
      setDetail(request)
    } catch (error) {
      showError(error.message)
    }
  }

  async function handleAction(action, request) {
    try {
      let result
      if (action === 'submit') {
        result = await submitStocktakeRequest(request.id)
        showSuccess(`Đã gửi duyệt ${result.requestCode}.`)
      } else {
        const defaultReason = action === 'approve' ? 'Duyệt kiểm kê' : ''
        const reason = window.prompt(action === 'approve' ? 'Ghi chú duyệt' : 'Nhập lý do', defaultReason)
        if (reason === null) return
        if ((action === 'reject' || action === 'cancel') && !reason.trim()) {
          showError('Vui lòng nhập lý do.')
          return
        }
        if (action === 'approve') {
          result = await approveStocktakeRequest(request.id, reason)
          notifyInventoryStockChanged()
          showSuccess(`Đã áp tồn theo ${result.requestCode}.`)
        }
        if (action === 'reject') {
          result = await rejectStocktakeRequest(request.id, reason)
          showSuccess(`Đã từ chối ${result.requestCode}.`)
        }
        if (action === 'cancel') {
          result = await cancelStocktakeRequest(request.id, reason)
          showSuccess(`Đã hủy ${result.requestCode}.`)
        }
      }
      await loadRequests()
      if (result) setDetail(result)
    } catch (error) {
      showError(error.message)
    }
  }

  return (
    <PageShell>
      <PageHeader
        title="Kiểm kê tồn kho"
        description="Ghi nhận chênh lệch thực đếm theo Kho hoặc Kệ Hàng, chờ duyệt trước khi áp tồn."
        searchPlaceholder="Tìm mã phiếu, SKU, tên hàng, mã lô..."
        searchValue={searchInput}
        onSearchChange={(value) => resetPageAndSet(setSearchInput, value)}
        rightContent={(
          <div className="flex flex-wrap items-center gap-3">
            <InventoryNavTabs />
            {canWrite ? (
              <button type="button" onClick={() => setIsCreateOpen(true)} className="inline-flex items-center gap-1.5 rounded-xl bg-[#538463] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#426d50]">
                <span className="material-symbols-outlined text-[18px]">add</span>
                Tạo phiếu kiểm kê
              </button>
            ) : null}
          </div>
        )}
      />

      <div className="mb-4 grid grid-cols-1 gap-3 rounded-2xl bg-white p-4 shadow-sm md:grid-cols-3">
        <select className="rounded-xl border border-slate-200 px-3 py-2 text-sm" value={status} onChange={(event) => resetPageAndSet(setStatus, event.target.value)}>
          {STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <select className="rounded-xl border border-slate-200 px-3 py-2 text-sm" value={location} onChange={(event) => resetPageAndSet(setLocation, event.target.value)}>
          <option value="">Tất cả vị trí</option>
          {LOCATION_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <button
          type="button"
          onClick={() => downloadCsv('stocktake-list.csv', [
            ['RequestCode', 'Location', 'Status', 'CreatedAt', 'PositiveVariance', 'NegativeVariance'],
            ...data.items.map((item) => [item.requestCode, getLocationLabel(item.location), getStatusLabel(item.status), item.createdAt, item.totalPositiveVariance, item.totalNegativeVariance]),
          ])}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
        >
          <span className="material-symbols-outlined text-[18px]">download</span>
          Xuất danh sách CSV
        </button>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-6 py-3">Mã phiếu</th>
                <th className="px-4 py-3">Vị trí</th>
                <th className="px-4 py-3">Trạng thái</th>
                <th className="px-4 py-3 text-right">Tăng</th>
                <th className="px-4 py-3 text-right">Giảm</th>
                <th className="px-4 py-3">Người tạo</th>
                <th className="px-4 py-3">Thời gian</th>
                <th className="px-4 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr><td colSpan={8} className="px-6 py-8 text-slate-500">Đang tải...</td></tr>
              ) : data.items.length === 0 ? (
                <tr><td colSpan={8} className="px-6 py-8 text-slate-500">Chưa có phiếu kiểm kê phù hợp.</td></tr>
              ) : data.items.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/80">
                  <td className="px-6 py-4">
                    <button type="button" onClick={() => openDetail(item.id)} className="font-mono font-semibold text-[#356647] hover:underline">
                      {item.requestCode}
                    </button>
                    <p className="text-xs text-slate-500">{item.items.length} SKU</p>
                  </td>
                  <td className="px-4 py-4">{getLocationLabel(item.location)}</td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${getStatusClass(item.status)}`}>
                      {getStatusLabel(item.status)}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-right font-semibold text-emerald-700">+{formatStockQuantity(item.totalPositiveVariance)}</td>
                  <td className="px-4 py-4 text-right font-semibold text-rose-700">-{formatStockQuantity(item.totalNegativeVariance)}</td>
                  <td className="px-4 py-4">{item.createdByName || '—'}</td>
                  <td className="px-4 py-4 text-slate-600">{formatVietnamDateTime(item.createdAt)}</td>
                  <td className="px-4 py-4">
                    <div className="flex justify-end gap-2">
                      <button type="button" onClick={() => openDetail(item.id)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50">
                        Chi tiết
                      </button>
                      {canWrite && item.status === 'PendingApproval' && item.createdBy !== currentUserId ? (
                        <button type="button" onClick={() => handleAction('approve', item)} className="rounded-lg bg-[#538463] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#426d50]">
                          Duyệt
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
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
          itemLabel="phiếu kiểm kê"
        />
      </section>

      {isCreateOpen ? (
        <CreateStocktakeModal
          onClose={() => setIsCreateOpen(false)}
          onSaved={() => {
            setPage(1)
            loadRequests()
          }}
        />
      ) : null}
      {detail ? (
        <StocktakeDetailModal
          request={detail}
          onClose={() => setDetail(null)}
          onAction={handleAction}
        />
      ) : null}
    </PageShell>
  )
}

export default InventoryStocktakePage
