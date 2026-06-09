import { useCallback, useEffect, useMemo, useState } from 'react'
import { AUTH_SESSION_CHANGED_EVENT, loadAuthSession } from '../../auth/services/authSession.js'
import { Link } from 'react-router-dom'
import PageHeader from '../../../components/shared/PageHeader.jsx'
import PageShell from '../../../components/shared/PageShell.jsx'
import TablePagination from '../../../components/shared/TablePagination.jsx'
import { showError, showSuccess } from '../../../app/toast.js'
import {
  canAdjustStoreStock,
  canCreateCatalog,
  canHideCatalog,
  canSyncCatalog,
  isWarehouseRole,
} from '../../auth/utils/permissions.js'
import { fetchCategories } from '../services/categoriesApi.js'
import {
  buildStockBySkuIdMap,
  buildWarehouseStockBySkuIdMap,
  fetchSkuStocks,
} from '../../inventory/services/inventoryStockApi.js'
import { deleteProduct, fetchProducts, restoreProduct } from '../services/productsApi.js'
import ProductImage from '../components/ProductImage.jsx'
import ProductSkusDetailModal from '../components/ProductSkusDetailModal.jsx'
import InventorySimulationBanner from '../../inventory/components/InventorySimulationBanner.jsx'
import { fetchInventorySettings } from '../../inventory/services/inventoryStockApi.js'
import { getProductStatusMeta, summarizeProductSkus, summarizeProductStock } from '../utils/productDisplay.js'

const TABLE_HEAD = 'px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-[#717971] sm:px-6'
const TABLE_CELL = 'px-4 py-4 text-sm text-[#414942] sm:px-6'

