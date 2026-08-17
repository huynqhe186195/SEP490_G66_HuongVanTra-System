import * as XLSX from 'xlsx'
import { PRODUCT_TYPE, getDefaultSellableByType, getInventoryUnitShortLabel } from './productTypes.js'
import { parseWholeVndInput } from './productDisplay.js'
import {
  MULTI_SHEET,
  buildMultiSheetProductCreationWorkbookBuffer,
  collectImportRowsFromMultiSheet,
  isMultiSheetProductCreationWorkbook,
} from './productCreationExcelMultiSheet.js'
import { injectXlsxWorkbookColors } from '../../utils/xlsxColorInject.js'

export const PRODUCT_CREATION_TEMPLATE_SHEET_NAME = 'NHAP_HANG_HOA'
export const PRODUCT_CREATION_REFERENCE_SHEET_NAME = '_DANH_MUC_THAM_CHIEU'
export const PRODUCT_CREATION_TEMPLATE_FILENAME = 'FileMau_YeuCauTaoHangHoaMoi.xlsx'
export const PRODUCT_CREATION_SAMPLE_FILENAME = 'FileMau_YeuCauTaoHangHoaMoi_CoDuLieu.xlsx'
export const PRODUCT_CREATION_TEMPLATE_URL = `/templates/${PRODUCT_CREATION_TEMPLATE_FILENAME}`
export const PRODUCT_CREATION_SAMPLE_URL = `/templates/${PRODUCT_CREATION_SAMPLE_FILENAME}`
export const LEGACY_PRODUCT_CREATION_TEMPLATE_MESSAGE =
  `File đang sử dụng mẫu cũ. Vui lòng tải và sử dụng ${PRODUCT_CREATION_TEMPLATE_FILENAME}.`

const EMPTY_GUID = '00000000-0000-0000-0000-000000000000'
const DERIVED_BOM_MESSAGE = 'BOM của SKU quy đổi được hệ thống tự động tính từ SKU đơn vị cơ bản.'
const DEFAULT_EDITABLE_ROW_COUNT = 100
const TEMPLATE_GUIDED_INPUT_LAST_ROW = 500
const EXAMPLE_MARKER = 'VÍ DỤ MINH HỌA'
const NO_COMPONENT_SKU_NOTE =
  'Chưa có SKU component đang hoạt động trong hệ thống. Vui lòng tạo nguyên liệu/bao bì/sản phẩm kệ trước khi nhập BOM.'
const ATTRIBUTE_NAME_SUGGESTIONS = [
  'Hương vị',
  'Màu sắc',
  'Xuất xứ',
  'Chất liệu bao bì',
  'Trọng lượng',
  'Cấp độ trà',
]

const ROW_TYPE = {
  PRODUCT: 'SẢN PHẨM',
  SKU: 'SKU',
  ATTRIBUTE: 'THUỘC TÍNH',
  BOM: 'BOM',
}

// UI-only preview. Persistence always regenerates derived BOM in ProductLogic.
export function deriveVariantBomPreview(baseBomLines = [], conversionRate) {
  const rate = Number(conversionRate)
  if (!Number.isInteger(rate) || rate <= 0) return []

  return (Array.isArray(baseBomLines) ? baseBomLines : [])
    .filter((line) => line && line.isRequiredBaseComponent !== true)
    .map((line) => ({
      ...line,
      quantity: Number(line.quantity) * rate,
      isRequiredBaseComponent: false,
      isSystemGenerated: true,
    }))
}

const HEADER_LABELS = {
  rowType: 'Loại dòng',
  productKey: 'Mã sản phẩm',
  skuRef: 'Mã SKU tham chiếu',
  productName: 'Tên sản phẩm',
  productType: 'Loại hàng hóa',
  category: 'Danh mục',
  inventoryUnit: 'Đơn vị tồn chuẩn',
  description: 'Mô tả',
  unitName: 'Tên đơn vị',
  conversionRate: 'Quy đổi',
  isBaseUnit: 'Đơn vị cơ bản',
  skuCode: 'Mã SKU (để trống = tự sinh)',
  retailPrice: 'Giá trước thuế',
  costPrice: 'Giá vốn',
  barcode: 'Barcode',
  isSellable: 'Bán trực tiếp',
  minStock: 'Tồn tối thiểu',
  maxStock: 'Tồn tối đa',
  attributeName: 'Tên thuộc tính',
  attributeValue: 'Giá trị thuộc tính',
  componentSku: 'Component SKU',
  bomQuantity: 'Định mức',
  bomNote: 'Ghi chú BOM',
  quickCheck: 'Kiểm tra nhanh (không import)',
}

const REQUIRED_HEADER_KEYS = Object.keys(HEADER_LABELS)


function normalizeText(value) {
  return String(value ?? '').trim()
}

function toReferenceArray(value) {
  if (Array.isArray(value)) return value
  if (!value || typeof value !== 'object') return []

  const candidateKeys = ['items', 'Items', 'records', 'Records', 'list', 'List', 'result', 'Result', 'data', 'Data']
  for (const key of candidateKeys) {
    const candidate = value[key]
    if (Array.isArray(candidate)) return candidate
    const nested = toReferenceArray(candidate)
    if (nested.length) return nested
  }

  return []
}

function normalizeComparable(value) {
  return normalizeText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/\s+/g, ' ')
    .toLocaleUpperCase('en-US')
}

function normalizeHeaderName(value) {
  return normalizeComparable(value)
    .replace(/\s*\*/g, '')
    .replace(/[“”"]/g, '')
}

const HEADER_ALIASES = {
  retailPrice: ['Giá trước thuế', 'Giá bán', 'Giá bán trước thuế', 'Price before tax', 'Retail price'],
  costPrice: ['Giá vốn', 'Cost price'],
  salesTaxPercent: ['Thuế %', 'Thuế bán hàng', 'Thuế', 'Sales tax', 'Tax %'],
}

function resolveHeaderColumnIndex(headerMap, key) {
  const aliases = HEADER_ALIASES[key] || [HEADER_LABELS[key]]
  for (const alias of aliases) {
    const columnIndex = headerMap.get(normalizeHeaderName(alias))
    if (columnIndex !== undefined) return columnIndex
  }
  // Also try official label
  return headerMap.get(normalizeHeaderName(HEADER_LABELS[key]))
}

function normalizeSkuCode(value) {
  return normalizeText(value).toLocaleUpperCase('en-US')
}

function normalizeAttributeName(value) {
  return normalizeText(value).replace(/\s+/g, ' ').normalize('NFC')
}

function getAttributeNameKey(value) {
  return normalizeAttributeName(value).toLocaleLowerCase('vi-VN')
}

function getCell(sheet, rowIndex, columnIndex) {
  return sheet[XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex })]
}

function getCellValue(sheet, rowIndex, columnIndex) {
  const cell = getCell(sheet, rowIndex, columnIndex)
  if (!cell) return ''
  return cell.v ?? ''
}



function isBlankValue(value) {
  return normalizeText(value) === ''
}

function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function toUint8Array(value) {
  if (value instanceof Uint8Array) return value
  if (value instanceof ArrayBuffer) return new Uint8Array(value)
  return new Uint8Array(value)
}

const CRC32_TABLE = (() => {
  const table = []
  for (let index = 0; index < 256; index += 1) {
    let value = index
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1)
    }
    table[index] = value >>> 0
  }
  return table
})()

