import { useCallback, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import PageHeader from '../../../components/shared/PageHeader.jsx'
import PageShell from '../../../components/shared/PageShell.jsx'
import { showError } from '../../../app/toast.js'
import { formatStockQuantity } from '../../products/utils/productDisplay.js'
import { formatVietnamDateTime } from '../../../utils/vietnamDateTime.js'
import { fetchStockExportSlips, getExportTypeLabel } from '../services/stockExportSlipApi.js'
import InventoryNavTabs from '../components/InventoryNavTabs.jsx'
import {
  ExportSlipDocument,
  SlipActionButtons,
  SlipPrintStyles,
} from '../components/InventorySlipDocument.jsx'

function getSlipMaterialLabel(slip) {
  if (slip.lines?.length > 1) return `${slip.lines.length} dòng nguyên liệu`
  if (slip.lines?.length === 1) return slip.lines[0].productSnapshotName || slip.lines[0].skuCode
  return slip.skuSnapshotName
}

function getSlipQuantity(slip) {
  if (slip.lines?.length) return slip.lines.reduce((sum, line) => sum + line.quantity, 0)
  return slip.quantity
}

function InventoryExportPage() {
  const location = useLocation()
  const [searchInput, setSearchInput] = useState(location.state?.search ?? '')
  const [slips, setSlips] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const items = await fetchStockExportSlips({ search: searchInput.trim() || undefined })
      setSlips(items)
      setSelectedId((prev) => {
        if (prev && items.some((item) => item.id === prev)) return prev
        return items[0]?.id ?? null
      })
    } catch (error) {
      setSlips([])
      showError(error.message)
    } finally {
      setIsLoading(false)
    }
  }, [searchInput])

  useEffect(() => {
    const timer = setTimeout(loadData, 250)
    return () => clearTimeout(timer)
  }, [loadData])

  const selected = slips.find((item) => item.id === selectedId) ?? null

  return (
    <PageShell>
      <SlipPrintStyles />
      <PageHeader
        title="Phiếu xuất kho"
        description="Chứng từ xuất nguyên liệu, gồm phiếu xuất sản xuất và các phiếu xuất kho khác."
        searchPlaceholder="Tìm mã phiếu, SKU..."
        searchValue={searchInput}
        onSearchChange={setSearchInput}
        rightContent={<InventoryNavTabs />}
      />

      <div className="grid flex-1 grid-cols-1 gap-6 lg:grid-cols-12">
        <section className="no-print rounded-2xl border border-slate-100 bg-white shadow-sm lg:col-span-5">
          <div className="border-b border-slate-50 px-6 py-4">
            <h2 className="text-lg font-bold text-slate-800">Danh sách phiếu</h2>
          </div>
          <div className="max-h-[560px] overflow-y-auto">
            {isLoading ? (
              <p className="px-6 py-8 text-sm text-slate-500">Đang tải...</p>
            ) : slips.length === 0 ? (
              <p className="px-6 py-8 text-sm text-slate-500">Chưa có phiếu xuất kho.</p>
            ) : (
              slips.map((slip) => (
                <button
                  key={slip.id}
                  type="button"
                  onClick={() => setSelectedId(slip.id)}
                  className={`block w-full border-b border-slate-50 px-6 py-4 text-left transition-colors hover:bg-[#fbf9f1]/40 ${
                    selectedId === slip.id ? 'bg-[#fbf9f1]/60' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-[#356647]">{slip.exportCode}</p>
                      <p className="mt-1 text-sm text-slate-700">{getSlipMaterialLabel(slip)}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        SL: {formatStockQuantity(getSlipQuantity(slip))} · {formatVietnamDateTime(slip.createdAt)}
                      </p>
                    </div>
                    <span className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600">
                      Chi tiết
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm sm:p-8 lg:col-span-7">
          <h2 className="no-print mb-6 text-lg font-bold text-slate-800">Chi tiết phiếu xuất</h2>
          {!selected ? (
            <p className="text-sm text-slate-500">Chọn một phiếu để xem chi tiết.</p>
          ) : (
            <>
              <SlipActionButtons />
              <ExportSlipDocument slip={selected} getTypeLabel={getExportTypeLabel} />
            </>
          )}
        </section>
      </div>
    </PageShell>
  )
}

export default InventoryExportPage
