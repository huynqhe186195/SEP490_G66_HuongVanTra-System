import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import PageHeader from '../../../components/shared/PageHeader.jsx'
import PageShell from '../../../components/shared/PageShell.jsx'
import TablePagination from '../../../components/shared/TablePagination.jsx'
import { showError, showSuccess } from '../../../app/toast.js'
import { loadAuthSession } from '../../auth/services/authSession.js'
import { canManageProducts } from '../../auth/utils/permissions.js'
import { fetchCategories } from '../services/categoriesApi.js'
import { buildStockBySkuIdMap, fetchSkuStocks } from '../../inventory/services/inventoryStockApi.js'
import { deleteProduct, fetchProducts } from '../services/productsApi.js'
import ProductImage from '../components/ProductImage.jsx'
import { getProductStatusMeta, summarizeProductSkus, summarizeProductStock } from '../utils/productDisplay.js'

const TABLE_HEAD = 'px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-[#717971] sm:px-6'
const TABLE_CELL = 'px-4 py-4 text-sm text-[#414942] sm:px-6'

function ProductsListPage() {
  const session = loadAuthSession()
  const canManage = canManageProducts(session)

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
  const [deletingId, setDeletingId] = useState(null)

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

  async function handleDelete(product) {
    if (!canManage) return
    if (!window.confirm(`Xóa sản phẩm "${product.name}"? Sản phẩm sẽ được ẩn khỏi hệ thống (soft delete).`)) return
    try {
      setDeletingId(product.id)
      await deleteProduct(product.id)
      showSuccess('Đã xóa sản phẩm.')
      await loadProducts()
    } catch (error) {
      showError(error.message)
    } finally {
      setDeletingId(null)
    }
  }

  const categoryOptions = useMemo(
    () => [{ value: '', label: 'Tất cả danh mục' }, ...categories.map((item) => ({ value: String(item.id), label: item.name }))],
    [categories],
  )

  return (
    <PageShell>
      <PageHeader
        title="Sản phẩm"
        description="Quản lý sản phẩm, biến thể SKU, danh mục và trạng thái kinh doanh"
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
            {canManage ? (
              <Link
                to="/products/create"
                className="inline-flex items-center gap-2 rounded-xl bg-[#538463] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#457053]"
              >
                <span className="material-symbols-outlined text-[18px]">add</span>
                Tạo sản phẩm
              </Link>
            ) : null}
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
                <th className={TABLE_HEAD}>Tên sản phẩm</th>
                <th className={TABLE_HEAD}>Danh mục</th>
                <th className={TABLE_HEAD}>SKU</th>
                <th className={TABLE_HEAD}>Giá</th>
                <th className={TABLE_HEAD}>Tồn kho</th>
                <th className={TABLE_HEAD}>Trạng thái</th>
                <th className={TABLE_HEAD}>Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {isLoading ? (
                <tr>
                  <td className="px-6 py-8 text-center text-slate-500" colSpan={8}>
                    Đang tải...
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td className="px-6 py-8 text-center text-slate-500" colSpan={8}>
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
                      <td className={`${TABLE_CELL} font-semibold text-slate-900`}>{product.name}</td>
                      <td className={TABLE_CELL}>{product.categoryName || '—'}</td>
                      <td className={`${TABLE_CELL} font-mono text-xs`}>
                        {skuSummary.count ? `${skuSummary.count} SKU · ${skuSummary.codes}` : 'Chưa có SKU'}
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
                          <Link to={`/products/${product.id}/edit`} className="rounded-full p-2 text-[#717971] hover:bg-[#e4e3db] hover:text-[#356647]">
                            <span className="material-symbols-outlined text-[20px]">edit</span>
                          </Link>
                          {canManage ? (
                            <button
                              type="button"
                              disabled={deletingId === product.id}
                              className="rounded-full p-2 text-[#717971] hover:bg-[#fff5f5] hover:text-[#b42318] disabled:opacity-50"
                              onClick={() => handleDelete(product)}
                            >
                              <span className="material-symbols-outlined text-[20px]">delete</span>
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
    </PageShell>
  )
}

export default ProductsListPage