function crc32(bytes) {
  let crc = 0xffffffff
  for (let index = 0; index < bytes.length; index += 1) {
    crc = CRC32_TABLE[(crc ^ bytes[index]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function readUint16(bytes, offset) {
  return bytes[offset] | (bytes[offset + 1] << 8)
}

function readUint32(bytes, offset) {
  return (
    bytes[offset] |
    (bytes[offset + 1] << 8) |
    (bytes[offset + 2] << 16) |
    (bytes[offset + 3] << 24)
  ) >>> 0
}

function writeUint16(bytes, offset, value) {
  bytes[offset] = value & 0xff
  bytes[offset + 1] = (value >>> 8) & 0xff
}

function writeUint32(bytes, offset, value) {
  bytes[offset] = value & 0xff
  bytes[offset + 1] = (value >>> 8) & 0xff
  bytes[offset + 2] = (value >>> 16) & 0xff
  bytes[offset + 3] = (value >>> 24) & 0xff
}

function concatUint8Arrays(chunks) {
  const totalLength = chunks.reduce((total, chunk) => total + chunk.length, 0)
  const result = new Uint8Array(totalLength)
  let offset = 0
  chunks.forEach((chunk) => {
    result.set(chunk, offset)
    offset += chunk.length
  })
  return result
}

function buildStoredZip(entries) {
  const encoder = new TextEncoder()
  const localChunks = []
  const centralChunks = []
  let localOffset = 0

  entries.forEach((entry) => {
    const nameBytes = encoder.encode(entry.name)
    const dataBytes = toUint8Array(entry.bytes)
    const checksum = crc32(dataBytes)
    const localHeader = new Uint8Array(30 + nameBytes.length)
    writeUint32(localHeader, 0, 0x04034b50)
    writeUint16(localHeader, 4, 20)
    writeUint16(localHeader, 6, 0)
    writeUint16(localHeader, 8, 0)
    writeUint16(localHeader, 10, 0)
    writeUint16(localHeader, 12, 0)
    writeUint32(localHeader, 14, checksum)
    writeUint32(localHeader, 18, dataBytes.length)
    writeUint32(localHeader, 22, dataBytes.length)
    writeUint16(localHeader, 26, nameBytes.length)
    writeUint16(localHeader, 28, 0)
    localHeader.set(nameBytes, 30)

    localChunks.push(localHeader, dataBytes)

    const centralHeader = new Uint8Array(46 + nameBytes.length)
    writeUint32(centralHeader, 0, 0x02014b50)
    writeUint16(centralHeader, 4, 20)
    writeUint16(centralHeader, 6, 20)
    writeUint16(centralHeader, 8, 0)
    writeUint16(centralHeader, 10, 0)
    writeUint16(centralHeader, 12, 0)
    writeUint16(centralHeader, 14, 0)
    writeUint32(centralHeader, 16, checksum)
    writeUint32(centralHeader, 20, dataBytes.length)
    writeUint32(centralHeader, 24, dataBytes.length)
    writeUint16(centralHeader, 28, nameBytes.length)
    writeUint16(centralHeader, 30, 0)
    writeUint16(centralHeader, 32, 0)
    writeUint16(centralHeader, 34, 0)
    writeUint16(centralHeader, 36, 0)
    writeUint32(centralHeader, 38, 0)
    writeUint32(centralHeader, 42, localOffset)
    centralHeader.set(nameBytes, 46)
    centralChunks.push(centralHeader)

    localOffset += localHeader.length + dataBytes.length
  })

  const centralDirectory = concatUint8Arrays(centralChunks)
  const endRecord = new Uint8Array(22)
  writeUint32(endRecord, 0, 0x06054b50)
  writeUint16(endRecord, 4, 0)
  writeUint16(endRecord, 6, 0)
  writeUint16(endRecord, 8, entries.length)
  writeUint16(endRecord, 10, entries.length)
  writeUint32(endRecord, 12, centralDirectory.length)
  writeUint32(endRecord, 16, localOffset)
  writeUint16(endRecord, 20, 0)

  return concatUint8Arrays([...localChunks, centralDirectory, endRecord])
}

async function inflateRawBytes(bytes) {
  if (typeof DecompressionStream !== 'function') {
    throw new Error('Trình duyệt không hỗ trợ giải nén file Excel.')
  }
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

async function parseZipEntries(arrayBuffer) {
  const bytes = toUint8Array(arrayBuffer)
  const decoder = new TextDecoder()
  const entries = []
  let offset = 0

  while (offset < bytes.length - 4) {
    const signature = readUint32(bytes, offset)
    if (signature === 0x02014b50 || signature === 0x06054b50) break
    if (signature !== 0x04034b50) {
      offset += 1
      continue
    }

    const flags = readUint16(bytes, offset + 6)
    const method = readUint16(bytes, offset + 8)
    const compressedSize = readUint32(bytes, offset + 18)
    const uncompressedSize = readUint32(bytes, offset + 22)
    const nameLength = readUint16(bytes, offset + 26)
    const extraLength = readUint16(bytes, offset + 28)
    const nameStart = offset + 30
    const dataStart = nameStart + nameLength + extraLength
    const dataEnd = dataStart + compressedSize
    const name = decoder.decode(bytes.slice(nameStart, nameStart + nameLength))

    if ((flags & 0x08) !== 0) {
      throw new Error('Không thể đọc file mẫu Excel có data descriptor.')
    }

    let entryBytes
    if (method === 0) {
      entryBytes = bytes.slice(dataStart, dataEnd)
    } else if (method === 8) {
      entryBytes = await inflateRawBytes(bytes.slice(dataStart, dataEnd))
    } else {
      throw new Error('Không thể đọc định dạng nén trong file mẫu Excel.')
    }

    if (entryBytes.length !== uncompressedSize) {
      throw new Error('File mẫu Excel không hợp lệ.')
    }

    entries.push({ name, bytes: entryBytes })
    offset = dataEnd
  }

  return entries
}

async function patchXlsxTextEntries(arrayBuffer, transforms, extraEntries = []) {
  const decoder = new TextDecoder()
  const encoder = new TextEncoder()
  const transformByName = new Map(Object.entries(transforms))
  const extraByName = new Map(extraEntries.map((entry) => [entry.name, entry]))
  const nextEntries = []
  const seenNames = new Set()

  for (const entry of await parseZipEntries(arrayBuffer)) {
    if (extraByName.has(entry.name)) continue
    const transform = transformByName.get(entry.name)
    const bytes = transform
      ? encoder.encode(transform(decoder.decode(entry.bytes)))
      : entry.bytes
    nextEntries.push({ name: entry.name, bytes })
    seenNames.add(entry.name)
  }

  extraEntries.forEach((entry) => {
    if (!seenNames.has(entry.name)) {
      nextEntries.push({
        name: entry.name,
        bytes: typeof entry.text === 'string' ? encoder.encode(entry.text) : toUint8Array(entry.bytes),
      })
    }
  })

  return buildStoredZip(nextEntries)
}

function downloadArrayBuffer(arrayBuffer, filename) {
  const blob = new Blob([arrayBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
}

function parsePositiveInteger(value) {
  const text = normalizeText(value)
  if (!/^[1-9]\d*$/.test(text)) return null
  const number = Number(text)
  return Number.isSafeInteger(number) ? number : null
}

function parseNonNegativeInteger(value) {
  const text = normalizeText(value)
  if (text === '') return ''
  if (!/^\d+$/.test(text)) return null
  const number = Number(text)
  return Number.isSafeInteger(number) ? number : null
}

function parseVndAmount(value) {
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0) return null
    const amount = Math.round(value)
    return Number.isSafeInteger(amount) ? amount : null
  }

  const text = normalizeText(value)
  if (!text) return null
  const amount = parseWholeVndInput(text)
  return Number.isSafeInteger(amount) && amount >= 0 ? amount : null
}

function parseTaxPercent(value) {
  if (isBlankValue(value)) return 0
  if (typeof value === 'number') {
    return Number.isFinite(value) && value >= 0 ? value : null
  }
  const text = normalizeText(value).replace('%', '').replace(',', '.')
  if (!text) return 0
  const amount = Number(text)
  return Number.isFinite(amount) && amount >= 0 ? amount : null
}

function toSkuToken(value) {
  return normalizeText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
}

export function buildGeneratedSkuCode(productName, unitName, conversionRate) {
  const productToken = toSkuToken(productName) || 'SKU'
  const unitToken = toSkuToken(unitName) || 'UNIT'
  const conversion = Number(conversionRate)
  const suffix = Number.isFinite(conversion) && conversion > 1 ? `-${conversion}` : ''
  return `${productToken}-${unitToken}${suffix}`.replace(/-{2,}/g, '-').slice(0, 50)
}

function parseStrictBoolean(value, fallback = null) {
  const text = normalizeComparable(value)
  if (!text) return fallback
  if (['CÓ', 'CO', 'TRUE', '1', 'YES', 'Y'].includes(text)) return true
  if (['KHÔNG', 'KHONG', 'FALSE', '0', 'NO', 'N'].includes(text)) return false
  return null
}

function normalizeProductType(value) {
  const text = normalizeComparable(value)
  if (text === PRODUCT_TYPE.THANH_PHAM || text === 'THÀNH PHẨM' || text === 'SAN PHAM KE' || text === 'SẢN PHẨM KỆ') {
    return PRODUCT_TYPE.THANH_PHAM
  }
  if (text === PRODUCT_TYPE.NGUYEN_LIEU || text === 'NGUYÊN LIỆU') return PRODUCT_TYPE.NGUYEN_LIEU
  if (text === PRODUCT_TYPE.BAO_BI || text === 'BAO BÌ') return PRODUCT_TYPE.BAO_BI
  return ''
}

function getDefaultCapabilitiesByProductType(productType) {
  if (productType === PRODUCT_TYPE.THANH_PHAM) {
    return {
      isPurchasable: true,
      canBeBomComponent: false,
      canUseInCustom: false,
      canHaveBom: true,
    }
  }

  return {
    isPurchasable: true,
    canBeBomComponent: true,
    canUseInCustom: false,
    canHaveBom: false,
  }
}

function normalizeInventoryUnit(value) {
  const text = normalizeComparable(value)
  if (text === 'PIECE' || text === 'CÁI' || text === 'CAI') return 'Piece'
  if (text === 'GRAM' || text === 'G' || text === 'GR') return 'Gram'
  return ''
}

function detectLegacyWorkbook(workbook) {
  const sheetNames = new Set((workbook?.SheetNames ?? []).map((name) => normalizeComparable(name)))
  return sheetNames.has('PRODUCTS') || sheetNames.has('VARIANTS') || sheetNames.has('BOM')
}

function findHeaderContract(sheet) {
  const range = XLSX.utils.decode_range(sheet['!ref'] ?? 'A1:X1')
  for (let rowIndex = range.s.r; rowIndex <= range.e.r; rowIndex += 1) {
    const headerMap = new Map()
    const duplicateHeaders = new Set()

    for (let columnIndex = range.s.c; columnIndex <= Math.min(range.e.c, 23); columnIndex += 1) {
      const normalizedHeader = normalizeHeaderName(getCellValue(sheet, rowIndex, columnIndex))
      if (!normalizedHeader) continue
      if (headerMap.has(normalizedHeader)) duplicateHeaders.add(normalizedHeader)
      headerMap.set(normalizedHeader, columnIndex)
    }

    const hasCoreHeaders = [
      HEADER_LABELS.rowType,
      HEADER_LABELS.productKey,
      HEADER_LABELS.skuRef,
      HEADER_LABELS.componentSku,
      HEADER_LABELS.quickCheck,
    ].every((label) => headerMap.has(normalizeHeaderName(label)))

    if (!hasCoreHeaders) continue

    const columnByKey = {}
    const missingHeaders = []
    REQUIRED_HEADER_KEYS.forEach((key) => {
      const columnIndex = resolveHeaderColumnIndex(headerMap, key)
      if (columnIndex === undefined) {
        missingHeaders.push(HEADER_LABELS[key])
      } else {
        columnByKey[key] = columnIndex
      }
    })

    // Optional tax column (multi-sheet / newer templates)
    const taxColumn = resolveHeaderColumnIndex(headerMap, 'salesTaxPercent')
    if (taxColumn !== undefined) columnByKey.salesTaxPercent = taxColumn

    return {
      rowIndex,
      columnByKey,
      errors: [
        ...Array.from(duplicateHeaders).map((header) => `Header "${header}" bị trùng.`),
        ...missingHeaders.map((header) => `Thiếu cột bắt buộc: ${header}.`),
      ],
    }
  }

  return null
}

function startsExampleSection(value) {
  return normalizeComparable(value).startsWith(EXAMPLE_MARKER)
}

function readImportRow(sheet, rowIndex, columnByKey) {
  const values = {}
  Object.entries(columnByKey).forEach(([key, columnIndex]) => {
    values[key] = getCellValue(sheet, rowIndex, columnIndex)
  })
  return values
}

function isBlankImportRow(values) {
  return [
    'rowType',
    'productKey',
    'skuRef',
    'productName',
    'productType',
    'category',
    'inventoryUnit',
    'description',
    'unitName',
    'conversionRate',
    'isBaseUnit',
    'skuCode',
    'retailPrice',
    'costPrice',
    'barcode',
    'isSellable',
    'minStock',
    'maxStock',
    'attributeName',
    'attributeValue',
    'componentSku',
    'bomQuantity',
    'bomNote',
  ].every((key) => isBlankValue(values[key]))
}

function normalizeRowType(value) {
  const text = normalizeComparable(value)
  if (text === ROW_TYPE.PRODUCT) return ROW_TYPE.PRODUCT
  if (text === ROW_TYPE.SKU) return ROW_TYPE.SKU
  if (text === ROW_TYPE.ATTRIBUTE) return ROW_TYPE.ATTRIBUTE
  if (text === ROW_TYPE.BOM) return ROW_TYPE.BOM
  return ''
}

function buildCategoryResolver(categories = []) {
  const activeCategories = categories.filter((category) => category && category.isDeleted !== true && category.isActive !== false)
  const byKey = new Map()
  const add = (key, category) => {
    const normalizedKey = normalizeComparable(key)
    if (!normalizedKey) return
    const existing = byKey.get(normalizedKey) ?? []
    existing.push(category)
    byKey.set(normalizedKey, existing)
  }

  activeCategories.forEach((category) => {
    add(category.name, category)
    add(category.code ?? category.categoryCode, category)
    add(category.id, category)
  })

  return (rawValue) => {
    const text = normalizeText(rawValue)
    if (!text) return { categoryId: '', error: 'thiếu danh mục.' }

    const matches = byKey.get(normalizeComparable(text)) ?? []
    const uniqueMatches = Array.from(new Map(matches.map((category) => [String(category.id), category])).values())
    if (uniqueMatches.length === 0) {
      return { categoryId: '', error: `Không tìm thấy danh mục "${text}".` }
    }
    if (uniqueMatches.length > 1) {
      return { categoryId: '', error: `Danh mục "${text}" bị trùng/không rõ ràng.` }
    }
    return { categoryId: String(uniqueMatches[0].id), categoryName: uniqueMatches[0].name }
  }
}

function getMaterialUnit(material) {
  const inventoryUnit = getInventoryUnitShortLabel(material?.inventoryUnit ?? material?.InventoryUnit)
  if (inventoryUnit) return inventoryUnit
  const units = toReferenceArray(material?.units ?? material?.Units)
  const baseUnit = units.find((unit) => unit.isBaseUnit ?? unit.IsBaseUnit) || units[0]
  return (
    material?.materialUnitName ??
    material?.MaterialUnitName ??
    material?.baseUnit ??
    material?.BaseUnit ??
    material?.unitName ??
    material?.UnitName ??
    baseUnit?.unitName ??
    baseUnit?.UnitName ??
    ''
  )
}

function buildExternalSkuIndex(materials = []) {
  const bySkuCode = new Map()
  const duplicateSkuCodes = new Set()
  const byBarcode = new Map()

  toReferenceArray(materials).forEach((material) => {
    if (!isActiveRecord(material)) return
    const variants = toReferenceArray(material.variants ?? material.Variants).length
      ? toReferenceArray(material.variants ?? material.Variants)
      : toReferenceArray(material.skus ?? material.Skus)
    const skuSources = variants.length ? variants : [material]
    skuSources.forEach((variant) => {
      if (!isActiveRecord(variant)) return
      const skuCode = normalizeSkuCode(variant.skuCode ?? variant.SkuCode ?? variant.code ?? variant.Code ?? variant.variantSku ?? variant.VariantSku)
      if (!skuCode) return

      const option = {
        productId: material.id ?? material.Id ?? material.productId ?? material.ProductId ?? variant.productId ?? variant.ProductId ?? EMPTY_GUID,
        productName: material.name ?? material.Name ?? material.productName ?? material.ProductName ?? variant.productName ?? variant.ProductName ?? '',
        productType: material.productType ?? material.ProductType ?? material.type ?? material.Type ?? variant.productType ?? variant.ProductType ?? '',
        categoryName: material.categoryName ?? material.CategoryName ?? variant.categoryName ?? variant.CategoryName ?? '',
        materialUnitName: getMaterialUnit(material),
        variantId: variant.id ?? variant.Id ?? variant.variantId ?? variant.VariantId ?? null,
        skuCode,
        variantName:
          variant.variantName ??
          variant.VariantName ??
          variant.skuName ??
          variant.SkuName ??
          variant.packagingType ??
          variant.PackagingType ??
          variant.unitName ??
          variant.UnitName ??
          material.name ??
          material.Name ??
          '',
        unitName: variant.unitName ?? variant.UnitName ?? '',
        barcode: normalizeText(variant.barcode ?? variant.Barcode),
        canBeBomComponent: variant.canBeBomComponent ?? variant.CanBeBomComponent ?? false,
      }

      if (bySkuCode.has(skuCode)) duplicateSkuCodes.add(skuCode)
      bySkuCode.set(skuCode, option)
      if (option.barcode) byBarcode.set(normalizeComparable(option.barcode), option)
    })
  })

  return { bySkuCode, duplicateSkuCodes, byBarcode }
}

function isActiveRecord(item) {
  if (!item) return false
  const status = normalizeComparable(item.status ?? item.Status)
  if (['DELETED', 'INACTIVE', 'DISABLED', 'ARCHIVED'].includes(status)) return false
  return (item.isDeleted ?? item.IsDeleted) !== true && (item.isActive ?? item.IsActive) !== false
}

function getCategoryCode(category) {
  return normalizeText(category?.code ?? category?.Code ?? category?.categoryCode ?? category?.CategoryCode)
}

function getCategoryName(category) {
  return normalizeText(category?.name ?? category?.Name ?? category?.categoryName ?? category?.CategoryName)
}

function getCategoryDisplay(category) {
  return getCategoryName(category) || getCategoryCode(category)
}

function getReferenceAttributeName(option) {
  return normalizeAttributeName(
    option?.name ??
    option?.Name ??
    option?.attributeName ??
    option?.AttributeName ??
    option?.displayName ??
    option?.DisplayName ??
    option,
  )
}

function getReferenceAttributeSource(option) {
  const source = normalizeText(option?.source ?? option?.Source).toLowerCase()
  if (source === 'suggestion') return 'Suggestion'
  if (source === 'request' || source === 'draft') return 'Draft'
  return 'System'
}

function normalizeReferenceLoadStatuses(statuses, counts) {
  const normalizedStatuses = toReferenceArray(statuses)
    .map((status) => ({
      source: normalizeText(status?.source ?? status?.Source),
      status: normalizeText(status?.status ?? status?.Status),
      message: normalizeText(status?.message ?? status?.Message),
    }))
    .filter((status) => status.source || status.message)

  if (normalizedStatuses.length) return normalizedStatuses

  return [
    { source: 'Categories', status: 'OK', message: `OK: ${counts.categories} items` },
    { source: 'Component SKUs', status: 'OK', message: `OK: ${counts.componentSkus} items` },
    { source: 'Attribute Names', status: 'OK', message: `OK: ${counts.attributeNames} items` },
  ]
}

function hasReferenceIssue(referenceData, sourceKeyword) {
  const keyword = normalizeComparable(sourceKeyword)
  return (referenceData.loadStatuses ?? []).some((status) => {
    const source = normalizeComparable(status.source)
    const state = normalizeComparable(status.status)
    const message = normalizeComparable(status.message)
    return source.includes(keyword) && (state.includes('FAILED') || message.includes('FAILED') || message.includes('KHONG') || message.includes('KHÔNG'))
  })
}

function buildProductCreationReferenceNotes(referenceData) {
  const notes = []
  const hasAnyFailure = (referenceData.loadStatuses ?? []).some((status) => {
    const state = normalizeComparable(status.status)
    const message = normalizeComparable(status.message)
    return state.includes('FAILED') || message.includes('FAILED')
  })

  if (hasAnyFailure) {
    notes.push('Lưu ý: Một số dữ liệu tham chiếu không tải được tại thời điểm tạo file. Bạn vẫn có thể nhập tay, hệ thống sẽ kiểm tra lại khi import.')
  }
  if (referenceData.componentSkus.length === 0 || hasReferenceIssue(referenceData, 'COMPONENT')) {
    notes.push('Danh sách Component SKU đang trống hoặc chưa tải được. Vui lòng nhập mã SKU component hợp lệ trong hệ thống hoặc khai báo SKU này trong cùng workbook trước khi dùng làm BOM.')
  }
  if (referenceData.categories.length === 0 || hasReferenceIssue(referenceData, 'CATEGORIES')) {
    notes.push('Danh sách danh mục chưa tải được. Vui lòng nhập đúng tên/mã danh mục đang có trong hệ thống.')
  }

  return notes
}

export function buildProductCreationReferenceData({
  categories = [],
  materials = [],
  attributeNameOptions = [],
  referenceLoadStatuses = [],
} = {}) {
  const categoryRows = toReferenceArray(categories)
    .filter(isActiveRecord)
    .map((category) => ({
      categoryDisplay: getCategoryDisplay(category),
      categoryName: getCategoryName(category),
      categoryCode: getCategoryCode(category),
      productType: normalizeText(category?.productType ?? category?.ProductType ?? category?.type ?? category?.Type),
    }))
    .filter((category) => category.categoryDisplay)
    .sort((left, right) => left.categoryDisplay.localeCompare(right.categoryDisplay, 'vi'))

  const componentSkuRows = Array.from(buildExternalSkuIndex(materials).bySkuCode.values())
    .filter((option) => normalizeText(option.skuCode))
    .map((option) => ({
      skuCode: option.skuCode,
      productName: option.productName || '',
      unitName: option.unitName || option.materialUnitName || '',
      productType: option.productType || '',
      categoryName: option.categoryName || '',
      display: [
        option.skuCode,
        option.productName,
        option.unitName || option.materialUnitName,
      ].filter(Boolean).join(' — '),
    }))
    .sort((left, right) => left.skuCode.localeCompare(right.skuCode, 'vi'))

  const attributeByKey = new Map()
  const addAttribute = (name, source) => {
    const attributeName = normalizeAttributeName(name)
    const key = getAttributeNameKey(attributeName)
    if (!key || attributeByKey.has(key)) return
    attributeByKey.set(key, { attributeName, source })
  }

  toReferenceArray(attributeNameOptions).forEach((option) => addAttribute(getReferenceAttributeName(option), getReferenceAttributeSource(option)))
  ATTRIBUTE_NAME_SUGGESTIONS.forEach((name) => addAttribute(name, 'Suggestion'))

  const attributeRows = Array.from(attributeByKey.values())
    .sort((left, right) => left.attributeName.localeCompare(right.attributeName, 'vi'))

  const loadStatuses = normalizeReferenceLoadStatuses(referenceLoadStatuses, {
    categories: categoryRows.length,
    componentSkus: componentSkuRows.length,
    attributeNames: attributeRows.length,
  })

  return {
    categories: categoryRows,
    componentSkus: componentSkuRows,
    attributeNames: attributeRows,
    loadStatuses,
  }
}

function quotedReferenceSheetName() {
  return `'${PRODUCT_CREATION_REFERENCE_SHEET_NAME.replace(/'/g, "''")}'`
}

function referenceFormula(column, rowCount) {
  return `${quotedReferenceSheetName()}!$${column}$2:$${column}$${Math.max(2, rowCount + 1)}`
}

function buildValidationXml(sqref, formula1) {
  return `<dataValidation type="list" allowBlank="1" showErrorMessage="1" showDropDown="0" errorStyle="warning" errorTitle="Giá trị không hợp lệ" error="Vui lòng chọn từ danh sách dropdown." sqref="${escapeXml(sqref)}"><formula1>${escapeXml(formula1)}</formula1></dataValidation>`
}

function buildDataValidationsXml(validations) {
  if (!validations.length) return ''
  return `<dataValidations count="${validations.length}">${validations.join('')}</dataValidations>`
}

function injectDataValidationsIntoSheetXml(sheetXml, validations) {
  const validationXml = buildDataValidationsXml(validations)
  if (!validationXml) return sheetXml
  const cleanedXml = sheetXml.replace(/<dataValidations[\s\S]*?<\/dataValidations>/, '')
  if (cleanedXml.includes('<pageMargins')) {
    return cleanedXml.replace('<pageMargins', `${validationXml}<pageMargins`)
  }
  return cleanedXml.replace('</worksheet>', `${validationXml}</worksheet>`)
}

function resolveWorkbookSheetPartPaths(workbookXml, relsXml) {
  const relTargetById = new Map()
  for (const match of relsXml.matchAll(/Id="(rId\d+)"[^>]*Target="([^"]+)"/g)) {
    relTargetById.set(match[1], match[2].replace(/^\//, ''))
  }
  // Also support Target before Id
  for (const match of relsXml.matchAll(/Target="([^"]+)"[^>]*Id="(rId\d+)"/g)) {
    relTargetById.set(match[2], match[1].replace(/^\//, ''))
  }

  const sheetPathByName = new Map()
  for (const match of workbookXml.matchAll(/<sheet\b[^>]*>/g)) {
    const tag = match[0]
    const name = tag.match(/\bname="([^"]+)"/)?.[1]
    const rId = tag.match(/\br:id="(rId\d+)"/)?.[1] || tag.match(/\bid="(rId\d+)"/)?.[1]
    if (!name || !rId) continue
    const target = relTargetById.get(rId)
    if (!target) continue
    const partName = target.startsWith('xl/') ? target : `xl/${target.replace(/^\.\//, '')}`
    sheetPathByName.set(name, partName)
  }
  return sheetPathByName
}

function multiSheetReferenceFormula(columnLetter, rowCount) {
  // buildDataSheet: title row1, subtitle row2, header row3, data from row4
  const endRow = Math.max(4, 3 + Math.max(1, rowCount))
  return `'${MULTI_SHEET.reference.replace(/'/g, "''")}'!$${columnLetter}$4:$${columnLetter}$${endRow}`
}

function buildMultiSheetDropdownValidations(referenceData, lastRow = 200) {
  const categories = referenceData.categories?.length || 1
  const componentSkus = referenceData.componentSkus?.length || 1
  const attributeNames = referenceData.attributeNames?.length || 1

  return {
    [MULTI_SHEET.product]: [
      buildValidationXml(`C4:C${lastRow}`, '"THANH_PHAM,NGUYEN_LIEU,BAO_BI"'),
      buildValidationXml(`D4:D${lastRow}`, multiSheetReferenceFormula('C', categories)),
      buildValidationXml(`E4:E${lastRow}`, '"Cái,Gram"'),
    ],
    [MULTI_SHEET.sku]: [
      buildValidationXml(`F4:F${lastRow}`, '"Có,Không"'),
      buildValidationXml(`J4:J${lastRow}`, '"Có,Không"'),
    ],
    [MULTI_SHEET.attribute]: [
      buildValidationXml(`B4:B${lastRow}`, multiSheetReferenceFormula('E', attributeNames)),
    ],
    [MULTI_SHEET.bom]: [
      buildValidationXml(`C4:C${lastRow}`, multiSheetReferenceFormula('D', componentSkus)),
    ],
  }
}

async function injectMultiSheetDropdownValidations(arrayBuffer, referenceData) {
  const decoder = new TextDecoder()
  const entries = await parseZipEntries(arrayBuffer)
  const byName = new Map(entries.map((entry) => [entry.name, entry]))
  const workbookXml = decoder.decode(byName.get('xl/workbook.xml')?.bytes || new Uint8Array())
  const relsXml = decoder.decode(byName.get('xl/_rels/workbook.xml.rels')?.bytes || new Uint8Array())
  if (!workbookXml || !relsXml) return arrayBuffer

  const sheetPathByName = resolveWorkbookSheetPartPaths(workbookXml, relsXml)
  const validationsBySheet = buildMultiSheetDropdownValidations(referenceData)
  const transforms = {}

  Object.entries(validationsBySheet).forEach(([sheetName, validations]) => {
    const partName = sheetPathByName.get(sheetName)
    if (!partName || !byName.has(partName)) return
    transforms[partName] = (sheetXml) => injectDataValidationsIntoSheetXml(sheetXml, validations)
  })

  if (!Object.keys(transforms).length) return arrayBuffer
  return patchXlsxTextEntries(arrayBuffer, transforms)
}

function buildGuidedInputValidations(referenceData, lastRowNumber) {
  const lastRow = Math.max(13, lastRowNumber)
  const validations = [
    buildValidationXml(`A13:A${lastRow}`, '"SẢN PHẨM,SKU,THUỘC TÍNH,BOM"'),
    buildValidationXml(`E13:E${lastRow}`, '"THANH_PHAM,NGUYEN_LIEU,BAO_BI"'),
    buildValidationXml(`F13:F${lastRow}`, referenceFormula('A', referenceData.categories.length)),
    buildValidationXml(`G13:G${lastRow}`, '"Cái,Gram"'),
    buildValidationXml(`K13:K${lastRow}`, '"Có,Không"'),
    buildValidationXml(`P13:P${lastRow}`, '"Có,Không"'),
    buildValidationXml(`S13:S${lastRow}`, referenceFormula('M', referenceData.attributeNames.length)),
    buildValidationXml(`U13:U${lastRow}`, referenceFormula('F', referenceData.componentSkus.length)),
  ]

  return buildDataValidationsXml(validations)
}

function injectGuidedInputValidations(sheetXml, referenceData, lastRowNumber) {
  const cleanedXml = sheetXml.replace(/<dataValidations[\s\S]*?<\/dataValidations>/, '')
  const validationXml = buildGuidedInputValidations(referenceData, lastRowNumber)
  if (cleanedXml.includes('<pageMargins')) {
    return cleanedXml.replace('<pageMargins', `${validationXml}<pageMargins`)
  }
  return cleanedXml.replace('</worksheet>', `${validationXml}</worksheet>`)
}

function columnName(columnIndex) {
  let index = columnIndex + 1
  let name = ''
  while (index > 0) {
    const remainder = (index - 1) % 26
    name = String.fromCharCode(65 + remainder) + name
    index = Math.floor((index - 1) / 26)
  }
  return name
}

function cellRef(rowNumber, columnIndex) {
  return `${columnName(columnIndex)}${rowNumber}`
}

function parseCellRef(reference) {
  const match = String(reference || '').match(/^([A-Z]+)(\d+)$/)
  if (!match) return { column: '', rowNumber: 0 }
  return { column: match[1], rowNumber: Number(match[2]) }
}

function getCellColumnIndex(reference) {
  const { column } = parseCellRef(reference)
  return column.split('').reduce((total, char) => total * 26 + char.charCodeAt(0) - 64, 0) - 1
}

function stripAttribute(xml, attributeName) {
  return xml.replace(new RegExp(`\\s${attributeName}="[^"]*"`, 'g'), '')
}

function setCellOpeningType(opening, type) {
  let nextOpening = stripAttribute(opening, 't')
  if (type) nextOpening = nextOpening.replace(/>$/, ` t="${type}">`)
  return nextOpening
}

function buildCellXmlFromOpening(opening, value) {
  if (value === '' || value === null || value === undefined) {
    return `${stripAttribute(opening, 't').replace(/>$/, '')}/>`
  }
  if (typeof value === 'number') {
    return `${setCellOpeningType(opening, '')}<v>${value}</v></c>`
  }
  return `${setCellOpeningType(opening, 'inlineStr')}<is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`
}

function updateCellXml(rowXml, reference, value) {
  const cellPattern = new RegExp(`<c\\b[^>]*\\br="${reference}"[^>]*(?:/>|>[\\s\\S]*?</c>)`)
  const existingCell = rowXml.match(cellPattern)?.[0]
  if (existingCell) {
    const opening = existingCell.match(/^<c\b[^>]*\/?>/)?.[0]?.replace(/\/>$/, '>') ?? `<c r="${reference}">`
    return rowXml.replace(cellPattern, buildCellXmlFromOpening(opening, value))
  }

  const newCell = buildCellXmlFromOpening(`<c r="${reference}">`, value)
  const insertAt = rowXml.lastIndexOf('</row>')
  if (insertAt < 0) return rowXml

  const cells = [...rowXml.matchAll(/<c\b[^>]*\br="([A-Z]+\d+)"[^>]*(?:\/>|>[\s\S]*?<\/c>)/g)]
  const targetColumn = getCellColumnIndex(reference)
  const nextCell = cells.find((cell) => getCellColumnIndex(cell[1]) > targetColumn)
  if (nextCell?.index !== undefined) {
    return `${rowXml.slice(0, nextCell.index)}${newCell}${rowXml.slice(nextCell.index)}`
  }

  return `${rowXml.slice(0, insertAt)}${newCell}${rowXml.slice(insertAt)}`
}

function getCellXml(rowXml, reference) {
  const cellPattern = new RegExp(`<c\\b[^>]*\\br="${reference}"[^>]*(?:/>|>[\\s\\S]*?</c>)`)
  return rowXml.match(cellPattern)?.[0] ?? ''
}

function upsertCellXml(rowXml, reference, cellXml) {
  const cellPattern = new RegExp(`<c\\b[^>]*\\br="${reference}"[^>]*(?:/>|>[\\s\\S]*?</c>)`)
  if (cellPattern.test(rowXml)) return rowXml.replace(cellPattern, cellXml)

  const insertAt = rowXml.lastIndexOf('</row>')
  if (insertAt < 0) return rowXml

  const cells = [...rowXml.matchAll(/<c\b[^>]*\br="([A-Z]+\d+)"[^>]*(?:\/>|>[\s\S]*?<\/c>)/g)]
  const targetColumn = getCellColumnIndex(reference)
  const nextCell = cells.find((cell) => getCellColumnIndex(cell[1]) > targetColumn)
  if (nextCell?.index !== undefined) {
    return `${rowXml.slice(0, nextCell.index)}${cellXml}${rowXml.slice(nextCell.index)}`
  }

  return `${rowXml.slice(0, insertAt)}${cellXml}${rowXml.slice(insertAt)}`
}

function getTemplateCellStyleId(templateRowXml, sourceRowNumber, columnIndex) {
  const sourceReference = cellRef(sourceRowNumber, columnIndex)
  return getCellXml(templateRowXml, sourceReference).match(/\ss="([^"]+)"/)?.[1] ?? ''
}

function setCellStyleId(rowXml, reference, styleId) {
  let nextRowXml = getCellXml(rowXml, reference)
    ? rowXml
    : updateCellXml(rowXml, reference, '')
  const cellXml = getCellXml(nextRowXml, reference)
  if (!cellXml) return nextRowXml

  const opening = cellXml.match(/^<c\b[^>]*\/?>/)?.[0] ?? `<c r="${reference}">`
  const normalizedOpening = opening.replace(/\/>$/, '>')
  const nextOpening = stripAttribute(normalizedOpening, 's')
    .replace(/>$/, styleId ? ` s="${styleId}">` : '>')
  const replacementOpening = opening.endsWith('/>')
    ? nextOpening.replace(/>$/, '/>')
    : nextOpening

  return nextRowXml.replace(cellXml, cellXml.replace(/^<c\b[^>]*\/?>/, replacementOpening))
}

function getRowXml(sheetXml, rowNumber) {
  const pattern = new RegExp(`<row\\b[^>]*\\br="${rowNumber}"[^>]*(?:/>|>[\\s\\S]*?</row>)`)
  return sheetXml.match(pattern)?.[0] ?? ''
}

function upsertRowXml(sheetXml, rowNumber, rowXml) {
  const rowPattern = new RegExp(`<row\\b[^>]*\\br="${rowNumber}"[^>]*(?:/>|>[\\s\\S]*?</row>)`)
  if (rowPattern.test(sheetXml)) return sheetXml.replace(rowPattern, rowXml)

  const rows = [...sheetXml.matchAll(/<row\b[^>]*\br="(\d+)"[^>]*(?:\/>|>[\s\S]*?<\/row>)/g)]
  const nextRow = rows.find((row) => Number(row[1]) > rowNumber)
  if (nextRow?.index !== undefined) {
    return `${sheetXml.slice(0, nextRow.index)}${rowXml}${sheetXml.slice(nextRow.index)}`
  }

  return sheetXml.replace('</sheetData>', `${rowXml}</sheetData>`)
}

function shiftRowXml(rowXml, delta) {
  const rowNumber = Number(rowXml.match(/\br="(\d+)"/)?.[1] ?? 0)
  if (!rowNumber) return rowXml
  const nextRowNumber = rowNumber + delta
  return rowXml
    .replace(/\br="\d+"/, `r="${nextRowNumber}"`)
    .replace(/r="([A-Z]+)(\d+)"/g, (_, column, row) => `r="${column}${Number(row) + delta}"`)
}

function shiftRows(sheetXml, startRowNumber, delta) {
  if (delta <= 0) return sheetXml
  return sheetXml.replace(/<row\b[^>]*\br="\d+"[^>]*(?:\/>|>[\s\S]*?<\/row>)/g, (rowXml) => {
    const rowNumber = Number(rowXml.match(/\br="(\d+)"/)?.[1] ?? 0)
    return rowNumber >= startRowNumber ? shiftRowXml(rowXml, delta) : rowXml
  })
}

function shiftMergeRef(reference, startRowNumber, delta) {
  return reference.replace(/([A-Z]+)(\d+)/g, (_, column, row) => {
    const rowNumber = Number(row)
    return `${column}${rowNumber >= startRowNumber ? rowNumber + delta : rowNumber}`
  })
}

function shiftMergeCells(sheetXml, startRowNumber, delta) {
  if (delta <= 0) return sheetXml
  return sheetXml.replace(/<mergeCell ref="([^"]+)"\/>/g, (match, reference) =>
    `<mergeCell ref="${shiftMergeRef(reference, startRowNumber, delta)}"/>`)
}

function updateDimensionEndRow(sheetXml, endRowNumber) {
  return sheetXml.replace(/<dimension ref="([^"]+)"/, (match, reference) => {
    const [start, end] = reference.split(':')
    const endRef = end || start
    const endColumn = endRef.match(/^([A-Z]+)/)?.[1] ?? 'X'
    return `<dimension ref="${start}:${endColumn}${Math.max(Number(endRef.match(/\d+$/)?.[0] ?? 1), endRowNumber)}"`
  })
}

