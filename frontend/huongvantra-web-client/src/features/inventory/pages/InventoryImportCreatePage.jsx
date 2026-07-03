import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import PageHeader from '../../../components/shared/PageHeader.jsx'
import PageShell from '../../../components/shared/PageShell.jsx'
import { showError, showSuccess } from '../../../app/toast.js'
import { formatStockQuantity } from '../../products/utils/productDisplay.js'
import { canCreateCatalog } from '../../auth/utils/permissions.js'
import { loadAuthSession } from '../../auth/services/authSession.js'
import { fetchAllActiveSkus } from '../../products/services/productSkusApi.js'
import { fetchProducts } from '../../products/services/productsApi.js'
import InventoryNavTabs from '../components/InventoryNavTabs.jsx'
import { fetchSkuStocks } from '../services/inventoryStockApi.js'
import { createWarehouseBatch } from '../services/warehouseBatchApi.js'
import { notifyInventoryStockChanged } from '../utils/inventoryStockEvents.js'

const EMPTY_HEADER = {
  lotCode: '',
  supplier: '',
  expiresAt: '',
  note: '',
}

function emptyLine() {
  return { key: crypto.randomUUID(), skuId: '', quantity: '', unitCost: '' }
}

async function fetchAllActiveProductsForImport() {
  const products = []
  let page = 1
  let totalPages = 1

  do {
    const result = await fetchProducts({ page, pageSize: 100, isActive: true })
    products.push(...(result.items ?? []))
    totalPages = Number(result.totalPages ?? 1) || 1
    page += 1
  } while (page <= totalPages && page <= 20)

  return products
}

function getProductTypeLabel(productType) {
  if (productType === 'NGUYEN_LIEU') return 'Nguyên liệu'
  if (productType === 'THANH_PHAM') return 'Thành phẩm'
  return productType || 'Khác'
}

function getSkuSnapshotName(sku) {
  return [sku?.productName, sku?.variantName || sku?.packagingType].filter(Boolean).join(' - ') || sku?.skuCode || ''
}

function getSkuDisplayText(sku) {
  if (!sku) return ''
  return [sku.skuCode, getSkuSnapshotName(sku)].filter(Boolean).join(' - ')
}

function normalizeSearch(value) {
  return String(value || '').trim().toLowerCase()
}

function matchesSkuSearch(sku, query) {
  const keyword = normalizeSearch(query)
  if (!keyword) return true
  return [
    sku.skuCode,
    sku.productName,
    sku.variantName,
    sku.packagingType,
    sku.categoryName,
  ].some((value) => normalizeSearch(value).includes(keyword))
}

function sortSkuOptions(left, right) {
  const typeCompare = String(left.productType || '').localeCompare(String(right.productType || ''), 'vi')
  if (typeCompare !== 0) return typeCompare
  const productCompare = String(left.productName || '').localeCompare(String(right.productName || ''), 'vi')
  if (productCompare !== 0) return productCompare
  return String(left.skuCode || '').localeCompare(String(right.skuCode || ''), 'vi')
}

