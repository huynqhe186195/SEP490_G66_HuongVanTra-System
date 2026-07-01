import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import PageHeader from '../../../components/shared/PageHeader.jsx'
import PageShell from '../../../components/shared/PageShell.jsx'
import { showError } from '../../../app/toast.js'
import { formatStockQuantity } from '../../products/utils/productDisplay.js'
import { formatVietnamDateTime } from '../../../utils/vietnamDateTime.js'
import { fetchStockExportSlips, getExportTypeLabel } from '../services/stockExportSlipApi.js'
import InventoryNavTabs from '../components/InventoryNavTabs.jsx'

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
      <PageHeader
        title="Phiếu xuất kho"
        description="Phiếu xuất tự động khi Thủ kho duyệt yêu cầu xuất kho tổng sang cửa hàng"
        searchPlaceholder="Tìm mã phiếu, SKU..."
        searchValue={searchInput}
        onSearchChange={setSearchInput}
        rightContent={<InventoryNavTabs />}
      />

      <div className="grid flex-1 grid-cols-1 gap-6 lg:grid-cols-12">
        <section className="rounded-2xl border border-slate-100 bg-white shadow-sm lg:col-span-5">
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
                  <p className="font-bold text-[#356647]">{slip.exportCode}</p>
                  <p className="mt-1 text-sm text-slate-700">{slip.skuSnapshotName}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    SL: {formatStockQuantity(slip.quantity)} · {formatVietnamDateTime(slip.createdAt)}
                  </p>
                </button>
              ))
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm sm:p-8 lg:col-span-7">
          <h2 className="mb-6 text-lg font-bold text-slate-800">Chi tiết phiếu xuất</h2>
          {!selected ? (
            <p className="text-sm text-slate-500">Chọn một phiếu để xem chi tiết.</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <DetailField label="Mã phiếu" value={selected.exportCode} />
              <DetailField label="Loại xuất" value={getExportTypeLabel(selected.exportType)} />
              {selected.productionCode ? (
                <DetailField label="Lệnh SX" value={selected.productionCode} />
              ) : null}
              <DetailField label="SKU" value={selected.skuCode} />
              <DetailField label="Sản phẩm" value={selected.skuSnapshotName} />
              <DetailField label="Số lượng xuất" value={formatStockQuantity(selected.quantity)} />
              <DetailField label="Thời gian" value={formatVietnamDateTime(selected.createdAt)} />
              <DetailField label="Kho trước → sau" value={`${formatStockQuantity(selected.warehouseQtyBefore)} → ${formatStockQuantity(selected.warehouseQtyAfter)}`} />
              <DetailField label="Cửa hàng trước → sau" value={`${formatStockQuantity(selected.storeQtyBefore)} → ${formatStockQuantity(selected.storeQtyAfter)}`} />
              {selected.batchAllocations?.length ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50/30 p-4 sm:col-span-2">
                  <label className="mb-2 block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Lô đã trừ (FIFO)
                  </label>
                  <ul className="space-y-1 text-sm text-slate-700">
                    {selected.batchAllocations.map((line) => (
                      <li key={line.id}>
                        <span className="font-mono font-semibold text-[#356647]">{line.lotCode}</span>
                        {line.skuCode ? (
                          <span className="text-slate-500"> ({line.skuCode})</span>
                        ) : null}
                        {' — '}
                        {formatStockQuantity(line.quantity)}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {selected.note ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50/30 p-4 sm:col-span-2">
                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-400">Ghi chú</label>
                  <div className="text-sm text-slate-700">{selected.note}</div>
                </div>
              ) : null}
            </div>
          )}
        </section>
      </div>
    </PageShell>
  )
}

function DetailField({ label, value }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/30 p-4">
      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</label>
      <div className="text-sm font-medium text-slate-700">{value}</div>
    </div>
  )
}

export default InventoryExportPage