function addWarningMerge(sheetXml, hasWarning) {
  if (!hasWarning || sheetXml.includes('<mergeCell ref="A3:X3"/>')) return sheetXml
  if (!sheetXml.includes('<mergeCells')) return sheetXml
  return sheetXml
    .replace(/<mergeCells count="(\d+)">/, (_, count) => `<mergeCells count="${Number(count) + 1}">`)
    .replace('</mergeCells>', '<mergeCell ref="A3:X3"/></mergeCells>')
}

function setRowCellValues(sheetXml, rowNumber, values) {
  let rowXml = getRowXml(sheetXml, rowNumber)
  if (!rowXml) return sheetXml
  values.forEach((value, columnIndex) => {
    if (value === undefined) return
    rowXml = updateCellXml(rowXml, cellRef(rowNumber, columnIndex), value)
  })
  return upsertRowXml(sheetXml, rowNumber, rowXml)
}

function buildQuickCheckFormula(rowNumber) {
  return `IF(COUNTA(A${rowNumber}:W${rowNumber})=0,&quot;&quot;,IF(A${rowNumber}=&quot;SẢN PHẨM&quot;,IF(AND(B${rowNumber}&lt;&gt;&quot;&quot;,D${rowNumber}&lt;&gt;&quot;&quot;,E${rowNumber}&lt;&gt;&quot;&quot;,F${rowNumber}&lt;&gt;&quot;&quot;,G${rowNumber}&lt;&gt;&quot;&quot;),&quot;Hợp lệ&quot;,&quot;Thiếu thông tin sản phẩm&quot;),IF(A${rowNumber}=&quot;SKU&quot;,IF(AND(B${rowNumber}&lt;&gt;&quot;&quot;,C${rowNumber}&lt;&gt;&quot;&quot;,I${rowNumber}&lt;&gt;&quot;&quot;,ISNUMBER(J${rowNumber}),J${rowNumber}&gt;=1,MOD(J${rowNumber},1)=0,K${rowNumber}&lt;&gt;&quot;&quot;,ISNUMBER(M${rowNumber}),M${rowNumber}&gt;=0,P${rowNumber}&lt;&gt;&quot;&quot;),&quot;Hợp lệ&quot;,&quot;Kiểm tra SKU / đơn vị&quot;),IF(A${rowNumber}=&quot;THUỘC TÍNH&quot;,IF(AND(B${rowNumber}&lt;&gt;&quot;&quot;,S${rowNumber}&lt;&gt;&quot;&quot;,T${rowNumber}&lt;&gt;&quot;&quot;),&quot;Hợp lệ&quot;,&quot;Thiếu tên hoặc giá trị&quot;),IF(A${rowNumber}=&quot;BOM&quot;,IF(AND(B${rowNumber}&lt;&gt;&quot;&quot;,C${rowNumber}&lt;&gt;&quot;&quot;,U${rowNumber}&lt;&gt;&quot;&quot;,ISNUMBER(V${rowNumber}),V${rowNumber}&gt;=1,MOD(V${rowNumber},1)=0),&quot;Hợp lệ&quot;,&quot;Kiểm tra BOM&quot;),&quot;Chọn Loại dòng&quot;)))))`
}