function ProductsListPage() {
  const [session, setSession] = useState(() => loadAuthSession())
  const canCreate = canCreateCatalog(session)
  const canHide = canHideCatalog(session)
  const canSync = canSyncCatalog(session)
  const canAdjustStock = canAdjustStoreStock(session)
  const isWarehouse = isWarehouseRole(session)
  const [isSyncing, setIsSyncing] = useState(false)

  useEffect(() => {
    const sync = () => setSession(loadAuthSession())
    window.addEventListener(AUTH_SESSION_CHANGED_EVENT, sync)
    return () => window.removeEventListener(AUTH_SESSION_CHANGED_EVENT, sync)
  }, [])

  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)
  const [totalCount, setTotalCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [stockBySkuId, setStockBySkuId] = useState(() => new Map())
  const [togglingId, setTogglingId] = useState(null)
  const [skuModalProduct, setSkuModalProduct] = useState(null)
  const [simulateWarehouse, setSimulateWarehouse] = useState(true)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim())
      setPage(1)
    }, 300)
    return () => window.clearTimeout(timer)
  }, [searchInput])

  const loadCategories = useCallback(async () => {
    try {
      const items = await fetchCategories()
      setCategories(items)
    } catch (error) {
      showError(error.message)
    }
  }, [])

  const loadStocks = useCallback(async () => {
    try {
      const stocks = await fetchSkuStocks()
      setStockBySkuId(
        isWarehouse ? buildWarehouseStockBySkuIdMap(stocks) : buildStockBySkuIdMap(stocks),
      )
    } catch {
      setStockBySkuId(new Map())
    }
  }, [isWarehouse])

  const loadProducts = useCallback(async () => {
    try {
      setIsLoading(true)
      const [result] = await Promise.all([
        fetchProducts({
          search: search || undefined,
          categoryId: categoryId ? Number(categoryId) : undefined,
          isActive: statusFilter === 'active' ? true : undefined,
          isDeleted: statusFilter === 'hidden' ? true : undefined,
          page,
          pageSize,
        }),
        loadStocks(),
      ])
      setProducts(result.items)
      setTotalCount(result.totalCount)
    } catch (error) {
      setProducts([])
      setTotalCount(0)
      showError(error.message)
    } finally {
      setIsLoading(false)
    }
  }, [search, categoryId, statusFilter, page, pageSize, loadStocks])

  useEffect(() => {
    loadCategories()
    fetchInventorySettings().then((s) => setSimulateWarehouse(s.simulateWarehouse)).catch(() => {})
  }, [loadCategories])

  useEffect(() => {
    loadProducts()
  }, [loadProducts])

  async function handleHide(product) {
    if (!canHide || product.isDeleted) return
    if (!window.confirm(`Ẩn sản phẩm "${product.name}"? Sản phẩm sẽ không hiển thị ở POS và có thể kích hoạt lại sau.`)) return
    try {
      setTogglingId(product.id)
      await deleteProduct(product.id)
      showSuccess('Đã ẩn sản phẩm.')
      await loadProducts()
    } catch (error) {
      showError(error.message)
    } finally {
      setTogglingId(null)
    }
  }

  async function handleSyncCatalog() {
    setIsSyncing(true)
    try {
      await Promise.all([loadCategories(), loadProducts()])
      showSuccess('Đã đồng bộ danh sách sản phẩm và danh mục mới nhất.')
    } catch (error) {
      showError(error.message)
    } finally {
      setIsSyncing(false)
    }
  }

  async function handleRestore(product) {
    if (!canHide || !product.isDeleted) return
    if (!window.confirm(`Kích hoạt lại sản phẩm "${product.name}"?`)) return
    try {
      setTogglingId(product.id)
      await restoreProduct(product.id)
      showSuccess('Đã kích hoạt lại sản phẩm.')
      await loadProducts()
    } catch (error) {
      showError(error.message)
    } finally {
      setTogglingId(null)
    }
  }

  const categoryOptions = useMemo(
    () => [
      { value: '', label: 'Tất cả danh mục' },
      ...categories.map((item) => ({
        value: String(item.id),
        label: item.isActive === false || item.isDeleted ? `${item.name} (đã ẩn)` : item.name,
      })),
    ],
    [categories],
  )

  return (
    <PageShell>
      <PageHeader
        title="Sản phẩm & số lượng"
        description={
          canCreate
            ? 'Thủ kho — tạo sản phẩm, danh mục và duyệt yêu cầu điều chỉnh tồn'
            : canSync
              ? 'Xem sản phẩm — dùng Đồng bộ để tải dữ liệu mới từ kho'
              : 'Xem sản phẩm và gửi yêu cầu điều chỉnh số lượng (Thủ kho duyệt)'
        }
        searchPlaceholder="Tìm theo tên, xuất xứ, mô tả..."
        searchValue={searchInput}
        onSearchChange={setSearchInput}
        rightContent={
          <>
            {canCreate ? (
              <Link
                to="/products/create"
                className="inline-flex items-center gap-2 rounded-xl bg-[#538463] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#457053]"
              >
                <span className="material-symbols-outlined text-[18px]">add</span>
                Tạo sản phẩm
              </Link>
            ) : null}
            {canSync ? (
              <button
                type="button"
                disabled={isSyncing}
                onClick={handleSyncCatalog}
                className="inline-flex items-center gap-2 rounded-xl border border-[#356647]/30 bg-white px-4 py-2.5 text-sm font-semibold text-[#356647] hover:bg-[#356647]/5 disabled:opacity-50"
              >
                <span className={`material-symbols-outlined text-[18px] ${isSyncing ? 'animate-spin' : ''}`}>sync</span>
                Đồng bộ dữ liệu
              </button>
            ) : null}
            {canAdjustStock ? (
              <Link
                to="/inventory/stock-requests"
                className="inline-flex items-center gap-2 rounded-xl border border-[#356647]/30 bg-white px-4 py-2.5 text-sm font-semibold text-[#356647] hover:bg-[#356647]/5"
              >
                <span className="material-symbols-outlined text-[18px]">edit_note</span>
                Yêu cầu tồn
              </Link>
            ) : null}
            <Link
              to="/products/pricing"
              className="inline-flex items-center gap-2 rounded-xl border border-[#356647]/30 bg-white px-4 py-2.5 text-sm font-semibold text-[#356647] hover:bg-[#356647]/5"
            >
              <span className="material-symbols-outlined text-[18px]">category</span>
              Danh mục
            </Link>
          </>
        }
      />

      <InventorySimulationBanner simulateWarehouse={simulateWarehouse} warehouseView={isWarehouse} />

      <div className="flex flex-col gap-3 rounded-2xl border border-slate-100 bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:gap-4 sm:p-4">
        <select
          className="min-h-[44px] w-full flex-[1.5] rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-[#356647] focus:ring-2 focus:ring-[#356647]/20 sm:min-w-[260px] sm:text-base"
          value={categoryId}
          onChange={(event) => {
            setCategoryId(event.target.value)
            setPage(1)
          }}
        >
          {categoryOptions.map((option) => (
            <option key={option.value || 'all'} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <select
          className="min-h-[44px] w-full flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-[#356647] focus:ring-2 focus:ring-[#356647]/20 sm:min-w-[220px] sm:text-base"
          value={statusFilter}
          onChange={(event) => {
            setStatusFilter(event.target.value)
            setPage(1)
          }}
        >
          <option value="all">Tất cả trạng thái</option>
          <option value="active">Đang bán</option>
          <option value="hidden">Đã ẩn</option>
        </select>

        {canSync ? (
          <button
            type="button"
            disabled={isSyncing}
            className="min-h-[44px] shrink-0 rounded-xl border border-[#356647]/30 px-5 py-3 text-sm font-semibold text-[#356647] hover:bg-[#356647]/5 disabled:opacity-50 sm:text-base"
            onClick={handleSyncCatalog}
          >
            {isSyncing ? 'Đang đồng bộ...' : 'Đồng bộ'}
          </button>
        ) : (
          <button
            type="button"
            className="min-h-[44px] shrink-0 rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 sm:text-base"
            onClick={() => loadProducts()}
          >
            Làm mới
          </button>
        )}
      </div>

      <div className="overflow-hidden rounded-[1rem] bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-left text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className={TABLE_HEAD}>Ảnh</th>
                <th className={TABLE_HEAD}>Sản phẩm</th>
                <th className={TABLE_HEAD}>Danh mục</th>
                <th className={TABLE_HEAD}>Xuất xứ</th>
                <th className={TABLE_HEAD}>Hương vị</th>
                <th className={TABLE_HEAD}>Biến thể</th>
                <th className={TABLE_HEAD}>Giá</th>
                <th className={TABLE_HEAD}>{isWarehouse ? 'Tồn kho tổng' : 'Tồn cửa hàng'}</th>
                <th className={TABLE_HEAD}>Trạng thái</th>
                <th className={TABLE_HEAD}>Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {isLoading ? (
                <tr>
                  <td className="px-6 py-8 text-center text-slate-500" colSpan={10}>
                    Đang tải...
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td className="px-6 py-8 text-center text-slate-500" colSpan={10}>
                    Không có sản phẩm phù hợp.
                  </td>
                </tr>
              ) : (
                products.map((product) => {
                  const status = getProductStatusMeta(product.isActive, product.isDeleted)
                  const skuSummary = summarizeProductSkus(product.skus)
                  const stockSummary = summarizeProductStock(
                    product.skus,
                    stockBySkuId,
                    isWarehouse ? 'tồn kho tổng' : 'tồn cửa hàng',
                  )
                  return (
                    <tr
                      key={product.id}
                      className={product.isDeleted ? 'bg-slate-50/80 opacity-75' : undefined}
                    >
                      <td className={TABLE_CELL}>
                        {skuSummary.imageUrl ? (
                          <a href={skuSummary.imageUrl} target="_blank" rel="noopener noreferrer" title={`Ảnh ${product.name}`}>
                            <ProductImage src={skuSummary.imageUrl} alt={product.name} className="h-12 w-12 rounded-lg" />
                          </a>
                        ) : (
                          <ProductImage src="" alt={product.name} className="h-12 w-12 rounded-lg" iconClassName="text-[22px]" />
                        )}
                      </td>
                      <td className={TABLE_CELL}>
                        <p className="font-semibold text-slate-900">{product.name}</p>
                        {product.description ? (
                          <p className="mt-1 line-clamp-2 text-xs text-slate-500">{product.description}</p>
                        ) : null}
                      </td>
                      <td className={TABLE_CELL}>{product.categoryName || '—'}</td>
                      <td className={TABLE_CELL}>{product.origin || '—'}</td>
                      <td className={TABLE_CELL}>{product.flavorProfile || '—'}</td>
                      <td className={TABLE_CELL}>
                        {skuSummary.count ? (
                          <button
                            type="button"
                            className="group text-left"
                            onClick={() => setSkuModalProduct(product)}
                            title="Xem chi tiết SKU"
                          >
                            <p className="text-sm text-slate-700 group-hover:text-[#356647]">{skuSummary.variantsLabel}</p>
                            <p className="mt-0.5 font-mono text-[11px] text-slate-500 group-hover:text-[#356647]">
                              {skuSummary.count} SKU · {skuSummary.codes}
                            </p>
                            <span className="mt-1 inline-flex items-center gap-0.5 text-[11px] font-semibold text-[#356647] opacity-0 transition-opacity group-hover:opacity-100">
                              <span className="material-symbols-outlined text-[14px]">visibility</span>
                              Xem chi tiết
                            </span>
                          </button>
                        ) : (
                          'Chưa có biến thể'
                        )}
                      </td>
                      <td className={`${TABLE_CELL} font-semibold text-[#356647]`}>{skuSummary.priceLabel}</td>
                      <td className={TABLE_CELL} title={stockSummary.title || undefined}>
                        <span
                          className={`font-semibold ${
                            stockSummary.isOut
                              ? 'text-[#b42318]'
                              : stockSummary.isLow
                                ? 'text-[#7e5700]'
                                : 'text-[#356647]'
                          }`}
                        >
                          {stockSummary.label}
                        </span>
                        {stockSummary.total <= 0 ? (
                          <p className="mt-0.5 text-[11px] text-amber-700">
                            {isWarehouse
                              ? 'Chưa có tồn kho — nhập tại Kho tổng'
                              : 'Chưa có tồn — gửi yêu cầu điều chỉnh'}
                          </p>
                        ) : skuSummary.count > 1 ? (
                          <p className="mt-0.5 text-[11px] text-[#717971]">theo SKU</p>
                        ) : null}
                      </td>
                      <td className={TABLE_CELL}>
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${status.className}`}>{status.label}</span>
                      </td>
                      <td className={TABLE_CELL}>
                        <div className="flex items-center gap-2">
                          {skuSummary.count ? (
                            <button
                              type="button"
                              className="rounded-full p-2 text-[#717971] hover:bg-[#e4e3db] hover:text-[#356647]"
                              title="Xem chi tiết SKU"
                              onClick={() => setSkuModalProduct(product)}
                            >
                              <span className="material-symbols-outlined text-[20px]">inventory_2</span>
                            </button>
                          ) : null}
                          {product.isDeleted ? null : canCreate && skuSummary.count ? (
                            <Link
                              to={`/products/${product.id}/edit`}
                              className="rounded-full p-2 text-[#717971] hover:bg-[#e4e3db] hover:text-[#356647]"
                              title="Sửa sản phẩm / SKU"
                            >
                              <span className="material-symbols-outlined text-[20px]">edit</span>
                            </Link>
                          ) : null}
                          {canHide && product.isDeleted ? (
                            <button
                              type="button"
                              disabled={togglingId === product.id}
                              title="Kích hoạt lại"
                              className="rounded-full p-2 text-[#356647] hover:bg-[#356647]/10 disabled:opacity-50"
                              onClick={() => handleRestore(product)}
                            >
                              <span className="material-symbols-outlined text-[20px]">restore_from_trash</span>
                            </button>
                          ) : null}
                          {canHide && !product.isDeleted ? (
                            <button
                              type="button"
                              disabled={togglingId === product.id}
                              title="Ẩn sản phẩm"
                              className="rounded-full p-2 text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                              onClick={() => handleHide(product)}
                            >
                              <span className="material-symbols-outlined text-[20px]">visibility_off</span>
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        <TablePagination page={page} pageSize={pageSize} totalCount={totalCount} onPageChange={setPage} itemLabel="sản phẩm" />
      </div>

      {skuModalProduct ? (
        <ProductSkusDetailModal
          product={skuModalProduct}
          stockBySkuId={stockBySkuId}
          canManage={canCreate}
          canAdjustStock={isWarehouse ? false : canAdjustStock}
          warehouseStockView={isWarehouse}
          onClose={() => setSkuModalProduct(null)}
          onStockAdjusted={loadStocks}
        />
      ) : null}
    </PageShell>
  )
}

export default ProductsListPage
