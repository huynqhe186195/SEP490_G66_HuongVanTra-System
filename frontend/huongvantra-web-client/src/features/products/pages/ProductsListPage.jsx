import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import PageHeader from '../../../components/shared/PageHeader.jsx'
import PageShell from '../../../components/shared/PageShell.jsx'
import TablePagination from '../../../components/shared/TablePagination.jsx'
import { showError, showSuccess } from '../../../app/toast.js'
import { loadAuthSession } from '../../auth/services/authSession.js'
import { canAdjustStoreStock, canManageProducts } from '../../auth/utils/permissions.js'
import { fetchCategories } from '../services/categoriesApi.js'
import { buildStockBySkuIdMap, fetchSkuStocks } from '../../inventory/services/inventoryStockApi.js'
import { fetchProducts, setProductStatus } from '../services/productsApi.js'
import ProductImage from '../components/ProductImage.jsx'
import ProductSkusDetailModal from '../components/ProductSkusDetailModal.jsx'
import { getProductStatusMeta, summarizeProductSkus, summarizeProductStock } from '../utils/productDisplay.js'

const TABLE_HEAD = 'px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-[#717971] sm:px-6'
const TABLE_CELL = 'px-4 py-4 text-sm text-[#414942] sm:px-6'

function ProductsListPage() {
  const session = loadAuthSession()
  const canManage = canManageProducts(session)
  const canAdjustStock = canAdjustStoreStock(session)

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
      setStockBySkuId(buildStockBySkuIdMap(stocks))
    } catch {
      setStockBySkuId(new Map())
    }
  }, [])

  const loadProducts = useCallback(async () => {
    try {
      setIsLoading(true)
      const [result] = await Promise.all([
        fetchProducts({
          search: search || undefined,
          categoryId: categoryId ? Number(categoryId) : undefined,
          isActive: statusFilter === 'all' ? undefined : statusFilter === 'active',
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
  }, [loadCategories])

  useEffect(() => {
    loadProducts()
  }, [loadProducts])

  async function handleToggleStatus(product) {
    if (!canManage) return
    const nextActive = !product.isActive
    if (!window.confirm(`${nextActive ? 'Kích hoạt' : 'Ngừng kinh doanh'} sản phẩm "${product.name}"?`)) return
    try {
      setTogglingId(product.id)
      await setProductStatus(product, nextActive)
      showSuccess(nextActive ? 'Đã kích hoạt lại sản phẩm.' : 'Đã chuyển sản phẩm sang ngừng kinh doanh.')
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
        label: item.isActive === false ? `${item.name} (ngừng)` : item.name,
      })),
    ],
    [categories],
  )

  return (
    <PageShell>
      <PageHeader
        title="Sản phẩm & số lượng"
        description={
          canManage
            ? 'Xem sản phẩm, cập nhật số lượng tại cửa hàng và quản lý trạng thái kinh doanh'
            : 'Xem sản phẩm và cập nhật số lượng hiện tại tại cửa hàng'
        }
        searchPlaceholder="Tìm theo tên, xuất xứ, mô tả..."
        searchValue={searchInput}
        onSearchChange={setSearchInput}
        rightContent={
          <>
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
          <option value="inactive">Ngừng kinh doanh</option>
        </select>

        <button
          type="button"
          className="min-h-[44px] shrink-0 rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 sm:text-base"
          onClick={() => loadProducts()}
        >
          Làm mới
        </button>
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
                <th className={TABLE_HEAD}>Số lượng hiện tại</th>
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
                  const status = getProductStatusMeta(product.isActive)
                  const skuSummary = summarizeProductSkus(product.skus)
                  const stockSummary = summarizeProductStock(product.skus, stockBySkuId)
                  return (
                    <tr key={product.id}>
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
                        {skuSummary.count > 1 ? (
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
                          {(canManage || canAdjustStock) && skuSummary.count ? (
                            <Link
                              to={`/products/${product.id}/edit`}
                              className="rounded-full p-2 text-[#717971] hover:bg-[#e4e3db] hover:text-[#356647]"
                              title={canManage ? 'Sửa sản phẩm / số lượng' : 'Cập nhật số lượng'}
                            >
                              <span className="material-symbols-outlined text-[20px]">
                                {canManage ? 'edit' : 'edit_square'}
                              </span>
                            </Link>
                          ) : null}
                          {canManage ? (
                            <button
                              type="button"
                              disabled={togglingId === product.id}
                              title={product.isActive ? 'Ngừng kinh doanh' : 'Kích hoạt lại'}
                              className={`rounded-full p-2 disabled:opacity-50 ${
                                product.isActive
                                  ? 'text-[#717971] hover:bg-[#fff8e8] hover:text-[#7e5700]'
                                  : 'text-[#356647] hover:bg-[#356647]/10'
                              }`}
                              onClick={() => handleToggleStatus(product)}
                            >
                              <span className="material-symbols-outlined text-[20px]">
                                {product.isActive ? 'pause_circle' : 'play_circle'}
                              </span>
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
          canManage={canManage}
          canAdjustStock={canAdjustStock}
          onClose={() => setSkuModalProduct(null)}
          onStockAdjusted={loadStocks}
        />
      ) : null}
    </PageShell>
  )
}

export default ProductsListPage
