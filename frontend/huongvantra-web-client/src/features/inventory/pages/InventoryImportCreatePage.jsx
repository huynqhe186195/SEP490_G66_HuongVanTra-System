import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import PageHeader from '../../../components/shared/PageHeader.jsx'
import PageShell from '../../../components/shared/PageShell.jsx'
import { showError, showSuccess } from '../../../app/toast.js'
import { formatStockQuantity } from '../../products/utils/productDisplay.js'
import { isSystemAdmin } from '../../auth/utils/permissions.js'
import { loadAuthSession } from '../../auth/services/authSession.js'
import { fetchAllActiveSkus } from '../../products/services/productSkusApi.js'
import { fetchProducts } from '../../products/services/productsApi.js'
import InventoryNavTabs from '../components/InventoryNavTabs.jsx'
import { fetchSkuStocks } from '../services/inventoryStockApi.js'
import { createSupplierReceipt, getSupplierReceiptTemplateUrl, submitSupplierReceipt } from '../services/supplierReceiptApi.js'

const EMPTY_HEADER = {
  supplierName: '',
  supplierReference: '',
  supplierDocumentNumber: '',
  supplierDocumentDate: '',
  receivedDate: new Date().toISOString().slice(0, 10),
  note: '',
}

function emptyLine() {
  return {
    key: crypto.randomUUID(),
    skuId: '',
    submittedQuantity: '',
    submittedUnit: '',
    unitCost: '',
    lotCode: '',
    manufacturedAt: '',
    expiresAt: '',
    qualityNote: '',
  }
}

async function fetchAllActiveProductsForImport() {
  const products = []
  let page = 1

  while (page <= 20) {
    const result = await fetchProducts({ page, pageSize: 100, isActive: true })
    products.push(...(result.items ?? []))
    const totalPages = Number(result.totalPages ?? 1) || 1
    if (page >= totalPages) break
    page += 1
  }

  return products
}

function getProductTypeLabel(productType) {
  if (productType === 'NGUYEN_LIEU') return 'Nguyên liệu'
  if (productType === 'BAO_BI') return 'Bao bì'
  if (productType === 'THANH_PHAM') return 'Sản phẩm kệ'
  return productType || 'Khác'
}

function getInventoryUnitLabel(unit) {
  return unit === 'Gram' ? 'g' : 'cái'
}

function defaultSubmittedUnit(unit) {
  return unit === 'Gram' ? 'kg' : 'piece'
}

function normalizeRole(role) {
  return String(role || '').trim().toLowerCase().replace(/[._-]+/g, ' ').replace(/\s+/g, ' ')
}