function buildEditableRowXml(templateRowXml, sourceRowNumber, targetRowNumber) {
  let rowXml = templateRowXml
    .replace(/\br="\d+"/, `r="${targetRowNumber}"`)
    .replace(
      new RegExp(`r="([A-Z]+)${sourceRowNumber}"`, 'g'),
      (_, column) => `r="${column}${targetRowNumber}"`,
    )

  for (let columnIndex = 0; columnIndex <= 22; columnIndex += 1) {
    rowXml = updateCellXml(rowXml, cellRef(targetRowNumber, columnIndex), '')
  }

  const quickCellRef = cellRef(targetRowNumber, 23)
  const quickPattern = new RegExp(`<c\\b[^>]*\\br="${quickCellRef}"[^>]*(?:/>|>[\\s\\S]*?</c>)`)
  const opening = rowXml.match(quickPattern)?.[0]?.match(/^<c\b[^>]*\/?>/)?.[0]?.replace(/\/>$/, '>') ?? `<c r="${quickCellRef}" s="32">`
  const quickCell = `${setCellOpeningType(opening, 'str')}<f>${buildQuickCheckFormula(targetRowNumber)}</f><v>Chọn Loại dòng</v></c>`
  return quickPattern.test(rowXml)
    ? rowXml.replace(quickPattern, quickCell)
    : rowXml.replace('</row>', `${quickCell}</row>`)
}

