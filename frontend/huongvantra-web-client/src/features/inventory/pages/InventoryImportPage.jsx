import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import PageHeader from '../../../components/shared/PageHeader.jsx'
import PageShell from '../../../components/shared/PageShell.jsx'
import TablePagination, { TABLE_PAGE_SIZE } from '../../../components/shared/TablePagination.jsx'
import { showError } from '../../../app/toast.js'
import { formatStockQuantity } from '../../products/utils/productDisplay.js'
import { formatVietnamDateTime } from '../../../utils/vietnamDateTime.js'
import InventoryNavTabs from '../components/InventoryNavTabs.jsx'
import { fetchStockImportSlips, getImportTypeLabel } from '../services/stockImportSlipApi.js'
import {
  ImportSlipDocument,
  SlipActionButtons,
  SlipPrintStyles,
} from '../components/InventorySlipDocument.jsx'

function isProductionImport(slip) {
  return slip?.importType === 'production_finished_goods_receipt'
}

function getSlipLineKind(slip) {
  return isProductionImport(slip) ? 'thành phẩm' : 'nguyên liệu'
}

function getSlipContentLabel(slip) {
  const lineKind = getSlipLineKind(slip)
  if (slip.lines?.length > 1) return `${slip.lines.length} dòng ${lineKind}`
  if (slip.lines?.length === 1) return slip.lines[0].productSnapshotName || slip.lines[0].skuCode
  return slip.productSnapshotName || slip.skuCode
}

function getSlipQuantity(slip) {
  if (slip.lines?.length) return slip.lines.reduce((sum, line) => sum + line.quantity, 0)
  return slip.quantity
}

function getProductionCodeDisplay(slip) {
  if (slip?.importType === 'manual_material_import') return ''
  return slip?.productionCode || '-'
}

function InventoryImportPage() {
  const [searchInput, setSearchInput] = useState('')
  const [importSlips, setImportSlips] = useState([])
  const [isLoadingImportSlips, setIsLoadingImportSlips] = useState(true)
  const [selectedSlip, setSelectedSlip] = useState(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(TABLE_PAGE_SIZE)
  const importSlipDocumentRef = useRef(null)

  const loadImportSlips = useCallback(async () => {
    setIsLoadingImportSlips(true)
    try {
      const items = await fetchStockImportSlips({ search: searchInput.trim() || undefined })
      setImportSlips(items)
    } catch (error) {
      setImportSlips([])
      showError(error.message)
    } finally {
      setIsLoadingImportSlips(false)
    }
  }, [searchInput])

  useEffect(() => {
    const timer = setTimeout(loadImportSlips, 250)
    return () => clearTimeout(timer)
  }, [loadImportSlips])

  useEffect(() => {
    setPage(1)
  }, [searchInput])

  const pagedSlips = useMemo(() => {
    const start = (page - 1) * pageSize
    return importSlips.slice(start, start + pageSize)
  }, [importSlips, page, pageSize])

  return (
    <PageShell>
      <SlipPrintStyles />
      <PageHeader
        title="Phiếu nhập kho"
        description="Theo dõi phiếu nhập nguyên liệu thủ công và phiếu nhập thành phẩm sau sản xuất."
        searchPlaceholder="Tìm mã phiếu, SKU, mã lô..."
        searchValue={searchInput}
        onSearchChange={setSearchInput}
        rightContent={
          <div className="flex flex-wrap items-center gap-3">
            <InventoryNavTabs />
            <Link
              to="/inventory/import/create"
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#538463] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#457053]"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              Nhập nguyên liệu
            </Link>
          </div>
        }
      />

      <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-6 py-3 text-left">Mã phiếu</th>
                <th className="px-4 py-3 text-left">Loại nhập</th>
                <th className="px-4 py-3 text-left">Nội dung</th>
                <th className="px-4 py-3 text-right">Số lượng</th>
                <th className="px-4 py-3 text-left">Mã lệnh SX</th>
                <th className="px-4 py-3 text-left">Thời gian</th>
                <th className="px-4 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoadingImportSlips ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-slate-500">
                    Đang tải...
                  </td>
                </tr>
              ) : importSlips.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-slate-500">
                    Chưa có phiếu nhập kho.
                  </td>
                </tr>
              ) : (
                pagedSlips.map((slip) => (
                  <tr key={slip.id} className="hover:bg-slate-50/80">
                    <td className="px-6 py-4 text-left font-mono font-semibold text-[#356647]">{slip.importCode}</td>
                    <td className="px-4 py-4 text-left text-slate-700">{getImportTypeLabel(slip.importType)}</td>
                    <td className="px-4 py-4 text-left text-slate-700">{getSlipContentLabel(slip)}</td>
                    <td className="px-4 py-4 text-right font-semibold text-slate-800">
                      {formatStockQuantity(getSlipQuantity(slip))}
                    </td>
                    <td className="px-4 py-4 text-left font-mono text-slate-700">{getProductionCodeDisplay(slip)}</td>
                    <td className="px-4 py-4 text-left text-slate-600">
                      {slip.createdAt ? formatVietnamDateTime(slip.createdAt) : '-'}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedSlip(slip)}
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <span className="material-symbols-outlined text-[16px]">visibility</span>
                        Chi tiết
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {importSlips.length > pageSize && (
          <TablePagination
            page={page}
            pageSize={pageSize}
            totalCount={importSlips.length}
            onPageChange={setPage}
            onPageSizeChange={(size) => { setPageSize(size); setPage(1) }}
            disabled={isLoadingImportSlips}
            itemLabel="phiếu nhập"
          />
        )}
      </section>

      {selectedSlip ? (
        <div
          className="inventory-modal fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          onClick={() => setSelectedSlip(null)}
        >
          <div
            className="max-h-[calc(100dvh-2rem)] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="no-print mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold text-slate-800">Chi tiết phiếu nhập</h2>
              <button
                type="button"
                onClick={() => setSelectedSlip(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Đóng"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <SlipActionButtons
              documentRef={importSlipDocumentRef}
              filename={selectedSlip.importCode ? `${selectedSlip.importCode}.pdf` : 'phieu-kho.pdf'}
            />
            <div ref={importSlipDocumentRef}>
              <ImportSlipDocument slip={selectedSlip} getTypeLabel={getImportTypeLabel} />
            </div>
          </div>
        </div>
      ) : null}
    </PageShell>
  )
}

export default InventoryImportPage
