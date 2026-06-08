import { useCallback, useEffect, useState } from 'react'
import PageHeader from '../../../components/shared/PageHeader.jsx'
import { showError, showSuccess } from '../../../app/toast.js'
import { adjustSkuStock, fetchSkuStocks } from '../services/inventoryStockApi.js'

function formatStock(value) {
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(Number(value) || 0)
}

function stockAlertLabel(quantity) {
  const qty = Number(quantity) || 0
  if (qty <= 0) return { text: 'Hết hàng', className: 'text-red-600' }
  if (qty <= 5) return { text: 'Tồn thấp', className: 'text-amber-600' }
  return { text: 'Ổn định', className: 'text-gray-600' }
}

function InventoryStockPage() {
  const [rows, setRows] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [adjustingSkuId, setAdjustingSkuId] = useState(null)
  const [deltaBySku, setDeltaBySku] = useState({})

  const loadStocks = useCallback(async () => {
    setIsLoading(true)
    try {
      const items = await fetchSkuStocks()
      setRows(items)
    } catch (error) {
      showError(error.message)
      setRows([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadStocks()
  }, [loadStocks])

  const handleAdjust = async (skuId) => {
    const delta = Number(deltaBySku[skuId])
    if (!Number.isFinite(delta) || delta === 0) {
      showError('Nhập số lượng điều chỉnh (+ nhập, − xuất).')
      return
    }

    setAdjustingSkuId(skuId)
    try {
      const updated = await adjustSkuStock(skuId, delta)
      setRows((prev) => prev.map((row) => (row.skuId === skuId ? updated : row)))
      setDeltaBySku((prev) => ({ ...prev, [skuId]: '' }))
      showSuccess('Đã cập nhật tồn kho.')
    } catch (error) {
      showError(error.message)
    } finally {
      setAdjustingSkuId(null)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      <PageHeader
        title="Tồn kho SKU"
        description="Theo dõi và điều chỉnh tồn theo SKU (InventoryService MVP)"
        searchPlaceholder="Tìm mã SKU..."
      />

      <section className="overflow-hidden rounded-[24px] border border-gray-100 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-5">
          <h2 className="text-lg font-bold text-gray-800">Danh sách tồn</h2>
          <button
            type="button"
            onClick={() => void loadStocks()}
            className="rounded-lg border border-[#c1c9c0] px-3 py-1.5 text-sm font-semibold text-[#356647] hover:bg-[#f6f4ec]"
          >
            Tải lại
          </button>
        </div>

        <div className="overflow-auto px-4 py-4 sm:px-6">
          {isLoading ? (
            <p className="py-8 text-center text-sm text-gray-500">Đang tải tồn kho...</p>
          ) : rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-500">
              Chưa có dữ liệu tồn. Tạo SKU mới hoặc chạy script đồng bộ tồn.
            </p>
          ) : (
            <table className="w-full min-w-[640px] border-separate border-spacing-y-2 text-left text-sm">
              <thead>
                <tr className="bg-[#fefcf3] text-[11px] font-bold uppercase tracking-wider text-gray-400">
                  <th className="rounded-l-xl px-4 py-3">Mã SKU</th>
                  <th className="px-4 py-3">Khối lượng (g)</th>
                  <th className="px-4 py-3">Tồn</th>
                  <th className="px-4 py-3">Cảnh báo</th>
                  <th className="rounded-r-xl px-4 py-3">Điều chỉnh</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => {
                  const alert = stockAlertLabel(row.quantityOnHand)
                  return (
                    <tr
                      key={row.skuId}
                      className={`${index % 2 === 0 ? 'bg-[#fefcf3]/50' : ''} transition-colors hover:bg-gray-50`}
                    >
                      <td className="rounded-l-xl px-4 py-3 font-bold text-gray-800">{row.skuCode}</td>
                      <td className="px-4 py-3 text-gray-600">{formatStock(row.weightInGrams)}</td>
                      <td className="px-4 py-3 font-semibold text-gray-800">{formatStock(row.quantityOnHand)}</td>
                      <td className={`px-4 py-3 font-medium ${alert.className}`}>{alert.text}</td>
                      <td className="rounded-r-xl px-4 py-3">
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            inputMode="numeric"
                            placeholder="±"
                            value={deltaBySku[row.skuId] ?? ''}
                            onChange={(event) =>
                              setDeltaBySku((prev) => ({ ...prev, [row.skuId]: event.target.value }))
                            }
                            className="w-20 rounded-lg border border-[#c1c9c0] px-2 py-1.5 text-sm outline-none focus:border-[#356647]"
                          />
                          <button
                            type="button"
                            disabled={adjustingSkuId === row.skuId}
                            onClick={() => void handleAdjust(row.skuId)}
                            className="rounded-lg bg-[#356647] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60"
                          >
                            {adjustingSkuId === row.skuId ? '...' : 'Lưu'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  )
}

export default InventoryStockPage
