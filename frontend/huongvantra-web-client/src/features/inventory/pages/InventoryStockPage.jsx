import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import PageHeader from '../../../components/shared/PageHeader.jsx'
import PageShell from '../../../components/shared/PageShell.jsx'
import { showError, showSuccess } from '../../../app/toast.js'
import { canCreateCatalog } from '../../auth/utils/permissions.js'
import { loadAuthSession } from '../../auth/services/authSession.js'
import { fetchAllActiveSkus } from '../../products/services/productSkusApi.js'
import { fetchProducts } from '../../products/services/productsApi.js'
import { formatStockQuantity } from '../../products/utils/productDisplay.js'
import InventorySimulationBanner from '../components/InventorySimulationBanner.jsx'
import {
  adjustWarehouseStock,
  fetchInventorySettings,
  fetchSkuStocks,
} from '../services/inventoryStockApi.js'

const navigationTabs = [
  { label: 'Kho tổng', to: '/inventory' },
  { label: 'Phiếu xuất kho', to: '/inventory/export' },
  { label: 'Yêu cầu tồn', to: '/inventory/stock-requests' },
]

function InventoryStockPage() {
  const canManageWarehouse = canCreateCatalog(loadAuthSession())
  const [simulateWarehouse, setSimulateWarehouse] = useState(true)
  const [searchInput, setSearchInput] = useState('')
  const [rows, setRows] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [actingSkuId, setActingSkuId] = useState(null)
  const [adjustSkuId, setAdjustSkuId] = useState('')
  const [adjustDelta, setAdjustDelta] = useState('')

  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [settings, stocks, skus, productsResult] = await Promise.all([
        fetchInventorySettings(),
        fetchSkuStocks(),
        fetchAllActiveSkus(),
        fetchProducts({ page: 1, pageSize: 100, isActive: true }),
      ])
      setSimulateWarehouse(settings.simulateWarehouse)
      const productNameById = new Map(productsResult.items.map((p) => [p.id, p.name]))
      const stockBySkuId = new Map(stocks.map((s) => [s.skuId, s]))

      const merged = skus.map((sku) => {
        const stock = stockBySkuId.get(sku.id)
        return {
          skuId: sku.id,
          skuCode: sku.skuCode,
          productName: productNameById.get(sku.productId) || '—',
          packagingType: sku.packagingType || '',
          warehouseQuantityOnHand: stock?.warehouseQuantityOnHand ?? 0,
        }
      })

      setRows(merged)
    } catch (error) {
      setRows([])
      showError(error.message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const filteredRows = useMemo(() => {
    const keyword = searchInput.trim().toLowerCase()
    if (!keyword) return rows
    return rows.filter((row) => {
      const haystack = `${row.skuCode} ${row.productName} ${row.packagingType}`.toLowerCase()
      return haystack.includes(keyword)
    })
  }, [rows, searchInput])

  async function handleAdjustWarehouse(event) {
    event.preventDefault()
    if (!canManageWarehouse) return
    const skuId = adjustSkuId
    const delta = Number(adjustDelta)
    if (!skuId || !Number.isFinite(delta) || delta === 0) {
      showError('Chọn SKU và nhập số lượng thay đổi (khác 0).')
      return
    }

    setActingSkuId(skuId)
    try {
      await adjustWarehouseStock(skuId, delta)
      showSuccess('Đã cập nhật tồn kho tổng.')
      setAdjustSkuId('')
      setAdjustDelta('')
      await loadData()
    } catch (error) {
      showError(error.message)
    } finally {
      setActingSkuId(null)
    }
  }

  return (
    <PageShell>
      <PageHeader
        title="Kho tổng"
        description="Thủ kho — chỉ theo dõi và nhập tồn tại kho trung tâm (không hiển thị tồn cửa hàng)"
        searchPlaceholder="Tìm SKU, sản phẩm..."
        searchValue={searchInput}
        onSearchChange={setSearchInput}
        rightContent={
          <div className="flex flex-wrap items-center gap-2">
            {navigationTabs.map((tab) => (
              <Link
                key={tab.to}
                to={tab.to}
                className={`rounded-xl px-4 py-2 text-sm font-semibold ${
                  tab.to === '/inventory'
                    ? 'bg-[#538463] text-white'
                    : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {tab.label}
              </Link>
            ))}
          </div>
        }
      />

      <InventorySimulationBanner simulateWarehouse={simulateWarehouse} warehouseView />

      {canManageWarehouse ? (
        <section className="mb-6 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-6">
          <h2 className="text-lg font-bold text-slate-800">Nhập / điều chỉnh tồn kho tổng</h2>
          <p className="mt-1 text-sm text-slate-500">
            Cộng hoặc trừ tồn tại kho trung tâm. Tồn cửa hàng do cửa hàng yêu cầu và Thủ kho duyệt riêng.
          </p>
          <form className="mt-4 grid gap-4 sm:grid-cols-3" onSubmit={handleAdjustWarehouse}>
            <label className="space-y-2 sm:col-span-1">
              <span className="text-xs font-semibold text-[#717971]">SKU</span>
              <select
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm"
                value={adjustSkuId}
                onChange={(event) => setAdjustSkuId(event.target.value)}
              >
                <option value="">Chọn SKU</option>
                {rows.map((row) => (
                  <option key={row.skuId} value={row.skuId}>
                    {row.skuCode} — {row.productName} (kho: {row.warehouseQuantityOnHand})
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2 sm:col-span-1">
              <span className="text-xs font-semibold text-[#717971]">Số lượng thay đổi</span>
              <input
                type="number"
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm"
                placeholder="VD: 200 hoặc -10"
                value={adjustDelta}
                onChange={(event) => setAdjustDelta(event.target.value)}
              />
            </label>
            <div className="flex items-end sm:col-span-1">
              <button
                type="submit"
                disabled={Boolean(actingSkuId)}
                className="rounded-xl bg-[#538463] px-5 py-3 text-sm font-bold text-white hover:bg-[#457053] disabled:opacity-50"
              >
                {actingSkuId ? 'Đang lưu...' : 'Cập nhật kho tổng'}
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-6 py-3">SKU</th>
                <th className="px-4 py-3">Sản phẩm</th>
                <th className="px-4 py-3">Tồn kho tổng</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td className="px-6 py-8 text-slate-500" colSpan={3}>
                    Đang tải...
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td className="px-6 py-8 text-slate-500" colSpan={3}>
                    Chưa có SKU — tạo sản phẩm và biến thể trước.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => (
                  <tr key={row.skuId}>
                    <td className="px-6 py-4 font-mono font-semibold text-[#356647]">{row.skuCode}</td>
                    <td className="px-4 py-4 text-slate-700">
                      {row.productName}
                      {row.packagingType ? (
                        <span className="mt-0.5 block text-xs text-slate-500">{row.packagingType}</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-4 font-semibold text-slate-800">
                      {formatStockQuantity(row.warehouseQuantityOnHand)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </PageShell>
  )
}

export default InventoryStockPage
