import { useState } from 'react'
import { showError } from '../../../app/toast.js'
import { formatVietnamDateTime } from '../../../utils/vietnamDateTime.js'
import { formatStockQuantity } from '../../products/utils/productDisplay.js'

const UNKNOWN_CREATOR_VALUE = 'Chưa xác định'

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

function normalizeRoleKey(roleName) {
  return String(roleName || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '')
}

function formatCreatorRole(roleName) {
  const trimmed = String(roleName || '').trim()
  if (!trimmed) return UNKNOWN_CREATOR_VALUE

  const roleMap = {
    warehouse: 'Thủ kho',
    warehousestaff: 'Thủ kho',
    inventorystaff: 'Thủ kho',
    inventorymanager: 'Quản lý kho',
    manager: 'Quản lý',
    agencymanager: 'Quản lý',
    admin: 'Quản trị viên',
    administrator: 'Quản trị viên',
    sale: 'Nhân viên bán hàng',
    salesstaff: 'Nhân viên bán hàng',
  }

  return roleMap[normalizeRoleKey(trimmed)] || trimmed
}

function getCreatorDisplay(slip) {
  const name = String(slip?.createdByName || '').trim()
  return {
    name: name || UNKNOWN_CREATOR_VALUE,
    role: formatCreatorRole(slip?.createdByRoleName),
  }
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

function HeaderField({ label, value }) {
  return (
    <div>
      <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</span>
      <span className="mt-1 block text-sm font-medium text-slate-800">{value || '-'}</span>
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

function normalizeProductionNote(note) {
  return String(note || '')
    .trim()
    .replace(/lệnh sản xuất/gi, 'lô sản xuất')
    .replace(/từ lệnh/gi, 'từ lô sản xuất')
    .replace(/cho lệnh/gi, 'cho lô sản xuất')
}

function getProductionAwareNote(slip, fallbackText) {
  const normalizedNote = slip?.productionCode ? normalizeProductionNote(slip.note) : String(slip?.note || '').trim()
  if (normalizedNote) return normalizedNote
  return slip?.productionCode ? fallbackText : ''
}

export function ExportSlipDocument({ slip, getTypeLabel }) {
  const lines = getExportLines(slip)
  const totalQuantity = lines.reduce((sum, line) => sum + Number(line.quantity || 0), 0)
  const creator = getCreatorDisplay(slip)
  const note = getProductionAwareNote(
    slip,
    `Xuất nguyên liệu cho lô sản xuất ${slip.productionCode}`,
  )

  return (
    <article className="inventory-slip-print rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="border-b border-slate-200 pb-4 text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#356647]">HuongVanTra</p>
        <h1 className="mt-2 text-2xl font-bold uppercase text-slate-900">Phiếu xuất kho</h1>
        <p className="mt-1 text-sm text-slate-500">Kho tổng - Workflow 1</p>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-4">
        <HeaderField label="Mã phiếu" value={slip.exportCode} />
        <HeaderField label="Loại xuất" value={getTypeLabel(slip.exportType)} />
        <HeaderField label="Mã lô SX" value={slip.productionCode} />
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
              <th className="border-b border-slate-200 px-3 py-2">SKU</th>
              <th className="border-b border-slate-200 px-3 py-2">Nguyên liệu</th>
              <th className="border-b border-slate-200 px-3 py-2 text-right">Số lượng</th>
              <th className="border-b border-slate-200 px-3 py-2">Kho trước/sau</th>
              <th className="border-b border-slate-200 px-3 py-2">Cửa hàng trước/sau</th>
              <th className="border-b border-slate-200 px-3 py-2">Lô FIFO</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {lines.map((line) => (
              <tr key={line.id}>
                <td className="px-3 py-2 font-mono text-[#356647]">{line.skuCode}</td>
                <td className="px-3 py-2 text-slate-800">{line.productSnapshotName || '-'}</td>
                <td className="px-3 py-2 text-right font-semibold">{formatStockQuantity(line.quantity)}</td>
                <td className="px-3 py-2 text-slate-700">
                  {formatStockQuantity(line.warehouseQtyBefore)} / {formatStockQuantity(line.warehouseQtyAfter)}
                </td>
                <td className="px-3 py-2 text-slate-700">
                  {formatStockQuantity(line.storeQtyBefore)} / {formatStockQuantity(line.storeQtyAfter)}
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

export function ImportSlipDocument({ slip, getTypeLabel }) {
  const lines = getImportLines(slip)
  const totalQuantity = lines.reduce((sum, line) => sum + Number(line.quantity || 0), 0)
  const creator = getCreatorDisplay(slip)
  const note = getProductionAwareNote(
    slip,
    `Nhập thành phẩm từ lô sản xuất ${slip.productionCode}`,
  )

  return (
    <article className="inventory-slip-print rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="border-b border-slate-200 pb-4 text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#356647]">HuongVanTra</p>
        <h1 className="mt-2 text-2xl font-bold uppercase text-slate-900">Phiếu nhập kho</h1>
        <p className="mt-1 text-sm text-slate-500">Kho tổng - Workflow 1</p>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-4">
        <HeaderField label="Mã phiếu" value={slip.importCode} />
        <HeaderField label="Loại nhập" value={getTypeLabel(slip.importType)} />
        <HeaderField label="Mã lô SX" value={slip.productionCode} />
        <HeaderField label="Thời gian" value={slip.createdAt ? formatVietnamDateTime(slip.createdAt) : '-'} />
        <HeaderField label="Kho" value="Kho tổng" />
        <HeaderField label="Người lập phiếu" value={creator.name} />
        <HeaderField label="Chức vụ/Vai trò" value={creator.role} />
        <HeaderField label="Tổng số lượng" value={formatStockQuantity(totalQuantity)} />
        <HeaderField label="Số dòng" value={`${lines.length} dòng thành phẩm`} />
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
              <th className="border-b border-slate-200 px-3 py-2">SKU</th>
              <th className="border-b border-slate-200 px-3 py-2">Thành phẩm</th>
              <th className="border-b border-slate-200 px-3 py-2 text-right">Số lượng</th>
              <th className="border-b border-slate-200 px-3 py-2">Lô thành phẩm</th>
              <th className="border-b border-slate-200 px-3 py-2">Kho trước/sau</th>
              <th className="border-b border-slate-200 px-3 py-2">Cửa hàng trước/sau</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {lines.map((line) => (
              <tr key={line.id}>
                <td className="px-3 py-2 font-mono text-[#356647]">{line.skuCode}</td>
                <td className="px-3 py-2 text-slate-800">{line.productSnapshotName || '-'}</td>
                <td className="px-3 py-2 text-right font-semibold">{formatStockQuantity(line.quantity)}</td>
                <td className="px-3 py-2 text-slate-700">
                  <span className="font-mono">{line.warehouseBatchLotCode || '-'}</span>
                </td>
                <td className="px-3 py-2 text-slate-700">
                  {formatStockQuantity(line.warehouseQtyBefore)} / {formatStockQuantity(line.warehouseQtyAfter)}
                </td>
                <td className="px-3 py-2 text-slate-700">
                  {formatStockQuantity(line.storeQtyBefore)} / {formatStockQuantity(line.storeQtyAfter)}
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
