import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { AUTH_SESSION_CHANGED_EVENT, loadAuthSession } from '../../auth/services/authSession.js'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import PageShell from '../../../components/shared/PageShell.jsx'
import TablePagination, { TABLE_PAGE_SIZE } from '../../../components/shared/TablePagination.jsx'
import { showError, showSuccess } from '../../../app/toast.js'
import {
  canCreateCatalog,
  canCreateStockReplenishmentRequest,
  canHideCatalog,
  canSyncCatalog,
  isWarehouseRole,
} from '../../auth/utils/permissions.js'
import { fetchCategories } from '../services/categoriesApi.js'
import {
  buildStockBySkuIdMap,
  buildWarehouseStockBySkuIdMap,
  fetchInventorySettings,
  fetchSkuStocks,
} from '../../inventory/services/inventoryStockApi.js'
import { fetchPendingCatalogSync, syncCatalogToStore } from '../services/catalogSyncApi.js'
import { createProductDeletionRequest, fetchProducts, submitProductDeletionRequest } from '../services/productsApi.js'
import ProductImage from '../components/ProductImage.jsx'
import ProductSkusDetailModal from '../components/ProductSkusDetailModal.jsx'
import ProductExpandedPanel from '../components/ProductExpandedPanel.jsx'
import TransferToStoreModal from '../components/TransferToStoreModal.jsx'
import InventorySimulationBanner from '../../inventory/components/InventorySimulationBanner.jsx'
import { INVENTORY_STOCK_CHANGED_EVENT } from '../../inventory/utils/inventoryStockEvents.js'
import {
  formatProductPrice,
  formatStockQuantity,
  getProductStatusMeta,
  pickProductImageUrl,
  summarizeProductVariants,
  summarizeProductSkus,
} from '../utils/productDisplay.js'
import { getProductTypeLabel, PRODUCT_TYPE, PRODUCT_TYPE_OPTIONS } from '../utils/productTypes.js'
import { buildCategoryTree } from '../utils/categoryTreeUtils.js'
import { consumeProductListFocus, readHighlightProductIdFromUrl } from '../utils/productListFocus.js'

// ─── Sidebar filter ──────────────────────────────────────────────────────────

const STATUS_FILTERS = [
  { value: 'all', label: 'Tất cả' },
  { value: 'active', label: 'Đang bán' },
  { value: 'hidden', label: 'Đã ẩn' },
]

const PRODUCT_TYPE_FILTERS = [
  { value: '', label: 'Tất cả' },
  ...PRODUCT_TYPE_OPTIONS,
]

