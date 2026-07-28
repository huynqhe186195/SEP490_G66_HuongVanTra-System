import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import PageHeader from '../../../components/shared/PageHeader.jsx'
import PageShell from '../../../components/shared/PageShell.jsx'
import { showError, showSuccess } from '../../../app/toast.js'
import { formatStockQuantity } from '../../products/utils/productDisplay.js'
import { canOperateSupplierReceipt } from '../../auth/utils/permissions.js'
import { loadAuthSession } from '../../auth/services/authSession.js'
import { fetchAllActiveSkus } from '../../products/services/productSkusApi.js'
import { fetchProducts } from '../../products/services/productsApi.js'
import { fetchSkuStocks } from '../services/inventoryStockApi.js'
import { createSupplierReceipt, getSupplierReceiptTemplateUrl, submitSupplierReceipt } from '../services/supplierReceiptApi.js'
import { fetchActiveSuppliers } from '../services/suppliersApi.js'

const EMPTY_HEADER = {
  supplierId: '',
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

function getSkuSnapshotName(sku) {
  return sku?.productName || sku?.skuCode || ''
}

function getSkuDisplayText(sku) {
  if (!sku) return ''
  return getSkuSnapshotName(sku)
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

const DOC_NUMBER_REGEX = /^[A-Za-z0-9\-/.]{1,100}$/

function stripHtml(value) {
  return String(value || '').replace(/<[^>]*>/g, '').replace(/&[a-zA-Z0-9#]+;/g, ' ').trim()
}

function SupplierSearchPicker({ disabled, onSelect, supplierId, supplierName, suppliers, hasError }) {
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

  const results = useMemo(() => {
    const keyword = normalizeSearch(query)
    return suppliers
      .filter((item) => {
        if (!keyword) return true
        return [item.name, item.phone, item.email].some((value) => normalizeSearch(value).includes(keyword))
      })
      .slice(0, 30)
  }, [query, suppliers])

  function handleInputChange(event) {
    setQuery(event.target.value)
    setIsOpen(true)
    if (supplierId) onSelect(null)
  }

  function handleSelect(item) {
    onSelect(item)
    setQuery(item.name)
    setIsOpen(false)
  }

  const inputValue = isOpen || !supplierId ? query : supplierName

  return (
    <div ref={wrapperRef} className="relative">
      <input
        type="text"
        disabled={disabled}
        className={`w-full rounded-xl border p-3 text-sm outline-none focus:ring-2 ${hasError ? 'border-red-400 bg-red-50 focus:border-red-400 focus:ring-red-200' : 'border-slate-200 bg-white focus:border-[#538463] focus:ring-[#538463]/15'}`}
        value={inputValue}
        onChange={handleInputChange}
        onFocus={() => {
          setQuery(supplierId ? supplierName : query)
          setIsOpen(true)
        }}
        placeholder={disabled ? 'Đang tải nhà cung cấp...' : 'Gõ để tìm nhà cung cấp'}
      />

      {isOpen && !disabled ? (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-80 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
          {results.length === 0 ? (
            <p className="px-3 py-3 text-sm text-slate-500">Không tìm thấy nhà cung cấp phù hợp.</p>
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
                <p className="text-sm font-semibold text-slate-800">{item.name}</p>
                {item.phone || item.email ? (
                  <p className="mt-0.5 text-xs text-slate-500">
                    {[item.phone, item.email].filter(Boolean).join(' · ')}
                  </p>
                ) : null}
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  )
}

function SkuSearchPicker({ disabled, duplicate, hasError, onSelect, sku, skus }) {
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
        className={`w-full rounded-xl border bg-white p-2.5 text-sm outline-none focus:ring-2 ${
          hasError ? 'border-red-400 bg-red-50 focus:ring-red-200' : duplicate ? 'border-amber-300 focus:ring-[#538463]/15' : 'border-slate-200 focus:border-[#538463] focus:ring-[#538463]/15'
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
  const canManage = canOperateSupplierReceipt(loadAuthSession())
  const [skus, setSkus] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [header, setHeader] = useState(EMPTY_HEADER)
  const [lines, setLines] = useState([emptyLine()])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [headerErrors, setHeaderErrors] = useState({})
  const [lineErrors, setLineErrors] = useState({})
  const [lineWarnings, setLineWarnings] = useState({})
  const errorSummaryRef = useRef(null)
  const today = new Date().toISOString().slice(0, 10)

  const loadSkus = useCallback(async () => {
    setIsLoading(true)
    try {
      const [skuItems, products, stocks, activeSuppliers] = await Promise.all([
        fetchAllActiveSkus(),
        fetchAllActiveProductsForImport(),
        fetchSkuStocks(),
        fetchActiveSuppliers(),
      ])
      setSuppliers(activeSuppliers)
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

  function validateHeader() {
    const errors = {}
    if (!header.supplierId) errors.supplierId = 'Vui lòng chọn nhà cung cấp.'
    if (!header.supplierReference.trim()) {
      errors.supplierReference = 'Mã NCC / tham chiếu không được để trống.'
    } else if (header.supplierReference.trim().length > 100) {
      errors.supplierReference = 'Mã NCC / tham chiếu không được vượt quá 100 ký tự.'
    }
    if (!header.supplierDocumentNumber.trim()) {
      errors.supplierDocumentNumber = 'Số hóa đơn / chứng từ NCC không được để trống.'
    } else if (header.supplierDocumentNumber.trim().length > 100) {
      errors.supplierDocumentNumber = 'Số chứng từ không được vượt quá 100 ký tự.'
    } else if (!DOC_NUMBER_REGEX.test(header.supplierDocumentNumber.trim())) {
      errors.supplierDocumentNumber = 'Số chứng từ chỉ được chứa chữ cái, số và ký tự - / .'
    }
    if (!header.supplierDocumentDate) {
      errors.supplierDocumentDate = 'Ngày chứng từ NCC không được để trống.'
    } else if (header.supplierDocumentDate > today) {
      errors.supplierDocumentDate = 'Ngày chứng từ không được là ngày tương lai.'
    }
    if (!header.receivedDate) {
      errors.receivedDate = 'Ngày nhận hàng không được để trống.'
    } else if (header.supplierDocumentDate && header.receivedDate < header.supplierDocumentDate) {
      errors.receivedDate = 'Ngày nhận hàng không thể trước ngày chứng từ NCC.'
    }
    if (header.note.length > 500) {
      errors.note = 'Ghi chú không được vượt quá 500 ký tự.'
    }
    setHeaderErrors(errors)
    return Object.keys(errors).length === 0
  }

  const LOT_CODE_REGEX = /^[A-Z0-9\-_]{1,50}$/

  function validateLines() {
    const errors = {}
    const warnings = {}
    const usedKeys = new Set()
    let valid = true

    for (const [, line] of lines.entries()) {
      const lineErr = {}
      const lineWarn = {}
      const qty = Number(line.submittedQuantity)
      const cost = line.unitCost === '' || line.unitCost == null ? null : Number(line.unitCost)
      const lotCode = line.lotCode.trim().toUpperCase()
      const dupKey = `${line.skuId}__${lotCode}`

      // SKU
      if (!line.skuId) lineErr.skuId = 'Vui lòng chọn SKU.'

      // Đơn vị phải hợp lệ theo inventoryUnit của SKU (B12)
      const sku = skuById.get(line.skuId)
      if (sku && line.submittedUnit) {
        const isGram = sku.inventoryUnit === 'Gram'
        const validUnits = isGram ? ['kg', 'g'] : ['piece']
        if (!validUnits.includes(line.submittedUnit)) {
          lineErr.submittedUnit = `Đơn vị "${line.submittedUnit}" không hợp lệ cho SKU đơn vị ${isGram ? 'Gram (kg/g)' : 'Piece (cái)'}.`
        }
      }

      // Mã lô: required + format + max length + trùng
      if (!lotCode) {
        lineErr.lotCode = 'Mã lô không được để trống.'
      } else if (lotCode.length > 50) {
        lineErr.lotCode = 'Mã lô không được vượt quá 50 ký tự.'
      } else if (!LOT_CODE_REGEX.test(lotCode)) {
        lineErr.lotCode = 'Mã lô chỉ được chứa chữ cái A-Z, số 0-9, dấu gạch ngang (-) và gạch dưới (_).'
      } else if (usedKeys.has(dupKey)) {
        lineErr.lotCode = `Mã lô "${lotCode}" trùng với dòng khác trong cùng phiếu. Hãy gộp lại thành một dòng.`
      } else {
        usedKeys.add(dupKey)
      }

      // Số lượng
      if (line.submittedQuantity === '' || line.submittedQuantity == null) {
        lineErr.submittedQuantity = 'Số lượng không được để trống.'
      } else if (!Number.isFinite(qty) || qty <= 0) {
        lineErr.submittedQuantity = 'Số lượng phải lớn hơn 0.'
      }

      // Giá vốn
      if (cost !== null && (!Number.isFinite(cost) || cost < 0)) {
        lineErr.unitCost = 'Giá vốn không được âm.'
      }

      // Ngày SX
      if (line.manufacturedAt) {
        if (line.manufacturedAt > today) {
          lineErr.manufacturedAt = 'Ngày sản xuất không được là ngày tương lai.'
        } else if (header.receivedDate && line.manufacturedAt > header.receivedDate) {
          lineErr.manufacturedAt = 'Ngày sản xuất không thể sau ngày nhận hàng.'
        }
      }

      // Hạn dùng
      if (line.expiresAt) {
        if (line.manufacturedAt && line.expiresAt <= line.manufacturedAt) {
          lineErr.expiresAt = 'Hạn dùng phải sau ngày sản xuất.'
        } else if (header.receivedDate && line.expiresAt <= header.receivedDate) {
          lineErr.expiresAt = 'Hàng đã hết hạn tại ngày nhận. Không thể nhập kho.'
        }
      }

      // Ghi chú chất lượng max length
      if (line.qualityNote && line.qualityNote.length > 300) {
        lineErr.qualityNote = 'Ghi chú chất lượng không được vượt quá 300 ký tự.'
      }

      // Warnings (không chặn lưu)
      if (cost === 0) {
        lineWarn.unitCost = 'Giá vốn bằng 0 — sẽ ảnh hưởng đến báo cáo tài chính.'
      }
      if (line.expiresAt && header.receivedDate) {
        const daysLeft = Math.ceil((new Date(line.expiresAt) - new Date(header.receivedDate)) / 86400000)
        if (daysLeft > 0 && daysLeft <= 30) {
          lineWarn.expiresAt = `Hàng chỉ còn ${daysLeft} ngày đến hạn dùng tính từ ngày nhận.`
        }
      }
      if (line.manufacturedAt && header.receivedDate) {
        const monthsOld = Math.floor((new Date(header.receivedDate) - new Date(line.manufacturedAt)) / (86400000 * 30))
        if (monthsOld > 18) {
          lineWarn.manufacturedAt = `Hàng được sản xuất cách đây ${monthsOld} tháng — kiểm tra chất lượng trước khi nhập kho.`
        }
      }

      if (Object.keys(lineErr).length > 0) {
        errors[line.key] = lineErr
        valid = false
      }
      if (Object.keys(lineWarn).length > 0) warnings[line.key] = lineWarn
    }

    setLineErrors(errors)
    setLineWarnings(warnings)
    return valid
  }

  async function saveReceipt(submitForApproval) {
    if (!canManage) {
      showError('Chỉ Thủ kho được tạo hoặc gửi phiếu nhập nhà cung cấp.')
      return
    }
    const headerOk = validateHeader()
    const linesOk = validateLines()
    if (!headerOk || !linesOk) {
      setTimeout(() => {
        const firstError = document.querySelector('[data-error="true"]')
        if (firstError) {
          firstError.scrollIntoView({ behavior: 'smooth', block: 'center' })
          const focusable = firstError.querySelector('input, select, textarea')
          focusable?.focus()
        }
      }, 50)
      return
    }

    const payloadLines = lines.map((line) => {
      const sku = skuById.get(line.skuId)
      return {
        skuId: line.skuId,
        skuCode: sku.skuCode,
        skuNameSnapshot: getSkuSnapshotName(sku),
        productTypeSnapshot: sku.productType,
        inventoryUnitSnapshot: sku.inventoryUnit,
        submittedUnit: line.submittedUnit || defaultSubmittedUnit(sku.inventoryUnit),
        submittedQuantity: Number(line.submittedQuantity),
        unitCost: line.unitCost === '' || line.unitCost == null ? null : Number(line.unitCost),
        lotCode: line.lotCode.trim().toUpperCase(),
        manufacturedAt: line.manufacturedAt ? new Date(`${line.manufacturedAt}T00:00:00`).toISOString() : null,
        expiresAt: line.expiresAt ? new Date(`${line.expiresAt}T00:00:00`).toISOString() : null,
        qualityNote: stripHtml(line.qualityNote),
      }
    })

    setIsSaving(true)
    try {
      const receipt = await createSupplierReceipt({
        supplierId: header.supplierId,
        supplierName: header.supplierName,
        supplierReference: header.supplierReference,
        supplierDocumentNumber: header.supplierDocumentNumber,
        supplierDocumentDate: header.supplierDocumentDate
          ? new Date(`${header.supplierDocumentDate}T00:00:00`).toISOString()
          : null,
        receivedDate: header.receivedDate ? new Date(`${header.receivedDate}T00:00:00`).toISOString() : null,
        note: stripHtml(header.note),
        items: payloadLines,
      })
      if (submitForApproval) {
        const submitted = await submitSupplierReceipt(receipt.id)
        showSuccess(`Đã gửi phiếu ${submitted.receiptCode} chờ duyệt. Tồn kho chỉ tăng sau khi phiếu được duyệt.`)
      } else {
        showSuccess(`Đã lưu nháp phiếu ${receipt.receiptCode}. Phiếu chưa ảnh hưởng tồn kho.`)
      }
      navigate('/inventory/supplier-receipts')
    } catch (error) {
      showError(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  function handleSubmit(event) {
    event.preventDefault()
    return saveReceipt(true)
  }

  return (
    <PageShell>
      <PageHeader
        title="Phiếu nhập nhà cung cấp"
        titleInfo="Thủ kho nhập chứng từ từ NCC. Lưu nháp hoặc gửi duyệt — tồn kho chỉ tăng sau khi phiếu được duyệt."
      />

      {!canManage ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Chỉ Thủ kho được tạo hoặc gửi phiếu nhập nhà cung cấp.
        </p>
      ) : null}

      <form className="inventory-form grid grid-cols-1 gap-6" onSubmit={handleSubmit}>
        <section className="rounded-2xl bg-white p-6 shadow-sm sm:p-8">          <h2 className="mb-6 text-lg font-bold text-slate-800">Thông tin nhà cung cấp</h2>
          <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <label className="space-y-2" data-error={headerErrors.supplierId ? 'true' : undefined}>
              <span className="text-xs font-semibold text-[#717971]">Nhà cung cấp <span className="text-red-500">*</span></span>
              <SupplierSearchPicker
                disabled={isLoading}
                suppliers={suppliers}
                supplierId={header.supplierId}
                supplierName={header.supplierName}
                onSelect={(supplier) => {
                  setHeader((prev) => ({
                    ...prev,
                    supplierId: supplier?.id || '',
                    supplierName: supplier?.name || '',
                  }))
                  setHeaderErrors((prev) => ({ ...prev, supplierId: undefined }))
                }}
                hasError={!!headerErrors.supplierId}
              />
              {headerErrors.supplierId ? <p className="text-xs text-red-500">{headerErrors.supplierId}</p> : null}
            </label>
            <label className="space-y-2" data-error={headerErrors.supplierReference ? 'true' : undefined}>
              <span className="text-xs font-semibold text-[#717971]">Mã NCC / tham chiếu <span className="text-red-500">*</span></span>
              <input
                maxLength={100}
                className={`w-full rounded-xl border p-3 text-sm ${headerErrors.supplierReference ? 'border-red-400 bg-red-50' : 'border-slate-200 bg-white'}`}
                value={header.supplierReference}
                onChange={(event) => {
                  setHeader((prev) => ({ ...prev, supplierReference: event.target.value }))
                  setHeaderErrors((prev) => ({ ...prev, supplierReference: undefined }))
                }}
              />
              {headerErrors.supplierReference ? <p className="text-xs text-red-500">{headerErrors.supplierReference}</p> : null}
            </label>
            <label className="space-y-2" data-error={headerErrors.supplierDocumentNumber ? 'true' : undefined}>
              <span className="text-xs font-semibold text-[#717971]">Số hóa đơn / chứng từ NCC <span className="text-red-500">*</span></span>
              <input
                maxLength={100}
                className={`w-full rounded-xl border p-3 text-sm ${headerErrors.supplierDocumentNumber ? 'border-red-400 bg-red-50' : 'border-slate-200 bg-white'}`}
                value={header.supplierDocumentNumber}
                onChange={(event) => {
                  setHeader((prev) => ({ ...prev, supplierDocumentNumber: event.target.value }))
                  setHeaderErrors((prev) => ({ ...prev, supplierDocumentNumber: undefined }))
                }}
              />
              {headerErrors.supplierDocumentNumber ? <p className="text-xs text-red-500">{headerErrors.supplierDocumentNumber}</p> : null}
            </label>
            <label className="space-y-2" data-error={headerErrors.supplierDocumentDate ? 'true' : undefined}>
              <span className="text-xs font-semibold text-[#717971]">Ngày chứng từ NCC <span className="text-red-500">*</span></span>
              <input
                type="date"
                max={today}
                className={`w-full rounded-xl border p-3 text-sm ${headerErrors.supplierDocumentDate ? 'border-red-400 bg-red-50' : 'border-slate-200 bg-white'}`}
                value={header.supplierDocumentDate}
                onChange={(event) => {
                  setHeader((prev) => ({ ...prev, supplierDocumentDate: event.target.value }))
                  setHeaderErrors((prev) => ({ ...prev, supplierDocumentDate: undefined }))
                }}
              />
              {headerErrors.supplierDocumentDate ? <p className="text-xs text-red-500">{headerErrors.supplierDocumentDate}</p> : null}
            </label>
            <label className="space-y-2" data-error={headerErrors.receivedDate ? 'true' : undefined}>
              <span className="text-xs font-semibold text-[#717971]">Ngày nhận hàng <span className="text-red-500">*</span></span>
              <input
                type="date"
                className={`w-full rounded-xl border p-3 text-sm ${headerErrors.receivedDate ? 'border-red-400 bg-red-50' : 'border-slate-200 bg-white'}`}
                value={header.receivedDate}
                onChange={(event) => {
                  setHeader((prev) => ({ ...prev, receivedDate: event.target.value }))
                  setHeaderErrors((prev) => ({ ...prev, receivedDate: undefined }))
                }}
              />
              {headerErrors.receivedDate ? <p className="text-xs text-red-500">{headerErrors.receivedDate}</p> : null}
            </label>
            <label className="space-y-2 md:col-span-2 xl:col-span-3" data-error={headerErrors.note ? 'true' : undefined}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#717971]">Ghi chú</span>
                <span className={`text-xs ${header.note.length > 450 ? 'text-amber-600' : 'text-slate-400'}`}>{header.note.length}/500</span>
              </div>
              <textarea
                maxLength={500}
                className={`min-h-[60px] w-full rounded-xl border p-3 text-sm ${headerErrors.note ? 'border-red-400 bg-red-50' : 'border-slate-200 bg-white'}`}
                value={header.note}
                onChange={(event) => {
                  setHeader((prev) => ({ ...prev, note: event.target.value }))
                  setHeaderErrors((prev) => ({ ...prev, note: undefined }))
                }}
              />
              {headerErrors.note ? <p className="text-xs text-red-500">{headerErrors.note}</p> : null}
            </label>
          </div>

          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-slate-800">Dòng hàng nhập</h2>
            <div className="flex flex-wrap items-center gap-2">
              <a
                href={getSupplierReceiptTemplateUrl()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                <span className="material-symbols-outlined text-[18px]">download</span>
                Tải mẫu CSV
              </a>
              <button
                type="button"
                onClick={addLine}
                className="inline-flex items-center gap-1 rounded-lg bg-[#538463] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#457053]"
              >
                <span className="material-symbols-outlined text-[18px]">add</span>
                Thêm dòng
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {lines.map((line, index) => {
              const selectedSku = skuById.get(line.skuId) ?? null
              const errs = lineErrors[line.key] ?? {}
              const warns = lineWarnings[line.key] ?? {}
              const hasLineError = Object.values(errs).some(Boolean)
              const hasLineWarning = Object.values(warns).some(Boolean)
              const fi = (field) => errs[field] ? 'border-red-400 bg-red-50' : 'border-slate-200 bg-white'
              return (
                <div
                  key={line.key}
                  data-error={hasLineError ? 'true' : undefined}
                  className={`rounded-xl border p-4 ${hasLineError ? 'border-red-300 bg-red-50/30' : 'border-slate-100 bg-slate-50/50'}`}
                >
                  <div className="mb-3 flex items-center justify-between">
                    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-bold ${hasLineError ? 'bg-red-100 text-red-700' : 'bg-[#538463]/10 text-[#356647]'}`}>
                      Dòng {index + 1}
                      {hasLineError ? <span className="ml-1 material-symbols-outlined text-[14px]">error</span> : null}
                    </span>
                    {lines.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => {
                          removeLine(line.key)
                          setLineErrors((prev) => { const n = { ...prev }; delete n[line.key]; return n })
                          setLineWarnings((prev) => { const n = { ...prev }; delete n[line.key]; return n })
                        }}
                        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
                      >
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                        Xóa
                      </button>
                    ) : null}
                  </div>

                  {hasLineWarning ? (
                    <div className="mb-3 flex flex-wrap gap-2">
                      {Object.values(warns).map((w, i) => (
                        <span key={i} className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2.5 py-1 text-xs text-amber-700">
                          <span className="material-symbols-outlined text-[14px]">warning</span>
                          {w}
                        </span>
                      ))}
                    </div>
                  ) : null}

                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-12">
                    <div className="col-span-2 space-y-1 lg:col-span-4">
                      <span className="text-xs font-semibold text-[#717971]">SKU <span className="text-red-500">*</span></span>
                      <SkuSearchPicker
                        disabled={isLoading}
                        duplicate={false}
                        onSelect={(sku) => {
                          updateLine(line.key, { skuId: sku?.id ?? '', submittedUnit: sku ? defaultSubmittedUnit(sku.inventoryUnit) : '' })
                          setLineErrors((prev) => ({ ...prev, [line.key]: { ...(prev[line.key] ?? {}), skuId: undefined } }))
                        }}
                        sku={selectedSku}
                        skus={skus}
                        hasError={!!errs.skuId}
                      />
                      {errs.skuId ? <p className="text-xs text-red-500">{errs.skuId}</p> : null}
                    </div>
                    <div className="space-y-1 sm:col-span-2 lg:col-span-2">
                      <span className="text-xs font-semibold text-[#717971]">Mã lô <span className="text-red-500">*</span></span>
                      <input
                        className={`w-full rounded-xl border p-2.5 text-sm uppercase ${fi('lotCode')}`}
                        value={line.lotCode}
                        onChange={(event) => {
                          updateLine(line.key, { lotCode: event.target.value })
                          setLineErrors((prev) => ({ ...prev, [line.key]: { ...(prev[line.key] ?? {}), lotCode: undefined } }))
                        }}
                      />
                      {errs.lotCode ? <p className="text-xs text-red-500">{errs.lotCode}</p> : null}
                    </div>
                    <div className="space-y-1 lg:col-span-2">
                      <span className="text-xs font-semibold text-[#717971]">Số lượng <span className="text-red-500">*</span></span>
                      <input
                        type="number"
                        min="0"
                        step="0.001"
                        className={`w-full rounded-xl border p-2.5 text-sm ${fi('submittedQuantity')}`}
                        value={line.submittedQuantity}
                        onChange={(event) => {
                          updateLine(line.key, { submittedQuantity: event.target.value })
                          setLineErrors((prev) => ({ ...prev, [line.key]: { ...(prev[line.key] ?? {}), submittedQuantity: undefined } }))
                        }}
                      />
                      {errs.submittedQuantity ? <p className="text-xs text-red-500">{errs.submittedQuantity}</p> : null}
                    </div>
                    <div className="space-y-1 lg:col-span-1">
                      <span className="text-xs font-semibold text-[#717971]">Đơn vị</span>
                      <select
                        className={`w-full rounded-xl border p-2.5 text-sm ${errs.submittedUnit ? 'border-red-400 bg-red-50' : 'border-slate-200 bg-white'}`}
                        value={line.submittedUnit || defaultSubmittedUnit(selectedSku?.inventoryUnit)}
                        onChange={(event) => {
                          updateLine(line.key, { submittedUnit: event.target.value })
                          setLineErrors((prev) => ({ ...prev, [line.key]: { ...(prev[line.key] ?? {}), submittedUnit: undefined } }))
                        }}
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
                      {errs.submittedUnit ? <p className="text-xs text-red-500">{errs.submittedUnit}</p> : null}
                    </div>
                    <div className="space-y-1 sm:col-span-2 lg:col-span-3">
                      <span className="text-xs font-semibold text-[#717971]">Giá vốn / đơn vị gốc</span>
                      <input
                        type="number"
                        min="0"
                        className={`w-full rounded-xl border p-2.5 text-sm ${fi('unitCost')}`}
                        value={line.unitCost}
                        onChange={(event) => {
                          updateLine(line.key, { unitCost: event.target.value })
                          setLineErrors((prev) => ({ ...prev, [line.key]: { ...(prev[line.key] ?? {}), unitCost: undefined } }))
                          setLineWarnings((prev) => ({ ...prev, [line.key]: { ...(prev[line.key] ?? {}), unitCost: undefined } }))
                        }}
                      />
                      {errs.unitCost ? <p className="text-xs text-red-500">{errs.unitCost}</p> : null}
                    </div>
                    <div className="space-y-1 sm:col-span-2 lg:col-span-3">
                      <span className="text-xs font-semibold text-[#717971]">Ngày SX</span>
                      <input
                        type="date"
                        max={today}
                        className={`w-full rounded-xl border p-2.5 text-sm ${fi('manufacturedAt')}`}
                        value={line.manufacturedAt}
                        onChange={(event) => {
                          updateLine(line.key, { manufacturedAt: event.target.value })
                          setLineErrors((prev) => ({ ...prev, [line.key]: { ...(prev[line.key] ?? {}), manufacturedAt: undefined } }))
                          setLineWarnings((prev) => ({ ...prev, [line.key]: { ...(prev[line.key] ?? {}), manufacturedAt: undefined } }))
                        }}
                      />
                      {errs.manufacturedAt ? <p className="text-xs text-red-500">{errs.manufacturedAt}</p> : null}
                    </div>
                    <div className="space-y-1 sm:col-span-2 lg:col-span-3">
                      <span className="text-xs font-semibold text-[#717971]">Hạn dùng</span>
                      <input
                        type="date"
                        className={`w-full rounded-xl border p-2.5 text-sm ${errs.expiresAt ? 'border-red-400 bg-red-50' : warns.expiresAt ? 'border-amber-400 bg-amber-50' : 'border-slate-200 bg-white'}`}
                        value={line.expiresAt}
                        onChange={(event) => {
                          updateLine(line.key, { expiresAt: event.target.value })
                          setLineErrors((prev) => ({ ...prev, [line.key]: { ...(prev[line.key] ?? {}), expiresAt: undefined } }))
                          setLineWarnings((prev) => ({ ...prev, [line.key]: { ...(prev[line.key] ?? {}), expiresAt: undefined } }))
                        }}
                      />
                      {errs.expiresAt ? <p className="text-xs text-red-500">{errs.expiresAt}</p> : null}
                    </div>
                    <div className="col-span-2 space-y-1 sm:col-span-4 lg:col-span-6">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-[#717971]">Ghi chú chất lượng</span>
                        {line.qualityNote.length > 250 ? (
                          <span className="text-xs text-amber-600">{line.qualityNote.length}/300</span>
                        ) : null}
                      </div>
                      <input
                        maxLength={300}
                        className={`w-full rounded-xl border p-2.5 text-sm ${errs.qualityNote ? 'border-red-400 bg-red-50' : 'border-slate-200 bg-white'}`}
                        value={line.qualityNote}
                        onChange={(event) => {
                          updateLine(line.key, { qualityNote: event.target.value })
                          setLineErrors((prev) => ({ ...prev, [line.key]: { ...(prev[line.key] ?? {}), qualityNote: undefined } }))
                        }}
                      />
                      {errs.qualityNote ? <p className="text-xs text-red-500">{errs.qualityNote}</p> : null}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {(Object.values(headerErrors).some(Boolean) || Object.values(lineErrors).some((e) => !!e && Object.values(e).some(Boolean))) ? (
            <div ref={errorSummaryRef} className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
              <p className="mb-2 text-sm font-bold text-red-700">Vui lòng kiểm tra lại các lỗi sau:</p>
              <ul className="space-y-1 text-sm text-red-600">
                {Object.values(headerErrors).filter(Boolean).map((msg, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="material-symbols-outlined mt-0.5 text-[14px]">error</span>
                    {msg}
                  </li>
                ))}
                {lines.map((line, index) => {
                  const errs = lineErrors[line.key]
                  if (!errs) return null
                  return Object.values(errs).filter(Boolean).map((msg, i) => (
                    <li key={`${line.key}-${i}`} className="flex items-start gap-1.5">
                      <span className="material-symbols-outlined mt-0.5 text-[14px]">error</span>
                      Dòng {index + 1}: {msg}
                    </li>
                  ))
                })}
              </ul>
            </div>
          ) : null}

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={isSaving || !canManage}
              className="rounded-xl bg-[#538463] px-6 py-2.5 text-sm font-bold text-white hover:bg-[#457053] disabled:opacity-50"
            >
              {isSaving ? 'Đang xử lý...' : 'Gửi duyệt'}
            </button>
            <button
              type="button"
              disabled={isSaving || !canManage}
              onClick={() => saveReceipt(false)}
              className="rounded-xl border border-[#538463] px-6 py-2.5 text-sm font-bold text-[#538463] hover:bg-[#f2f7f3] disabled:opacity-50"
            >
              Lưu nháp
            </button>
            <Link
              to="/inventory/supplier-receipts"
              className="rounded-xl border border-slate-200 px-6 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Xem phiếu nhập NCC
            </Link>
          </div>
        </section>
      </form>
    </PageShell>
  )
}

export default InventoryImportCreatePage
