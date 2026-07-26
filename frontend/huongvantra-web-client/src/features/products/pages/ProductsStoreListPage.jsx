import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { AUTH_SESSION_CHANGED_EVENT, loadAuthSession } from '../../auth/services/authSession.js'
import { Link } from 'react-router-dom'
import PageShell from '../../../components/shared/PageShell.jsx'
import { TitleInfoButton } from '../../../components/shared/PageHeader.jsx'
import TablePagination, { TABLE_PAGE_SIZE } from '../../../components/shared/TablePagination.jsx'
import { showError, showSuccess } from '../../../app/toast.js'
import { canAdjustStoreStock, canSyncCatalog } from '../../auth/utils/permissions.js'
import { fetchCategories } from '../services/categoriesApi.js'
import { buildStockBySkuIdMap, fetchStoreSkuStocks } from '../../inventory/services/inventoryStockApi.js'
import { fetchPendingCatalogSync, syncCatalogToStore } from '../services/catalogSyncApi.js'
import { fetchAllActiveStoreSkus } from '../services/productSkusApi.js'
import ProductImage from '../components/ProductImage.jsx'
import StoreProductExpandedLoader from '../components/StoreProductExpandedLoader.jsx'
import { useStockAdjustmentBatch } from '../../inventory/hooks/useStockAdjustmentBatch.js'
import ProductsFilterSidebar, { ProductsFilterContent } from '../components/ProductsFilterSidebar.jsx'
import InventorySimulationBanner from '../../inventory/components/InventorySimulationBanner.jsx'
import { fetchInventorySettings } from '../../inventory/services/inventoryStockApi.js'
import { INVENTORY_STOCK_CHANGED_EVENT } from '../../inventory/utils/inventoryStockEvents.js'
import { formatProductPrice, formatStockQuantity } from '../utils/productDisplay.js'

// v2: now keyed by productId instead of skuId
const FAVORITES_KEY = 'hvt_product_favorites_store_v2'

function loadFavoriteIds() {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY)
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? new Set(parsed.map(String)) : new Set()
  } catch {
    return new Set()
  }
}

function saveFavoriteIds(set) {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify([...set]))
}

function matchesSkuSearch(sku, term) {
  const haystack = [sku.skuCode, sku.productName, sku.barcode, sku.categoryName, sku.packagingType]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return haystack.includes(term)
}

function passesSkuStockFilter(sku, stockFilter, stockBySkuId) {
  if (stockFilter === 'all') return true
  const qty = Number(stockBySkuId.get(sku.id) ?? 0)
  if (stockFilter === 'out_of_stock') return qty <= 0
  if (stockFilter === 'in_stock') return qty > 0
  if (stockFilter === 'low') return qty > 0 && qty <= 5
  return true
}

function passesSkuDirectSellFilter(sku, directSellFilter) {
  if (directSellFilter === 'all') return true
  const sellable = sku.isSellable !== false
  return directSellFilter === 'yes' ? sellable : !sellable
}