function applyEditableRowTemplate(rowXml, templateRowXml, sourceRowNumber, targetRowNumber) {
  let nextRowXml = rowXml

  for (let columnIndex = 0; columnIndex <= 22; columnIndex += 1) {
    nextRowXml = setCellStyleId(
      nextRowXml,
      cellRef(targetRowNumber, columnIndex),
      getTemplateCellStyleId(templateRowXml, sourceRowNumber, columnIndex),
    )
  }

  const quickColumnIndex = 23
  const quickCellRef = cellRef(targetRowNumber, quickColumnIndex)
  const quickStyleId = getTemplateCellStyleId(templateRowXml, sourceRowNumber, quickColumnIndex) || '32'
  const quickCell = `<c r="${quickCellRef}" s="${quickStyleId}" t="str"><f>${buildQuickCheckFormula(targetRowNumber)}</f><v>Chá»n Loáº¡i dĂ²ng</v></c>`

  return upsertCellXml(nextRowXml, quickCellRef, quickCell)
}

function buildReferenceSheetXml(referenceData) {
  const rowCount = Math.max(
    1,
    referenceData.categories.length,
    referenceData.componentSkus.length,
    referenceData.attributeNames.length,
    referenceData.loadStatuses.length,
  )
  const rows = [[
    'CategoryDisplay',
    'CategoryName',
    'CategoryCode',
    'ProductType',
    '',
    'SkuCode',
    'ProductName',
    'UnitName',
    'ProductType',
    'CategoryName',
    'Display',
    '',
    'AttributeName',
    'Source',
    '',
    'Source',
    'Status / Message',
  ]]

  for (let index = 0; index < rowCount; index += 1) {
    const category = referenceData.categories[index] ?? {}
    const componentSku = referenceData.componentSkus[index] ?? {}
    const attribute = referenceData.attributeNames[index] ?? {}
    const loadStatus = referenceData.loadStatuses[index] ?? {}
    rows.push([
      category.categoryDisplay ?? '',
      category.categoryName ?? '',
      category.categoryCode ?? '',
      category.productType ?? '',
      '',
      componentSku.skuCode ?? '',
      componentSku.productName ?? '',
      componentSku.unitName ?? '',
      componentSku.productType ?? '',
      componentSku.categoryName ?? '',
      componentSku.display ?? '',
      '',
      attribute.attributeName ?? '',
      attribute.source ?? '',
      '',
      loadStatus.source ?? '',
      loadStatus.message || [loadStatus.status, loadStatus.message].filter(Boolean).join(': '),
    ])
  }

  const rowXml = rows.map((row, rowIndex) => {
    const rowNumber = rowIndex + 1
    const cells = row.map((value, columnIndex) => {
      if (value === '') return ''
      return `<c r="${cellRef(rowNumber, columnIndex)}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`
    }).join('')
    return `<row r="${rowNumber}">${cells}</row>`
  }).join('')

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:Q${rowCount + 1}"/><sheetViews><sheetView workbookViewId="0"/></sheetViews><sheetFormatPr defaultRowHeight="15"/><cols><col min="1" max="1" width="32" customWidth="1"/><col min="2" max="2" width="28" customWidth="1"/><col min="3" max="3" width="18" customWidth="1"/><col min="4" max="4" width="18" customWidth="1"/><col min="6" max="6" width="28" customWidth="1"/><col min="7" max="7" width="32" customWidth="1"/><col min="8" max="8" width="18" customWidth="1"/><col min="9" max="9" width="18" customWidth="1"/><col min="10" max="10" width="24" customWidth="1"/><col min="11" max="11" width="72" customWidth="1"/><col min="13" max="13" width="28" customWidth="1"/><col min="14" max="14" width="14" customWidth="1"/><col min="16" max="16" width="22" customWidth="1"/><col min="17" max="17" width="72" customWidth="1"/></cols><sheetData>${rowXml}</sheetData><pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/></worksheet>`
}

const REFERENCE_SHEET_REL_ID = 'rIdReferenceData'
const REFERENCE_SHEET_PART = 'xl/worksheets/sheet2.xml'
const REFERENCE_SHEET_TARGET = 'worksheets/sheet2.xml'

function patchWorkbookXml(workbookXml) {
  const withoutReferenceSheet = workbookXml.replace(
    new RegExp(`<sheet\\b(?=[^>]*name="${PRODUCT_CREATION_REFERENCE_SHEET_NAME}")[^>]*/>`, 'g'),
    '',
  )
  const sheetIds = [...withoutReferenceSheet.matchAll(/\bsheetId="(\d+)"/g)].map((match) => Number(match[1]))
  const nextSheetId = Math.max(1, ...sheetIds) + 1
  const sheetXml = `<sheet name="${PRODUCT_CREATION_REFERENCE_SHEET_NAME}" sheetId="${nextSheetId}" state="veryHidden" r:id="${REFERENCE_SHEET_REL_ID}"/>`
  return withoutReferenceSheet.replace('</sheets>', `${sheetXml}</sheets>`)
}

function patchWorkbookRelsXml(relsXml) {
  const cleanedRels = relsXml
    .replace(new RegExp(`<Relationship\\b(?=[^>]*Id="${REFERENCE_SHEET_REL_ID}")[^>]*/>`, 'g'), '')
    .replace(new RegExp(`<Relationship\\b(?=[^>]*Target="${REFERENCE_SHEET_TARGET}")[^>]*/>`, 'g'), '')
  const relationshipXml = `<Relationship Id="${REFERENCE_SHEET_REL_ID}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="${REFERENCE_SHEET_TARGET}"/>`
  return cleanedRels.replace('</Relationships>', `${relationshipXml}</Relationships>`)
}