function canManageSupplierReceipt(session) {
  if (isSystemAdmin(session)) return true
  return (session?.roles ?? []).some((role) => ['manager', 'agency manager', 'branch manager', 'owner'].includes(normalizeRole(role)))
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

  const inputValue = isOpen || !sku ? query : getSkuDisplayText(sku)

  return (
    <div ref={wrapperRef} className="relative">
      <input
        type="text"
        disabled={disabled}
        className={`w-full rounded-xl border bg-white p-2.5 text-sm outline-none focus:ring-2 focus:ring-[#538463]/15 ${
          duplicate ? 'border-amber-300' : 'border-slate-200 focus:border-[#538463]'
        }`}
        value={inputValue}
        onChange={handleInputChange}
        onFocus={() => {
          setQuery(sku ? getSkuDisplayText(sku) : query)
          setIsOpen(true)
        }}
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
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                      item.productType === 'NGUYEN_LIEU'
                        ? 'bg-violet-100 text-violet-800'
                        : item.productType === 'BAO_BI'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-emerald-50 text-emerald-700'
                    }`}
                    >
                      {getProductTypeLabel(item.productType)}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                      {getInventoryUnitLabel(item.inventoryUnit)}
                    </span>
                  </div>
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
  const canManage = canManageSupplierReceipt(loadAuthSession())
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
      const inventoryUnitById = new Map(products.map((product) => [product.id, product.inventoryUnit]))
      const stockBySkuId = new Map(stocks.map((stock) => [stock.skuId, stock]))

      setSkus(
        skuItems
          .map((sku) => {
            const stock = stockBySkuId.get(sku.id)
            return {
              ...sku,
              productName: productNameById.get(sku.productId) || sku.productName || '',
              productType: productTypeById.get(sku.productId) || sku.productType || '',
              inventoryUnit: inventoryUnitById.get(sku.productId) || sku.inventoryUnit || 'Piece',
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
    const timer = setTimeout(loadSkus, 0)
    return () => clearTimeout(timer)
  }, [loadSkus])

  const skuById = useMemo(() => new Map(skus.map((sku) => [sku.id, sku])), [skus])

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
      showError('Chỉ Manager hoặc Admin được tạo phiếu nhập nhà cung cấp.')
      return
    }

    const payloadLines = []
    const usedLotCodes = new Set()
    for (const [index, line] of lines.entries()) {
      const submittedQuantity = Number(line.submittedQuantity)
      const unitCost = line.unitCost === '' || line.unitCost == null ? null : Number(line.unitCost)
      if (!line.skuId) {
        showError(`Chọn SKU cho dòng ${index + 1}.`)
        return
      }
      if (!Number.isFinite(submittedQuantity) || submittedQuantity <= 0) {
        showError(`Số lượng dòng ${index + 1} phải lớn hơn 0.`)
        return
      }
      if (unitCost != null && (!Number.isFinite(unitCost) || unitCost < 0)) {
        showError(`Giá vốn dòng ${index + 1} không hợp lệ.`)
        return
      }
      const lotCode = line.lotCode.trim().toUpperCase()
      if (!lotCode) {
        showError(`Nhập mã lô cho dòng ${index + 1}.`)
        return
      }
      if (usedLotCodes.has(lotCode)) {
        showError(`Mã lô ${lotCode} bị trùng trong cùng phiếu nhập.`)
        return
      }
      usedLotCodes.add(lotCode)
      const sku = skuById.get(line.skuId)
      if (!sku) {
        showError(`SKU dòng ${index + 1} không hợp lệ.`)
        return
      }
      payloadLines.push({
        skuId: line.skuId,
        skuCode: sku.skuCode,
        skuNameSnapshot: getSkuSnapshotName(sku),
        productTypeSnapshot: sku.productType,
        inventoryUnitSnapshot: sku.inventoryUnit,
        submittedUnit: line.submittedUnit || defaultSubmittedUnit(sku.inventoryUnit),
        submittedQuantity,
        unitCost,
        lotCode,
        manufacturedAt: line.manufacturedAt ? new Date(`${line.manufacturedAt}T00:00:00`).toISOString() : null,
        expiresAt: line.expiresAt ? new Date(`${line.expiresAt}T00:00:00`).toISOString() : null,
        qualityNote: line.qualityNote,
      })
    }

    if (payloadLines.length === 0) {
      showError('Thêm ít nhất một dòng SKU với số lượng > 0.')
      return
    }

    setIsSaving(true)
    try {
      const receipt = await createSupplierReceipt({
        supplierName: header.supplierName,
        supplierReference: header.supplierReference,
        supplierDocumentNumber: header.supplierDocumentNumber,
        supplierDocumentDate: header.supplierDocumentDate
          ? new Date(`${header.supplierDocumentDate}T00:00:00`).toISOString()
          : null,
        receivedDate: header.receivedDate ? new Date(`${header.receivedDate}T00:00:00`).toISOString() : null,
        note: header.note,
        items: payloadLines,
      })
      const submitted = await submitSupplierReceipt(receipt.id)
      showSuccess(`Đã gửi phiếu nhập ${submitted.receiptCode} chờ duyệt. Tồn kho chưa thay đổi trước khi duyệt.`)
      navigate('/inventory/supplier-receipts')
    } catch (error) {
      showError(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <PageShell>
      <PageHeader
        title="Phiếu nhập nhà cung cấp"
        description="Tạo chứng từ nhập hàng vào Kho. Tồn kho chỉ tăng sau khi phiếu được duyệt."
        rightContent={<InventoryNavTabs />}
      />

      {!canManage ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Chỉ Manager hoặc Admin được tạo phiếu nhập nhà cung cấp.
        </p>
      ) : null}

      <form className="grid grid-cols-1 gap-6 xl:grid-cols-3" onSubmit={handleSubmit}>
        <section className="rounded-2xl bg-white p-6 shadow-sm sm:p-8 xl:col-span-2">
          <h2 className="mb-6 text-lg font-bold text-slate-800">Thông tin nhà cung cấp</h2>
          <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-xs font-semibold text-[#717971]">Nhà cung cấp</span>
              <input
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm"
                value={header.supplierName}
                onChange={(event) => setHeader((prev) => ({ ...prev, supplierName: event.target.value }))}
              />
            </label>
            <label className="space-y-2">
              <span className="text-xs font-semibold text-[#717971]">Mã NCC / tham chiếu</span>
              <input
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm"
                value={header.supplierReference}
                onChange={(event) => setHeader((prev) => ({ ...prev, supplierReference: event.target.value }))}
              />
            </label>
            <label className="space-y-2">
              <span className="text-xs font-semibold text-[#717971]">Số hóa đơn/chứng từ NCC</span>
              <input
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm"
                value={header.supplierDocumentNumber}
                onChange={(event) => setHeader((prev) => ({ ...prev, supplierDocumentNumber: event.target.value }))}
              />
            </label>
            <label className="space-y-2">
              <span className="text-xs font-semibold text-[#717971]">Ngày chứng từ NCC</span>
              <input
                type="date"
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm"
                value={header.supplierDocumentDate}
                onChange={(event) => setHeader((prev) => ({ ...prev, supplierDocumentDate: event.target.value }))}
              />
            </label>
            <label className="space-y-2">
              <span className="text-xs font-semibold text-[#717971]">Ngày nhận hàng</span>
              <input
                type="date"
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm"
                value={header.receivedDate}
                onChange={(event) => setHeader((prev) => ({ ...prev, receivedDate: event.target.value }))}
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
            <h2 className="text-lg font-bold text-slate-800">Dòng hàng nhập</h2>
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
                      duplicate={false}
                      onSelect={(sku) => updateLine(line.key, {
                        skuId: sku?.id ?? '',
                        submittedUnit: sku ? defaultSubmittedUnit(sku.inventoryUnit) : '',
                      })}
                      sku={selectedSku}
                      skus={skus}
                    />
                  </label>
                  <label className="space-y-1 md:col-span-2">
                    <span className="text-xs font-semibold text-[#717971]">Mã lô *</span>
                    <input
                      className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-sm uppercase"
                      value={line.lotCode}
                      onChange={(event) => updateLine(line.key, { lotCode: event.target.value })}
                    />
                  </label>
                  <label className="space-y-1 md:col-span-2">
                    <span className="text-xs font-semibold text-[#717971]">Số lượng *</span>
                    <input
                      type="number"
                      min="0"
                      step="0.001"
                      className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-sm"
                      value={line.submittedQuantity}
                      onChange={(event) => updateLine(line.key, { submittedQuantity: event.target.value })}
                    />
                  </label>
                  <label className="space-y-1 md:col-span-1">
                    <span className="text-xs font-semibold text-[#717971]">Đơn vị</span>
                    <select
                      className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-sm"
                      value={line.submittedUnit || defaultSubmittedUnit(selectedSku?.inventoryUnit)}
                      onChange={(event) => updateLine(line.key, { submittedUnit: event.target.value })}
                    >
                      {selectedSku?.inventoryUnit === 'Gram' ? (
                        <>
                          <option value="kg">kg</option>
                          <option value="g">g</option>
                        </>
                      ) : (
                        <option value="piece">cái</option>
                      )}
                    </select>
                  </label>
                  <label className="space-y-1 md:col-span-2">
                    <span className="text-xs font-semibold text-[#717971]">Ngày SX</span>
                    <input
                      type="date"
                      className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-sm"
                      value={line.manufacturedAt}
                      onChange={(event) => updateLine(line.key, { manufacturedAt: event.target.value })}
                    />
                  </label>
                  <label className="space-y-1 md:col-span-2">
                    <span className="text-xs font-semibold text-[#717971]">Hạn dùng</span>
                    <input
                      type="date"
                      className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-sm"
                      value={line.expiresAt}
                      onChange={(event) => updateLine(line.key, { expiresAt: event.target.value })}
                    />
                  </label>
                  <label className="space-y-1 md:col-span-3">
                    <span className="text-xs font-semibold text-[#717971]">Giá vốn / đơn vị gốc</span>
                    <input
                      type="number"
                      min="0"
                      className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-sm"
                      value={line.unitCost}
                      onChange={(event) => updateLine(line.key, { unitCost: event.target.value })}
                    />
                  </label>
                  <label className="space-y-1 md:col-span-7">
                    <span className="text-xs font-semibold text-[#717971]">Ghi chú chất lượng</span>
                    <input
                      className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-sm"
                      value={line.qualityNote}
                      onChange={(event) => updateLine(line.key, { qualityNote: event.target.value })}
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
              {isSaving ? 'Đang gửi...' : 'Gửi duyệt phiếu nhập'}
            </button>
            <Link
              to="/inventory/supplier-receipts"
              className="rounded-xl border border-slate-200 px-6 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Xem phiếu nhập NCC
            </Link>
          </div>
        </section>

        <aside className="h-fit rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-bold text-slate-800">Lưu ý</h2>
          <ul className="space-y-2 text-sm text-slate-600">
            <li>Mỗi dòng nhập có một mã lô riêng.</li>
            <li>Phiếu gửi duyệt chưa làm tăng tồn Kho.</li>
            <li>Khi duyệt, hệ thống tạo batch, phiếu nhập kho và ledger cùng transaction.</li>
            <li>Người tạo phiếu không được tự duyệt phiếu của mình.</li>
          </ul>
          <a
            href={getSupplierReceiptTemplateUrl()}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
            Tải mẫu CSV
          </a>
        </aside>
      </form>
    </PageShell>
  )
}

export default InventoryImportCreatePage