export default function ProductsStoreListPage() {
  const [session, setSession] = useState(() => loadAuthSession())
  const canSync = canSyncCatalog(session)
  const canAdjustStock = canAdjustStoreStock(session)

  const [isSyncing, setIsSyncing] = useState(false)
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const [expandedProductId, setExpandedProductId] = useState(null)
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const [favoriteIds, setFavoriteIds] = useState(() => loadFavoriteIds())
  // Map<productId, skuId> — which SKU variant is currently selected per product group
  const [selectedSkuByProductId, setSelectedSkuByProductId] = useState(() => new Map())
  const { isInBatch, addAll, toggleLine } = useStockAdjustmentBatch()

  useEffect(() => {
    const sync = () => setSession(loadAuthSession())
    window.addEventListener(AUTH_SESSION_CHANGED_EVENT, sync)
    return () => window.removeEventListener(AUTH_SESSION_CHANGED_EVENT, sync)
  }, [])

  const [skus, setSkus] = useState([])
  const [categories, setCategories] = useState([])
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [statusFilter, setStatusFilter] = useState('active')
  const [stockFilter, setStockFilter] = useState('all')
  const [directSellFilter, setDirectSellFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(TABLE_PAGE_SIZE)
  const [isLoading, setIsLoading] = useState(true)
  const [stockBySkuId, setStockBySkuId] = useState(() => new Map())
  // POS-04 (H6): tồn Kệ đang giữ chỗ theo skuId để hiển thị "khả bán / giữ chỗ".
  const [reservedBySkuId, setReservedBySkuId] = useState(() => new Map())
  const [simulateWarehouse, setSimulateWarehouse] = useState(true)
  const [pendingSyncTotal, setPendingSyncTotal] = useState(0)

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
      setCategories(items.filter((item) => item.isActive !== false && !item.isDeleted))
    } catch (error) {
      showError(error.message)
    }
  }, [])

  const loadStocks = useCallback(async () => {
    try {
      const stocks = await fetchStoreSkuStocks()
      setStockBySkuId(buildStockBySkuIdMap(stocks))
      setReservedBySkuId(new Map(stocks.map((row) => [row.skuId, Number(row.reservedQuantity ?? 0)])))
    } catch {
      setStockBySkuId(new Map())
      setReservedBySkuId(new Map())
    }
  }, [])

  const loadCatalog = useCallback(async () => {
    try {
      setIsLoading(true)
      const [items] = await Promise.all([fetchAllActiveStoreSkus(100), loadStocks()])
      setSkus(items)
    } catch (error) {
      setSkus([])
      showError(error.message)
    } finally {
      setIsLoading(false)
    }
  }, [loadStocks])

  const loadPendingSync = useCallback(async () => {
    if (!canSync) {
      setPendingSyncTotal(0)
      return
    }
    try {
      const pending = await fetchPendingCatalogSync()
      setPendingSyncTotal(pending.total)
    } catch {
      setPendingSyncTotal(0)
    }
  }, [canSync])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadCategories()
    loadPendingSync()
    fetchInventorySettings().then((s) => setSimulateWarehouse(s.simulateWarehouse)).catch(() => { })
  }, [loadCategories, loadPendingSync])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadCatalog()
  }, [loadCatalog])

  useEffect(() => {
    const refreshStocks = () => loadStocks()
    window.addEventListener(INVENTORY_STOCK_CHANGED_EVENT, refreshStocks)
    return () => window.removeEventListener(INVENTORY_STOCK_CHANGED_EVENT, refreshStocks)
  }, [loadStocks])

  const selectedCategoryName = useMemo(() => {
    if (!categoryId) return ''
    return categories.find((item) => String(item.id) === String(categoryId))?.name ?? ''
  }, [categories, categoryId])

  const filteredSkus = useMemo(() => {
    const term = search.toLowerCase()
    return skus.filter((sku) => {
      if (statusFilter === 'active' && sku.isActive === false) return false
      if (statusFilter === 'hidden' && sku.isActive !== false) return false
      if (selectedCategoryName && sku.categoryName !== selectedCategoryName) return false
      if (term && !matchesSkuSearch(sku, term)) return false
      if (!passesSkuStockFilter(sku, stockFilter, stockBySkuId)) return false
      if (!passesSkuDirectSellFilter(sku, directSellFilter)) return false
      return true
    })
  }, [skus, search, selectedCategoryName, statusFilter, stockFilter, directSellFilter, stockBySkuId])

  // Group filtered SKUs by productId so same-product variants share one row
  const groupedProducts = useMemo(() => {
    const map = new Map()
    for (const sku of filteredSkus) {
      const key = String(sku.productId ?? sku.productName)
      if (!map.has(key)) {
        map.set(key, { productId: key, productName: sku.productName, skus: [] })
      }
      map.get(key).skus.push(sku)
    }
    return Array.from(map.values())
  }, [filteredSkus])

  const totalCount = groupedProducts.length

  const pagedGroups = useMemo(() => {
    const start = (page - 1) * pageSize
    return groupedProducts.slice(start, start + pageSize)
  }, [groupedProducts, page, pageSize])

  // Returns the currently-selected SKU for a product group
  function getSelectedSku(group) {
    const selectedId = selectedSkuByProductId.get(String(group.productId))
    if (selectedId != null) {
      const found = group.skus.find((s) => String(s.id) === selectedId)
      if (found) return found
    }
    return group.skus[0]
  }

  function selectSkuForProduct(productId, skuId) {
    setSelectedSkuByProductId((prev) => {
      const next = new Map(prev)
      // store as string to match sku.id regardless of whether API returns number or string
      next.set(String(productId), String(skuId))
      return next
    })
  }

  async function handleSyncCatalog() {
    setIsSyncing(true)
    try {
      const result = await syncCatalogToStore()
      await Promise.all([loadCategories(), loadCatalog(), loadPendingSync()])
      const total = result.categoriesSynced + result.productsSynced + result.skusSynced
      showSuccess(
        total === 0
          ? 'Không có dữ liệu mới từ kho cần đồng bộ.'
          : `Đã đồng bộ ${result.productsSynced} sản phẩm, ${result.skusSynced} SKU.`,
      )
    } catch (error) {
      showError(error.message)
    } finally {
      setIsSyncing(false)
    }
  }

  function toggleFavorite(productId) {
    setFavoriteIds((current) => {
      const next = new Set(current)
      const key = String(productId)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      saveFavoriteIds(next)
      return next
    })
  }

  function toggleSelect(skuId) {
    setSelectedIds((current) => {
      const next = new Set(current)
      const key = String(skuId)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function toggleSelectAll() {
    const selectedSkus = pagedGroups.map((g) => getSelectedSku(g))
    const allSelected =
      pagedGroups.length > 0 && selectedSkus.every((s) => selectedIds.has(String(s.id)))
    if (allSelected) {
      setSelectedIds(new Set())
      return
    }
    setSelectedIds(new Set(selectedSkus.map((s) => String(s.id))))
  }

  function toggleExpand(productId) {
    setExpandedProductId((current) => (current === productId ? null : productId))
  }

  function skuBatchMeta(sku) {
    return {
      productName: sku.productName,
      quantityOnHand: Number(stockBySkuId.get(sku.id) ?? 0),
    }
  }

  function toggleBatchSku(sku) {
    toggleLine(
      { id: sku.id, skuCode: sku.skuCode, packagingType: sku.packagingType },
      skuBatchMeta(sku),
    )
  }

  function addSelectedToBatch() {
    const selectedSkus = skus.filter((sku) => selectedIds.has(String(sku.id)))
    addAll(
      selectedSkus.map((sku) => ({
        id: sku.id,
        skuCode: sku.skuCode,
        packagingType: sku.packagingType,
      })),
      (sku) => {
        const full = selectedSkus.find((item) => String(item.id) === String(sku.id))
        return skuBatchMeta(full ?? sku)
      },
    )
  }

  function addAllSkusToBatch(skuList, productName = '') {
    addAll(skuList, (sku) => ({
      productName,
      quantityOnHand: Number(stockBySkuId.get(sku.id) ?? 0),
    }))
  }

  const tableColSpan = canAdjustStock ? 13 : 12

  const filterProps = {
    categories,
    categoryId,
    onCategoryChange: (value) => {
      setCategoryId(value)
      setPage(1)
    },
    stockFilter,
    onStockFilterChange: (value) => {
      setStockFilter(value)
      setPage(1)
    },
    directSellFilter,
    onDirectSellFilterChange: (value) => {
      setDirectSellFilter(value)
      setPage(1)
    },
    statusFilter,
    onStatusFilterChange: (value) => {
      setStatusFilter(value)
      setPage(1)
    },
    canCreate: false,
  }

  const hasActiveClientFilters =
    stockFilter !== 'all' ||
    directSellFilter !== 'all' ||
    categoryId !== '' ||
    statusFilter !== 'active' ||
    Boolean(search)

  return (
    <PageShell className="!gap-0 flex h-full min-h-0 flex-1 flex-col">
      <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm sm:rounded-[1rem]">
        <div className="shrink-0 border-b border-slate-200 px-3 py-3 sm:px-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900">Hàng hóa</h1>
                <TitleInfoButton text={`Catalog cửa hàng theo sản phẩm — cùng nguồn dữ liệu với POS (${totalCount} sản phẩm)`} />
              </div>
            </div>

            <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center lg:max-w-3xl lg:justify-end">
              <div className="relative flex-1">
                <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-slate-400">
                  search
                </span>
                <input
                  type="search"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Theo mã, tên hàng"
                  className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm outline-none focus:border-[#356647] focus:ring-2 focus:ring-[#356647]/15"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMobileFiltersOpen(true)}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2.5 text-sm font-semibold lg:hidden ${hasActiveClientFilters
                      ? 'border-[#356647]/40 bg-[#356647]/5 text-[#356647]'
                      : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                >
                  <span className="material-symbols-outlined text-[18px]">filter_list</span>
                  Lọc
                </button>

                {canSync ? (
                  <button
                    type="button"
                    disabled={isSyncing || isLoading}
                    onClick={handleSyncCatalog}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    title="Đồng bộ từ kho"
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

                <Link
                  to="/products/pricing"
                  className="rounded-lg border border-slate-200 p-2.5 text-slate-600 hover:bg-slate-50"
                  title="Bảng giá"
                >
                  <span className="material-symbols-outlined text-[20px]">sell</span>
                </Link>
                {canAdjustStock && selectedIds.size > 0 ? (
                  <button
                    type="button"
                    onClick={addSelectedToBatch}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#356647]/30 bg-[#356647]/5 px-3 py-2.5 text-sm font-semibold text-[#356647] hover:bg-[#356647]/10"
                  >
                    <span className="material-symbols-outlined text-[18px]">playlist_add</span>
                    Thêm {selectedIds.size} SKU vào lô
                  </button>
                ) : null}
                {canAdjustStock ? (
                  <Link
                    to="/inventory/stock-requests"
                    className="rounded-lg border border-slate-200 p-2.5 text-slate-600 hover:bg-slate-50"
                    title="Yêu cầu tồn"
                  >
                    <span className="material-symbols-outlined text-[20px]">edit_note</span>
                  </Link>
                ) : null}
              </div>
            </div>
          </div>

          {pendingSyncTotal > 0 ? (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              <p className="font-semibold">Có {pendingSyncTotal} mục từ kho chưa đồng bộ sang cửa hàng.</p>
              <p className="mt-1 text-amber-900/90">
                Sản phẩm / SKU mới tạo ở kho sẽ không hiện trong danh sách này cho đến khi bấm Đồng bộ (và SKU đã được thêm trên sản phẩm).
              </p>
            </div>
          ) : null}
        </div>

        <div className="flex min-h-0 flex-1 overflow-hidden">
          <ProductsFilterSidebar {...filterProps} />

          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <div className="shrink-0 px-3 pt-2 sm:px-5 sm:pt-3">
              <InventorySimulationBanner simulateWarehouse={simulateWarehouse} warehouseView={false} />
            </div>

            <div className="relative min-h-0 flex-1 overflow-auto custom-scrollbar">
              <table className="min-w-[680px] w-full text-left text-sm sm:min-w-[900px] lg:min-w-[1100px]">
                <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500 shadow-[0_1px_0_0_rgba(226,232,240,1)]">
                  <tr>
                    <th className="w-10 px-3 py-3">
                      <input
                        type="checkbox"
                        checked={
                          pagedGroups.length > 0 &&
                          pagedGroups.every((g) => selectedIds.has(String(getSelectedSku(g).id)))
                        }
                        onChange={toggleSelectAll}
                        aria-label="Chọn tất cả"
                      />
                    </th>
                    <th className="w-10 px-2 py-3" />
                    <th className="w-10 px-2 py-3" />
                    <th className="w-14 px-2 py-3" />
                    <th className="px-3 py-3">Mã hàng</th>
                    <th className="min-w-[180px] px-3 py-3">Tên hàng</th>
                    <th className="hidden px-3 py-3 md:table-cell">Nhóm hàng</th>
                    <th className="px-3 py-3 text-right">Giá bán</th>
                    <th className="hidden px-3 py-3 text-right lg:table-cell">Giá vốn</th>
                    <th className="hidden px-3 py-3 xl:table-cell">Quy cách</th>
                    <th className="px-3 py-3 text-right">Tồn cửa hàng</th>
                    <th className="hidden px-3 py-3 text-center sm:table-cell">Bán POS</th>
                    {canAdjustStock ? (
                      <th className="hidden px-3 py-3 text-right md:table-cell">Lô</th>
                    ) : null}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isLoading ? (
                    <tr>
                      <td colSpan={tableColSpan} className="px-6 py-10 text-center text-slate-500">
                        Đang tải catalog...
                      </td>
                    </tr>
                  ) : pagedGroups.length === 0 ? (
                    <tr>
                      <td colSpan={tableColSpan} className="px-6 py-10 text-center text-slate-500">
                        {skus.length === 0
                          ? 'Chưa có SKU — bấm Đồng bộ để tải từ kho.'
                          : 'Không có hàng hóa phù hợp bộ lọc.'}
                      </td>
                    </tr>
                  ) : (
                    pagedGroups.map((group) => {
                      const selectedSku = getSelectedSku(group)
                      const stockQty = Number(stockBySkuId.get(selectedSku.id) ?? 0)
                      const reservedQty = Number(reservedBySkuId.get(selectedSku.id) ?? 0)
                      const isExpanded = expandedProductId === group.productId
                      const isFavorite = favoriteIds.has(String(group.productId))
                      const isSelected = selectedIds.has(String(selectedSku.id))
                      const isOut = stockQty <= 0
                      const isLow = stockQty > 0 && stockQty <= 5
                      const inBatch = isInBatch(selectedSku.id)
                      const hasMultipleSkus = group.skus.length > 1

                      return (
                        <Fragment key={group.productId}>
                          <tr
                            className={`cursor-pointer transition-colors hover:bg-[#f8faf8] ${isExpanded ? 'bg-[#f0f7f2] shadow-[inset_3px_0_0_0_#356647]' : ''
                              }`}
                          >
                            <td className="px-3 py-3" onClick={(event) => event.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleSelect(selectedSku.id)}
                                aria-label={`Chọn ${selectedSku.skuCode}`}
                              />
                            </td>
                            <td className="px-2 py-3" onClick={(event) => event.stopPropagation()}>
                              <button
                                type="button"
                                onClick={() => toggleFavorite(group.productId)}
                                className={`rounded p-1 ${isFavorite ? 'text-amber-500' : 'text-slate-300 hover:text-amber-400'}`}
                                aria-label={isFavorite ? 'Bỏ yêu thích' : 'Yêu thích'}
                              >
                                <span
                                  className="material-symbols-outlined text-[20px]"
                                  style={{ fontVariationSettings: isFavorite ? "'FILL' 1" : "'FILL' 0" }}
                                >
                                  star
                                </span>
                              </button>
                            </td>
                            <td className="px-2 py-3">
                              <button
                                type="button"
                                onClick={() => toggleExpand(group.productId)}
                                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-[#356647]"
                                aria-expanded={isExpanded}
                              >
                                <span
                                  className={`material-symbols-outlined text-[20px] transition-transform ${isExpanded ? 'rotate-90' : ''
                                    }`}
                                >
                                  chevron_right
                                </span>
                              </button>
                            </td>
                            <td className="px-2 py-3" onClick={() => toggleExpand(group.productId)}>
                              <ProductImage
                                src={selectedSku.imageUrl}
                                alt={group.productName}
                                className="h-10 w-10 rounded-lg"
                                iconClassName="text-lg"
                              />
                            </td>
                            <td
                              className="px-3 py-3 font-mono text-xs font-bold text-[#356647]"
                              onClick={() => toggleExpand(group.productId)}
                            >
                              {selectedSku.skuCode}
                            </td>
                            {/* Tên hàng — shows product name + variant selector when multiple SKUs */}
                            <td className="px-3 py-3" onClick={() => toggleExpand(group.productId)}>
                              <span className="block font-semibold text-slate-900">{group.productName}</span>
                              {hasMultipleSkus ? (
                                <select
                                  value={String(selectedSku.id)}
                                  onChange={(e) => {
                                    e.stopPropagation()
                                    selectSkuForProduct(group.productId, e.target.value)
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  className="mt-1 w-20 cursor-pointer rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-xs text-slate-600 outline-none focus:border-[#356647] focus:ring-1 focus:ring-[#356647]/20"
                                >
                                  {group.skus.map((sku) => (
                                    <option key={sku.id} value={String(sku.id)}>
                                      {sku.packagingType || sku.skuCode}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                selectedSku.packagingType ? (
                                  <span className="mt-0.5 block text-xs text-slate-400">{selectedSku.packagingType}</span>
                                ) : null
                              )}
                            </td>
                            <td
                              className="hidden px-3 py-3 text-slate-600 md:table-cell"
                              onClick={() => toggleExpand(group.productId)}
                            >
                              {selectedSku.categoryName || '—'}
                            </td>
                            <td
                              className="px-3 py-3 text-right font-medium text-slate-800"
                              onClick={() => toggleExpand(group.productId)}
                            >
                              {formatProductPrice(selectedSku.retailPrice || selectedSku.basePrice)}
                            </td>
                            <td
                              className="hidden px-3 py-3 text-right text-slate-600 lg:table-cell"
                              onClick={() => toggleExpand(group.productId)}
                            >
                              {formatProductPrice(selectedSku.costPrice)}
                            </td>
                            <td
                              className="hidden px-3 py-3 text-slate-600 xl:table-cell"
                              onClick={() => toggleExpand(group.productId)}
                            >
                              {selectedSku.packagingType || '—'}
                            </td>
                            <td
                              className={`px-3 py-3 text-right font-semibold ${isOut ? 'text-[#b42318]' : isLow ? 'text-[#7e5700]' : 'text-[#356647]'
                                }`}
                              onClick={() => toggleExpand(group.productId)}
                            >
                              {formatStockQuantity(stockQty)}
                              {reservedQty > 0 ? (
                                <span
                                  className="mt-0.5 block text-[11px] font-medium text-sky-700"
                                  title="Đang giữ chỗ cho đơn COD chờ xác nhận — tồn khả bán = tồn quầy − giữ chỗ"
                                >
                                  giữ chỗ {formatStockQuantity(reservedQty)} · khả bán{' '}
                                  {formatStockQuantity(Math.max(0, stockQty - reservedQty))}
                                </span>
                              ) : null}
                            </td>
                            <td
                              className="hidden px-3 py-3 text-center sm:table-cell"
                              onClick={() => toggleExpand(group.productId)}
                            >
                              {selectedSku.isSellable !== false ? (
                                <span className="text-emerald-700">Có</span>
                              ) : (
                                <span className="text-slate-400">Không</span>
                              )}
                            </td>
                            {canAdjustStock ? (
                              <td className="hidden px-3 py-3 text-right md:table-cell" onClick={(event) => event.stopPropagation()}>
                                <button
                                  type="button"
                                  onClick={() => toggleBatchSku(selectedSku)}
                                  className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold ${inBatch
                                      ? 'bg-[#356647]/10 text-[#356647]'
                                      : 'text-[#356647] hover:bg-[#356647]/5'
                                    }`}
                                >
                                  {inBatch ? 'Đã thêm' : 'Thêm vào lô'}
                                </button>
                              </td>
                            ) : null}
                          </tr>
                          {isExpanded ? (
                            <tr>
                              <td colSpan={tableColSpan} className="p-0">
                                <StoreProductExpandedLoader
                                  sku={selectedSku}
                                  stockBySkuId={stockBySkuId}
                                  canAdjustStock={canAdjustStock}
                                  inBatch={inBatch}
                                  isInBatch={isInBatch}
                                  onToggleBatchSku={() => toggleBatchSku(selectedSku)}
                                  onToggleBatchSkuItem={(item, meta) => toggleLine(item, meta)}
                                  onAddAllSkusToBatch={(skuList, productName) =>
                                    addAllSkusToBatch(skuList, productName)
                                  }
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
                itemLabel="sản phẩm"
              />
            </div>
          </div>
        </div>
      </div>

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
              <h2 className="text-base font-bold text-slate-900">Bộ lọc hàng hóa</h2>
              <button
                type="button"
                onClick={() => setMobileFiltersOpen(false)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                aria-label="Đóng"
              >
                <span className="material-symbols-outlined text-[22px]">close</span>
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar">
              <ProductsFilterContent {...filterProps} showFooterNote={false} />
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
    </PageShell>
  )
}
