import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import PageHeader from '../../../components/shared/PageHeader.jsx'
import PageShell from '../../../components/shared/PageShell.jsx'
import TablePagination, { TABLE_PAGE_SIZE } from '../../../components/shared/TablePagination.jsx'
import { showError } from '../../../app/toast.js'
import { fetchAllActiveSkus } from '../../products/services/productSkusApi.js'
import { fetchProducts } from '../../products/services/productsApi.js'
import { formatStockQuantity } from '../../products/utils/productDisplay.js'
import InventoryNavTabs from '../components/InventoryNavTabs.jsx'
import { fetchSkuStocks } from '../services/inventoryStockApi.js'
import { fetchWarehouseBatches } from '../services/warehouseBatchApi.js'

function InventoryStockPage() {
  const [searchInput, setSearchInput] = useState('')
  const [rows, setRows] = useState([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(TABLE_PAGE_SIZE)
  const [isLoading, setIsLoading] = useState(true)

  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [stocks, skus, productsResult, batches] = await Promise.all([
        fetchSkuStocks(),
        fetchAllActiveSkus(),
        fetchProducts({ page: 1, pageSize: 100, isActive: true }),
        fetchWarehouseBatches({ availableOnly: true }),
      ])
      const productNameById = new Map(productsResult.items.map((p) => [p.id, p.name]))
      const stockBySkuId = new Map(stocks.map((s) => [s.skuId, s]))
      const batchCountBySku = batches.reduce((map, batch) => {
        for (const item of batch.items || []) {
          if (item.quantityOnHand > 0) {
            map.set(item.skuId, (map.get(item.skuId) || 0) + 1)
          }
        }
        return map
      }, new Map())

      const merged = skus.map((sku) => {
        const stock = stockBySkuId.get(sku.id)
        return {
          skuId: sku.id,
          skuCode: sku.skuCode,
          productName: productNameById.get(sku.productId) || '—',
          packagingType: sku.packagingType || '',
          warehouseQuantityOnHand: stock?.warehouseQuantityOnHand ?? 0,
          activeLotCount: batchCountBySku.get(sku.id) || 0,
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

  useEffect(() => {
    setPage(1)
  }, [searchInput])

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize))
    if (page > totalPages) setPage(totalPages)
  }, [filteredRows.length, page, pageSize])

  const pagedRows = useMemo(() => {
    const start = (page - 1) * pageSize
    return filteredRows.slice(start, start + pageSize)
  }, [filteredRows, page, pageSize])

  return (
    <PageShell>
      <PageHeader
        title="Kho tổng"
        description="Tồn kho tổng = tổng các lô còn hàng — nhập lô tại Nhập lô, xuất theo FIFO khi duyệt yêu cầu"
        searchPlaceholder="Tìm SKU, sản phẩm..."
        searchValue={searchInput}
        onSearchChange={setSearchInput}
        rightContent={<InventoryNavTabs />}
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <Link
          to="/inventory/import"
          className="inline-flex items-center gap-2 rounded-xl bg-[#538463] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#457053]"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          Nhập lô mới
        </Link>
        <Link
          to="/inventory/batches"
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Xem chi tiết từng lô
        </Link>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-6 py-3">SKU</th>
                <th className="px-4 py-3">Sản phẩm</th>
                <th className="px-4 py-3">Tồn kho tổng</th>
                <th className="px-4 py-3">Lô đang còn</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td className="px-6 py-8 text-slate-500" colSpan={4}>
                    Đang tải...
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td className="px-6 py-8 text-slate-500" colSpan={4}>
                    Chưa có SKU — tạo sản phẩm và biến thể trước.
                  </td>
                </tr>
              ) : (
                pagedRows.map((row) => (
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
                    <td className="px-4 py-4 text-slate-600">
                      {row.activeLotCount > 0 ? (
                        <Link to="/inventory/batches" className="font-semibold text-[#356647] hover:underline">
                          {row.activeLotCount} lô
                        </Link>
                      ) : (
                        <span className="text-amber-700">Chưa có lô</span>
                      )}
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
          totalCount={filteredRows.length}
          itemLabel="SKU"
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      </section>
    </PageShell>
  )
}

export default InventoryStockPage