function patchContentTypesXml(contentTypesXml) {
  const partName = `/${REFERENCE_SHEET_PART}`
  const cleanedTypes = contentTypesXml.replace(
    new RegExp(`<Override\\b(?=[^>]*PartName="${partName.replace(/\//g, '\\/')}")[^>]*/>`, 'g'),
    '',
  )
  const overrideXml = `<Override PartName="${partName}" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
  return cleanedTypes.replace('</Types>', `${overrideXml}</Types>`)
}

function patchTableXml(tableXml, endRowNumber) {
  if (endRowNumber <= 112) return tableXml
  return tableXml.replace(/ref="A12:X\d+"/, `ref="A12:X${endRowNumber}"`)
}

function getExportCellValues(values) {
  return [
    values.rowType ?? '',
    values.productKey ?? '',
    values.skuRef ?? '',
    values.productName ?? '',
    values.productType ?? '',
    values.category ?? '',
    values.inventoryUnit ?? '',
    values.description ?? '',
    values.unitName ?? '',
    values.conversionRate ?? '',
    values.isBaseUnit ?? '',
    values.skuCode ?? '',
    values.retailPrice ?? '',
    values.costPrice ?? '',
    values.barcode ?? '',
    values.isSellable ?? '',
    values.minStock ?? '',
    values.maxStock ?? '',
    values.attributeName ?? '',
    values.attributeValue ?? '',
    values.componentSku ?? '',
    values.bomQuantity ?? '',
    values.bomNote ?? '',
  ]
}

function applyWarningNotesToSheetXml(sheetXml, referenceData) {
  const notes = buildProductCreationReferenceNotes(referenceData)
  if (!notes.length) return sheetXml
  const note = notes.join(' | ')
  const rowXml = `<row r="3" ht="34" customHeight="1" spans="1:24"><c r="A3" s="2" t="inlineStr"><is><t xml:space="preserve">${escapeXml(note)}</t></is></c></row>`
  return addWarningMerge(upsertRowXml(sheetXml, 3, rowXml), true)
}

function applyExportRowsToSheetXml(sheetXml, exportRows = []) {
  if (!exportRows.length) {
    return { sheetXml, requiredEndRow: 112, extraRows: 0 }
  }

  const requiredRowCount = Math.max(DEFAULT_EDITABLE_ROW_COUNT, exportRows.length)
  const requiredEndRow = 12 + requiredRowCount
  const extraRows = Math.max(0, requiredEndRow - 114)
  let nextSheetXml = sheetXml

  if (extraRows > 0) {
    nextSheetXml = shiftRows(nextSheetXml, 115, extraRows)
    nextSheetXml = shiftMergeCells(nextSheetXml, 115, extraRows)
  }

  const templateRowNumber = 112
  const templateRowXml = getRowXml(nextSheetXml, templateRowNumber) || getRowXml(nextSheetXml, 13)
  for (let rowNumber = 13; rowNumber <= requiredEndRow; rowNumber += 1) {
    if (!getRowXml(nextSheetXml, rowNumber) || rowNumber > 112) {
      nextSheetXml = upsertRowXml(
        nextSheetXml,
        rowNumber,
        buildEditableRowXml(templateRowXml, templateRowNumber, rowNumber),
      )
    }
    nextSheetXml = setRowCellValues(
      nextSheetXml,
      rowNumber,
      getExportCellValues(exportRows[rowNumber - 13] ?? {}),
    )
    const rowXml = getRowXml(nextSheetXml, rowNumber)
    if (rowXml) {
      nextSheetXml = upsertRowXml(
        nextSheetXml,
        rowNumber,
        applyEditableRowTemplate(rowXml, templateRowXml, templateRowNumber, rowNumber),
      )
    }
  }

  return {
    sheetXml: nextSheetXml,
    requiredEndRow,
    extraRows,
  }
}

function refreshExampleSectionXml(sheetXml, referenceData, extraRows = 0) {
  let nextSheetXml = sheetXml
  const componentSkuCodes = referenceData.componentSkus.map((sku) => sku.skuCode).filter(Boolean)
  const exampleStartRow = 115 + extraRows
  const bomOffsets = [6, 7, 9, 13, 14, 15]

  bomOffsets.forEach((offset, index) => {
    const rowNumber = exampleStartRow + offset
    const skuCode = componentSkuCodes.length ? componentSkuCodes[index % componentSkuCodes.length] : ''
    nextSheetXml = setRowCellValues(nextSheetXml, rowNumber, [
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      skuCode,
    ])
  })

  if (!componentSkuCodes.length) {
    nextSheetXml = setRowCellValues(nextSheetXml, exampleStartRow + 6, [
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      '',
      '',
      NO_COMPONENT_SKU_NOTE,
    ])
  }

  return nextSheetXml
}

function patchMainSheetXml(sheetXml, referenceData, exportRows = []) {
  const exportPatch = applyExportRowsToSheetXml(sheetXml, exportRows)
  const validationLastRow = Math.max(TEMPLATE_GUIDED_INPUT_LAST_ROW, exportPatch.requiredEndRow)
  let nextSheetXml = exportPatch.sheetXml
  nextSheetXml = applyWarningNotesToSheetXml(nextSheetXml, referenceData)
  nextSheetXml = refreshExampleSectionXml(nextSheetXml, referenceData, exportPatch.extraRows)
  nextSheetXml = injectGuidedInputValidations(nextSheetXml, referenceData, validationLastRow)
  nextSheetXml = updateDimensionEndRow(nextSheetXml, Math.max(130 + exportPatch.extraRows, exportPatch.requiredEndRow))
  return {
    sheetXml: nextSheetXml,
    tableEndRow: exportPatch.requiredEndRow,
  }
}

async function readOfficialProductCreationTemplateBuffer() {
  const response = await fetch(PRODUCT_CREATION_TEMPLATE_URL, { cache: 'no-store' })
  if (!response.ok) {
    throw new Error(`Không tìm thấy file mẫu ${PRODUCT_CREATION_TEMPLATE_FILENAME}.`)
  }
  return response.arrayBuffer()
}

async function buildStylePreservingWorkbookBuffer(referenceData, exportRows = []) {
  const templateBuffer = await readOfficialProductCreationTemplateBuffer()
  const tableEndRow = exportRows.length
    ? 12 + Math.max(DEFAULT_EDITABLE_ROW_COUNT, exportRows.length)
    : 112
  return patchXlsxTextEntries(
    templateBuffer,
    {
      'xl/workbook.xml': patchWorkbookXml,
      'xl/_rels/workbook.xml.rels': patchWorkbookRelsXml,
      '[Content_Types].xml': patchContentTypesXml,
      'xl/tables/table1.xml': (tableXml) => patchTableXml(tableXml, tableEndRow),
      'xl/worksheets/sheet1.xml': (sheetXml) => {
        return patchMainSheetXml(sheetXml, referenceData, exportRows).sheetXml
      },
    },
    [{ name: REFERENCE_SHEET_PART, text: buildReferenceSheetXml(referenceData) }],
  )
}

function calculateDerivedRetailPrice(baseRetailPrice, conversionRate) {
  const basePrice = parseVndAmount(baseRetailPrice)
  const conversion = parsePositiveInteger(conversionRate)
  if (basePrice === null || conversion === null) return ''

  const amount = basePrice * conversion
  return Number.isSafeInteger(amount) && amount >= 0 ? String(amount) : ''
}

function createLocalBomLine(product, componentSku, quantity, note = '') {
  return {
    materialId: EMPTY_GUID,
    materialName: product.name,
    materialUnitName: componentSku.unitName || product.baseUnit,
    quantity,
    componentRequestSkuKey: componentSku.requestSkuKey,
    componentSkuCode: componentSku.skuCode,
    componentVariantName: componentSku.variantName || componentSku.unitName,
    isRequiredBaseComponent: false,
    note,
  }
}

function createExternalBomLine(option, quantity, note = '') {
  return {
    materialId: option.productId,
    materialName: option.productName,
    materialUnitName: option.materialUnitName,
    quantity,
    componentVariantId: option.variantId,
    componentSkuCode: option.skuCode,
    componentVariantName: option.variantName,
    isRequiredBaseComponent: false,
    note,
  }
}

function getBomComponentKey(line) {
  if (line?.componentVariantId) return `variant:${line.componentVariantId}`
  if (line?.componentSkuCode) return `sku:${normalizeSkuCode(line.componentSkuCode)}`
  if (line?.componentRequestSkuKey) return `request:${line.componentRequestSkuKey}`
  return ''
}

function detectWorkbookCycles(products) {
  const graph = new Map()
  const skuByKey = new Map()

  products.forEach((product) => {
    product.skuRows.forEach((sku) => {
      skuByKey.set(sku.requestSkuKey, sku)
      graph.set(sku.requestSkuKey, (sku.bomLines ?? [])
        .filter((line) => line.componentRequestSkuKey)
        .map((line) => line.componentRequestSkuKey))
    })
  })

  const errors = []
  const visiting = new Set()
  const visited = new Set()

  const visit = (skuKey, path) => {
    if (visiting.has(skuKey)) {
      const cycle = [...path, skuKey].map((key) => skuByKey.get(key)?.skuCode || key).join(' -> ')
      errors.push(`Phát hiện vòng lặp BOM trong workbook: ${cycle}.`)
      return
    }
    if (visited.has(skuKey)) return

    visiting.add(skuKey)
    ;(graph.get(skuKey) ?? []).forEach((nextKey) => visit(nextKey, [...path, skuKey]))
    visiting.delete(skuKey)
    visited.add(skuKey)
  }

  graph.forEach((_, skuKey) => visit(skuKey, []))
  return errors
}

function summarizeRows(rows) {
  const skuCount = rows.reduce((total, row) => total + (row.skuRows?.length ?? 0), 0)
  const attributeCount = rows.reduce((total, row) => total + (row.attributes?.filter((attribute) => attribute.attributeName && attribute.value).length ?? 0), 0)
  const manualBomCount = rows.reduce((total, row) => total + (row.skuRows ?? [])
    .reduce((sum, sku) => sum + (sku.bomLines ?? []).filter((line) => !line.isRequiredBaseComponent).length, 0), 0)
  return {
    products: rows.length,
    skus: skuCount,
    attributes: attributeCount,
    manualBomLines: manualBomCount,
  }
}

export function hasMeaningfulProductCreationDraftData(rows = []) {
  return rows.some((row) => {
    if (normalizeText(row.name) || normalizeText(row.description)) return true
    if (normalizeText(row.categoryId) || normalizeText(row.skuCode)) return true
    if ((row.attributes ?? []).some((attribute) => normalizeText(attribute.attributeName) || normalizeText(attribute.value))) return true
    return (row.skuRows ?? []).some((sku) => {
      const hasMeaningfulSku =
        normalizeText(sku.skuCode) ||
        normalizeText(sku.retailPrice) ||
        normalizeText(sku.barcode) ||
        (sku.bomLines ?? []).some((line) => !line.isRequiredBaseComponent)
      return hasMeaningfulSku
    })
  })
}

export function validateAppendProductCreationImport(currentRows, importedRows, helpers) {
  const errors = []
  const currentProductKeys = new Set(currentRows.map((row) => normalizeComparable(row.clientKey)).filter(Boolean))
  const currentSkuKeys = new Set()
  const currentSkuCodes = new Set()

  currentRows.forEach((row) => {
    helpers.syncSkuRows(row, helpers.getSkuRows(row)).forEach((sku) => {
      const skuKey = normalizeComparable(sku.requestSkuKey)
      const skuCode = normalizeSkuCode(sku.skuCode)
      if (skuKey) currentSkuKeys.add(skuKey)
      if (skuCode) currentSkuCodes.add(skuCode)
    })
  })

  importedRows.forEach((row) => {
    const productKey = normalizeComparable(row.clientKey)
    if (productKey && currentProductKeys.has(productKey)) {
      errors.push(`Mã sản phẩm ${row.clientKey} đã tồn tại trong bản nháp hiện tại.`)
    }
    helpers.syncSkuRows(row, helpers.getSkuRows(row)).forEach((sku) => {
      const skuKey = normalizeComparable(sku.requestSkuKey)
      const skuCode = normalizeSkuCode(sku.skuCode)
      if (skuKey && currentSkuKeys.has(skuKey)) {
        errors.push(`Mã SKU tham chiếu ${sku.requestSkuKey} đã tồn tại trong bản nháp hiện tại.`)
      }
      if (skuCode && currentSkuCodes.has(skuCode)) {
        errors.push(`Mã SKU ${sku.skuCode} đã tồn tại trong bản nháp hiện tại.`)
      }
    })
  })

  return errors
}

export async function downloadOfficialProductCreationTemplate({
  categories = [],
  materials = [],
  attributeNameOptions = [],
  referenceLoadStatuses = [],
} = {}) {
  const buffer = await buildOfficialProductCreationTemplateBuffer({
    categories,
    materials,
    attributeNameOptions,
    referenceLoadStatuses,
  })
  downloadArrayBuffer(buffer, PRODUCT_CREATION_TEMPLATE_FILENAME)
}

export async function buildOfficialProductCreationSampleBuffer({
  categories = [],
  materials = [],
  attributeNameOptions = [],
  referenceLoadStatuses = [],
} = {}) {
  const referenceData = buildProductCreationReferenceData({
    categories,
    materials,
    attributeNameOptions,
    referenceLoadStatuses,
  })
  const buffer = buildMultiSheetProductCreationWorkbookBuffer(referenceData, [], { mode: 'sample' })
  const colored = await injectXlsxWorkbookColors(buffer, { kind: 'productCreation' })
  return injectMultiSheetDropdownValidations(colored, referenceData)
}

export async function downloadOfficialProductCreationSample({
  categories = [],
  materials = [],
  attributeNameOptions = [],
  referenceLoadStatuses = [],
} = {}) {
  const buffer = await buildOfficialProductCreationSampleBuffer({
    categories,
    materials,
    attributeNameOptions,
    referenceLoadStatuses,
  })
  downloadArrayBuffer(buffer, PRODUCT_CREATION_SAMPLE_FILENAME)
}

export async function readOfficialProductCreationTemplateWorkbook() {
  const response = await fetch(PRODUCT_CREATION_TEMPLATE_URL, { cache: 'no-store' })
  if (!response.ok) {
    throw new Error(`Không tìm thấy file mẫu ${PRODUCT_CREATION_TEMPLATE_FILENAME}.`)
  }
  const buffer = await response.arrayBuffer()
  return XLSX.read(buffer, { type: 'array', cellFormula: true, cellStyles: true })
}

export async function buildOfficialProductCreationTemplateBuffer({
  categories = [],
  materials = [],
  attributeNameOptions = [],
  referenceLoadStatuses = [],
} = {}) {
  const referenceData = buildProductCreationReferenceData({
    categories,
    materials,
    attributeNameOptions,
    referenceLoadStatuses,
  })
  const buffer = buildMultiSheetProductCreationWorkbookBuffer(referenceData, [], { mode: 'template' })
  const colored = await injectXlsxWorkbookColors(buffer, { kind: 'productCreation' })
  return injectMultiSheetDropdownValidations(colored, referenceData)
}

export async function parseOfficialProductCreationFile(file, context) {
  const filename = file?.name ?? ''
  if (!/\.xlsx$/i.test(filename)) {
    return {
      sourceFilename: filename || 'Không rõ tên file',
      sheetName: '',
      rows: [],
      errors: ['File import phải có định dạng .xlsx.'],
      warnings: [],
      counts: { products: 0, skus: 0, attributes: 0, manualBomLines: 0 },
    }
  }

  try {
    const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellFormula: true, cellStyles: true })
    return parseOfficialProductCreationWorkbook(workbook, {
      ...context,
      sourceFilename: filename,
    })
  } catch {
    return {
      sourceFilename: filename,
      sheetName: '',
      rows: [],
      errors: ['Không thể đọc file Excel. Vui lòng kiểm tra lại file có bị hỏng hay không.'],
      warnings: [],
      counts: { products: 0, skus: 0, attributes: 0, manualBomLines: 0 },
    }
  }
}

export function parseOfficialProductCreationWorkbook(workbook, context) {
  const errors = []
  const warnings = []
  const sourceFilename = context.sourceFilename ?? ''

  if (!workbook || !Array.isArray(workbook.SheetNames)) {
    return {
      sourceFilename,
      sheetName: '',
      rows: [],
      errors: ['Workbook không hợp lệ.'],
      warnings,
      counts: { products: 0, skus: 0, attributes: 0, manualBomLines: 0 },
    }
  }

  const importRows = []
  let sheetName = workbook.SheetNames[0] ?? ''

  if (isMultiSheetProductCreationWorkbook(workbook)) {
    sheetName = MULTI_SHEET.product
    const collected = collectImportRowsFromMultiSheet(workbook)
    errors.push(...collected.errors)
    importRows.push(...collected.importRows)
    warnings.push('Đã đọc mẫu multi-sheet (1_SanPham / 2_SKU / 3_ThuocTinh / 4_BOM).')
  } else if (!workbook.SheetNames.includes(PRODUCT_CREATION_TEMPLATE_SHEET_NAME)) {
    return {
      sourceFilename,
      sheetName,
      rows: [],
      errors: [detectLegacyWorkbook(workbook) ? LEGACY_PRODUCT_CREATION_TEMPLATE_MESSAGE : `Không tìm thấy worksheet ${PRODUCT_CREATION_TEMPLATE_SHEET_NAME} hoặc mẫu multi-sheet 1_SanPham.`],
      warnings,
      counts: { products: 0, skus: 0, attributes: 0, manualBomLines: 0 },
    }
  } else {
    sheetName = PRODUCT_CREATION_TEMPLATE_SHEET_NAME
    const sheet = workbook.Sheets[PRODUCT_CREATION_TEMPLATE_SHEET_NAME]
    const headerContract = findHeaderContract(sheet)
    if (!headerContract) {
      return {
        sourceFilename,
        sheetName: PRODUCT_CREATION_TEMPLATE_SHEET_NAME,
        rows: [],
        errors: ['Không tìm thấy dòng header của mẫu import.'],
        warnings,
        counts: { products: 0, skus: 0, attributes: 0, manualBomLines: 0 },
      }
    }

    errors.push(...headerContract.errors)
    const range = XLSX.utils.decode_range(sheet['!ref'] ?? 'A1:X1')
    for (let rowIndex = headerContract.rowIndex + 1; rowIndex <= range.e.r; rowIndex += 1) {
      const firstColumnValue = getCellValue(sheet, rowIndex, 0)
      if (startsExampleSection(firstColumnValue)) break

      const values = readImportRow(sheet, rowIndex, headerContract.columnByKey)
      if (isBlankImportRow(values)) continue

      const excelRow = rowIndex + 1
      const rowType = normalizeRowType(values.rowType)
      if (!rowType) {
        errors.push(`Dòng ${excelRow}: Loại dòng không được hỗ trợ: "${normalizeText(values.rowType) || '(trống)'}".`)
        continue
      }

      importRows.push({ excelRow, rowType, values })
    }
  }

  warnings.push('Capability SKU được gán mặc định an toàn theo ProductType: THANH_PHAM mặc định mua được, có BOM và CanBeBomComponent=false (phải bật riêng nếu muốn dùng làm component); NGUYEN_LIEU và BAO_BI mặc định mua/có thể là BOM component; CanUseInCustom luôn false.')

  if (importRows.length === 0) {
    errors.push('File không có dữ liệu hàng hóa để import.')
  }

  const resolveCategory = buildCategoryResolver(context.categories ?? [])
  const externalSkuIndex = buildExternalSkuIndex(context.materials ?? [])
  const productsByKey = new Map()
  const rawSkuEntries = []
  const rawAttributeEntries = []
  const rawBomEntries = []

  importRows.forEach((entry) => {
    const { excelRow, rowType, values } = entry
    const productKey = normalizeText(values.productKey)

    if (rowType === ROW_TYPE.PRODUCT) {
      if (!productKey) {
        errors.push(`Dòng ${excelRow}: thiếu Mã sản phẩm.`)
        return
      }
      if (productsByKey.has(productKey)) {
        errors.push(`Dòng ${excelRow}: Mã sản phẩm ${productKey} bị trùng trong workbook.`)
        return
      }

      const name = normalizeText(values.productName)
      const productType = normalizeProductType(values.productType)
      const inventoryUnit = normalizeInventoryUnit(values.inventoryUnit)
      const categoryResult = resolveCategory(values.category)

      if (!name) errors.push(`Dòng ${excelRow}: thiếu Tên sản phẩm.`)
      if (!productType) errors.push(`Dòng ${excelRow}: Loại hàng hóa không hợp lệ.`)
      if (!inventoryUnit) errors.push(`Dòng ${excelRow}: Đơn vị tồn chuẩn không hợp lệ.`)
      if (categoryResult.error) errors.push(`Dòng ${excelRow}: ${categoryResult.error}`)

      productsByKey.set(productKey, {
        excelRow,
        productKey,
        name,
        productType: productType || PRODUCT_TYPE.THANH_PHAM,
        categoryId: categoryResult.categoryId || '',
        categoryName: categoryResult.categoryName || normalizeText(values.category),
        baseUnit: '',
        inventoryUnit: inventoryUnit || 'Piece',
        description: normalizeText(values.description),
        skuEntries: [],
        attributes: [],
      })
      return
    }

    if (rowType === ROW_TYPE.SKU) rawSkuEntries.push({ excelRow, productKey, values })
    if (rowType === ROW_TYPE.ATTRIBUTE) rawAttributeEntries.push({ excelRow, productKey, values })
    if (rowType === ROW_TYPE.BOM) rawBomEntries.push({ excelRow, productKey, values })
  })

  const skuEntriesByKey = new Map()
  const skuCodes = new Map()
  const barcodes = new Map()

  rawSkuEntries.forEach(({ excelRow, productKey, values }) => {
    if (!productKey) {
      errors.push(`Dòng ${excelRow}: SKU thiếu Mã sản phẩm.`)
      return
    }
    const product = productsByKey.get(productKey)
    if (!product) {
      errors.push(`Dòng ${excelRow}: Mã sản phẩm ${productKey} không tồn tại trong workbook.`)
      return
    }

    const requestSkuKey = normalizeText(values.skuRef)
    const unitName = normalizeText(values.unitName)
    const conversionRate = parsePositiveInteger(values.conversionRate)
    const isBaseUnitVariant = parseStrictBoolean(values.isBaseUnit)
    const isSellable = parseStrictBoolean(values.isSellable, getDefaultSellableByType(product.productType))
    const providedSkuCode = normalizeSkuCode(values.skuCode)
    const skuCode = providedSkuCode || buildGeneratedSkuCode(product.name, unitName, conversionRate || '')
    const retailPrice = isBlankValue(values.retailPrice) ? '' : parseVndAmount(values.retailPrice)
    const salesTaxPercent = parseTaxPercent(values.salesTaxPercent)
    const costPrice = isBlankValue(values.costPrice) ? 0 : parseVndAmount(values.costPrice)
    const minStock = isBlankValue(values.minStock) ? 0 : parseNonNegativeInteger(values.minStock)
    const maxStock = isBlankValue(values.maxStock) ? '' : parseNonNegativeInteger(values.maxStock)
    const barcode = normalizeText(values.barcode)

    if (!requestSkuKey) errors.push(`Dòng ${excelRow}: thiếu Mã SKU tham chiếu.`)
    if (!unitName) errors.push(`Dòng ${excelRow}: thiếu Tên đơn vị.`)
    if (!conversionRate) errors.push(`Dòng ${excelRow}: Quy đổi phải là số nguyên dương.`)
    if (isBaseUnitVariant === null) errors.push(`Dòng ${excelRow}: Đơn vị cơ bản chỉ nhận Có hoặc Không.`)
    if (isSellable === null) errors.push(`Dòng ${excelRow}: Bán trực tiếp chỉ nhận Có hoặc Không.`)
    if (retailPrice === null && !isBlankValue(values.retailPrice)) errors.push(`Dòng ${excelRow}: Giá trước thuế không hợp lệ.`)
    if (salesTaxPercent === null) errors.push(`Dòng ${excelRow}: Thuế % không hợp lệ.`)
    if (costPrice === null && !isBlankValue(values.costPrice)) errors.push(`Dòng ${excelRow}: Giá vốn không hợp lệ.`)
    if (minStock === null) errors.push(`Dòng ${excelRow}: Tồn tối thiểu phải là số nguyên không âm.`)
    if (maxStock === null) errors.push(`Dòng ${excelRow}: Tồn tối đa phải là số nguyên không âm.`)

    if (requestSkuKey) {
      const skuKey = normalizeComparable(requestSkuKey)
      if (skuEntriesByKey.has(skuKey)) errors.push(`Dòng ${excelRow}: Mã SKU tham chiếu ${requestSkuKey} bị trùng trong workbook.`)
      skuEntriesByKey.set(skuKey, { product, excelRow })
    }

    if (skuCode) {
      if (skuCodes.has(skuCode)) {
        errors.push(`Dòng ${excelRow}: Mã SKU ${skuCode} bị trùng trong workbook.`)
      }
      if (externalSkuIndex.bySkuCode.has(skuCode)) {
        errors.push(`Dòng ${excelRow}: Mã SKU ${skuCode} đã tồn tại trong ProductService.`)
      }
      skuCodes.set(skuCode, excelRow)
    }

    if (barcode) {
      const barcodeKey = normalizeComparable(barcode)
      if (barcodes.has(barcodeKey)) errors.push(`Dòng ${excelRow}: Barcode ${barcode} bị trùng trong workbook.`)
      if (externalSkuIndex.byBarcode.has(barcodeKey)) errors.push(`Dòng ${excelRow}: Barcode ${barcode} đã tồn tại trong ProductService.`)
      barcodes.set(barcodeKey, excelRow)
    }

    const taxPercent = salesTaxPercent ?? 0
    const salesTaxMode = [8, 10].includes(Number(taxPercent)) ? String(taxPercent) : 'custom'
    const skuEntry = {
      excelRow,
      productKey,
      requestSkuKey,
      unitName,
      conversionRate: conversionRate ? String(conversionRate) : '',
      skuCode,
      variantName: `${product.name || 'Sản phẩm'} - ${unitName || 'đơn vị'}`,
      retailPrice: retailPrice === '' ? '' : String(retailPrice ?? ''),
      importedRetailPrice: retailPrice,
      salesTaxMode,
      salesTaxPercent: String(taxPercent),
      costPrice: String(costPrice ?? 0),
      barcode,
      minStock: String(minStock ?? 0),
      maxStock: maxStock === '' ? '' : String(maxStock ?? ''),
      isSellable: isSellable !== false,
      ...getDefaultCapabilitiesByProductType(product.productType),
      isBaseUnitVariant: Boolean(isBaseUnitVariant),
      isAutoGeneratedSku: !providedSkuCode,
      bomLines: [],
    }

    product.skuEntries.push(skuEntry)
  })

  productsByKey.forEach((product) => {
    if (product.skuEntries.length === 0) {
      errors.push(`Dòng ${product.excelRow}: Sản phẩm ${product.productKey} chưa có SKU.`)
      return
    }

    const baseSkus = product.skuEntries.filter((sku) => sku.isBaseUnitVariant)
    if (baseSkus.length === 0) {
      errors.push(`Dòng ${product.excelRow}: Sản phẩm ${product.productKey} chưa có đơn vị cơ bản.`)
      return
    }
    if (baseSkus.length > 1) {
      errors.push(`Dòng ${product.excelRow}: Sản phẩm ${product.productKey} có nhiều hơn một đơn vị cơ bản.`)
      return
    }

    const baseSku = baseSkus[0]
    const basePrice = parseVndAmount(baseSku.retailPrice)
    product.baseUnit = baseSku.unitName

    product.skuEntries.forEach((sku) => {
      if (sku.isBaseUnitVariant && parsePositiveInteger(sku.conversionRate) !== 1) {
        errors.push(`Dòng ${sku.excelRow}: SKU đơn vị cơ bản phải có Quy đổi = 1.`)
      }
      if (!sku.isBaseUnitVariant) {
        const calculatedPrice = calculateDerivedRetailPrice(baseSku.retailPrice, sku.conversionRate)
        if (sku.importedRetailPrice !== '' && calculatedPrice && Number(sku.importedRetailPrice) !== Number(calculatedPrice)) {
          warnings.push(`Dòng ${sku.excelRow}: Giá trước thuế SKU quy đổi được tính lại theo giá SKU cơ bản × Quy đổi.`)
        }
        sku.retailPrice = calculatedPrice
        sku.salesTaxMode = baseSku.salesTaxMode ?? 'custom'
        sku.salesTaxPercent = baseSku.salesTaxPercent ?? '0'
        sku.baseRequestSkuKey = baseSku.requestSkuKey
        sku.baseSkuCode = baseSku.skuCode
      }
      if ((parseVndAmount(sku.retailPrice) ?? 0) <= 0 && sku.isSellable) {
        errors.push(`Dòng ${sku.excelRow}: SKU bán trực tiếp cần Giá trước thuế > 0 (sau thuế sẽ > 0).`)
      }
    })

    if ((basePrice ?? 0) <= 0 && baseSku.isSellable) {
      errors.push(`Dòng ${baseSku.excelRow}: SKU đơn vị cơ bản bán trực tiếp cần Giá trước thuế > 0.`)
    }
  })

  rawAttributeEntries.forEach(({ excelRow, productKey, values }) => {
    const product = productsByKey.get(productKey)
    const attributeName = normalizeAttributeName(values.attributeName)
    const value = normalizeText(values.attributeValue)
    if (!productKey) errors.push(`Dòng ${excelRow}: THUỘC TÍNH thiếu Mã sản phẩm.`)
    if (productKey && !product) errors.push(`Dòng ${excelRow}: Mã sản phẩm ${productKey} không tồn tại trong workbook.`)
    if (!attributeName) errors.push(`Dòng ${excelRow}: thiếu Tên thuộc tính.`)
    if (!value) errors.push(`Dòng ${excelRow}: Vui lòng nhập giá trị thuộc tính.`)
    if (!product || !attributeName || !value) return

    const attributeKey = getAttributeNameKey(attributeName)
    if (product.attributes.some((attribute) => getAttributeNameKey(attribute.attributeName) === attributeKey)) {
      errors.push(`Dòng ${excelRow}: Thuộc tính này đã được sử dụng cho sản phẩm.`)
      return
    }

    const existingAttribute = context.attributeNameByKey?.get(attributeKey)
    product.attributes.push(context.createAttributeRow({
      attributeNameId: existingAttribute?.id ?? null,
      attributeName: existingAttribute?.name ?? attributeName,
      value,
    }))
  })

  const localSkuByRequestKey = new Map()
  const localSkuByCode = new Map()
  productsByKey.forEach((product) => {
    product.skuEntries.forEach((sku) => {
      localSkuByRequestKey.set(normalizeComparable(sku.requestSkuKey), { product, sku })
      localSkuByCode.set(normalizeSkuCode(sku.skuCode), { product, sku })
    })
  })

  rawBomEntries.forEach(({ excelRow, productKey, values }) => {
    const product = productsByKey.get(productKey)
    const skuRef = normalizeText(values.skuRef)
    const componentSkuCode = normalizeSkuCode(values.componentSku)
    const quantity = parsePositiveInteger(values.bomQuantity)
    const note = normalizeText(values.bomNote)

    if (!productKey) errors.push(`Dòng ${excelRow}: BOM thiếu Mã sản phẩm.`)
    if (productKey && !product) errors.push(`Dòng ${excelRow}: Mã sản phẩm ${productKey} không tồn tại trong workbook.`)
    if (!skuRef) errors.push(`Dòng ${excelRow}: BOM thiếu Mã SKU tham chiếu.`)
    if (!componentSkuCode) errors.push(`Dòng ${excelRow}: BOM thiếu Component SKU.`)
    if (!quantity) errors.push(`Dòng ${excelRow}: Định mức BOM phải là số nguyên dương.`)
    if (!product || !skuRef || !componentSkuCode || !quantity) return

    const outputEntry = localSkuByRequestKey.get(normalizeComparable(skuRef))
    if (!outputEntry) {
      errors.push(`Dòng ${excelRow}: Mã SKU tham chiếu ${skuRef} không tồn tại trong workbook.`)
      return
    }
    if (outputEntry.product.productKey !== productKey) {
      errors.push(`Dòng ${excelRow}: Mã SKU tham chiếu ${skuRef} không thuộc sản phẩm ${productKey}.`)
      return
    }

    const outputSku = outputEntry.sku
    if (!outputSku.isBaseUnitVariant) {
      errors.push(`Dòng ${excelRow}: ${DERIVED_BOM_MESSAGE}`)
      return
    }
    if (outputEntry.product.productType !== PRODUCT_TYPE.THANH_PHAM || outputSku.canHaveBom !== true) {
      errors.push(`Dòng ${excelRow}: Output SKU chỉ được có BOM khi là THANH_PHAM và CanHaveBom=true.`)
      return
    }
    const localComponent = localSkuByCode.get(componentSkuCode)
    const externalComponent = externalSkuIndex.bySkuCode.get(componentSkuCode)

    if (localComponent?.sku.requestSkuKey === outputSku.requestSkuKey || componentSkuCode === normalizeSkuCode(outputSku.skuCode)) {
      errors.push(`Dòng ${excelRow}: Component SKU không được trùng với Output SKU ${outputSku.skuCode}.`)
      return
    }

    if (!localComponent && !externalComponent) {
      errors.push(`Dòng ${excelRow}: Không tìm thấy Component SKU ${componentSkuCode}. Vui lòng chọn SKU từ danh sách gợi ý trong file mẫu hoặc khai báo SKU này trong cùng workbook trước khi dùng làm BOM.`)
      return
    }

    const componentProductType = localComponent?.product?.productType ?? externalComponent?.productType
    const componentCanBeBom = localComponent?.sku?.canBeBomComponent ?? externalComponent?.canBeBomComponent
    if (![PRODUCT_TYPE.NGUYEN_LIEU, PRODUCT_TYPE.BAO_BI, PRODUCT_TYPE.THANH_PHAM].includes(componentProductType) || componentCanBeBom !== true) {
      errors.push(`Dòng ${excelRow}: Component BOM phải là SKU NGUYEN_LIEU/BAO_BI/THANH_PHAM có CanBeBomComponent=true.`)
      return
    }

    if (externalSkuIndex.duplicateSkuCodes.has(componentSkuCode)) {
      errors.push(`Dòng ${excelRow}: Component SKU ${componentSkuCode} bị trùng trong dữ liệu hiện có, không thể tự chọn.`)
      return
    }

    const line = localComponent
      ? createLocalBomLine(localComponent.product, localComponent.sku, quantity, note)
      : createExternalBomLine(externalComponent, quantity, note)
    const componentKey = getBomComponentKey(line)
    if ((outputSku.bomLines ?? []).some((existingLine) => getBomComponentKey(existingLine) === componentKey)) {
      errors.push(`Dòng ${excelRow}: Component SKU ${componentSkuCode} bị trùng trong BOM của ${outputSku.skuCode}.`)
      return
    }

    outputSku.bomLines.push(line)
  })

  productsByKey.forEach((product) => {
    if (product.productType !== PRODUCT_TYPE.THANH_PHAM) return
    const baseSku = product.skuEntries.find((sku) => sku.isBaseUnitVariant) ?? product.skuEntries[0]
    const bomCount = (baseSku?.bomLines ?? []).length
    if (!baseSku || bomCount === 0) {
      errors.push(
        `Sản phẩm ${product.productKey}${product.name ? ` (${product.name})` : ''}: Sản phẩm kệ bắt buộc phải có BOM trước khi gửi duyệt.`,
      )
    }
  })

  const rows = Array.from(productsByKey.values()).map((product) => {
    const draft = context.createDraftProduct()
    const skuRows = product.skuEntries.map((sku) => ({
      requestSkuKey: sku.requestSkuKey,
      unitName: sku.unitName,
      conversionRate: sku.conversionRate,
      skuCode: sku.skuCode,
      variantName: sku.variantName,
      retailPrice: sku.retailPrice,
      salesTaxMode: sku.salesTaxMode ?? 'custom',
      salesTaxPercent: sku.salesTaxPercent ?? '0',
      costPrice: sku.costPrice,
      barcode: sku.barcode,
      minStock: sku.minStock,
      maxStock: sku.maxStock,
      isSellable: sku.isSellable,
      isPurchasable: sku.isPurchasable,
      canBeBomComponent: sku.canBeBomComponent,
      canUseInCustom: sku.canUseInCustom,
      canHaveBom: sku.canHaveBom,
      isBaseUnitVariant: sku.isBaseUnitVariant,
      isAutoGeneratedSku: sku.isAutoGeneratedSku,
      baseRequestSkuKey: sku.baseRequestSkuKey ?? null,
      baseSkuCode: sku.baseSkuCode ?? null,
      bomLines: product.productType === PRODUCT_TYPE.THANH_PHAM ? sku.bomLines : [],
    }))

    return context.syncLegacySkuFields({
      ...draft,
      clientKey: product.productKey,
      variantClientKey: skuRows.find((sku) => sku.isBaseUnitVariant)?.requestSkuKey ?? skuRows[0]?.requestSkuKey ?? `${product.productKey}-sku`,
      name: product.name,
      description: product.description,
      productType: product.productType,
      categoryId: product.categoryId,
      baseUnit: product.baseUnit || skuRows[0]?.unitName || draft.baseUnit,
      inventoryUnit: product.inventoryUnit,
      skuRows,
      attributes: product.attributes,
    }, skuRows)
  })

  errors.push(...detectWorkbookCycles(rows))

  return {
    sourceFilename,
    sheetName,
    rows,
    errors,
    warnings,
    counts: summarizeRows(rows),
    suggestedTitle: sourceFilename.replace(/\.xlsx$/i, ''),
  }
}









function makeExportRows({ rows, categories, helpers }) {
  const categoryById = new Map(categories.map((category) => [String(category.id), category]))
  const exportRows = []

  rows.forEach((row) => {
    const productKey = normalizeText(row.clientKey) || `P${exportRows.length + 1}`
    const category = categoryById.get(String(row.categoryId))
    const skuRows = helpers.syncSkuRows(row, helpers.getSkuRows(row))

    exportRows.push({
      rowType: ROW_TYPE.PRODUCT,
      productKey,
      productName: row.name,
      productType: row.productType,
      category: category?.name || row.categoryName || row.categoryId || '',
      inventoryUnit: row.inventoryUnit || 'Piece',
      description: row.description || '',
    })

    skuRows.forEach((sku) => {
      exportRows.push({
        rowType: ROW_TYPE.SKU,
        productKey,
        skuRef: sku.requestSkuKey,
        unitName: sku.unitName,
        conversionRate: Number(sku.conversionRate || 1),
        isBaseUnit: sku.isBaseUnitVariant ? 'Có' : 'Không',
        skuCode: sku.isAutoGeneratedSku ? '' : sku.skuCode,
        retailPrice: helpers.moneyOrNull(sku.retailPrice) ?? '',
        salesTaxPercent: Number(sku.salesTaxPercent ?? 0),
        costPrice: helpers.moneyOrNull(sku.costPrice) ?? 0,
        barcode: sku.barcode || '',
        isSellable: sku.isSellable !== false ? 'Có' : 'Không',
        minStock: Number(sku.minStock || 0),
        maxStock: sku.maxStock === '' || sku.maxStock == null ? '' : Number(sku.maxStock),
      })
    })

    helpers.getSubmittableAttributes(row.attributes).forEach((attribute) => {
      exportRows.push({
        rowType: ROW_TYPE.ATTRIBUTE,
        productKey,
        attributeName: attribute.attributeName,
        attributeValue: attribute.value,
      })
    })

    skuRows.forEach((sku) => {
      ;(sku.bomLines ?? [])
        .filter((line) => !line.isRequiredBaseComponent)
        .forEach((line) => {
          exportRows.push({
            rowType: ROW_TYPE.BOM,
            productKey,
            skuRef: sku.requestSkuKey,
            componentSku: line.componentSkuCode || '',
            bomQuantity: Number(line.quantity || 0),
            bomNote: line.note || '',
          })
        })
    })
  })

  return exportRows
}











export async function exportProductCreationDraftToTemplate({
  rows,
  categories,
  materials = [],
  attributeNameOptions = [],
  referenceLoadStatuses = [],
  helpers,
  filename,
}) {
  const referenceData = buildProductCreationReferenceData({
    categories,
    materials,
    attributeNameOptions,
    referenceLoadStatuses,
  })
  const exportRows = makeExportRows({ rows, categories, helpers })
  const buffer = buildMultiSheetProductCreationWorkbookBuffer(referenceData, exportRows, { mode: 'template' })
  const colored = await injectXlsxWorkbookColors(buffer, { kind: 'productCreation' })
  const withDropdowns = await injectMultiSheetDropdownValidations(colored, referenceData)
  downloadArrayBuffer(withDropdowns, filename)
}



export function formatProductCreationDraftExportFilename(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0')
  const timestamp = [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join('') + '_' + [
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join('')
  return `YeuCauTaoHangHoaMoi_${timestamp}.xlsx`
}