function SkuSearchPicker({ disabled, duplicate, onSelect, sku, skus }) {
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const wrapperRef = useRef(null)

  useEffect(() => {
    if (sku) {
      setQuery(getSkuDisplayText(sku))
    } else if (!isOpen) {
      setQuery('')
    }
  }, [sku, isOpen])

  useEffect(() => {
    function handlePointerDown(event) {
      if (!wrapperRef.current?.contains(event.target)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [])

  const results = useMemo(
    () => skus.filter((item) => matchesSkuSearch(item, query)).slice(0, 30),
    [query, skus],
  )

  function handleInputChange(event) {
    setQuery(event.target.value)
    setIsOpen(true)
    if (sku) onSelect(null)
  }

  function handleSelect(item) {
    onSelect(item)
    setQuery(getSkuDisplayText(item))
    setIsOpen(false)
  }

  return (
    <div ref={wrapperRef} className="relative">
      <input
        type="text"
        disabled={disabled}
        className={`w-full rounded-xl border bg-white p-2.5 text-sm outline-none focus:ring-2 focus:ring-[#538463]/15 ${
          duplicate ? 'border-amber-300' : 'border-slate-200 focus:border-[#538463]'
        }`}
        value={query}
        onChange={handleInputChange}
        onFocus={() => setIsOpen(true)}
        placeholder={disabled ? 'Đang tải SKU...' : 'Tìm SKU hoặc tên sản phẩm'}
      />
      {duplicate ? (
        <p className="mt-1 text-xs font-medium text-amber-700">SKU này đã có trong lô nhập.</p>
      ) : null}

      {isOpen && !disabled ? (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-80 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
          {results.length === 0 ? (
            <p className="px-3 py-3 text-sm text-slate-500">Không tìm thấy SKU phù hợp.</p>
          ) : (
            results.map((item) => (
              <button
                key={item.id}
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault()
                  handleSelect(item)
                }}
                className="block w-full rounded-lg px-3 py-2 text-left hover:bg-[#f3f7f4]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-sm font-bold text-[#356647]">{item.skuCode}</p>
                    <p className="mt-0.5 text-sm font-medium text-slate-800">{getSkuSnapshotName(item)}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                    item.productType === 'NGUYEN_LIEU'
                      ? 'bg-violet-100 text-violet-800'
                      : 'bg-emerald-50 text-emerald-700'
                  }`}
                  >
                    {getProductTypeLabel(item.productType)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Tồn kho tổng: <span className="font-semibold text-slate-700">{formatStockQuantity(item.warehouseQuantityOnHand)}</span>
                  <span className="mx-1.5 text-slate-300">|</span>
                  Tồn quầy: <span className="font-semibold text-slate-700">{formatStockQuantity(item.quantityOnHand)}</span>
                </p>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  )
}

function InventoryImportCreatePage() {
  const navigate = useNavigate()
  const canManage = canCreateCatalog(loadAuthSession())
  const [skus, setSkus] = useState([])
  const [header, setHeader] = useState(EMPTY_HEADER)
  const [lines, setLines] = useState([emptyLine()])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  const loadSkus = useCallback(async () => {
    setIsLoading(true)
    try {
      const [skuItems, products, stocks] = await Promise.all([
        fetchAllActiveSkus(),
        fetchAllActiveProductsForImport(),
        fetchSkuStocks(),
      ])
      const productNameById = new Map(products.map((product) => [product.id, product.name]))
      const productTypeById = new Map(products.map((product) => [product.id, product.productType]))
      const stockBySkuId = new Map(stocks.map((stock) => [stock.skuId, stock]))

      setSkus(
        skuItems
          .map((sku) => {
            const stock = stockBySkuId.get(sku.id)
            return {
              ...sku,
              productName: productNameById.get(sku.productId) || sku.productName || '',
              productType: productTypeById.get(sku.productId) || sku.productType || '',
              warehouseQuantityOnHand: stock?.warehouseQuantityOnHand ?? 0,
              quantityOnHand: stock?.quantityOnHand ?? 0,
            }
          })
          .sort(sortSkuOptions),
      )
    } catch (error) {
      setSkus([])
      showError(error.message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadSkus()
  }, [loadSkus])

  const skuById = useMemo(() => new Map(skus.map((sku) => [sku.id, sku])), [skus])
  const duplicateSkuIds = useMemo(() => {
    const counts = new Map()
    for (const line of lines) {
      if (!line.skuId) continue
      counts.set(line.skuId, (counts.get(line.skuId) ?? 0) + 1)
    }
    return new Set([...counts.entries()].filter(([, count]) => count > 1).map(([skuId]) => skuId))
  }, [lines])

  function updateLine(key, patch) {
    setLines((prev) => prev.map((line) => (line.key === key ? { ...line, ...patch } : line)))
  }

  function addLine() {
    setLines((prev) => [...prev, emptyLine()])
  }

  function removeLine(key) {
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((line) => line.key !== key)))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (!canManage) {
      showError('Chỉ Thủ kho được nhập nguyên liệu.')
      return
    }
    if (!header.lotCode.trim()) {
      showError('Nhập mã lô.')
      return
    }

    const payloadLines = []
    const usedSkuIds = new Set()
    for (const [index, line] of lines.entries()) {
      const quantity = Number(line.quantity)
      const unitCost = line.unitCost === '' || line.unitCost == null ? null : Number(line.unitCost)
      if (!line.skuId) {
        showError(`Chọn SKU cho dòng ${index + 1}.`)
        return
      }
      if (!Number.isFinite(quantity) || quantity <= 0) {
        showError(`Số lượng dòng ${index + 1} phải lớn hơn 0.`)
        return
      }
      if (unitCost != null && (!Number.isFinite(unitCost) || unitCost < 0)) {
        showError(`Giá vốn dòng ${index + 1} không hợp lệ.`)
        return
      }
      if (usedSkuIds.has(line.skuId)) {
        showError('Mỗi SKU chỉ được xuất hiện một lần trong cùng lô.')
        return
      }
      usedSkuIds.add(line.skuId)
      const sku = skuById.get(line.skuId)
      if (!sku) {
        showError(`SKU dòng ${index + 1} không hợp lệ.`)
        return
      }
      payloadLines.push({
        skuId: line.skuId,
        skuCode: sku.skuCode,
        productSnapshotName: getSkuSnapshotName(sku),
        quantity,
        unitCost,
      })
    }

    if (payloadLines.length === 0) {
      showError('Thêm ít nhất một dòng SKU với số lượng > 0.')
      return
    }

    setIsSaving(true)
    try {
      await createWarehouseBatch({
        lotCode: header.lotCode,
        supplier: header.supplier,
        expiresAt: header.expiresAt ? new Date(`${header.expiresAt}T00:00:00`).toISOString() : null,
        note: header.note,
        items: payloadLines,
      })
      const totalQty = payloadLines.reduce((sum, line) => sum + line.quantity, 0)
      showSuccess(
        `Đã nhập nguyên liệu lô ${header.lotCode.trim().toUpperCase()} - ${payloadLines.length} SKU, tổng ${totalQty} đơn vị.`,
      )
      notifyInventoryStockChanged()
      navigate('/inventory/import')
    } catch (error) {
      showError(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <PageShell>
      <PageHeader
        title="Nhập nguyên liệu vào kho"
        description="Tạo lô nhập kho tổng và tự sinh phiếu nhập kho cho các SKU đã chọn."
        rightContent={<InventoryNavTabs />}
      />

      {!canManage ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Chỉ tài khoản Thủ kho được nhập nguyên liệu.
        </p>
      ) : null}

      <form className="grid grid-cols-1 gap-6 xl:grid-cols-3" onSubmit={handleSubmit}>
        <section className="rounded-2xl bg-white p-6 shadow-sm sm:p-8 xl:col-span-2">
          <h2 className="mb-6 text-lg font-bold text-slate-800">Thông tin nhập nguyên liệu</h2>
          <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-xs font-semibold text-[#717971]">Mã lô *</span>
              <input
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm uppercase"
                placeholder="VD: LO-A05"
                value={header.lotCode}
                onChange={(event) => setHeader((prev) => ({ ...prev, lotCode: event.target.value }))}
              />
            </label>
            <label className="space-y-2">
              <span className="text-xs font-semibold text-[#717971]">Nhà cung cấp</span>
              <input
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm"
                value={header.supplier}
                onChange={(event) => setHeader((prev) => ({ ...prev, supplier: event.target.value }))}
              />
            </label>
            <label className="space-y-2">
              <span className="text-xs font-semibold text-[#717971]">Hạn sử dụng</span>
              <input
                type="date"
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm"
                value={header.expiresAt}
                onChange={(event) => setHeader((prev) => ({ ...prev, expiresAt: event.target.value }))}
              />
            </label>
            <label className="space-y-2 md:col-span-2">
              <span className="text-xs font-semibold text-[#717971]">Ghi chú</span>
              <textarea
                className="min-h-[60px] w-full rounded-xl border border-slate-200 bg-white p-3 text-sm"
                value={header.note}
                onChange={(event) => setHeader((prev) => ({ ...prev, note: event.target.value }))}
              />
            </label>
          </div>

          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-800">Danh sách SKU trong lô</h2>
            <button
              type="button"
              onClick={addLine}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              + Thêm dòng
            </button>
          </div>

          <div className="space-y-3">
            {lines.map((line, index) => {
              const selectedSku = skuById.get(line.skuId) ?? null
              return (
                <div
                  key={line.key}
                  className="grid grid-cols-1 gap-3 rounded-xl border border-slate-100 bg-slate-50/50 p-4 md:grid-cols-12"
                >
                  <label className="space-y-1 md:col-span-5">
                    <span className="text-xs font-semibold text-[#717971]">SKU *</span>
                    <SkuSearchPicker
                      disabled={isLoading}
                      duplicate={Boolean(line.skuId && duplicateSkuIds.has(line.skuId))}
                      onSelect={(sku) => updateLine(line.key, { skuId: sku?.id ?? '' })}
                      sku={selectedSku}
                      skus={skus}
                    />
                  </label>
                  <label className="space-y-1 md:col-span-2">
                    <span className="text-xs font-semibold text-[#717971]">SL *</span>
                    <input
                      type="number"
                      min="1"
                      className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-sm"
                      value={line.quantity}
                      onChange={(event) => updateLine(line.key, { quantity: event.target.value })}
                    />
                  </label>
                  <label className="space-y-1 md:col-span-3">
                    <span className="text-xs font-semibold text-[#717971]">Giá vốn / đv</span>
                    <input
                      type="number"
                      min="0"
                      className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-sm"
                      value={line.unitCost}
                      onChange={(event) => updateLine(line.key, { unitCost: event.target.value })}
                    />
                  </label>
                  <div className="flex items-end md:col-span-2">
                    {lines.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => removeLine(line.key)}
                        className="rounded-lg px-2 py-2 text-sm text-red-600 hover:bg-red-50"
                      >
                        Xóa dòng {index + 1}
                      </button>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={isSaving || !canManage}
              className="rounded-xl bg-[#538463] px-6 py-2.5 text-sm font-bold text-white hover:bg-[#457053] disabled:opacity-50"
            >
              {isSaving ? 'Đang lưu...' : 'Nhập nguyên liệu vào kho'}
            </button>
            <Link
              to="/inventory/import"
              className="rounded-xl border border-slate-200 px-6 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Xem phiếu nhập
            </Link>
          </div>
        </section>

        <aside className="h-fit rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-bold text-slate-800">Lưu ý</h2>
          <ul className="space-y-2 text-sm text-slate-600">
            <li>Một mã lô có thể gồm nhiều SKU.</li>
            <li>Mỗi SKU chỉ xuất hiện một lần trong cùng lô.</li>
            <li>Phiếu nhập kho sẽ được tạo tự động sau khi lưu lô.</li>
            <li>Thành phẩm sau sản xuất vẫn được tạo từ lô sản xuất, không đổi luồng hiện tại.</li>
          </ul>
        </aside>
      </form>
    </PageShell>
  )
}

export default InventoryImportCreatePage
