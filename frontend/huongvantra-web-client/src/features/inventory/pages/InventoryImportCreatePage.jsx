import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import PageHeader from '../../../components/shared/PageHeader.jsx'
import PageShell from '../../../components/shared/PageShell.jsx'
import { showError, showSuccess } from '../../../app/toast.js'
import {
  formatVnd,
  formatVndInput,
  parseVndInput,
  sanitizeVndInput,
} from '../../../utils/vietnamCurrency.js'
import { canOperateSupplierReceipt } from '../../auth/utils/permissions.js'
import { loadAuthSession } from '../../auth/services/authSession.js'
import { fetchSupplierReceiptSkus } from '../../products/services/productSkusApi.js'
import { isSupplierReceiptEligibleSku } from '../../products/services/productsApi.js'
import {
  createSupplierReceipt,
  fetchSupplierReceiptById,
  submitSupplierReceipt,
  updateSupplierReceipt,
} from '../services/supplierReceiptApi.js'
import { fetchActiveSuppliers } from '../services/suppliersApi.js'
import {
  parseSupplierReceiptTt200Excel,
  TT200_TEMPLATE_URL,
} from '../utils/supplierReceiptTt200Excel.js'

const EMPTY_HEADER = {
  supplierId: '',
  supplierName: '',
  supplierReference: '',
  supplierDocumentNumber: '',
  supplierDocumentDate: '',
  deliveredByName: '',
  originalDocumentReference: '',
  receivedDate: new Date().toISOString().slice(0, 10),
  note: '',
}

function emptyLine() {
  return {
    key: crypto.randomUUID(),
    skuId: '',
    documentQuantity: '',
    actualQuantity: '',
    unitCost: '',
    submittedUnit: '',
    lotCode: '',
    manufacturedAt: '',
    expiresAt: '',
    qualityNote: '',
  }
}

function calculateLineAmount(line) {
  const actualQuantity = Number(line.actualQuantity)
  const unitCost = parseVndInput(line.unitCost)
  if (!Number.isFinite(actualQuantity) || !Number.isFinite(unitCost)) return 0
  return actualQuantity * unitCost
}

function parseCsvLine(line) {
  const cells = []
  let current = ''
  let quoted = false
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"'
        index += 1
      } else {
        quoted = !quoted
      }
    } else if (char === ',' && !quoted) {
      cells.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  cells.push(current.trim())
  return cells
}

function normalizeCsvHeader(value) {
  return String(value || '').replace(/^\uFEFF/, '').trim().toLowerCase().replace(/[\s_-]+/g, '')
}

function isPositiveIntegerText(value) {
  return /^[1-9]\d*$/.test(String(value ?? '').trim())
}

function getProductTypeLabel(productType) {
  if (productType === 'NGUYEN_LIEU') return 'Nguyên liệu'
  if (productType === 'BAO_BI') return 'Bao bì'
  if (productType === 'THANH_PHAM') return 'Sản phẩm kệ'
  return productType || 'Khác'
}

function getSkuUnitName(sku) {
  if (sku?.unitName) return sku.unitName
  if (sku?.inventoryUnit === 'Gram') return 'g'
  return sku?.inventoryUnit || '—'
}

function defaultSubmittedUnit(unit) {
  return unit === 'Gram' ? 'kg' : 'piece'
}

function getSkuSnapshotName(sku) {
  return sku?.productName || sku?.skuCode || ''
}

