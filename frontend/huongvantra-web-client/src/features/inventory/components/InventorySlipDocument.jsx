import { useState } from 'react'
import { showError } from '../../../app/toast.js'
import { formatVietnamDateTime } from '../../../utils/vietnamDateTime.js'
import { formatStockQuantity } from '../../products/utils/productDisplay.js'
import { formatCreatorRole, UNKNOWN_CREATOR_VALUE } from '../utils/inventoryCreatorDisplay.js'
import { getStockTransferSourceRef, getStockTransferTypeLabel } from '../utils/stockFlowLabels.js'

export function SlipPrintStyles() {
  return (
    <style>
      {`
        @media print {
          @page {
            margin: 14mm;
          }
          html,
          body {
            background: white !important;
          }
          body * {
            visibility: hidden !important;
          }
          .inventory-slip-print,
          .inventory-slip-print * {
            visibility: visible !important;
          }
          .inventory-slip-print {
            position: absolute !important;
            inset: 0 auto auto 0 !important;
            width: 100% !important;
            max-width: none !important;
            box-shadow: none !important;
            border: 0 !important;
            padding: 24px !important;
            background: white !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}
    </style>
  )
}

function getPdfFilename(filename) {
  const normalized = String(filename || '').trim()
  if (!normalized) return 'phieu-kho.pdf'
  return normalized.toLowerCase().endsWith('.pdf') ? normalized : `${normalized}.pdf`
}

function getCreatorDisplay(slip) {
  const name = String(slip?.createdByName || '').trim()
  return {
    name: name || UNKNOWN_CREATOR_VALUE,
    role: formatCreatorRole(slip?.createdByRoleName),
  }
}

function formatDestinationLocation(value) {
  if (value === 'Shelf') return 'Kệ Hàng'
  if (value === 'Warehouse') return 'Kho'
  return '—'
}

export function SlipActionButtons({ documentRef, filename = 'phieu-kho.pdf' }) {
  const [isExporting, setIsExporting] = useState(false)

  function printSlip() {
    window.print()
  }

  async function exportPdf() {
    const element = documentRef?.current
    if (!element) {
      showError('Không tìm thấy nội dung phiếu để xuất PDF.')
      return
    }

    setIsExporting(true)
    try {
      const html2pdfModule = await import('html2pdf.js')
      const html2pdf = html2pdfModule.default ?? html2pdfModule
      const worker = html2pdf()
      await worker
        .set({
          margin: [10, 10, 10, 10],
          filename: getPdfFilename(filename),
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: {
            scale: Math.min(2, window.devicePixelRatio || 1.5),
            backgroundColor: '#ffffff',
            useCORS: true,
            scrollY: 0,
          },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
          pagebreak: {
            mode: ['css', 'legacy'],
            avoid: ['tr', 'thead', '.signature-area'],
          },
        })
        .from(element)
        .save()
    } catch (error) {
      showError(error?.message ? `Xuất PDF thất bại: ${error.message}` : 'Xuất PDF thất bại.')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="no-print mb-4 flex flex-wrap justify-end gap-2">
      <button
        type="button"
        onClick={printSlip}
        className="inline-flex min-w-28 items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
      >
        <span className="material-symbols-outlined text-[18px]">print</span>
        In phiếu
      </button>
      <button
        type="button"
        onClick={exportPdf}
        disabled={isExporting}
        className="inline-flex min-w-28 items-center justify-center gap-1.5 rounded-xl bg-[#538463] px-4 py-2 text-sm font-bold text-white hover:bg-[#457053] disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className={`material-symbols-outlined text-[18px] ${isExporting ? 'animate-spin' : ''}`}>
          {isExporting ? 'progress_activity' : 'picture_as_pdf'}
        </span>
        {isExporting ? 'Đang xuất...' : 'Xuất PDF'}
      </button>
    </div>
  )
}

function SignatureArea({ creator }) {
  return (
    <div className="signature-area mt-10 grid grid-cols-3 gap-6 text-center text-sm text-slate-700">
      <div>
        <p className="font-semibold">Người lập phiếu</p>
        <p className="mt-12 font-medium text-slate-800">{creator.name}</p>
        <p className="mt-1 text-xs text-slate-500">Chức vụ/Vai trò: {creator.role}</p>
        <p className="mt-8 text-xs text-slate-400">(Ký, ghi rõ họ tên)</p>
      </div>
      <div>
        <p className="font-semibold">Thủ kho</p>
        <p className="mt-16 text-xs text-slate-400">(Ký, ghi rõ họ tên)</p>
      </div>
      <div>
        <p className="font-semibold">Kế toán/Manager</p>
        <p className="mt-16 text-xs text-slate-400">(Ký, ghi rõ họ tên)</p>
      </div>
    </div>
  )
}

function StockTransferSignatureArea({ creator }) {
  return (
    <div className="signature-area mt-10 grid grid-cols-2 gap-6 text-center text-sm text-slate-700">
      <div>
        <p className="font-semibold">Người lập phiếu</p>
        <p className="mt-12 font-medium text-slate-800">{creator.name}</p>
        <p className="mt-1 text-xs text-slate-500">Chức vụ/Vai trò: {creator.role}</p>
        <p className="mt-8 text-xs text-slate-400">(Ký, ghi rõ họ tên)</p>
      </div>
      <div>
        <p className="font-semibold">Quản Lý Cửa Hàng</p>
        <p className="mt-16 text-xs text-slate-400">(Ký, ghi rõ họ tên)</p>
      </div>
    </div>
  )
}

function HeaderField({ label, value, emptyFallback = '-' }) {
  return (
    <div>
      <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</span>
      <span className="mt-1 block text-sm font-medium text-slate-800">{value || emptyFallback}</span>
    </div>
  )
}

function getExportLines(slip) {
  if (slip.lines?.length) return slip.lines
  return [
    {
      id: `${slip.id}-legacy-line`,
      skuCode: slip.skuCode,
      productSnapshotName: slip.skuSnapshotName,
      quantity: slip.quantity,
      warehouseQtyBefore: slip.warehouseQtyBefore,
      warehouseQtyAfter: slip.warehouseQtyAfter,
      storeQtyBefore: slip.storeQtyBefore,
      storeQtyAfter: slip.storeQtyAfter,
      batchAllocations: slip.batchAllocations ?? [],
    },
  ]
}

function getImportLines(slip) {
  if (slip.lines?.length) return slip.lines
  return [
    {
      id: `${slip.id}-legacy-line`,
      skuCode: slip.skuCode,
      productSnapshotName: slip.productSnapshotName,
      quantity: slip.quantity,
      warehouseQtyBefore: slip.warehouseQtyBefore,
      warehouseQtyAfter: slip.warehouseQtyAfter,
      storeQtyBefore: slip.storeQtyBefore,
      storeQtyAfter: slip.storeQtyAfter,
      warehouseBatchId: slip.warehouseBatchId,
      warehouseBatchLotCode: slip.warehouseBatchLotCode,
    },
  ]
}

function formatAllocations(allocations = []) {
  const visibleAllocations = allocations.filter((allocation) => allocation.lotCode)
  if (!visibleAllocations.length) return '-'
  return visibleAllocations
    .map((allocation) => `${allocation.lotCode} (${formatStockQuantity(allocation.quantity)})`)
    .join(', ')
}

function formatQuantityTransition(before, after) {
  return `${formatStockQuantity(before)} -> ${formatStockQuantity(after)}`
}

function normalizeProductionNote(note) {
  return String(note || '')
    .trim()
}

function getProductionAwareNote(slip, fallbackText) {
  const normalizedNote = slip?.productionCode ? normalizeProductionNote(slip.note) : String(slip?.note || '').trim()
  if (normalizedNote) return normalizedNote
  return slip?.productionCode ? fallbackText : ''
}

function isManualMaterialImportSlip(slip) {
  return slip?.importType === 'manual_material_import'
}

export function ExportSlipDocument({ slip, getTypeLabel }) {
  const lines = getExportLines(slip)
  const totalQuantity = lines.reduce((sum, line) => sum + Number(line.quantity || 0), 0)
  const creator = getCreatorDisplay(slip)
  const note = getProductionAwareNote(
    slip,
    `Xuất nguyên liệu cho lệnh sản xuất ${slip.productionCode}`,
  )

  return (
    <article className="inventory-slip-print rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="border-b border-slate-200 pb-4 text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#356647]">HuongVanTra</p>
        <h1 className="mt-2 text-2xl font-bold uppercase text-slate-900">Phiếu xuất kho</h1>
        <p className="mt-1 text-sm text-slate-500">Kho tổng</p>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-4">
        <HeaderField label="Mã phiếu" value={slip.exportCode} />
        <HeaderField label="Loại xuất" value={getTypeLabel(slip.exportType)} />
        <HeaderField label="Mã lệnh SX" value={slip.productionCode} />
        <HeaderField label="Thời gian" value={slip.createdAt ? formatVietnamDateTime(slip.createdAt) : '-'} />
        <HeaderField label="Kho" value="Kho tổng" />
        <HeaderField label="Người lập phiếu" value={creator.name} />
        <HeaderField label="Chức vụ/Vai trò" value={creator.role} />
        <HeaderField label="Tổng số lượng" value={formatStockQuantity(totalQuantity)} />
        <HeaderField label="Số dòng" value={`${lines.length} dòng nguyên liệu`} />
      </div>

      {note ? (
        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <span className="font-semibold">Ghi chú:</span> {note}
        </div>
      ) : null}

      <div className="mt-6 overflow-x-auto">
        <table className="min-w-full border border-slate-200 text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="border-b border-slate-200 px-3 py-2">Sản Phẩm</th>
              <th className="border-b border-slate-200 px-3 py-2 text-right">Số lượng</th>
              <th className="border-b border-slate-200 px-3 py-2">Kho trước {'->'} sau</th>
              <th className="border-b border-slate-200 px-3 py-2">Tồn quầy POS trước {'->'} sau</th>
              <th className="border-b border-slate-200 px-3 py-2">Lô FIFO</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {lines.map((line) => (
              <tr key={line.id}>
                <td className="px-3 py-2">
                  <p className="text-slate-800">{line.productSnapshotName || '-'}</p>
                  <p className="font-mono text-xs text-slate-500">{line.skuCode}</p>
                </td>
                <td className="px-3 py-2 text-right font-semibold">{formatStockQuantity(line.quantity)}</td>
                <td className="px-3 py-2 text-slate-700">
                  {formatQuantityTransition(line.warehouseQtyBefore, line.warehouseQtyAfter)}
                </td>
                <td className="px-3 py-2 text-slate-700">
                  {formatQuantityTransition(line.storeQtyBefore, line.storeQtyAfter)}
                </td>
                <td className="px-3 py-2 text-slate-700">{formatAllocations(line.batchAllocations)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <SignatureArea creator={creator} />
    </article>
  )
}

export function ProductionOrderDocument({ order, statusLabel }) {
  const outputLines = Array.isArray(order?.outputLines) ? order.outputLines.filter(Boolean) : []
  const materialLines = Array.isArray(order?.lines) ? order.lines.filter(Boolean) : []
  const totalOutput = outputLines.reduce((sum, line) => sum + Number(line.plannedQuantity || 0), 0)
  const creator = getCreatorDisplay(order)

  return (
    <article className="inventory-slip-print rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="border-b border-slate-200 pb-4 text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#356647]">HuongVanTra</p>
        <h1 className="mt-2 text-2xl font-bold uppercase text-slate-900">Lệnh sản xuất</h1>
        <p className="mt-1 font-mono text-sm text-slate-500">{order?.productionCode || '-'}</p>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-4">
        <HeaderField label="Mã lệnh SX" value={order?.productionCode} />
        <HeaderField label="Trạng thái" value={statusLabel} />
        <HeaderField label="Ngày tạo" value={order?.createdAt ? formatVietnamDateTime(order.createdAt) : '-'} />
        <HeaderField label="Hoàn thành" value={order?.completedAt ? formatVietnamDateTime(order.completedAt) : '-'} />
        <HeaderField label="Người lập phiếu" value={creator.name} />
        <HeaderField label="Chức vụ/Vai trò" value={creator.role} />
        <HeaderField label="Tổng số lượng SX" value={formatStockQuantity(totalOutput)} />
        <HeaderField label="Số dòng" value={`${outputLines.length} thành phẩm · ${materialLines.length} nguyên liệu`} />
      </div>

      {order?.note ? (
        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <span className="font-semibold">Ghi chú:</span> {order.note}
        </div>
      ) : null}

      <div className="mt-6 overflow-x-auto">
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Thành phẩm đầu ra</p>
        <table className="min-w-full border border-slate-200 text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="border-b border-slate-200 px-3 py-2">Sản Phẩm</th>
              <th className="border-b border-slate-200 px-3 py-2 text-right">Số lượng</th>
              <th className="border-b border-slate-200 px-3 py-2">Nơi nhập</th>
              <th className="border-b border-slate-200 px-3 py-2">Lô thành phẩm</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {outputLines.map((line) => (
              <tr key={line.id}>
                <td className="px-3 py-2">
                  <p className="text-slate-800">{line.finishedSkuSnapshotName || '-'}</p>
                  <p className="font-mono text-xs text-slate-500">{line.finishedSkuCode || '-'}</p>
                </td>
                <td className="px-3 py-2 text-right font-semibold">{formatStockQuantity(line.plannedQuantity)}</td>
                <td className="px-3 py-2 text-slate-700">{formatDestinationLocation(line.destinationLocation)}</td>
                <td className="px-3 py-2 font-mono text-slate-700">{line.warehouseBatchLotCode || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {materialLines.length ? (
        <div className="mt-5 overflow-x-auto">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Nguyên liệu cần xuất theo BOM</p>
          <table className="min-w-full border border-slate-200 text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="border-b border-slate-200 px-3 py-2">Nguyên liệu</th>
                <th className="border-b border-slate-200 px-3 py-2 text-right">Số lượng</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {materialLines.map((line) => (
                <tr key={line.id}>
                  <td className="px-3 py-2">
                    <p className="text-slate-800">{line.materialSnapshotName || '-'}</p>
                    <p className="font-mono text-xs text-slate-500">{line.materialSkuCode || '-'}</p>
                  </td>
                  <td className="px-3 py-2 text-right font-semibold">{formatStockQuantity(line.plannedQuantity)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <SignatureArea creator={creator} />
    </article>
  )
}

export function StockTransferDocument({ transfer, statusLabel }) {
  const lines = Array.isArray(transfer?.lines) ? transfer.lines.filter(Boolean) : []
  const totalQuantity = Number(
    transfer?.totalQuantity ?? lines.reduce((sum, line) => sum + Number(line.quantity || 0), 0),
  )
  const creator = getCreatorDisplay(transfer)

  return (
    <article className="inventory-slip-print rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="border-b border-slate-200 pb-4 text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#356647]">HuongVanTra</p>
        <h1 className="mt-2 text-2xl font-bold uppercase text-slate-900">Phiếu điều chuyển</h1>
        <p className="mt-1 text-sm text-slate-500">Kho → Kệ Hàng</p>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-4">
        <HeaderField label="Mã phiếu" value={transfer?.transferCode} />
        <HeaderField label="Trạng thái" value={statusLabel} />
        <HeaderField
          label="Loại phiếu"
          value={getStockTransferTypeLabel(transfer)}
        />
        <HeaderField
          label="Yêu cầu nguồn"
          value={getStockTransferSourceRef(transfer)}
        />
        <HeaderField label="Người yêu cầu" value={transfer?.sourceRequestedByName} />
        <HeaderField label="Thời gian tạo" value={transfer?.createdAt ? formatVietnamDateTime(transfer.createdAt) : '-'} />
        <HeaderField label="Phiếu xuất" value={transfer?.exportSlipCode} />
        <HeaderField label="Hoàn tất lúc" value={transfer?.completedAt ? formatVietnamDateTime(transfer.completedAt) : '-'} />
        <HeaderField label="Người lập phiếu" value={creator.name} />
        <HeaderField label="Chức vụ/Vai trò" value={creator.role} />
        <HeaderField label="Phiếu nhập" value={transfer?.importSlipCode} />
        <HeaderField label="Tổng số lượng" value={formatStockQuantity(totalQuantity)} />
        <HeaderField label="Số dòng" value={`${lines.length} dòng`} />
      </div>

      {transfer?.note ? (
        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <span className="font-semibold">Ghi chú:</span> {transfer.note}
        </div>
      ) : null}

      {transfer?.cancellationReason ? (
        <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <span className="font-semibold">Lý do hủy:</span> {transfer.cancellationReason}
        </div>
      ) : null}

      <div className="mt-6 overflow-x-auto">
        <table className="min-w-full border border-slate-200 text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="border-b border-slate-200 px-3 py-2">Sản Phẩm</th>
              <th className="border-b border-slate-200 px-3 py-2 text-right">Số lượng</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {lines.map((line) => (
              <tr key={line.id}>
                <td className="px-3 py-2">
                  <p className="text-slate-800">{line.skuNameSnapshot || '-'}</p>
                  <p className="font-mono text-xs text-slate-500">{line.skuCode}</p>
                </td>
                <td className="px-3 py-2 text-right font-semibold">{formatStockQuantity(line.quantity)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <StockTransferSignatureArea creator={creator} />
    </article>
  )
}

export function ImportSlipDocument({ slip, getTypeLabel }) {
  const lines = getImportLines(slip)
  const totalQuantity = lines.reduce((sum, line) => sum + Number(line.quantity || 0), 0)
  const creator = getCreatorDisplay(slip)
  const isManualMaterialImport = isManualMaterialImportSlip(slip)
  const lineKindLabel = isManualMaterialImport ? 'nguyên liệu' : 'thành phẩm'
  const lotColumnLabel = isManualMaterialImport ? 'Mã lô nhập' : 'Lô thành phẩm'
  const note = getProductionAwareNote(
    slip,
    `Nhập thành phẩm từ lệnh sản xuất ${slip.productionCode}`,
  )

  return (
    <article className="inventory-slip-print rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="border-b border-slate-200 pb-4 text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#356647]">HuongVanTra</p>
        <h1 className="mt-2 text-2xl font-bold uppercase text-slate-900">Phiếu nhập kho</h1>
        <p className="mt-1 text-sm text-slate-500">Kho tổng</p>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-4">
        <HeaderField label="Mã phiếu" value={slip.importCode} />
        <HeaderField label="Loại nhập" value={getTypeLabel(slip.importType)} />
        <HeaderField label="Mã lệnh SX" value={slip.productionCode} emptyFallback={isManualMaterialImport ? '' : '-'} />
        <HeaderField label="Thời gian" value={slip.createdAt ? formatVietnamDateTime(slip.createdAt) : '-'} />
        <HeaderField label="Kho" value="Kho tổng" />
        <HeaderField label="Người lập phiếu" value={creator.name} />
        <HeaderField label="Chức vụ/Vai trò" value={creator.role} />
        <HeaderField label="Tổng số lượng" value={formatStockQuantity(totalQuantity)} />
        <HeaderField label="Số dòng" value={`${lines.length} dòng ${lineKindLabel}`} />
      </div>

      {note ? (
        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <span className="font-semibold">Ghi chú:</span> {note}
        </div>
      ) : null}

      <div className="mt-6 overflow-x-auto">
        <table className="min-w-full border border-slate-200 text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="border-b border-slate-200 px-3 py-2">Sản Phẩm</th>
              <th className="border-b border-slate-200 px-3 py-2 text-right">Số lượng</th>
              <th className="border-b border-slate-200 px-3 py-2">{lotColumnLabel}</th>
              <th className="border-b border-slate-200 px-3 py-2">Nơi nhập</th>
              <th className="border-b border-slate-200 px-3 py-2">Kho trước {'->'} sau</th>
              <th className="border-b border-slate-200 px-3 py-2">Tồn quầy POS trước {'->'} sau</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {lines.map((line) => (
              <tr key={line.id}>
                <td className="px-3 py-2">
                  <p className="text-slate-800">{line.productSnapshotName || '-'}</p>
                  <p className="font-mono text-xs text-slate-500">{line.skuCode}</p>
                </td>
                <td className="px-3 py-2 text-right font-semibold">{formatStockQuantity(line.quantity)}</td>
                <td className="px-3 py-2 text-slate-700">
                  <span className="font-mono">{line.warehouseBatchLotCode || '-'}</span>
                </td>
                <td className="px-3 py-2 text-slate-700">{formatDestinationLocation(line.destinationLocation)}</td>
                <td className="px-3 py-2 text-slate-700">
                  {formatQuantityTransition(line.warehouseQtyBefore, line.warehouseQtyAfter)}
                </td>
                <td className="px-3 py-2 text-slate-700">
                  {formatQuantityTransition(line.storeQtyBefore, line.storeQtyAfter)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <SignatureArea creator={creator} />
    </article>
  )
}