function ChipGroup({ options, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
            value === opt.value
              ? 'bg-[#356647] text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

function FilterSection({ title, children, action }) {
  return (
    <div className="border-b border-slate-100 px-4 py-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{title}</p>
        {action}
      </div>
      {children}
    </div>
  )
}

function WarehouseFilterContent({
  categories = [],
  categoryId,
  onCategoryChange,
  statusFilter,
  onStatusFilterChange,
  productTypeFilter,
  onProductTypeChange,
  canCreate = false,
}) {
  const tree = buildCategoryTree(categories.filter((c) => !c.isDeleted))
  return (
    <>
      <FilterSection
        title="Nhóm hàng"
        action={
          canCreate ? (
            <Link to="/products/categories" className="text-[11px] font-bold text-[#356647] hover:underline">
              Quản lý
            </Link>
          ) : null
        }
      >
        <div className="space-y-0.5">
          <button
            type="button"
            onClick={() => onCategoryChange('')}
            className={`w-full rounded px-2 py-1.5 text-left text-xs font-semibold transition ${
              !categoryId ? 'bg-[#356647]/10 text-[#356647]' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Tất cả nhóm hàng
          </button>
          {tree.map((node) => (
            <button
              key={node.id}
              type="button"
              onClick={() => onCategoryChange(String(node.id))}
              className={`w-full rounded px-2 py-1.5 text-left text-xs transition ${
                String(categoryId) === String(node.id)
                  ? 'bg-[#356647]/10 font-semibold text-[#356647]'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
              style={{ paddingLeft: `${8 + (node.depth || 0) * 12}px` }}
            >
              {node.name}
            </button>
          ))}
        </div>
      </FilterSection>

      <FilterSection title="Loại hàng">
        <ChipGroup options={PRODUCT_TYPE_FILTERS} value={productTypeFilter} onChange={onProductTypeChange} />
      </FilterSection>

      <FilterSection title="Trạng thái">
        <ChipGroup options={STATUS_FILTERS} value={statusFilter} onChange={onStatusFilterChange} />
      </FilterSection>
    </>
  )
}

function WarehouseFilterSidebar(props) {
  return (
    <div className="hidden w-52 shrink-0 overflow-y-auto border-r border-slate-100 lg:block custom-scrollbar">
      <WarehouseFilterContent {...props} />
    </div>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function readInitialState(locationState) {
  const highlightFromUrl = readHighlightProductIdFromUrl()
  return {
    focusId: highlightFromUrl || null,
    searchName: locationState?.createdName || '',
    statusFilter: 'all',
    showCreatedBanner: Boolean(highlightFromUrl),
    createdName: locationState?.createdName || '',
  }
}

function getVariantLabel(variant, productName) {
  if (!variant) return '—'
  const name = variant.variantName || ''
  const prefix = productName ? productName + ' - ' : ''
  return name.startsWith(prefix) ? name.slice(prefix.length) : name || variant.skuCode || '—'
}

const MISSING_BOM_TITLE = 'Sản phẩm kệ này chưa có định mức BOM, chưa nên dùng để tạo lệnh sản xuất.'
const PRODUCT_FETCH_PAGE_SIZE = 100

async function fetchAllProductsForWarehouseList(params = {}) {
  const items = []
  let requestPage = 1
  let totalPages

  do {
    const result = await fetchProducts({
      ...params,
      page: requestPage,
      pageSize: PRODUCT_FETCH_PAGE_SIZE,
    })
    items.push(...(result.items ?? []))
    totalPages = Number(result.totalPages ?? 1) || 1
    requestPage += 1
  } while (requestPage <= totalPages)

  return items
}

function buildSkuRows(products = []) {
  return products.flatMap((product) => {
    const variants = product.variants?.length ? product.variants : (product.skus ?? [])

    if (!variants.length) {
      return [{
        rowKey: `${product.id}:no-sku`,
        product,
        sku: null,
        isFirstForProduct: true,
      }]
    }

    return variants.map((sku, index) => ({
      rowKey: `${product.id}:${sku.id}`,
      product,
      sku,
      isFirstForProduct: index === 0,
    }))
  })
}

function matchesSkuRowSearch(row, keyword) {
  const term = keyword.trim().toLowerCase()
  if (!term) return true

  const product = row.product
  const sku = row.sku
  const haystack = [
    product.name,
    product.categoryName,
    product.origin,
    product.description,
    sku?.skuCode,
    sku?.barcode,
    sku?.variantName,
    sku?.packagingType,
  ].filter(Boolean).join(' ').toLowerCase()

  return haystack.includes(term)
}

function matchesSkuRowStatus(row, statusFilter) {
  if (statusFilter === 'active') {
    return !row.product.isDeleted && row.product.isActive !== false && row.sku?.isActive !== false
  }

  return true
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const COL = 11

export default function ProductsWarehouseListPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [initialState] = useState(() => readInitialState(location.state))

  const [session, setSession] = useState(() => loadAuthSession())
  const canCreate = canCreateCatalog(session)
  const canHide = canHideCatalog(session)
  const canSync = canSyncCatalog(session)
  const canRequestCounterReplenishment = canCreateStockReplenishmentRequest(session)
  const isWarehouse = isWarehouseRole(session)

  useEffect(() => {
    const sync = () => setSession(loadAuthSession())
    window.addEventListener(AUTH_SESSION_CHANGED_EVENT, sync)
    return () => window.removeEventListener(AUTH_SESSION_CHANGED_EVENT, sync)
  }, [])

  // ── State ──────────────────────────────────────────────────────────────────
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [searchInput, setSearchInput] = useState(() => initialState.searchName)
  const [search, setSearch] = useState(() => initialState.searchName)
  const [categoryId, setCategoryId] = useState('')
  const [statusFilter, setStatusFilter] = useState(() => initialState.statusFilter)
  const [productTypeFilter, setProductTypeFilter] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(TABLE_PAGE_SIZE)
  const [isLoading, setIsLoading] = useState(true)
  const [stockBySkuId, setStockBySkuId] = useState(() => new Map())
  const [storeStockBySkuId, setStoreStockBySkuId] = useState(() => new Map())
  const [simulateWarehouse, setSimulateWarehouse] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [togglingId, setTogglingId] = useState(null)
  const [pendingSyncTotal, setPendingSyncTotal] = useState(0)
  const [skuModalProduct, setSkuModalProduct] = useState(null)
  const [transferTarget, setTransferTarget] = useState(null)
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const [focusProductId, setFocusProductId] = useState(() => initialState.focusId)
  const [expandedRowKey, setExpandedRowKey] = useState(null)
  const [createdBanner, setCreatedBanner] = useState(() => ({
    open: initialState.showCreatedBanner,
    productId: initialState.focusId,
    name: initialState.createdName,
  }))

  // ── Search debounce ────────────────────────────────────────────────────────
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim())
      setPage(1)
    }, 300)
    return () => window.clearTimeout(timer)
  }, [searchInput])

  // ── Strip ?highlight= from URL ────────────────────────────────────────────
  useEffect(() => {
    const highlight = searchParams.get('highlight')
    if (!highlight) return
    navigate('/inventory/products', { replace: true, state: location.state })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Focus from list-focus utility ─────────────────────────────────────────
  useEffect(() => {
    const focus = consumeProductListFocus()
    if (!focus?.id) return undefined
    const applyTimer = window.setTimeout(() => {
      setFocusProductId(focus.id)
      if (focus.showBanner) setCreatedBanner({ open: true, productId: focus.id, name: focus.name || '' })
      if (focus.statusFilter) setStatusFilter(focus.statusFilter)
    }, 0)
    const scrollTimer = window.setTimeout(
      () => document.getElementById(`product-row-${focus.id}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }),
      120,
    )
    const clearTimer = window.setTimeout(() => setFocusProductId(null), 4500)
    return () => {
      window.clearTimeout(applyTimer)
      window.clearTimeout(scrollTimer)
      window.clearTimeout(clearTimer)
    }
  }, [location.key])

  // ── Data loading ───────────────────────────────────────────────────────────
  const loadStocks = useCallback(async () => {
    try {
      const stocks = await fetchSkuStocks()
      setStockBySkuId(buildWarehouseStockBySkuIdMap(stocks))
      setStoreStockBySkuId(buildStockBySkuIdMap(stocks))
    } catch {
      setStockBySkuId(new Map())
      setStoreStockBySkuId(new Map())
    }
  }, [])

  const loadProducts = useCallback(async () => {
    try {
      setIsLoading(true)
      const [items] = await Promise.all([
        fetchAllProductsForWarehouseList({
          categoryId: categoryId ? Number(categoryId) : undefined,
          isActive: statusFilter === 'active' ? true : undefined,
          isDeleted: statusFilter === 'hidden' ? true : undefined,
          productType: productTypeFilter || undefined,
        }),
        loadStocks(),
      ])
      setProducts(items)
    } catch (error) {
      setProducts([])
      showError(error.message)
    } finally {
      setIsLoading(false)
    }
  }, [categoryId, statusFilter, productTypeFilter, loadStocks])

  const loadCategories = useCallback(async () => {
    try {
      const items = await fetchCategories()
      setCategories(items)
    } catch (error) {
      showError(error.message)
    }
  }, [])

  const loadPendingSync = useCallback(async () => {
    if (!canSync) { setPendingSyncTotal(0); return }
    try {
      const pending = await fetchPendingCatalogSync()
      setPendingSyncTotal(pending.total)
    } catch {
      setPendingSyncTotal(0)
    }
  }, [canSync])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadCategories()
      loadPendingSync()
      fetchInventorySettings().then((s) => setSimulateWarehouse(s.simulateWarehouse)).catch(() => {})
    }, 0)
    return () => window.clearTimeout(timer)
  }, [loadCategories, loadPendingSync])

  useEffect(() => {
    const timer = window.setTimeout(() => loadProducts(), 0)
    return () => window.clearTimeout(timer)
  }, [loadProducts])

  useEffect(() => {
    const refresh = () => loadStocks()
    window.addEventListener(INVENTORY_STOCK_CHANGED_EVENT, refresh)
    return () => window.removeEventListener(INVENTORY_STOCK_CHANGED_EVENT, refresh)
  }, [loadStocks])

  useEffect(() => {
    if (!createdBanner.open || !createdBanner.productId) return
    const found = products.find((p) => String(p.id) === String(createdBanner.productId))
    if (!found?.name || found.name === createdBanner.name) return
    const timer = window.setTimeout(() => {
      setCreatedBanner((prev) => ({ ...prev, name: found.name }))
    }, 0)
    return () => window.clearTimeout(timer)
  }, [products, createdBanner.open, createdBanner.productId, createdBanner.name])

  const skuRows = useMemo(() => buildSkuRows(products), [products])
  const filteredSkuRows = useMemo(
    () => skuRows.filter((row) => matchesSkuRowSearch(row, search) && matchesSkuRowStatus(row, statusFilter)),
    [skuRows, search, statusFilter],
  )
  const totalCount = filteredSkuRows.length
  const pagedSkuRows = useMemo(() => {
    const start = (page - 1) * pageSize
    return filteredSkuRows.slice(start, start + pageSize)
  }, [filteredSkuRows, page, pageSize])

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(totalCount / pageSize))
    if (page <= maxPage) return undefined
    const timer = window.setTimeout(() => setPage(maxPage), 0)
    return () => window.clearTimeout(timer)
  }, [page, pageSize, totalCount])

  // ── Actions ────────────────────────────────────────────────────────────────
  async function handleSyncCatalog() {
    setIsSyncing(true)
    try {
      const result = await syncCatalogToStore()
      await Promise.all([loadCategories(), loadProducts(), loadPendingSync()])
      const total = result.categoriesSynced + result.productsSynced + result.skusSynced
      showSuccess(
        total === 0
          ? 'Không có dữ liệu mới từ kho cần đồng bộ.'
          : `Đã đồng bộ ${result.productsSynced} sản phẩm, ${result.skusSynced} SKU, ${result.categoriesSynced} danh mục.`,
      )
    } catch (error) {
      showError(error.message)
    } finally {
      setIsSyncing(false)
    }
  }

  async function handleHide(product) {
    if (!canHide || product.isDeleted) return
    const reason = window.prompt(`Nhập lý do yêu cầu xóa sản phẩm "${product.name}":`)
    if (!String(reason || '').trim()) return
    try {
      setTogglingId(product.id)
      const request = await createProductDeletionRequest({
        title: `Yêu cầu xóa ${product.name}`,
        reason,
        items: [{ productId: product.id, reason }],
      })
      await submitProductDeletionRequest(request.id, reason)
      showSuccess('Đã gửi yêu cầu xóa hàng hóa cho Admin duyệt.')
      await loadProducts()
    } catch (error) {
      showError(error.message)
    } finally {
      setTogglingId(null)
    }
  }

  async function handleRestore(product) {
    if (!canHide || !product.isDeleted) return
    showError('Khôi phục Product đã bị khóa khỏi UI thường. Cần quy trình Admin khẩn cấp riêng.')
  }

  // ── Row expansion ─────────────────────────────────────────────────────────
  function toggleExpand(rowKey) {
    setExpandedRowKey((cur) => (cur === rowKey ? null : rowKey))
  }

  function openTransferToStore(product, sku) {
    if (!sku) return
    setTransferTarget({
      sku,
      productName: product.name,
      warehouseQuantityOnHand: Number(stockBySkuId.get(sku.id) ?? 0),
      quantityOnHand: Number(storeStockBySkuId.get(sku.id) ?? 0),
    })
  }

  // ── Filter state for sidebar ───────────────────────────────────────────────
  const hasActiveFilters =
    Boolean(categoryId) || Boolean(productTypeFilter) || statusFilter !== 'all' || Boolean(search)

  const filterProps = {
    categories,
    categoryId,
    onCategoryChange: (v) => { setCategoryId(v); setPage(1) },
    statusFilter,
    onStatusFilterChange: (v) => { setStatusFilter(v); setPage(1) },
    productTypeFilter,
    onProductTypeChange: (v) => { setProductTypeFilter(v); setPage(1) },
    canCreate,
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <PageShell className="!gap-0 flex h-full min-h-0 flex-1 flex-col">
      <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm sm:rounded-[1rem]">

        {/* ── Header bar ── */}
        <div className="shrink-0 border-b border-slate-200 px-3 py-3 sm:px-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-xl font-bold text-slate-900">Sản phẩm &amp; số lượng</h1>
              <p className="mt-0.5 text-xs text-slate-500">
                Master catalog kho — tồn kho tổng cập nhật theo từng SKU ({totalCount} SKU)
              </p>
            </div>

            <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center lg:max-w-3xl lg:justify-end">
              {/* Search */}
              <div className="relative flex-1">
                <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-slate-400">
                  search
                </span>
                <input
                  type="search"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Tìm theo SKU, tên, biến thể..."
                  className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm outline-none focus:border-[#356647] focus:ring-2 focus:ring-[#356647]/15"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Mobile filter toggle */}
                <button
                  type="button"
                  onClick={() => setMobileFiltersOpen(true)}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2.5 text-sm font-semibold lg:hidden ${
                    hasActiveFilters
                      ? 'border-[#356647]/40 bg-[#356647]/5 text-[#356647]'
                      : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">filter_list</span>
                  Lọc
                </button>

                {canCreate ? (
                  <Link
                    to="/inventory/products/create"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#538463] px-3 py-2.5 text-sm font-bold text-white hover:bg-[#457053]"
                  >
                    <span className="material-symbols-outlined text-[18px]">add</span>
                    Tạo sản phẩm
                  </Link>
                ) : null}

                {canSync ? (
                  <button
                    type="button"
                    disabled={isSyncing || isLoading}
                    onClick={handleSyncCatalog}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    title="Đồng bộ sang cửa hàng"
                  >
                    <span className={`material-symbols-outlined text-[18px] ${isSyncing ? 'animate-spin' : ''}`}>sync</span>
                    Đồng bộ
                    {pendingSyncTotal > 0 ? (
                      <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                        {pendingSyncTotal}
                      </span>
                    ) : null}
                  </button>
                ) : null}

                {isWarehouse ? (
                  <Link
                    to="/inventory/import/create"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    title="Nhập nguyên liệu vào kho"
                  >
                    <span className="material-symbols-outlined text-[18px]">inventory</span>
                    Nhập nguyên liệu
                  </Link>
                ) : null}

                <Link
                  to="/products/categories"
                  className="rounded-lg border border-slate-200 p-2.5 text-slate-600 hover:bg-slate-50"
                  title="Danh mục"
                >
                  <span className="material-symbols-outlined text-[20px]">category</span>
                </Link>

                <Link
                  to="/products/pricing"
                  className="rounded-lg border border-slate-200 p-2.5 text-slate-600 hover:bg-slate-50"
                  title="Bảng giá"
                >
                  <span className="material-symbols-outlined text-[20px]">sell</span>
                </Link>
              </div>
            </div>
          </div>

          {pendingSyncTotal > 0 ? (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              <p className="font-semibold">Có {pendingSyncTotal} mục từ kho chưa đồng bộ sang cửa hàng.</p>
            </div>
          ) : null}

          {createdBanner.open && createdBanner.productId ? (
            <div className="mt-3 flex flex-col gap-3 rounded-xl border border-[#356647]/30 bg-[#356647]/8 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold text-[#1d3d2a]">
                  Đã lưu sản phẩm{createdBanner.name ? ` "${createdBanner.name}"` : ''}.
                </p>
                <p className="mt-0.5 text-sm text-[#356647]">
                  Biến thể đã tự sinh từ đơn vị tính. Nhập nguyên liệu để có tồn kho.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  to={`/inventory/products?highlight=${encodeURIComponent(createdBanner.productId)}`}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#538463] px-4 py-2 text-sm font-bold text-white hover:bg-[#457053]"
                >
                  <span className="material-symbols-outlined text-[18px]">visibility</span>
                  Xem
                </Link>
                <button
                  type="button"
                  onClick={() => setCreatedBanner({ open: false, productId: null, name: '' })}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Đóng
                </button>
              </div>
            </div>
          ) : null}
        </div>

        {/* ── Sidebar + Table ── */}
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <WarehouseFilterSidebar {...filterProps} />

          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <div className="shrink-0 px-3 pt-2 sm:px-5 sm:pt-3">
              <InventorySimulationBanner simulateWarehouse={simulateWarehouse} warehouseView />
            </div>

            <div className="relative min-h-0 flex-1 overflow-auto custom-scrollbar">
              <table className="min-w-[700px] w-full text-left text-sm sm:min-w-[920px]">
                <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500 shadow-[0_1px_0_0_rgba(226,232,240,1)]">
                  <tr>
                    <th className="w-10 px-2 py-3" />
                    <th className="w-14 px-2 py-3" />
                    <th className="px-3 py-3">Mã SKU</th>
                    <th className="min-w-[180px] px-3 py-3">Tên hàng</th>
                    <th className="hidden px-3 py-3 md:table-cell">Nhóm hàng</th>
                    <th className="hidden px-3 py-3 text-right lg:table-cell">Giá vốn</th>
                    <th className="px-3 py-3 text-right">Giá bán</th>
                    <th className="px-3 py-3 text-right">Tồn kho tổng</th>
                    <th className="hidden px-3 py-3 sm:table-cell">Loại</th>
                    <th className="hidden px-3 py-3 sm:table-cell">Trạng thái</th>
                    <th className="px-3 py-3">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isLoading ? (
                    <tr>
                      <td colSpan={COL} className="px-6 py-10 text-center text-slate-500">
                        Đang tải...
                      </td>
                    </tr>
                  ) : filteredSkuRows.length === 0 ? (
                    <tr>
                      <td colSpan={COL} className="px-6 py-10 text-center text-slate-500">
                        Không có SKU phù hợp.
                      </td>
                    </tr>
                  ) : (
                    pagedSkuRows.map((row) => {
                      const { product, sku: selectedVariant } = row
                      const status = getProductStatusMeta(
                        product.isActive !== false && selectedVariant?.isActive !== false,
                        product.isDeleted,
                      )
                      const variants = product.variants ?? []
                      const imageUrl = selectedVariant?.imageUrl || pickProductImageUrl(product)
                      const stockQty = selectedVariant ? Number(stockBySkuId.get(selectedVariant.id) ?? 0) : 0
                      const isOut = stockQty <= 0
                      const isLow = stockQty > 0 && stockQty <= 5
                      const isExpanded = expandedRowKey === row.rowKey
                      const isFocused = focusProductId && String(product.id) === focusProductId
                      const isNguyenLieu = product.productType === PRODUCT_TYPE.NGUYEN_LIEU
                      const isBaoBi = product.productType === PRODUCT_TYPE.BAO_BI
                      const isFinishedProduct = product.productType === PRODUCT_TYPE.THANH_PHAM
                      const selectedVariantBomLineCount = Number(selectedVariant?.bomLineCount ?? 0)
                      const selectedVariantHasBom = selectedVariant
                        ? Boolean(selectedVariant.hasBom || selectedVariantBomLineCount > 0)
                        : false
                      const skuSummary = variants.length
                        ? summarizeProductVariants(variants)
                        : summarizeProductSkus(product.skus ?? [])

                      return (
                        <Fragment key={row.rowKey}>
                          <tr
                            id={row.isFirstForProduct ? `product-row-${product.id}` : `sku-row-${selectedVariant?.id ?? row.rowKey}`}
                            data-product-id={product.id}
                            data-sku-id={selectedVariant?.id ?? ''}
                            className={[
                              'cursor-pointer transition-colors hover:bg-[#f8faf8]',
                              isExpanded ? 'bg-[#f0f7f2] shadow-[inset_3px_0_0_0_#356647]' : '',
                              product.isDeleted ? 'opacity-60' : '',
                              isFocused ? 'bg-[#356647]/8 ring-1 ring-inset ring-[#356647]/25' : '',
                            ].filter(Boolean).join(' ')}
                          >
                            {/* Expand */}
                            <td className="px-2 py-3">
                              <button
                                type="button"
                                onClick={() => toggleExpand(row.rowKey)}
                                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-[#356647]"
                                aria-expanded={isExpanded}
                              >
                                <span className={`material-symbols-outlined text-[20px] transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
                                  chevron_right
                                </span>
                              </button>
                            </td>

                            {/* Image */}
                            <td className="px-2 py-3" onClick={() => toggleExpand(row.rowKey)}>
                              <ProductImage
                                src={imageUrl}
                                alt={product.name}
                                className="h-10 w-10 rounded-lg"
                                iconClassName="text-lg"
                              />
                            </td>

                            {/* SKU code */}
                            <td className="px-3 py-3 font-mono text-xs font-bold text-[#356647]" onClick={() => toggleExpand(row.rowKey)}>
                              {selectedVariant?.skuCode || '—'}
                            </td>

                            {/* Tên hàng + variant */}
                            <td className="px-3 py-3" onClick={() => toggleExpand(row.rowKey)}>
                              <span className="block font-semibold text-slate-900">{product.name}</span>
                              {selectedVariant ? (
                                <span className="mt-0.5 block text-xs text-slate-400">
                                  {getVariantLabel(selectedVariant, product.name)}
                                </span>
                              ) : null}
                            </td>

                            {/* Danh mục */}
                            <td className="hidden px-3 py-3 text-slate-600 md:table-cell" onClick={() => toggleExpand(row.rowKey)}>
                              {product.categoryName || '—'}
                            </td>

                            {/* Giá vốn */}
                            <td className="hidden px-3 py-3 text-right text-slate-600 lg:table-cell" onClick={() => toggleExpand(row.rowKey)}>
                              {selectedVariant ? formatProductPrice(selectedVariant.costPrice) : '—'}
                            </td>

                            {/* Giá bán */}
                            <td className="px-3 py-3 text-right font-medium text-slate-800" onClick={() => toggleExpand(row.rowKey)}>
                              {selectedVariant?.isSellable !== false
                                ? formatProductPrice(selectedVariant?.retailPrice)
                                : <span className="text-slate-400 text-xs">Không bán</span>}
                            </td>

                            {/* Tồn kho tổng */}
                            <td
                              className={`px-3 py-3 text-right font-semibold ${
                                !selectedVariant ? 'text-slate-400' : isOut ? 'text-[#b42318]' : isLow ? 'text-[#7e5700]' : 'text-[#356647]'
                              }`}
                              onClick={() => toggleExpand(row.rowKey)}
                            >
                              {selectedVariant ? formatStockQuantity(stockQty) : '—'}
                              {selectedVariant && stockQty <= 0 && !product.isDeleted ? (
                                <Link
                                  to="/inventory/import/create"
                                  className="mt-0.5 block text-[10px] font-semibold text-amber-700 hover:underline"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  Nhập nguyên liệu
                                </Link>
                              ) : null}
                            </td>

                            {/* Loại */}
                            <td className="hidden px-3 py-3 sm:table-cell" onClick={() => toggleExpand(row.rowKey)}>
                              {isNguyenLieu ? (
                                <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-800">
                                  {getProductTypeLabel(product.productType)}
                                </span>
                              ) : isBaoBi ? (
                                <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-800">
                                  {getProductTypeLabel(product.productType)}
                                </span>
                              ) : isFinishedProduct ? (
                                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                                  {getProductTypeLabel(product.productType)}
                                </span>
                              ) : (
                                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-700">
                                  {getProductTypeLabel(product.productType)}
                                </span>
                              )}
                              {isFinishedProduct && selectedVariant && !selectedVariantHasBom ? (
                                <span
                                  title={MISSING_BOM_TITLE}
                                  className="mt-1 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800"
                                >
                                  Thiếu BOM
                                </span>
                              ) : null}
                            </td>

                            {/* Trạng thái */}
                            <td className="hidden px-3 py-3 sm:table-cell" onClick={() => toggleExpand(row.rowKey)}>
                              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${status.className}`}>
                                {status.label}
                              </span>
                            </td>

                            {/* Thao tác */}
                            <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center gap-1">
                                {skuSummary.count > 0 ? (
                                  <button
                                    type="button"
                                    title="Chi tiết biến thể"
                                    className="rounded-full p-1.5 text-[#717971] hover:bg-[#e4e3db] hover:text-[#356647]"
                                    onClick={() => setSkuModalProduct(product)}
                                  >
                                    <span className="material-symbols-outlined text-[18px]">inventory_2</span>
                                  </button>
                                ) : null}
                                {canRequestCounterReplenishment && selectedVariant && !product.isDeleted ? (
                                  <button
                                    type="button"
                                    title={stockQty > 0 ? 'Bổ sung Kệ Hàng' : 'Kho hết hàng'}
                                    disabled={stockQty <= 0}
                                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-[#356647] hover:bg-[#356647]/8 disabled:cursor-not-allowed disabled:opacity-40"
                                    onClick={() => openTransferToStore(product, selectedVariant)}
                                  >
                                    <span className="material-symbols-outlined text-[18px]">output</span>
                                    <span>Bổ sung quầy</span>
                                  </button>
                                ) : null}
                                {!product.isDeleted && canCreate ? (
                                  <button
                                    type="button"
                                    title="Master data chỉ sửa qua workflow phê duyệt"
                                    className="rounded-full p-1.5 text-slate-400"
                                    onClick={() => showError('Sửa Product/SKU/BOM trực tiếp đã bị khóa. Vui lòng tạo yêu cầu Product Creation mới nếu cần thay đổi master data.')}
                                  >
                                    <span className="material-symbols-outlined text-[18px]">lock</span>
                                  </button>
                                ) : null}
                                {canHide && product.isDeleted ? (
                                  <button
                                    type="button"
                                    title="Kích hoạt lại"
                                    disabled={togglingId === product.id}
                                    className="rounded-full p-1.5 text-[#356647] hover:bg-[#356647]/10 disabled:opacity-50"
                                    onClick={() => handleRestore(product)}
                                  >
                                    <span className="material-symbols-outlined text-[18px]">restore_from_trash</span>
                                  </button>
                                ) : null}
                                {canHide && !product.isDeleted ? (
                                  <button
                                    type="button"
                                    title="Ẩn sản phẩm"
                                    disabled={togglingId === product.id}
                                    className="rounded-full p-1.5 text-rose-500 hover:bg-rose-50 disabled:opacity-50"
                                    onClick={() => handleHide(product)}
                                  >
                                    <span className="material-symbols-outlined text-[18px]">visibility_off</span>
                                  </button>
                                ) : null}
                              </div>
                            </td>
                          </tr>

                          {/* Expand row */}
                          {isExpanded ? (
                            <tr>
                              <td colSpan={COL} className="p-0">
                                <ProductExpandedPanel
                                  product={product}
                                  stockBySkuId={stockBySkuId}
                                  stockLabel="Tồn kho tổng"
                                  activeSkuId={selectedVariant?.id ?? null}
                                  readOnly={false}
                                  canManage={canCreate}
                                  canHide={canHide}
                                  isHiding={togglingId === product.id}
                                  onHide={handleHide}
                                />
                              </td>
                            </tr>
                          ) : null}
                        </Fragment>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="shrink-0 border-t border-slate-200 bg-white px-3 py-2.5 sm:px-5 sm:py-3">
              <TablePagination
                page={page}
                pageSize={pageSize}
                totalCount={totalCount}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
                itemLabel="SKU"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Mobile filter drawer */}
      {mobileFiltersOpen ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/40 lg:hidden"
            aria-label="Đóng bộ lọc"
            onClick={() => setMobileFiltersOpen(false)}
          />
          <div className="fixed inset-x-0 bottom-0 z-50 flex max-h-[min(85dvh,640px)] flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl lg:hidden">
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-4 py-3">
              <h2 className="text-base font-bold text-slate-900">Bộ lọc</h2>
              <button
                type="button"
                onClick={() => setMobileFiltersOpen(false)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              >
                <span className="material-symbols-outlined text-[22px]">close</span>
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar">
              <WarehouseFilterContent {...filterProps} />
            </div>
            <div className="shrink-0 border-t border-slate-100 p-4">
              <button
                type="button"
                onClick={() => setMobileFiltersOpen(false)}
                className="w-full rounded-xl bg-[#356647] py-3 text-sm font-bold text-white hover:bg-[#2d5539]"
              >
                Áp dụng
              </button>
            </div>
          </div>
        </>
      ) : null}

      {skuModalProduct ? (
        <ProductSkusDetailModal
          product={skuModalProduct}
          stockBySkuId={stockBySkuId}
          canManage={canCreate}
          canAdjustStock={false}
          warehouseStockView
          onClose={() => setSkuModalProduct(null)}
          onStockAdjusted={loadStocks}
        />
      ) : null}

      {transferTarget ? (
        <TransferToStoreModal
          sku={transferTarget.sku}
          productName={transferTarget.productName}
          warehouseQuantityOnHand={transferTarget.warehouseQuantityOnHand}
          quantityOnHand={transferTarget.quantityOnHand}
          onClose={() => setTransferTarget(null)}
          onSubmitted={(created) => {
            setTransferTarget(null)
            navigate('/inventory/stock-requests', {
              state: { search: created?.requestCode ?? '' },
            })
          }}
        />
      ) : null}
    </PageShell>
  )
}