function getSkuDisplayText(sku) {
  if (!sku) return ''
  return `${getSkuSnapshotName(sku)} — ${sku.skuCode} — ${getSkuUnitName(sku)}`
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

function SkuSearchPicker({ catalogError, duplicate, hasError, isCatalogLoading, onSelect, sku, skus }) {
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
  const isCatalogUnavailable = isCatalogLoading || Boolean(catalogError)
  const emptyMessage = skus.length === 0
    ? 'Không có SKU nào đang hoạt động và được phép nhập từ nhà cung cấp.'
    : 'Không tìm thấy SKU phù hợp với từ khóa.'

  return (
    <div ref={wrapperRef} className="relative">
      <input
        type="text"
        disabled={isCatalogUnavailable}
        className={`w-full rounded-xl border bg-white p-2.5 text-sm outline-none focus:ring-2 ${
          hasError ? 'border-red-400 bg-red-50 focus:ring-red-200' : duplicate ? 'border-amber-300 focus:ring-[#538463]/15' : 'border-slate-200 focus:border-[#538463] focus:ring-[#538463]/15'
        }`}
        value={inputValue}
        onChange={handleInputChange}
        onFocus={() => {
          setQuery(sku ? getSkuDisplayText(sku) : query)
          setIsOpen(true)
        }}
        placeholder={isCatalogLoading ? 'Đang tải danh sách hàng hóa...' : 'Tìm Hàng hóa hoặc Mã số'}
      />
      {isCatalogLoading ? <p className="mt-1 text-xs text-slate-500">Đang tải danh sách SKU...</p> : null}
      {catalogError ? <p className="mt-1 text-xs font-medium text-red-600">{catalogError}</p> : null}
      {duplicate ? (
        <p className="mt-1 text-xs font-medium text-amber-700">SKU này đã có trong lô nhập.</p>
      ) : null}

      {isOpen && !isCatalogUnavailable ? (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-80 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
          {results.length === 0 ? (
            <p className="px-3 py-3 text-sm text-slate-500">{emptyMessage}</p>
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
                      {getSkuUnitName(item)}
                    </span>
                  </div>
                </div>
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
  const location = useLocation()
  const canManage = canOperateSupplierReceipt(loadAuthSession())
  const editingReceiptId = useMemo(
    () => new URLSearchParams(location.search).get('receiptId'),
    [location.search],
  )
  const [supplierReceiptSkus, setSupplierReceiptSkus] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [header, setHeader] = useState(EMPTY_HEADER)
  const [lines, setLines] = useState([emptyLine()])
  const [isSkuCatalogLoading, setIsSkuCatalogLoading] = useState(true)
  const [skuCatalogError, setSkuCatalogError] = useState('')
  const [isSupplierLoading, setIsSupplierLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isEditLoading, setIsEditLoading] = useState(Boolean(editingReceiptId))
  const [headerErrors, setHeaderErrors] = useState({})
  const [lineErrors, setLineErrors] = useState({})
  const [lineWarnings, setLineWarnings] = useState({})
  const errorSummaryRef = useRef(null)
  const today = new Date().toISOString().slice(0, 10)

  const loadSupplierReceiptSkus = useCallback(async () => {
    setIsSkuCatalogLoading(true)
    setSkuCatalogError('')
    try {
      const skuItems = await fetchSupplierReceiptSkus()
      setSupplierReceiptSkus(skuItems.filter(isSupplierReceiptEligibleSku).sort(sortSkuOptions))
    } catch {
      const message = 'Không tải được danh sách SKU được phép nhập từ nhà cung cấp. Vui lòng thử lại.'
      setSupplierReceiptSkus([])
      setSkuCatalogError(message)
      showError(message)
    } finally {
      setIsSkuCatalogLoading(false)
    }
  }, [])

  const loadSuppliers = useCallback(async () => {
    setIsSupplierLoading(true)
    try {
      setSuppliers(await fetchActiveSuppliers())
    } catch {
      setSuppliers([])
      showError('Không tải được danh sách nhà cung cấp đang hoạt động. Vui lòng thử lại.')
    } finally {
      setIsSupplierLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadSupplierReceiptSkus()
      void loadSuppliers()
    }, 0)
    return () => clearTimeout(timer)
  }, [loadSupplierReceiptSkus, loadSuppliers])

  useEffect(() => {
    if (!editingReceiptId) {
      setIsEditLoading(false)
      return undefined
    }

    let cancelled = false
    async function loadReceiptForEdit() {
      setIsEditLoading(true)
      try {
        const receipt = await fetchSupplierReceiptById(editingReceiptId)
        if (cancelled) return
        const editableStatus = String(receipt?.status || '').toLowerCase()
        if (!['draft', 'rejected'].includes(editableStatus)) {
          showError('Chỉ có thể sửa Phiếu nhập ở trạng thái Draft hoặc Rejected.')
          navigate('/inventory/supplier-receipts', { replace: true })
          return
        }

        const toDateInput = (value) => value ? String(value).slice(0, 10) : ''
        setHeader({
          supplierId: receipt.supplierId || '',
          supplierName: receipt.supplierName || '',
          supplierReference: receipt.supplierReference || '',
          supplierDocumentNumber: receipt.supplierDocumentNumber || '',
          supplierDocumentDate: toDateInput(receipt.supplierDocumentDate),
          deliveredByName: receipt.deliveredByName || '',
          originalDocumentReference: receipt.originalDocumentReference || '',
          receivedDate: toDateInput(receipt.receivedDate),
          note: receipt.note || '',
        })
        setLines(receipt.items.map((item) => ({
          key: crypto.randomUUID(),
          skuId: item.skuId,
          documentQuantity: String(item.documentQuantity ?? item.actualQuantity ?? item.submittedQuantity ?? ''),
          actualQuantity: String(item.actualQuantity ?? item.submittedQuantity ?? ''),
          unitCost: item.unitCost === null || item.unitCost === undefined ? '' : String(item.unitCost),
          submittedUnit: item.submittedUnit || '',
          lotCode: item.lotCode || '',
          manufacturedAt: toDateInput(item.manufacturedAt),
          expiresAt: toDateInput(item.expiresAt),
          qualityNote: item.qualityNote || '',
        })))
      } catch (error) {
        if (!cancelled) {
          showError(error.message)
          navigate('/inventory/supplier-receipts', { replace: true })
        }
      } finally {
        if (!cancelled) setIsEditLoading(false)
      }
    }

    void loadReceiptForEdit()
    return () => {
      cancelled = true
    }
  }, [editingReceiptId, navigate])

  const skuById = useMemo(() => new Map(supplierReceiptSkus.map((sku) => [sku.id, sku])), [supplierReceiptSkus])
  const skuByCode = useMemo(
    () => new Map(supplierReceiptSkus.map((sku) => [String(sku.skuCode || '').trim().toUpperCase(), sku])),
    [supplierReceiptSkus],
  )
  const receiptTotals = useMemo(() => ({
    actualQuantity: lines.reduce((sum, line) => sum + (Number(line.actualQuantity) || 0), 0),
    amount: lines.reduce((sum, line) => sum + calculateLineAmount(line), 0),
  }), [lines])

  function updateLine(key, patch) {
    setLines((prev) => prev.map((line) => (line.key === key ? { ...line, ...patch } : line)))
  }

  function addLine() {
    setLines((prev) => [...prev, emptyLine()])
  }

  function removeLine(key) {
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((line) => line.key !== key)))
  }

  function applyImportedLines(rawLines, sourceLabel) {
    const previewErrors = []
    const previewWarnings = []
    const compositeKeys = new Set()
    const nextLines = rawLines.map((raw, rowIndex) => {
      const rowLabel = raw.rowNumber ?? rowIndex + 2
      const skuCode = String(raw.skuCode || '').trim().toUpperCase()
      const sku = skuByCode.get(skuCode)
      const actualQuantity = String(raw.actualQuantity ?? '').trim()
      const documentQuantity = String(raw.documentQuantity || actualQuantity).trim()
      const unitCost = String(raw.unitCost ?? '').trim()
      const supplierLotCode = String(raw.lotCode ?? '').trim()
      const manufacturedAt = String(raw.manufacturedAt ?? '').trim()
      const expiresAt = String(raw.expiresAt ?? '').trim()
      // ĐVT trên Excel chỉ mang tính tham khảo — form luôn lấy đơn vị chuẩn của SKU.

      if (!sku) {
        previewErrors.push(
          `Dòng ${rowLabel}: SKU ${skuCode || 'trống'} không hợp lệ hoặc không được phép nhập NCC.`,
        )
      }
      if (!isPositiveIntegerText(documentQuantity) || !isPositiveIntegerText(actualQuantity)) {
        previewErrors.push(`Dòng ${rowLabel}: Số lượng phải là số nguyên lớn hơn 0.`)
      }
      if (!unitCost) previewWarnings.push(`Dòng ${rowLabel}: thiếu Unit Cost; chỉ có thể lưu Draft.`)
      if (!String(raw.documentQuantity ?? '').trim() && actualQuantity) {
        previewWarnings.push(`Dòng ${rowLabel}: thiếu Document Quantity, đã preview theo Actual Quantity.`)
      }

      if (sku && supplierLotCode && manufacturedAt && expiresAt) {
        const composite = [
          sku.id,
          supplierLotCode.trim().toUpperCase(),
          manufacturedAt,
          expiresAt,
        ].join('|')
        if (compositeKeys.has(composite)) {
          previewErrors.push(
            `Dòng ${rowLabel}: trùng SKU, Supplier Lot Code, Manufacture Date và Expiry Date.`,
          )
        }
        compositeKeys.add(composite)
      }

      return {
        key: crypto.randomUUID(),
        skuId: sku?.id ?? '',
        documentQuantity,
        actualQuantity,
        unitCost: sanitizeVndInput(unitCost),
        submittedUnit: defaultSubmittedUnit(sku?.inventoryUnit),
        lotCode: supplierLotCode,
        manufacturedAt,
        expiresAt,
        qualityNote: String(raw.qualityNote ?? raw.note ?? '').trim(),
      }
    })

    if (previewErrors.length > 0) {
      throw new Error(`${sourceLabel} không hợp lệ. ${previewErrors.slice(0, 5).join(' ')}`)
    }

    setLines(nextLines.length ? nextLines : [emptyLine()])
    setLineWarnings({})
    setLineErrors({})
    return { nextLines, previewWarnings }
  }

  async function importExcelPreview(file) {
    if (!file) return
    try {
      const buffer = await file.arrayBuffer()
      const { headerPatch = {}, rawLines, errors } = parseSupplierReceiptTt200Excel(buffer)
      if (errors.length > 0) throw new Error(errors[0])

      const importWarnings = []
      const nextHeader = { ...headerPatch }
      if (nextHeader.supplierName) {
        const needle = normalizeSearch(nextHeader.supplierName)
        const matched = suppliers.find((s) => normalizeSearch(s.name) === needle)
          || suppliers.find((s) => {
            const name = normalizeSearch(s.name)
            return name.includes(needle) || needle.includes(name)
          })
        if (matched) {
          nextHeader.supplierId = matched.id
          nextHeader.supplierName = matched.name
        } else {
          delete nextHeader.supplierId
          importWarnings.push(
            `Không khớp nhà cung cấp "${nextHeader.supplierName}" trong danh sách — vui lòng chọn lại trên form.`,
          )
          delete nextHeader.supplierName
        }
      }

      if (Object.keys(nextHeader).length > 0) {
        setHeader((prev) => ({
          ...prev,
          ...Object.fromEntries(
            Object.entries(nextHeader).filter(([, value]) => value != null && String(value).trim() !== ''),
          ),
        }))
        setHeaderErrors({})
      }

      const { nextLines, previewWarnings } = applyImportedLines(rawLines, 'Excel')
      const allWarnings = [...importWarnings, ...previewWarnings]
      if (allWarnings.length > 0) {
        showSuccess(`Đã nạp ${nextLines.length} dòng hàng hóa. ${allWarnings.slice(0, 3).join(' ')}`)
      } else {
        showSuccess(`Đã nạp ${nextLines.length} dòng hàng hóa từ Excel.`)
      }
    } catch (error) {
      showError(error.message || 'Không đọc được file Excel.')
    }
  }

  async function importCsvPreview(file) {
    if (!file) return
    const lowerName = String(file.name || '').toLowerCase()
    if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls')) {
      await importExcelPreview(file)
      return
    }
    try {
      const text = await file.text()
      const rows = text.split(/\r?\n/).filter((row) => row.trim())
      if (rows.length < 2) throw new Error('File CSV không có dòng dữ liệu.')

      const headers = parseCsvLine(rows[0]).map(normalizeCsvHeader)
      const indexOf = (...names) => headers.findIndex((header) => names.includes(header))
      const indexes = {
        skuCode: indexOf('skucode', 'sku', 'maso', 'mahang', 'ma'),
        documentQuantity: indexOf(
          'documentquantity',
          'soluongtheochungtu',
          'theochungtu',
          'sltheochungtu',
        ),
        actualQuantity: indexOf(
          'actualquantity',
          'submittedquantity',
          'quantity',
          'soluong',
          'soluongthucnhap',
          'thucnhap',
          'slthucnhap',
        ),
        unitCost: indexOf('unitcost', 'dongia', 'gia'),
        submittedUnit: indexOf('submittedunit', 'unit', 'donvi', 'dvt'),
        lotCode: indexOf('supplierlotcode', 'lotcode', 'malo', 'maloncc'),
        manufacturedAt: indexOf('manufacturedat', 'manufacturedate', 'ngaysanxuat'),
        expiresAt: indexOf('expiresat', 'expirydate', 'hansudung'),
        note: indexOf('note', 'qualitynote', 'ghichu'),
      }
      if (indexes.skuCode < 0 || indexes.actualQuantity < 0) {
        throw new Error(
          'CSV phải có cột SKU Code (hoặc Mã số) và Actual Quantity (hoặc Số lượng / Thực nhập). File Excel TT200 hãy dùng nút Nạp Excel.',
        )
      }

      const rawLines = rows.slice(1).map((rawRow, rowIndex) => {
        const cells = parseCsvLine(rawRow)
        const get = (index) => (index >= 0 ? String(cells[index] ?? '').trim() : '')
        return {
          rowNumber: rowIndex + 2,
          skuCode: get(indexes.skuCode),
          documentQuantity: get(indexes.documentQuantity),
          actualQuantity: get(indexes.actualQuantity),
          unitCost: get(indexes.unitCost),
          submittedUnit: get(indexes.submittedUnit),
          lotCode: get(indexes.lotCode),
          manufacturedAt: get(indexes.manufacturedAt),
          expiresAt: get(indexes.expiresAt),
          note: get(indexes.note),
        }
      })

      const { nextLines, previewWarnings } = applyImportedLines(rawLines, 'CSV')
      if (previewWarnings.length > 0) {
        showSuccess(`Đã nạp ${nextLines.length} dòng. ${previewWarnings.slice(0, 3).join(' ')}`)
      } else {
        showSuccess(`Đã nạp ${nextLines.length} dòng từ CSV để kiểm tra trước khi lưu.`)
      }
    } catch (error) {
      showError(error.message)
    }
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
    if (header.deliveredByName.length > 255) {
      errors.deliveredByName = 'Tên người giao hàng không được vượt quá 255 ký tự.'
    }
    if (header.originalDocumentReference.length > 500) {
      errors.originalDocumentReference = 'Chứng từ kèm theo không được vượt quá 500 ký tự.'
    }
    setHeaderErrors(errors)
    return Object.keys(errors).length === 0
  }

  const LOT_CODE_REGEX = /^[A-Za-z0-9\-_]{1,50}$/

  function validateLines(requireUnitCost = false) {
    const errors = {}
    const warnings = {}
    const compositeKeys = new Set()
    let valid = true

    for (const [, line] of lines.entries()) {
      const lineErr = {}
      const lineWarn = {}
      const documentQuantity = Number(line.documentQuantity)
      const actualQuantity = Number(line.actualQuantity)
      const unitCost = parseVndInput(line.unitCost)
      const lotCode = line.lotCode.trim()

      // SKU
      if (!line.skuId) lineErr.skuId = 'Vui lòng chọn SKU.'

      // Đơn vị phải hợp lệ theo inventoryUnit của SKU (B12)
      const sku = skuById.get(line.skuId)
      if (sku && line.submittedUnit) {
        const isGram = sku.inventoryUnit === 'Gram'
        const validUnits = isGram ? ['kg', 'g'] : ['piece']
        if (!validUnits.includes(line.submittedUnit)) {
          lineErr.submittedUnit = `Đơn vị "${line.submittedUnit}" không hợp lệ cho SKU đơn vị ${isGram ? 'Gram (kg/g)' : 'Piece'}.`
        }
      }

      // Draft có thể thiếu metadata lô; Submit bắt buộc đầy đủ.
      if (requireUnitCost && !lotCode) {
        lineErr.lotCode = 'Mã lô NCC không được để trống.'
      } else if (lotCode.length > 50) {
        lineErr.lotCode = 'Mã lô NCC không được vượt quá 50 ký tự.'
      } else if (lotCode && !LOT_CODE_REGEX.test(lotCode)) {
        lineErr.lotCode = 'Mã lô NCC chỉ được chứa chữ cái, số, dấu gạch ngang (-) và gạch dưới (_).'
      }

      if (!isPositiveIntegerText(line.documentQuantity)
        || !Number.isFinite(documentQuantity)
        || documentQuantity <= 0) {
        lineErr.documentQuantity = 'Số lượng phải là số nguyên lớn hơn 0.'
      }
      if (!isPositiveIntegerText(line.actualQuantity)
        || !Number.isFinite(actualQuantity)
        || actualQuantity <= 0) {
        lineErr.actualQuantity = 'Số lượng phải là số nguyên lớn hơn 0.'
      }
      if (line.unitCost !== '' && (!Number.isFinite(unitCost) || unitCost < 0)) {
        lineErr.unitCost = 'Đơn giá không được âm.'
      } else if (requireUnitCost && (line.unitCost === '' || unitCost <= 0)) {
        lineErr.unitCost = 'Đơn giá theo chứng từ phải lớn hơn 0 trước khi gửi duyệt.'
      }

      // Ngày SX
      if (requireUnitCost && !line.manufacturedAt) {
        lineErr.manufacturedAt = 'Ngày sản xuất là bắt buộc trước khi Submit.'
      } else if (line.manufacturedAt) {
        if (line.manufacturedAt > today) {
          lineErr.manufacturedAt = 'Ngày sản xuất không được là ngày tương lai.'
        } else if (header.receivedDate && line.manufacturedAt > header.receivedDate) {
          lineErr.manufacturedAt = 'Ngày sản xuất không thể sau ngày nhận hàng.'
        }
      }

      // Hạn dùng
      if (requireUnitCost && !line.expiresAt) {
        lineErr.expiresAt = 'Hạn dùng là bắt buộc trước khi Submit.'
      } else if (line.expiresAt) {
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

      if (line.skuId && lotCode && line.manufacturedAt && line.expiresAt) {
        const composite = [
          line.skuId,
          lotCode.toUpperCase(),
          line.manufacturedAt,
          line.expiresAt,
        ].join('|')
        if (compositeKeys.has(composite)) {
          lineErr.lotCode = 'Trùng Hàng hóa, Mã lô NCC, Ngày SX và Hạn dùng trong cùng phiếu.'
        }
        compositeKeys.add(composite)
      }

      // Warnings (không chặn lưu)
      if (isPositiveIntegerText(line.documentQuantity) && isPositiveIntegerText(line.actualQuantity)) {
        const difference = actualQuantity - documentQuantity
        if (difference < 0) {
          lineWarn.quantityVariance = `Cảnh báo: Số lượng thực nhập thiếu ${Math.abs(difference)} so với chứng từ. Chênh lệch: ${difference}.`
        } else if (difference > 0) {
          lineWarn.quantityVariance = `Cảnh báo: Số lượng thực nhập vượt ${difference} so với chứng từ. Chênh lệch: +${difference}.`
        }
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
    const linesOk = validateLines(submitForApproval)
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
        inventoryUnitSnapshot: getSkuUnitName(sku),
        submittedUnit: line.submittedUnit || defaultSubmittedUnit(sku.inventoryUnit),
        submittedQuantity: Number(line.actualQuantity),
        documentQuantity: Number(line.documentQuantity),
        actualQuantity: Number(line.actualQuantity),
        unitCost: line.unitCost === '' ? null : parseVndInput(line.unitCost),
        lotCode: line.lotCode.trim(),
        manufacturedAt: line.manufacturedAt ? new Date(`${line.manufacturedAt}T00:00:00`).toISOString() : null,
        expiresAt: line.expiresAt ? new Date(`${line.expiresAt}T00:00:00`).toISOString() : null,
        qualityNote: stripHtml(line.qualityNote),
      }
    })

    setIsSaving(true)
    try {
      const receiptPayload = {
        supplierId: header.supplierId,
        supplierName: header.supplierName,
        supplierReference: header.supplierReference,
        supplierDocumentNumber: header.supplierDocumentNumber,
        supplierDocumentDate: header.supplierDocumentDate
          ? new Date(`${header.supplierDocumentDate}T00:00:00`).toISOString()
          : null,
        receivedDate: header.receivedDate ? new Date(`${header.receivedDate}T00:00:00`).toISOString() : null,
        deliveredByName: header.deliveredByName,
        originalDocumentReference: header.originalDocumentReference,
        note: stripHtml(header.note),
        items: payloadLines,
      }
      const receipt = editingReceiptId
        ? await updateSupplierReceipt(editingReceiptId, receiptPayload)
        : await createSupplierReceipt(receiptPayload)
      if (submitForApproval) {
        const submitted = await submitSupplierReceipt(receipt.id)
        showSuccess(`Đã gửi phiếu ${submitted.receiptCode} chờ duyệt. Tồn kho chỉ tăng sau khi phiếu được duyệt.`)
      } else {
        showSuccess(`${editingReceiptId ? 'Đã cập nhật' : 'Đã lưu nháp'} phiếu ${receipt.receiptCode}. Phiếu chưa ảnh hưởng tồn kho.`)
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
        title={editingReceiptId ? 'CẬP NHẬT PHIẾU NHẬP KHO' : 'PHIẾU NHẬP KHO'}
        titleInfo="Thủ kho nhập lại dữ liệu từ chứng từ NCC. Thành tiền do hệ thống tính; tồn kho và Giá vốn trung bình chỉ cập nhật sau khi Manager duyệt."
      />

      {!canManage ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Chỉ Thủ kho được tạo hoặc gửi phiếu nhập nhà cung cấp.
        </p>
      ) : null}

      {isEditLoading ? (
        <p className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
          Đang tải Phiếu nhập để chỉnh sửa...
        </p>
      ) : null}

      <form className="inventory-form grid grid-cols-1 gap-6" onSubmit={handleSubmit}>
        <section className="rounded-2xl bg-white p-6 shadow-sm sm:p-8">
          <div className="mb-6 border-b border-slate-100 pb-4 text-center">
            <h2 className="text-2xl font-black tracking-wide text-slate-800">PHIẾU NHẬP KHO</h2>
            <p className="mt-1 text-sm text-slate-500">Kho nhập: <strong>Kho</strong> · Mã phiếu hệ thống được cấp sau khi lưu</p>
          </div>
          <h3 className="mb-4 text-lg font-bold text-slate-800">Thông tin chứng từ</h3>
          <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <label className="space-y-2" data-error={headerErrors.supplierId ? 'true' : undefined}>
              <span className="text-xs font-semibold text-[#717971]">Nhà cung cấp <span className="text-red-500">*</span></span>
              <SupplierSearchPicker
                disabled={isSupplierLoading}
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
            <label className="space-y-2" data-error={headerErrors.deliveredByName ? 'true' : undefined}>
              <span className="text-xs font-semibold text-[#717971]">Người giao hàng</span>
              <input
                maxLength={255}
                className={`w-full rounded-xl border p-3 text-sm ${headerErrors.deliveredByName ? 'border-red-400 bg-red-50' : 'border-slate-200 bg-white'}`}
                value={header.deliveredByName}
                onChange={(event) => {
                  setHeader((prev) => ({ ...prev, deliveredByName: event.target.value }))
                  setHeaderErrors((prev) => ({ ...prev, deliveredByName: undefined }))
                }}
              />
              {headerErrors.deliveredByName ? <p className="text-xs text-red-500">{headerErrors.deliveredByName}</p> : null}
            </label>
            <label className="space-y-2">
              <span className="text-xs font-semibold text-[#717971]">Kho nhập / Địa điểm</span>
              <input readOnly value="Kho" className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600" />
            </label>
            <label className="space-y-2 md:col-span-2" data-error={headerErrors.originalDocumentReference ? 'true' : undefined}>
              <span className="text-xs font-semibold text-[#717971]">Số chứng từ gốc / Chứng từ kèm theo</span>
              <input
                maxLength={500}
                className={`w-full rounded-xl border p-3 text-sm ${headerErrors.originalDocumentReference ? 'border-red-400 bg-red-50' : 'border-slate-200 bg-white'}`}
                value={header.originalDocumentReference}
                onChange={(event) => {
                  setHeader((prev) => ({ ...prev, originalDocumentReference: event.target.value }))
                  setHeaderErrors((prev) => ({ ...prev, originalDocumentReference: undefined }))
                }}
              />
              {headerErrors.originalDocumentReference ? <p className="text-xs text-red-500">{headerErrors.originalDocumentReference}</p> : null}
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
            <div>
              <h2 className="text-lg font-bold text-slate-800">Dòng hàng nhập</h2>
              <p className="mt-1 text-xs text-slate-500">
                Nạp Excel lấy NCC + ghi chú phiếu + dòng hàng (lô / NSX / HSD / ghi chú chất lượng nếu có). Tên NCC phải khớp danh sách hệ thống.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <a
                href={TT200_TEMPLATE_URL}
                download="phieu-nhap-kho-excel-tt200.xlsx"
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                <span className="material-symbols-outlined text-[18px]">download</span>
                Tải mẫu CSV
              </a>
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                <span className="material-symbols-outlined text-[18px]">upload_file</span>
                Nạp CSV
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls,text/csv"
                  className="hidden"
                  onChange={(event) => {
                    void importCsvPreview(event.target.files?.[0])
                    event.target.value = ''
                  }}
                />
              </label>
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
              const quantityDifference = isPositiveIntegerText(line.documentQuantity)
                && isPositiveIntegerText(line.actualQuantity)
                ? Number(line.actualQuantity) - Number(line.documentQuantity)
                : 0
              const varianceWarning = quantityDifference < 0
                ? `Cảnh báo: Số lượng thực nhập thiếu ${Math.abs(quantityDifference)} so với chứng từ. Chênh lệch: ${quantityDifference}.`
                : quantityDifference > 0
                  ? `Cảnh báo: Số lượng thực nhập vượt ${quantityDifference} so với chứng từ. Chênh lệch: +${quantityDifference}.`
                  : null
              const warns = {
                ...(lineWarnings[line.key] ?? {}),
                quantityVariance: varianceWarning,
              }
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
                      Dòng {index + 1}{selectedSku ? ` — ${selectedSku.skuCode}` : ''}
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
                      {Object.values(warns).filter(Boolean).map((w, i) => (
                        <span key={i} className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2.5 py-1 text-xs text-amber-700">
                          <span className="material-symbols-outlined text-[14px]">warning</span>
                          {w}
                        </span>
                      ))}
                    </div>
                  ) : null}

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)_minmax(0,0.8fr)]">
                    <section className="space-y-3 rounded-xl border border-slate-100 bg-white p-3">
                      <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Thông tin hàng hóa</h3>
                      <label className="block space-y-1">
                        <span className="text-xs font-semibold text-[#717971]">Hàng hóa <span className="text-red-500">*</span></span>
                        <SkuSearchPicker
                          catalogError={skuCatalogError}
                          duplicate={false}
                          isCatalogLoading={isSkuCatalogLoading}
                          onSelect={(sku) => {
                            updateLine(line.key, { skuId: sku?.id ?? '', submittedUnit: sku ? defaultSubmittedUnit(sku.inventoryUnit) : '' })
                            setLineErrors((prev) => ({ ...prev, [line.key]: { ...(prev[line.key] ?? {}), skuId: undefined } }))
                          }}
                          sku={selectedSku}
                          skus={supplierReceiptSkus}
                          hasError={!!errs.skuId}
                        />
                        {errs.skuId ? <p className="text-xs text-red-500">{errs.skuId}</p> : null}
                      </label>
                      <label className="block space-y-1">
                        <span className="text-xs font-semibold text-[#717971]">Mã số</span>
                        <input
                          readOnly
                          value={selectedSku?.skuCode || ''}
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 font-mono text-sm text-slate-700"
                        />
                      </label>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                        <label className="space-y-1">
                          <span className="text-xs font-semibold text-[#717971]">SL chứng từ <span className="text-red-500">*</span></span>
                          <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            className={`w-full rounded-xl border p-2.5 text-sm ${fi('documentQuantity')}`}
                            value={line.documentQuantity}
                            onChange={(event) => {
                              updateLine(line.key, { documentQuantity: event.target.value })
                              setLineErrors((prev) => ({ ...prev, [line.key]: { ...(prev[line.key] ?? {}), documentQuantity: undefined } }))
                            }}
                          />
                          {errs.documentQuantity ? <p className="text-xs text-red-500">{errs.documentQuantity}</p> : null}
                        </label>
                        <label className="space-y-1">
                          <span className="text-xs font-semibold text-[#717971]">SL thực nhập <span className="text-red-500">*</span></span>
                          <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            className={`w-full rounded-xl border p-2.5 text-sm ${fi('actualQuantity')}`}
                            value={line.actualQuantity}
                            onChange={(event) => {
                              updateLine(line.key, { actualQuantity: event.target.value })
                              setLineErrors((prev) => ({ ...prev, [line.key]: { ...(prev[line.key] ?? {}), actualQuantity: undefined } }))
                            }}
                          />
                          {errs.actualQuantity ? <p className="text-xs text-red-500">{errs.actualQuantity}</p> : null}
                        </label>
                        <label className="space-y-1">
                          <span className="text-xs font-semibold text-[#717971]">Đơn vị</span>
                          <input
                            readOnly
                            value={selectedSku ? getSkuUnitName(selectedSku) : ''}
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-sm text-slate-700"
                          />
                        </label>
                      </div>
                    </section>

                    <section className="space-y-3 rounded-xl border border-slate-100 bg-white p-3">
                      <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Giá và thông tin lô</h3>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <label className="space-y-1">
                          <span className="text-xs font-semibold text-[#717971]">Đơn giá <span className="text-red-500">*</span></span>
                          <div className="relative">
                            <input
                              type="text"
                              inputMode="numeric"
                              className={`w-full rounded-xl border py-2.5 pl-2.5 pr-8 text-right text-sm ${fi('unitCost')}`}
                              value={formatVndInput(line.unitCost)}
                              onChange={(event) => {
                                updateLine(line.key, { unitCost: sanitizeVndInput(event.target.value) })
                                setLineErrors((prev) => ({ ...prev, [line.key]: { ...(prev[line.key] ?? {}), unitCost: undefined } }))
                              }}
                              placeholder="Có thể để trống khi lưu Draft"
                            />
                            <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">₫</span>
                          </div>
                          {errs.unitCost ? <p className="text-xs text-red-500">{errs.unitCost}</p> : null}
                        </label>
                        <div className="space-y-1">
                          <span className="text-xs font-semibold text-[#717971]">Thành tiền</span>
                          <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-right text-sm font-bold text-slate-700">
                            {line.unitCost === '' || line.actualQuantity === '' ? '—' : formatVnd(calculateLineAmount(line))}
                          </div>
                        </div>
                      </div>
                      <label className="block space-y-1">
                        <span className="text-xs font-semibold text-[#717971]">Mã lô NCC <span className="text-red-500">*</span></span>
                        <input
                          className={`w-full rounded-xl border p-2.5 text-sm ${fi('lotCode')}`}
                          value={line.lotCode}
                          onChange={(event) => {
                            updateLine(line.key, { lotCode: event.target.value })
                            setLineErrors((prev) => ({ ...prev, [line.key]: { ...(prev[line.key] ?? {}), lotCode: undefined } }))
                          }}
                        />
                        {errs.lotCode ? <p className="text-xs text-red-500">{errs.lotCode}</p> : null}
                      </label>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <label className="space-y-1">
                          <span className="text-xs font-semibold text-[#717971]">Ngày SX <span className="text-red-500">*</span></span>
                          <input
                            type="date"
                            max={today}
                            className={`w-full rounded-xl border p-2.5 text-sm ${fi('manufacturedAt')}`}
                            value={line.manufacturedAt}
                            onChange={(event) => {
                              updateLine(line.key, { manufacturedAt: event.target.value })
                              setLineErrors((prev) => ({ ...prev, [line.key]: { ...(prev[line.key] ?? {}), manufacturedAt: undefined } }))
                            }}
                          />
                          {errs.manufacturedAt ? <p className="text-xs text-red-500">{errs.manufacturedAt}</p> : null}
                        </label>
                        <label className="space-y-1">
                          <span className="text-xs font-semibold text-[#717971]">Hạn dùng <span className="text-red-500">*</span></span>
                          <input
                            type="date"
                            className={`w-full rounded-xl border p-2.5 text-sm ${errs.expiresAt ? 'border-red-400 bg-red-50' : warns.expiresAt ? 'border-amber-400 bg-amber-50' : 'border-slate-200 bg-white'}`}
                            value={line.expiresAt}
                            onChange={(event) => {
                              updateLine(line.key, { expiresAt: event.target.value })
                              setLineErrors((prev) => ({ ...prev, [line.key]: { ...(prev[line.key] ?? {}), expiresAt: undefined } }))
                            }}
                          />
                          {errs.expiresAt ? <p className="text-xs text-red-500">{errs.expiresAt}</p> : null}
                        </label>
                      </div>
                    </section>

                    <section className="space-y-3 rounded-xl border border-slate-100 bg-white p-3 md:col-span-2 xl:col-span-1">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Chất lượng và ghi chú</h3>
                        <span className="text-xs text-slate-400">{line.qualityNote.length}/300</span>
                      </div>
                      <label className="block space-y-1">
                        <span className="text-xs font-semibold text-[#717971]">Ghi chú chất lượng</span>
                        <textarea
                          maxLength={300}
                          rows={8}
                          className={`w-full rounded-xl border p-2.5 text-sm ${errs.qualityNote ? 'border-red-400 bg-red-50' : 'border-slate-200 bg-white'}`}
                          value={line.qualityNote}
                          onChange={(event) => {
                            updateLine(line.key, { qualityNote: event.target.value })
                            setLineErrors((prev) => ({ ...prev, [line.key]: { ...(prev[line.key] ?? {}), qualityNote: undefined } }))
                          }}
                        />
                        {errs.qualityNote ? <p className="text-xs text-red-500">{errs.qualityNote}</p> : null}
                      </label>
                    </section>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="mt-4 flex flex-col items-end gap-1 rounded-xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm">
            <p className="text-slate-600">
              Tổng số lượng thực nhập: <strong className="text-slate-800">{receiptTotals.actualQuantity.toLocaleString('vi-VN')}</strong>
            </p>
            <p className="text-base text-slate-700">
              Tổng tiền: <strong className="text-[#356647]">{formatVnd(receiptTotals.amount)}</strong>
            </p>
            <p className="text-xs text-slate-500">Preview do client tính; server sẽ tính lại từng LineAmount và TotalAmount.</p>
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
              disabled={isSaving || isEditLoading || !canManage}
              className="rounded-xl bg-[#538463] px-6 py-2.5 text-sm font-bold text-white hover:bg-[#457053] disabled:opacity-50"
            >
              {isSaving ? 'Đang xử lý...' : 'Gửi duyệt'}
            </button>
            <button
              type="button"
              disabled={isSaving || isEditLoading || !canManage}
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
