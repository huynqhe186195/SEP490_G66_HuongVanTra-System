import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import PageHeader from '../../../components/shared/PageHeader.jsx'
import PageShell from '../../../components/shared/PageShell.jsx'
import TablePagination, { TABLE_PAGE_SIZE } from '../../../components/shared/TablePagination.jsx'
import { showError, showSuccess } from '../../../app/toast.js'
import { canEditWarehouseThreshold, canWriteInventory } from '../../auth/utils/permissions.js'
import { loadAuthSession } from '../../auth/services/authSession.js'
import { fetchAllActiveSkus } from '../../products/services/productSkusApi.js'
import { fetchProducts } from '../../products/services/productsApi.js'
import { formatStockQuantity } from '../../products/utils/productDisplay.js'
import { fetchSkuStocks, updateWarehouseLowStockThreshold } from '../services/inventoryStockApi.js'
import { fetchWarehouseBatches } from '../services/warehouseBatchApi.js'

function InventoryStockPage() {
  const [searchInput, setSearchInput] = useState('')
  const [rows, setRows] = useState([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(TABLE_PAGE_SIZE)
  const [isLoading, setIsLoading] = useState(true)
  const [editingThreshold, setEditingThreshold] = useState(null) // { skuId, value }
  const [savingSkuId, setSavingSkuId] = useState(null)
  const inputRef = useRef(null)
  const session = loadAuthSession()
  const canWrite = canWriteInventory(session)
  const canEditThreshold = canEditWarehouseThreshold(session)

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
          quantityOnHand: stock?.quantityOnHand ?? 0,
          warehouseLowStockThreshold: stock?.warehouseLowStockThreshold ?? 0,
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
    const timer = window.setTimeout(() => loadData(), 0)
    return () => window.clearTimeout(timer)
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
    const timer = window.setTimeout(() => setPage(1), 0)
    return () => window.clearTimeout(timer)
  }, [searchInput])

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize))
    if (page <= totalPages) return undefined
    const timer = window.setTimeout(() => setPage(totalPages), 0)
    return () => window.clearTimeout(timer)
  }, [filteredRows.length, page, pageSize])

  const pagedRows = useMemo(() => {
    const start = (page - 1) * pageSize
    return filteredRows.slice(start, start + pageSize)
  }, [filteredRows, page, pageSize])

  useEffect(() => {
    if (editingThreshold && inputRef.current) inputRef.current.focus()
  }, [editingThreshold])

  function startEdit(skuId, currentValue) {
    setEditingThreshold({ skuId, value: String(currentValue) })
  }

  function cancelEdit() {
    setEditingThreshold(null)
  }

  async function commitEdit(skuId) {
    const raw = editingThreshold?.value ?? ''
    const parsed = parseInt(raw, 10)
    if (isNaN(parsed) || parsed < 0) {
      showError('Ngưỡng phải là số nguyên không âm')
      return
    }
    setSavingSkuId(skuId)
    setEditingThreshold(null)
    try {
      await updateWarehouseLowStockThreshold(skuId, parsed)
      setRows((prev) => prev.map((r) => (r.skuId === skuId ? { ...r, warehouseLowStockThreshold: parsed } : r)))
      showSuccess('Đã cập nhật ngưỡng cảnh báo Kho')
    } catch (err) {
      showError(err.message)
    } finally {
      setSavingSkuId(null)
    }
  }

  function handleKeyDown(e, skuId) {
    if (e.key === 'Enter') commitEdit(skuId)
    if (e.key === 'Escape') cancelEdit()
  }

  function renderThresholdCell(row) {
    const value = row.warehouseLowStockThreshold
    const isEditing = editingThreshold?.skuId === row.skuId
    const isSaving = savingSkuId === row.skuId

    if (canEditThreshold && isEditing) {
      return (
        <input
          ref={inputRef}
          type="number"
          min={0}
          className="w-20 rounded-lg border border-[#356647] px-2 py-1 text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-[#356647]/30"
          value={editingThreshold.value}
          onChange={(e) => setEditingThreshold((prev) => ({ ...prev, value: e.target.value }))}
          onKeyDown={(e) => handleKeyDown(e, row.skuId)}
          onBlur={() => commitEdit(row.skuId)}
        />
      )
    }

    if (!canEditThreshold) {
      return (
        <span className={value === 0 ? 'text-slate-400' : 'font-semibold text-slate-800'}>
          {value === 0 ? 'Chưa đặt' : value}
        </span>
      )
    }

    return (
      <button
        type="button"
        title="Click để sửa ngưỡng"
        disabled={isSaving}
        onClick={() => startEdit(row.skuId, value)}
        className="group flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
      >
        {isSaving ? (
          <span className="text-xs text-slate-400">Đang lưu...</span>
        ) : (
          <>
            <span className={value === 0 ? 'text-slate-400' : 'text-slate-800'}>
              {value === 0 ? 'Chưa đặt' : value}
            </span>
            <span className="material-symbols-outlined text-[14px] text-slate-400 opacity-0 group-hover:opacity-100">
              edit
            </span>
          </>
        )}
      </button>
    )
  }

  return (
    <PageShell>
      <PageHeader
        title="Kho"
        titleInfo="Tồn Kho = tổng các lô còn hàng. Nhà cung cấp nhập vào Kho trước, xuất theo FIFO khi có yêu cầu hợp lệ."
        searchPlaceholder="Tìm SKU, sản phẩm..."
        searchValue={searchInput}
        onSearchChange={setSearchInput}
      />

      <div className="mb-4 flex flex-wrap gap-3">
        {canWrite ? (
          <Link
            to="/inventory/import/create"
            className="inline-flex items-center gap-2 rounded-xl bg-[#538463] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#457053]"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            Nhập nguyên liệu
          </Link>
        ) : null}
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
                <th className="px-6 py-3">Sản Phẩm</th>
                <th className="px-4 py-3">Tồn Kho</th>
                <th className="px-4 py-3">Lô đang còn</th>
                <th className="px-4 py-3">Ngưỡng cảnh báo Kho</th>
                <th className="px-4 py-3">Tồn Kệ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td className="px-6 py-8 text-slate-500" colSpan={5}>
                    Đang tải...
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td className="px-6 py-8 text-slate-500" colSpan={5}>
                    Chưa có SKU — tạo sản phẩm và biến thể trước.
                  </td>
                </tr>
              ) : (
                pagedRows.map((row) => (
                  <tr key={row.skuId}>
                    <td className="px-6 py-4 text-slate-700">
                      <p className="font-semibold text-slate-900">{row.productName}</p>
                      <p className="font-mono text-xs text-slate-500">{row.skuCode}</p>
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
                    <td className="px-4 py-4">{renderThresholdCell(row)}</td>
                    <td className="px-4 py-4 font-semibold text-slate-800">
                      {formatStockQuantity(row.quantityOnHand)}
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
