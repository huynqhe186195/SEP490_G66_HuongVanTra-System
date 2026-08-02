import * as XLSX from 'xlsx'
import { PRODUCT_TYPE } from './productTypes.js'

/** Same row-type labels as productCreationExcelWorkflow.js */
const ROW_TYPE = {
  PRODUCT: 'SẢN PHẨM',
  SKU: 'SKU',
  ATTRIBUTE: 'THUỘC TÍNH',
  BOM: 'BOM',
}

export const MULTI_SHEET = {
  guide: '0_HuongDan',
  product: '1_SanPham',
  sku: '2_SKU',
  attribute: '3_ThuocTinh',
  bom: '4_BOM',
  reference: '_ThamChieu',
}

export const PRODUCT_CREATION_SAMPLE_FILENAME = 'FileMau_YeuCauTaoHangHoaMoi_CoDuLieu.xlsx'

const THEME = {
  font: 'Times New Roman',
  headerBg: '1B5E3F',
  headerFg: 'FFFFFF',
  zebra: 'EAF7F2',
  white: 'FFFFFF',
  border: 'A8C9C3',
  title: '145C3A',
  muted: '5F6F67',
  tipBg: 'FFF4D6',
  tipBorder: 'E8DCC0',
  sampleBg: 'ECFDF5',
  spacerBg: 'E8ECEA',
  bannerBg: 'B8E0D6',
  bannerFg: '1A4F44',
  sheetTitleBg: '1B5E3F',
  emptyBg: 'F8FAF8',
  groupPalette: ['EAF7F2', 'FFFFFF', 'D1FAE5', 'FFFFFF', 'EAF7F2', 'FFFFFF'],
  typeColors: {
    [PRODUCT_TYPE.THANH_PHAM]: 'D1FAE5',
    [PRODUCT_TYPE.NGUYEN_LIEU]: 'FDE68A',
    [PRODUCT_TYPE.BAO_BI]: 'BFDBFE',
  },
  sheetAccents: {
    product: '1B5E3F',
    sku: '0F766E',
    attribute: '92400E',
    bom: '1D4ED8',
    reference: '3F6F5C',
  },
  sheetGroups: {
    sku: {
      palette: ['CCFBF1', 'FFFFFF', '99F6E4', 'FFFFFF', 'CCFBF1', 'FFFFFF'],
      bannerBg: '5EEAD4',
      bannerFg: '134E4A',
      border: '5EEAD4',
    },
    attribute: {
      palette: ['FFEDD5', 'FFFFFF', 'FED7AA', 'FFFFFF', 'FFEDD5', 'FFFFFF'],
      bannerBg: 'FDBA74',
      bannerFg: '7C2D12',
      border: 'FDBA74',
    },
    bom: {
      palette: ['DBEAFE', 'FFFFFF', 'BFDBFE', 'FFFFFF', 'DBEAFE', 'FFFFFF'],
      bannerBg: '93C5FD',
      bannerFg: '1E3A8A',
      border: '93C5FD',
    },
  },
  moneyKeys: new Set(['retailPrice', 'salesTaxPercent', 'costPrice', 'bomQuantity', 'conversionRate', 'minStock', 'maxStock']),
}

const PRODUCT_COLUMNS = [
  { key: 'productKey', header: 'Mã sản phẩm', aliases: ['Mã SP'], width: 14, minWidth: 12, maxWidth: 16 },
  { key: 'productName', header: 'Tên sản phẩm', width: 26, minWidth: 18, maxWidth: 34 },
  { key: 'productType', header: 'Loại hàng hóa', width: 14, minWidth: 13, maxWidth: 16 },
  { key: 'category', header: 'Danh mục', width: 16, minWidth: 12, maxWidth: 20 },
  { key: 'inventoryUnit', header: 'Đơn vị tồn', aliases: ['Đơn vị tồn chuẩn'], width: 12, minWidth: 11, maxWidth: 14 },
  { key: 'description', header: 'Mô tả', width: 28, minWidth: 18, maxWidth: 36 },
]

const SKU_COLUMNS = [
  { key: 'productKey', header: 'Mã SP', aliases: ['Mã sản phẩm'], width: 10, minWidth: 9, maxWidth: 12 },
  { key: 'skuRef', header: 'SKU tham chiếu', aliases: ['Mã SKU tham chiếu'], width: 14, minWidth: 12, maxWidth: 16 },
  { key: 'skuCode', header: 'Mã SKU', aliases: ['Mã SKU (để trống = tự sinh)'], width: 18, minWidth: 14, maxWidth: 24 },
  { key: 'unitName', header: 'Đơn vị', aliases: ['Tên đơn vị'], width: 10, minWidth: 8, maxWidth: 12 },
  { key: 'conversionRate', header: 'Quy đổi', width: 9, minWidth: 8, maxWidth: 10 },
  { key: 'isBaseUnit', header: 'ĐV cơ bản', aliases: ['Đơn vị cơ bản'], width: 11, minWidth: 10, maxWidth: 12 },
  {
    key: 'retailPrice',
    header: 'Giá trước thuế',
    aliases: ['Giá bán', 'Giá bán trước thuế', 'Price before tax', 'Retail price'],
    width: 13,
    minWidth: 11,
    maxWidth: 16,
  },
  {
    key: 'salesTaxPercent',
    header: 'Thuế %',
    aliases: ['Thuế bán hàng', 'Thuế', 'Sales tax', 'Tax %'],
    width: 9,
    minWidth: 8,
    maxWidth: 11,
  },
  { key: 'costPrice', header: 'Giá vốn', aliases: ['Cost price'], width: 11, minWidth: 10, maxWidth: 13 },
  { key: 'barcode', header: 'Barcode', width: 15, minWidth: 12, maxWidth: 18 },
  { key: 'isSellable', header: 'Bán?', aliases: ['Bán trực tiếp'], width: 8, minWidth: 7, maxWidth: 9 },
  { key: 'minStock', header: 'Tồn min', aliases: ['Tồn tối thiểu'], width: 9, minWidth: 8, maxWidth: 10 },
  { key: 'maxStock', header: 'Tồn max', aliases: ['Tồn tối đa'], width: 9, minWidth: 8, maxWidth: 10 },
]

const ATTR_COLUMNS = [
  { key: 'productKey', header: 'Mã SP', aliases: ['Mã sản phẩm'], width: 12, minWidth: 10, maxWidth: 14 },
  { key: 'attributeName', header: 'Thuộc tính', aliases: ['Tên thuộc tính'], width: 18, minWidth: 14, maxWidth: 24 },
  { key: 'attributeValue', header: 'Giá trị', aliases: ['Giá trị thuộc tính'], width: 28, minWidth: 16, maxWidth: 36 },
]

const BOM_COLUMNS = [
  { key: 'productKey', header: 'Mã SP', aliases: ['Mã sản phẩm'], width: 12, minWidth: 10, maxWidth: 14 },
  { key: 'skuRef', header: 'SKU tham chiếu', aliases: ['Mã SKU tham chiếu'], width: 14, minWidth: 12, maxWidth: 16 },
  { key: 'componentSku', header: 'Component SKU', width: 18, minWidth: 14, maxWidth: 24 },
  { key: 'bomQuantity', header: 'Định mức', width: 10, minWidth: 9, maxWidth: 12 },
  { key: 'bomNote', header: 'Ghi chú', aliases: ['Ghi chú BOM'], width: 36, minWidth: 24, maxWidth: 44 },
]

const IMPORT_VALUE_KEYS = [
  'rowType', 'productKey', 'skuRef', 'productName', 'productType', 'category', 'inventoryUnit',
  'description',
  'unitName', 'conversionRate', 'isBaseUnit', 'skuCode', 'retailPrice', 'salesTaxPercent', 'costPrice',
  'barcode', 'isSellable', 'minStock', 'maxStock', 'attributeName', 'attributeValue',
  'componentSku', 'bomQuantity', 'bomNote', 'quickCheck',
]

function normalizeText(value) {
  return String(value ?? '').trim()
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

function isDecorativeImportRow(values) {
  const productKey = normalizeText(values?.productKey)
  if (!productKey) return false
  return productKey.startsWith('▼') || productKey.startsWith('■') || productKey.startsWith('—')
}

function findSheet(workbook, expectedName) {
  const target = normalizeComparable(expectedName)
  const name = (workbook?.SheetNames ?? []).find((item) => normalizeComparable(item) === target)
  return name ? workbook.Sheets[name] : null
}

function getCellValue(sheet, rowIndex, columnIndex, { preferRawNumber = false } = {}) {
  const cell = sheet[XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex })]
  if (!cell) return ''
  if (preferRawNumber && typeof cell.v === 'number' && Number.isFinite(cell.v)) {
    return String(cell.v)
  }
  if (cell.w != null && String(cell.w).trim() !== '') return String(cell.w).trim()
  if (cell.v == null) return ''
  return String(cell.v).trim()
}

function displayWidth(value) {
  const text = String(value ?? '')
  // Approximate Excel width: ASCII ~1, Vietnamese/wide ~1.15
  let width = 0
  for (const char of text) {
    width += char.charCodeAt(0) > 127 ? 1.15 : 1
  }
  return width
}

function fitColumns(columns, dataRows = [], extraLabels = []) {
  return columns.map((column) => {
    let max = displayWidth(column.header)
    extraLabels.forEach((label) => {
      max = Math.max(max, displayWidth(label) / Math.max(columns.length - 1, 1))
    })
    dataRows.forEach((row) => {
      max = Math.max(max, displayWidth(row?.[column.key]))
    })
    const minWidth = column.minWidth ?? 8
    const maxWidth = column.maxWidth ?? 42
    const width = Math.min(Math.max(Math.ceil(max + 2.5), minWidth), maxWidth)
    return { ...column, width }
  })
}

function headerLookupNames(column) {
  const names = [column.header, ...(column.aliases ?? [])]
  return names.map((name) => normalizeComparable(name))
}

function findHeaderRow(sheet, columns) {
  const range = XLSX.utils.decode_range(sheet['!ref'] ?? 'A1:Z1')
  const expectedGroups = columns.map((column) => headerLookupNames(column))

  for (let rowIndex = range.s.r; rowIndex <= Math.min(range.e.r, 30); rowIndex += 1) {
    const headerMap = new Map()
    for (let columnIndex = range.s.c; columnIndex <= Math.min(range.e.c, 40); columnIndex += 1) {
      const header = normalizeComparable(getCellValue(sheet, rowIndex, columnIndex))
      if (!header) continue
      headerMap.set(header, columnIndex)
    }
    const columnByKey = {}
    let matched = 0
    expectedGroups.forEach((aliases, index) => {
      const columnIndex = aliases.map((alias) => headerMap.get(alias)).find((value) => value !== undefined)
      if (columnIndex !== undefined) {
        matched += 1
        columnByKey[index] = columnIndex
      }
    })
    if (matched >= Math.min(3, columns.length)) {
      return { rowIndex, columnByKey }
    }
  }
  return null
}

function boolLabel(value) {
  if (value === true || value === 'true' || value === 1) return 'Có'
  if (value === false || value === 'false' || value === 0) return 'Không'
  return normalizeText(value)
}

function emptyValues(keys) {
  return keys.reduce((acc, key) => {
    acc[key] = ''
    return acc
  }, {})
}

function thinBorder(color = THEME.border) {
  const edge = { style: 'thin', color: { rgb: color } }
  return { top: edge, left: edge, bottom: edge, right: edge }
}

function mediumTopBorder(color = THEME.headerBg) {
  return {
    top: { style: 'medium', color: { rgb: color } },
    left: { style: 'thin', color: { rgb: THEME.border } },
    bottom: { style: 'thin', color: { rgb: THEME.border } },
    right: { style: 'thin', color: { rgb: THEME.border } },
  }
}

function headerStyle(accent = THEME.headerBg) {
  return {
    font: { name: THEME.font, sz: 12, bold: true, color: { rgb: THEME.headerFg } },
    fill: { patternType: 'solid', fgColor: { rgb: accent } },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border: thinBorder(accent),
  }
}

function titleStyle(accent = THEME.sheetTitleBg) {
  return {
    font: { name: THEME.font, sz: 12.5, bold: true, color: { rgb: THEME.headerFg } },
    fill: { patternType: 'solid', fgColor: { rgb: accent } },
    alignment: { horizontal: 'left', vertical: 'center' },
  }
}

function subtitleStyle() {
  return {
    font: { name: THEME.font, sz: 12, italic: true, color: { rgb: '5A4A20' } },
    fill: { patternType: 'solid', fgColor: { rgb: THEME.tipBg } },
    alignment: { horizontal: 'left', vertical: 'center', wrapText: true },
  }
}

function bannerStyle({ accent = THEME.headerBg, bannerBg = THEME.bannerBg, bannerFg = THEME.bannerFg } = {}) {
  return {
    font: { name: THEME.font, sz: 12, bold: true, color: { rgb: bannerFg } },
    fill: { patternType: 'solid', fgColor: { rgb: bannerBg } },
    alignment: { horizontal: 'left', vertical: 'center' },
    border: {
      top: { style: 'thin', color: { rgb: accent } },
      bottom: { style: 'thin', color: { rgb: accent } },
      left: { style: 'medium', color: { rgb: accent } },
      right: { style: 'thin', color: { rgb: THEME.border } },
    },
  }
}

function spacerStyle() {
  return {
    font: { name: THEME.font, sz: 12, color: { rgb: THEME.spacerBg } },
    fill: { patternType: 'solid', fgColor: { rgb: THEME.spacerBg } },
    border: thinBorder(THEME.spacerBg),
  }
}

function dataStyle({
  bg = THEME.white,
  align = 'left',
  numFmt,
  bold = false,
  topBorder = false,
  accent = THEME.headerBg,
} = {}) {
  const style = {
    font: { name: THEME.font, sz: 12, bold, color: { rgb: '1F2A24' } },
    fill: { patternType: 'solid', fgColor: { rgb: bg } },
    alignment: { horizontal: align, vertical: 'center', wrapText: true },
    border: topBorder ? mediumTopBorder(accent) : thinBorder(),
  }
  if (numFmt) style.numFmt = numFmt
  return style
}

function setStyledCell(sheet, rowIndex, columnIndex, value, style) {
  const address = XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex })
  if (value === '' || value == null) {
    sheet[address] = { t: 's', v: '', s: style }
    return
  }
  const isNumber = typeof value === 'number' && Number.isFinite(value)
  sheet[address] = isNumber
    ? { t: 'n', v: value, s: style }
    : { t: 's', v: String(value), s: style }
}

function applySheetMeta(sheet, columns, lastRow, headerRowIndex = 1) {
  sheet['!ref'] = XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: Math.max(lastRow, headerRowIndex + 1), c: Math.max(columns.length - 1, 0) },
  })
  sheet['!cols'] = columns.map((column) => ({ wch: column.width }))
  sheet['!freeze'] = {
    xSplit: 0,
    ySplit: headerRowIndex + 1,
    topLeftCell: XLSX.utils.encode_cell({ r: headerRowIndex + 1, c: 0 }),
    activePane: 'bottomLeft',
    state: 'frozen',
  }
  sheet['!autofilter'] = {
    ref: XLSX.utils.encode_range({
      s: { r: headerRowIndex, c: 0 },
      e: { r: Math.max(lastRow, headerRowIndex + 1), c: columns.length - 1 },
    }),
  }
}

function columnAlign(key) {
  if (THEME.moneyKeys.has(key) || key === 'isBaseUnit' || key === 'isSellable' || key === 'inventoryUnit' || key === 'productType') {
    return 'center'
  }
  return 'left'
}

function columnNumFmt(key) {
  if (key === 'retailPrice' || key === 'costPrice') return '#,##0'
  if (key === 'salesTaxPercent') return '0.##'
  if (key === 'bomQuantity' || key === 'conversionRate' || key === 'minStock' || key === 'maxStock') return '0'
  return undefined
}

function writeTitleBlock(sheet, columns, { title, subtitle, accent }) {
  columns.forEach((_, columnIndex) => {
    setStyledCell(sheet, 0, columnIndex, columnIndex === 0 ? title : '', titleStyle(accent))
  })
  columns.forEach((_, columnIndex) => {
    setStyledCell(sheet, 1, columnIndex, columnIndex === 0 ? subtitle : '', subtitleStyle())
  })
  sheet['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: columns.length - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: columns.length - 1 } },
  ]
}

function writeHeaderRow(sheet, columns, rowIndex, accent) {
  columns.forEach((column, columnIndex) => {
    setStyledCell(sheet, rowIndex, columnIndex, column.header, headerStyle(accent))
  })
}

function writeDataRow(sheet, columns, rowIndex, values, styleOpts = {}) {
  columns.forEach((column, columnIndex) => {
    const raw = values?.[column.key]
    const isFirstCol = columnIndex === 0
    setStyledCell(
      sheet,
      rowIndex,
      columnIndex,
      raw === '' || raw == null ? '' : raw,
      dataStyle({
        ...styleOpts,
        bg: styleOpts.bg,
        align: columnAlign(column.key),
        numFmt: columnNumFmt(column.key),
        bold: Boolean(styleOpts.boldFirstCol && isFirstCol) || Boolean(styleOpts.bold),
      }),
    )
  })
}

function writeSpacerRow(sheet, columns, rowIndex) {
  columns.forEach((_, columnIndex) => {
    setStyledCell(sheet, rowIndex, columnIndex, '', spacerStyle())
  })
}

function writeBannerRow(sheet, columns, rowIndex, label, accent, bannerColors = {}) {
  const style = bannerStyle({
    accent,
    bannerBg: bannerColors.bannerBg || THEME.bannerBg,
    bannerFg: bannerColors.bannerFg || THEME.bannerFg,
  })
  columns.forEach((_, columnIndex) => {
    setStyledCell(
      sheet,
      rowIndex,
      columnIndex,
      columnIndex === 0 ? label : '',
      style,
    )
  })
  if (!sheet['!merges']) sheet['!merges'] = []
  // Merge ngang cả hàng để hiện đủ "▼ SP01 — Tên sản phẩm" khi mở file
  sheet['!merges'].push({
    s: { r: rowIndex, c: 0 },
    e: { r: rowIndex, c: columns.length - 1 },
  })
}

function groupRowsByProductKey(rows = []) {
  const groups = []
  const indexByKey = new Map()
  rows.forEach((row) => {
    const key = normalizeText(row.productKey) || '(không mã)'
    if (!indexByKey.has(key)) {
      indexByKey.set(key, groups.length)
      groups.push({ key, rows: [] })
    }
    groups[indexByKey.get(key)].rows.push(row)
  })
  return groups
}

function productNameLookup(products = []) {
  const map = new Map()
  products.forEach((product) => {
    map.set(normalizeText(product.productKey), normalizeText(product.productName))
  })
  return map
}

function buildGuideSheet({ isSample = false } = {}) {
  const sheet = {}
  const lines = [
    { text: 'HƯỚNG DẪN NHẬP HÀNG HÓA MỚI', kind: 'title' },
    { text: 'Hương Vân Trà — mẫu Excel nhiều sheet, dễ điền', kind: 'subtitle' },
    { text: '', kind: 'blank' },
    { text: isSample ? 'File này là BẢN CÓ DỮ LIỆU MẪU — dùng để học cách điền.' : 'File này là MẪU TRỐNG (có 1 ví dụ nhẹ) — điền thêm rồi Import.', kind: 'tip' },
    { text: '', kind: 'blank' },
    { text: 'Cách dùng nhanh', kind: 'section' },
    { text: '1. Điền 1 dòng sản phẩm ở sheet 1_SanPham (Mã sản phẩm duy nhất).', kind: 'body' },
    { text: '2. Thêm đơn vị bán ở sheet 2_SKU — ghi cùng Mã sản phẩm.', kind: 'body' },
    { text: '3. (Tuỳ chọn) Thuộc tính ở sheet 3_ThuocTinh.', kind: 'body' },
    { text: '4. BOM ở sheet 4_BOM — bắt buộc với THANH_PHAM (Sản phẩm kệ). Mỗi khối màu = 1 sản phẩm.', kind: 'body' },
    { text: '5. Xem gợi ý / dropdown ở sheet _ThamChieu.', kind: 'body' },
    { text: '6. Ảnh sản phẩm: thêm sau khi import bằng nút Thêm ảnh trên web (upload local).', kind: 'body' },
    { text: '', kind: 'blank' },
    { text: 'Quy tắc quan trọng', kind: 'section' },
    { text: '• Mã sản phẩm là chìa khóa nối các sheet.', kind: 'body' },
    { text: '• Mỗi sản phẩm chỉ có đúng 1 đơn vị cơ bản = Có, Quy đổi = 1.', kind: 'body' },
    { text: '• Đơn vị tồn: Piece hoặc Gram.', kind: 'body' },
    { text: '• Loại hàng hóa: THANH_PHAM / NGUYEN_LIEU / BAO_BI.', kind: 'body' },
    { text: '• Cột Có/Không chỉ nhận: Có hoặc Không.', kind: 'body' },
    { text: '• Không xóa dòng tiêu đề cột. Dòng bắt đầu bằng ▼ là dòng trang trí (không import).', kind: 'body' },
    { text: '', kind: 'blank' },
    { text: 'Mẹo đọc file', kind: 'section' },
    { text: '• Header màu đậm = tiêu đề cột (giữ nguyên).', kind: 'tip' },
    { text: '• Sheet BOM / SKU / Thuộc tính: mỗi sản phẩm một khối màu, cách nhau bằng dòng trống.', kind: 'tip' },
    { text: '• Giá trước thuế / Giá vốn format số. Thuế % để trống = 0. SKU quy đổi tự nhân giá đơn vị cơ bản.', kind: 'tip' },
  ]

  lines.forEach((line, rowIndex) => {
    let style
    if (line.kind === 'title') {
      style = {
        font: { name: THEME.font, sz: 12.5, bold: true, color: { rgb: THEME.headerFg } },
        fill: { patternType: 'solid', fgColor: { rgb: THEME.headerBg } },
        alignment: { horizontal: 'left', vertical: 'center' },
      }
    } else if (line.kind === 'subtitle') {
      style = {
        font: { name: THEME.font, sz: 12, italic: true, color: { rgb: THEME.headerFg } },
        fill: { patternType: 'solid', fgColor: { rgb: '3F7A62' } },
        alignment: { horizontal: 'left', vertical: 'center' },
      }
    } else if (line.kind === 'section') {
      style = {
        font: { name: THEME.font, sz: 12.5, bold: true, color: { rgb: THEME.title } },
        fill: { patternType: 'solid', fgColor: { rgb: THEME.zebra } },
        alignment: { horizontal: 'left', vertical: 'center' },
      }
    } else if (line.kind === 'tip') {
      style = {
        font: { name: THEME.font, sz: 12, italic: true, color: { rgb: '5A4A20' } },
        fill: { patternType: 'solid', fgColor: { rgb: THEME.tipBg } },
        alignment: { horizontal: 'left', vertical: 'center', wrapText: true },
        border: thinBorder(THEME.tipBorder),
      }
    } else if (line.kind === 'blank') {
      style = { font: { name: THEME.font, sz: 12 }, fill: { patternType: 'solid', fgColor: { rgb: THEME.emptyBg } } }
    } else {
      style = {
        font: { name: THEME.font, sz: 12, color: { rgb: THEME.muted } },
        fill: { patternType: 'solid', fgColor: { rgb: THEME.white } },
        alignment: { horizontal: 'left', vertical: 'center', wrapText: true },
      }
    }
    setStyledCell(sheet, rowIndex, 0, line.text, style)
  })

  sheet['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: lines.length - 1, c: 0 } })
  sheet['!cols'] = [{ wch: 102 }]
  sheet['!rows'] = lines.map((line) => ({
    hpt: line.kind === 'title' ? 34 : line.kind === 'subtitle' ? 22 : line.kind === 'tip' ? 24 : 18,
  }))
  return sheet
}

function buildReferenceSheet(referenceData = {}) {
  const categories = (referenceData.categories ?? [])
    .map((item) => (typeof item === 'string' ? item : item.categoryDisplay || item.categoryName || ''))
    .filter(Boolean)
  const componentSkus = (referenceData.componentSkus ?? [])
    .map((item) => (typeof item === 'string' ? item : item.display || item.skuCode || ''))
    .filter(Boolean)
  const attributeNames = (referenceData.attributeNames ?? [])
    .map((item) => (typeof item === 'string' ? item : item.attributeName || ''))
    .filter(Boolean)

  const columns = [
    { key: 'type', header: 'LOẠI HÀNG HÓA', width: 16 },
    { key: 'unit', header: 'ĐƠN VỊ TỒN CHUẨN', width: 18 },
    { key: 'category', header: 'DANH MỤC GỢI Ý', width: 22 },
    { key: 'sku', header: 'SKU NGUYÊN LIỆU / BAO BÌ (BOM)', width: 42 },
    { key: 'attr', header: 'TÊN THUỘC TÍNH GỢI Ý', width: 22 },
  ]

  const rows = [
    {
      type: PRODUCT_TYPE.THANH_PHAM,
      unit: 'Piece',
      category: categories[0] || 'Trà',
      sku: componentSkus[0] || 'LA-TRA-SEN-G',
      attr: attributeNames[0] || 'Hương vị',
    },
    {
      type: PRODUCT_TYPE.NGUYEN_LIEU,
      unit: 'Gram',
      category: categories[1] || categories[0] || 'Trà',
      sku: componentSkus[1] || 'LY-GIAY-350',
      attr: attributeNames[1] || 'Màu sắc',
    },
    {
      type: PRODUCT_TYPE.BAO_BI,
      unit: '',
      category: categories[2] || categories[0] || 'Trà',
      sku: componentSkus[2] || '',
      attr: attributeNames[2] || 'Xuất xứ',
    },
  ]

  const maxExtra = Math.max(categories.length, componentSkus.length, attributeNames.length, 6)
  for (let index = 3; index < maxExtra; index += 1) {
    rows.push({
      type: '',
      unit: '',
      category: categories[index] || '',
      sku: componentSkus[index] || '',
      attr: attributeNames[index] || '',
    })
  }

  return buildDataSheet(columns, rows, 0, {
    title: 'THAM CHIẾU — chọn giá trị gợi ý khi điền các sheet khác',
    subtitle: 'Không import sheet này. Chỉ để nhìn / copy giá trị.',
    accent: THEME.sheetAccents.reference,
    markFilledAsSample: false,
    groupByProduct: false,
  })
}

function buildDataSheet(columns, dataRows, blankCount, options = {}) {
  const {
    title = '',
    subtitle = '',
    accent = THEME.headerBg,
    markFilledAsSample = true,
    groupByProduct = false,
    productNames = new Map(),
    colorByProductType = false,
    groupTheme = null,
  } = options

  const paletteList = groupTheme?.palette || THEME.groupPalette
  const bannerColors = {
    bannerBg: groupTheme?.bannerBg || THEME.bannerBg,
    bannerFg: groupTheme?.bannerFg || THEME.bannerFg,
  }

  const bannerLabels = groupByProduct
    ? groupRowsByProductKey(dataRows).map((group) => {
      const name = productNames.get(group.key)
      return name ? `▼ ${group.key}  —  ${name}` : `▼ ${group.key}`
    })
    : []
  const fittedColumns = fitColumns(columns, dataRows, [title, subtitle, ...bannerLabels])

  const sheet = {}
  const rowHeights = []
  writeTitleBlock(sheet, fittedColumns, { title, subtitle, accent })
  rowHeights.push(26, 20)

  const headerRowIndex = 2
  writeHeaderRow(sheet, fittedColumns, headerRowIndex, accent)
  rowHeights.push(28)

  let rowIndex = headerRowIndex + 1
  const empty = emptyValues(fittedColumns.map((column) => column.key))

  const writeOne = (row, { bg, boldFirstCol = false, topBorder = false }) => {
    writeDataRow(sheet, fittedColumns, rowIndex, row, {
      bg,
      boldFirstCol,
      topBorder,
      accent,
    })
    const longest = fittedColumns.reduce((max, column) => {
      const text = String(row?.[column.key] ?? '')
      const approxLines = Math.ceil(displayWidth(text) / Math.max(column.width, 1))
      return Math.max(max, approxLines)
    }, 1)
    rowHeights[rowIndex] = Math.min(18 + Math.max(0, longest - 1) * 12, 42)
    rowIndex += 1
  }

  if (groupByProduct) {
    const groups = groupRowsByProductKey(dataRows)
    groups.forEach((group, groupIndex) => {
      if (groupIndex > 0) {
        writeSpacerRow(sheet, fittedColumns, rowIndex)
        rowHeights[rowIndex] = 10
        rowIndex += 1
      }

      const palette = paletteList[groupIndex % paletteList.length]
      const name = productNames.get(group.key)
      const bannerLabel = name ? `▼ ${group.key}  —  ${name}` : `▼ ${group.key}`
      writeBannerRow(sheet, fittedColumns, rowIndex, bannerLabel, accent, bannerColors)
      rowHeights[rowIndex] = 22
      rowIndex += 1

      group.rows.forEach((row, rowOffset) => {
        writeOne(row, {
          bg: palette,
          boldFirstCol: rowOffset === 0,
          topBorder: rowOffset === 0,
        })
      })
    })
  } else {
    dataRows.forEach((row, index) => {
      let bg = markFilledAsSample ? THEME.sampleBg : (index % 2 === 1 ? THEME.zebra : THEME.white)
      if (colorByProductType) {
        bg = THEME.typeColors[row.productType] || bg
      }
      writeOne(row, { bg, boldFirstCol: true })
    })
  }

  for (let index = 0; index < blankCount; index += 1) {
    if (groupByProduct && index === 0 && dataRows.length) {
      writeSpacerRow(sheet, fittedColumns, rowIndex)
      rowHeights[rowIndex] = 10
      rowIndex += 1
      writeBannerRow(sheet, fittedColumns, rowIndex, '▼ (thêm sản phẩm mới bên dưới)', accent, bannerColors)
      rowHeights[rowIndex] = 22
      rowIndex += 1
    }
    writeOne(empty, {
      bg: index % 2 === 1 ? THEME.zebra : THEME.emptyBg,
    })
  }

  applySheetMeta(sheet, fittedColumns, Math.max(rowIndex - 1, headerRowIndex + 8), headerRowIndex)
  sheet['!rows'] = rowHeights.map((hpt) => ({ hpt: hpt || 18 }))
  return sheet
}

/** Template download: 1 ví dụ nhẹ */
function demoProductRows() {
  return {
    products: [
      {
        productKey: 'SP01',
        productName: 'Trà Sen',
        productType: PRODUCT_TYPE.THANH_PHAM,
        category: 'Trà',
        inventoryUnit: 'Piece',
        description: 'Ví dụ nhẹ — xóa nếu không dùng',
      },
    ],
    skus: [
      {
        productKey: 'SP01',
        skuRef: 'SP01-U1',
        skuCode: 'TRA-SEN-LY',
        unitName: 'Ly',
        conversionRate: 1,
        isBaseUnit: 'Có',
        retailPrice: 35000,
        costPrice: 12000,
        isSellable: 'Có',
        minStock: 0,
      },
      {
        productKey: 'SP01',
        skuRef: 'SP01-U2',
        skuCode: 'TRA-SEN-SET',
        unitName: 'Set',
        conversionRate: 2,
        isBaseUnit: 'Không',
        retailPrice: 70000,
        costPrice: 24000,
        isSellable: 'Có',
        minStock: 0,
      },
    ],
    attributes: [
      { productKey: 'SP01', attributeName: 'Size', attributeValue: 'M' },
    ],
    boms: [
      {
        productKey: 'SP01',
        skuRef: 'SP01-U1',
        componentSku: 'LA-TRA-SEN-G',
        bomQuantity: 5,
        bomNote: 'Ví dụ BOM — Sản phẩm kệ bắt buộc có BOM',
      },
    ],
  }
}

/** File có dữ liệu mẫu đầy đủ hơn để học */
export function richSampleProductRows() {
  return {
    products: [
      {
        productKey: 'NL01',
        productName: 'Lá trà sen',
        productType: PRODUCT_TYPE.NGUYEN_LIEU,
        category: 'Trà',
        inventoryUnit: 'Gram',
        description: 'Nguyên liệu pha chế',
      },
      {
        productKey: 'NL02',
        productName: 'Lá trà đen',
        productType: PRODUCT_TYPE.NGUYEN_LIEU,
        category: 'Trà',
        inventoryUnit: 'Gram',
        description: 'Trà nền pha trà sữa / đào',
      },
      {
        productKey: 'NL03',
        productName: 'Đường phèn',
        productType: PRODUCT_TYPE.NGUYEN_LIEU,
        category: 'Trà',
        inventoryUnit: 'Gram',
        description: 'Tạo ngọt',
      },
      {
        productKey: 'NL04',
        productName: 'Sữa đặc',
        productType: PRODUCT_TYPE.NGUYEN_LIEU,
        category: 'Trà',
        inventoryUnit: 'Gram',
        description: 'Nguyên liệu trà sữa',
      },
      {
        productKey: 'NL05',
        productName: 'Đào ngâm',
        productType: PRODUCT_TYPE.NGUYEN_LIEU,
        category: 'Trà',
        inventoryUnit: 'Gram',
        description: 'Topping / hương đào',
      },
      {
        productKey: 'BB01',
        productName: 'Ly giấy 350ml',
        productType: PRODUCT_TYPE.BAO_BI,
        category: 'Trà',
        inventoryUnit: 'Piece',
        description: 'Bao bì dùng 1 lần — size M',
      },
      {
        productKey: 'BB02',
        productName: 'Ly giấy 500ml',
        productType: PRODUCT_TYPE.BAO_BI,
        category: 'Trà',
        inventoryUnit: 'Piece',
        description: 'Bao bì dùng 1 lần — size L',
      },
      {
        productKey: 'BB03',
        productName: 'Ống hút giấy',
        productType: PRODUCT_TYPE.BAO_BI,
        category: 'Trà',
        inventoryUnit: 'Piece',
        description: 'Ống hút kèm ly mang đi',
      },
      {
        productKey: 'BB04',
        productName: 'Nắp ly pet',
        productType: PRODUCT_TYPE.BAO_BI,
        category: 'Trà',
        inventoryUnit: 'Piece',
        description: 'Nắp đậy ly mang đi',
      },
      {
        productKey: 'SP01',
        productName: 'Trà Sen',
        productType: PRODUCT_TYPE.THANH_PHAM,
        category: 'Trà',
        inventoryUnit: 'Piece',
        description: 'Thành phẩm bán tại quầy — có BOM',
      },
      {
        productKey: 'SP02',
        productName: 'Trà Đào',
        productType: PRODUCT_TYPE.THANH_PHAM,
        category: 'Trà',
        inventoryUnit: 'Piece',
        description: 'Thành phẩm có 2 size / BOM',
      },
      {
        productKey: 'SP03',
        productName: 'Trà Sữa Trân Châu',
        productType: PRODUCT_TYPE.THANH_PHAM,
        category: 'Trà',
        inventoryUnit: 'Piece',
        description: 'Best-seller — nhiều component BOM',
      },
      {
        productKey: 'SP04',
        productName: 'Trà Lài',
        productType: PRODUCT_TYPE.THANH_PHAM,
        category: 'Trà',
        inventoryUnit: 'Piece',
        description: 'Thành phẩm đơn giản (1 SKU)',
      },
      {
        productKey: 'SP05',
        productName: 'Nước lọc đóng chai',
        productType: PRODUCT_TYPE.THANH_PHAM,
        category: 'Trà',
        inventoryUnit: 'Piece',
        description: 'Thành phẩm mua sẵn — vẫn cần BOM bao bì',
      },
    ],
    skus: [
      {
        productKey: 'NL01',
        skuRef: 'NL01-U1',
        skuCode: 'LA-TRA-SEN-G',
        unitName: 'g',
        conversionRate: 1,
        isBaseUnit: 'Có',
        retailPrice: 0,
        costPrice: 2,
        isSellable: 'Không',
        minStock: 500,
      },
      {
        productKey: 'NL02',
        skuRef: 'NL02-U1',
        skuCode: 'LA-TRA-DEN-G',
        unitName: 'g',
        conversionRate: 1,
        isBaseUnit: 'Có',
        retailPrice: 0,
        costPrice: 2,
        isSellable: 'Không',
        minStock: 800,
      },
      {
        productKey: 'NL03',
        skuRef: 'NL03-U1',
        skuCode: 'DUONG-PHEN-G',
        unitName: 'g',
        conversionRate: 1,
        isBaseUnit: 'Có',
        retailPrice: 0,
        costPrice: 1,
        isSellable: 'Không',
        minStock: 1000,
      },
      {
        productKey: 'NL04',
        skuRef: 'NL04-U1',
        skuCode: 'SUA-DAC-G',
        unitName: 'g',
        conversionRate: 1,
        isBaseUnit: 'Có',
        retailPrice: 0,
        costPrice: 3,
        isSellable: 'Không',
        minStock: 600,
      },
      {
        productKey: 'NL05',
        skuRef: 'NL05-U1',
        skuCode: 'DAO-NGAM-G',
        unitName: 'g',
        conversionRate: 1,
        isBaseUnit: 'Có',
        retailPrice: 0,
        costPrice: 4,
        isSellable: 'Không',
        minStock: 400,
      },
      {
        productKey: 'BB01',
        skuRef: 'BB01-U1',
        skuCode: 'LY-GIAY-350',
        unitName: 'Cái',
        conversionRate: 1,
        isBaseUnit: 'Có',
        retailPrice: 0,
        costPrice: 1500,
        isSellable: 'Không',
        minStock: 100,
      },
      {
        productKey: 'BB02',
        skuRef: 'BB02-U1',
        skuCode: 'LY-GIAY-500',
        unitName: 'Cái',
        conversionRate: 1,
        isBaseUnit: 'Có',
        retailPrice: 0,
        costPrice: 1800,
        isSellable: 'Không',
        minStock: 80,
      },
      {
        productKey: 'BB03',
        skuRef: 'BB03-U1',
        skuCode: 'ONG-HUT-GIAY',
        unitName: 'Cái',
        conversionRate: 1,
        isBaseUnit: 'Có',
        retailPrice: 0,
        costPrice: 300,
        isSellable: 'Không',
        minStock: 200,
      },
      {
        productKey: 'BB04',
        skuRef: 'BB04-U1',
        skuCode: 'NAP-LY-PET',
        unitName: 'Cái',
        conversionRate: 1,
        isBaseUnit: 'Có',
        retailPrice: 0,
        costPrice: 500,
        isSellable: 'Không',
        minStock: 150,
      },
      {
        productKey: 'SP01',
        skuRef: 'SP01-U1',
        skuCode: 'TRA-SEN-LY',
        unitName: 'Ly',
        conversionRate: 1,
        isBaseUnit: 'Có',
        retailPrice: 35000,
        costPrice: 12000,
        barcode: '890100100001',
        isSellable: 'Có',
        minStock: 10,
        maxStock: 200,
      },
      {
        productKey: 'SP01',
        skuRef: 'SP01-U2',
        skuCode: 'TRA-SEN-SET',
        unitName: 'Set',
        conversionRate: 2,
        isBaseUnit: 'Không',
        retailPrice: 70000,
        costPrice: 24000,
        isSellable: 'Có',
        minStock: 5,
      },
      {
        productKey: 'SP02',
        skuRef: 'SP02-U1',
        skuCode: 'TRA-DAO-M',
        unitName: 'Ly M',
        conversionRate: 1,
        isBaseUnit: 'Có',
        retailPrice: 39000,
        costPrice: 14000,
        barcode: '890100100002',
        isSellable: 'Có',
        minStock: 10,
        maxStock: 150,
      },
      {
        productKey: 'SP02',
        skuRef: 'SP02-U2',
        skuCode: 'TRA-DAO-L',
        unitName: 'Ly L',
        conversionRate: 2,
        isBaseUnit: 'Không',
        retailPrice: 78000,
        costPrice: 28000,
        isSellable: 'Có',
        minStock: 8,
      },
      {
        productKey: 'SP03',
        skuRef: 'SP03-U1',
        skuCode: 'TRA-SUA-TC-M',
        unitName: 'Ly M',
        conversionRate: 1,
        isBaseUnit: 'Có',
        retailPrice: 42000,
        costPrice: 16000,
        barcode: '890100100003',
        isSellable: 'Có',
        minStock: 15,
        maxStock: 180,
      },
      {
        productKey: 'SP03',
        skuRef: 'SP03-U2',
        skuCode: 'TRA-SUA-TC-L',
        unitName: 'Ly L',
        conversionRate: 2,
        isBaseUnit: 'Không',
        retailPrice: 84000,
        costPrice: 32000,
        isSellable: 'Có',
        minStock: 10,
      },
      {
        productKey: 'SP04',
        skuRef: 'SP04-U1',
        skuCode: 'TRA-LAI-LY',
        unitName: 'Ly',
        conversionRate: 1,
        isBaseUnit: 'Có',
        retailPrice: 32000,
        costPrice: 11000,
        isSellable: 'Có',
        minStock: 10,
      },
      {
        productKey: 'SP05',
        skuRef: 'SP05-U1',
        skuCode: 'NUOC-LOC-CHAI',
        unitName: 'Chai',
        conversionRate: 1,
        isBaseUnit: 'Có',
        retailPrice: 10000,
        costPrice: 4000,
        barcode: '890100100005',
        isSellable: 'Có',
        minStock: 24,
        maxStock: 300,
      },
    ],
    attributes: [
      { productKey: 'SP01', attributeName: 'Size', attributeValue: 'M' },
      { productKey: 'SP01', attributeName: 'Hương vị', attributeValue: 'Sen' },
      { productKey: 'SP01', attributeName: 'Nhiệt độ', attributeValue: 'Nóng/Lạnh' },
      { productKey: 'SP02', attributeName: 'Hương vị', attributeValue: 'Đào' },
      { productKey: 'SP02', attributeName: 'Size', attributeValue: 'M/L' },
      { productKey: 'SP03', attributeName: 'Hương vị', attributeValue: 'Trà sữa' },
      { productKey: 'SP03', attributeName: 'Topping', attributeValue: 'Trân châu' },
      { productKey: 'SP03', attributeName: 'Độ ngọt', attributeValue: '70%' },
      { productKey: 'SP04', attributeName: 'Hương vị', attributeValue: 'Lài' },
      { productKey: 'SP05', attributeName: 'Dung tích', attributeValue: '500ml' },
      { productKey: 'BB01', attributeName: 'Dung tích', attributeValue: '350ml' },
      { productKey: 'BB02', attributeName: 'Dung tích', attributeValue: '500ml' },
      { productKey: 'NL04', attributeName: 'Xuất xứ', attributeValue: 'Việt Nam' },
    ],
    boms: [
      {
        productKey: 'SP01',
        skuRef: 'SP01-U1',
        componentSku: 'LA-TRA-SEN-G',
        bomQuantity: 8,
        bomNote: '8g lá trà / ly',
      },
      {
        productKey: 'SP01',
        skuRef: 'SP01-U1',
        componentSku: 'DUONG-PHEN-G',
        bomQuantity: 10,
        bomNote: '10g đường phèn',
      },
      {
        productKey: 'SP01',
        skuRef: 'SP01-U1',
        componentSku: 'LY-GIAY-350',
        bomQuantity: 1,
        bomNote: '1 ly giấy / ly thành phẩm',
      },
      {
        productKey: 'SP01',
        skuRef: 'SP01-U1',
        componentSku: 'ONG-HUT-GIAY',
        bomQuantity: 1,
        bomNote: '1 ống hút',
      },
      {
        productKey: 'SP02',
        skuRef: 'SP02-U1',
        componentSku: 'LA-TRA-DEN-G',
        bomQuantity: 7,
        bomNote: '7g trà đen',
      },
      {
        productKey: 'SP02',
        skuRef: 'SP02-U1',
        componentSku: 'DAO-NGAM-G',
        bomQuantity: 30,
        bomNote: '30g đào ngâm',
      },
      {
        productKey: 'SP02',
        skuRef: 'SP02-U1',
        componentSku: 'DUONG-PHEN-G',
        bomQuantity: 12,
        bomNote: '12g đường',
      },
      {
        productKey: 'SP02',
        skuRef: 'SP02-U1',
        componentSku: 'LY-GIAY-350',
        bomQuantity: 1,
        bomNote: '1 ly M',
      },
      {
        productKey: 'SP02',
        skuRef: 'SP02-U1',
        componentSku: 'NAP-LY-PET',
        bomQuantity: 1,
        bomNote: '1 nắp',
      },
      {
        productKey: 'SP03',
        skuRef: 'SP03-U1',
        componentSku: 'LA-TRA-DEN-G',
        bomQuantity: 8,
        bomNote: '8g trà đen',
      },
      {
        productKey: 'SP03',
        skuRef: 'SP03-U1',
        componentSku: 'SUA-DAC-G',
        bomQuantity: 25,
        bomNote: '25g sữa đặc',
      },
      {
        productKey: 'SP03',
        skuRef: 'SP03-U1',
        componentSku: 'DUONG-PHEN-G',
        bomQuantity: 15,
        bomNote: '15g đường',
      },
      {
        productKey: 'SP03',
        skuRef: 'SP03-U1',
        componentSku: 'LY-GIAY-350',
        bomQuantity: 1,
        bomNote: '1 ly M',
      },
      {
        productKey: 'SP03',
        skuRef: 'SP03-U1',
        componentSku: 'ONG-HUT-GIAY',
        bomQuantity: 1,
        bomNote: '1 ống hút',
      },
      {
        productKey: 'SP03',
        skuRef: 'SP03-U1',
        componentSku: 'NAP-LY-PET',
        bomQuantity: 1,
        bomNote: '1 nắp',
      },
      {
        productKey: 'SP04',
        skuRef: 'SP04-U1',
        componentSku: 'LA-TRA-SEN-G',
        bomQuantity: 6,
        bomNote: '6g trà (dùng tạm lá sen làm mẫu)',
      },
      {
        productKey: 'SP04',
        skuRef: 'SP04-U1',
        componentSku: 'LY-GIAY-350',
        bomQuantity: 1,
        bomNote: '1 ly',
      },
      {
        productKey: 'SP05',
        skuRef: 'SP05-U1',
        componentSku: 'LY-GIAY-350',
        bomQuantity: 1,
        bomNote: '1 chai/bao bì mẫu',
      },
    ],
  }
}

function groupExportRows(exportRows = []) {
  const products = []
  const skus = []
  const attributes = []
  const boms = []

  exportRows.forEach((row) => {
    const type = normalizeComparable(row.rowType)
    if (type === normalizeComparable(ROW_TYPE.PRODUCT)) {
      products.push({
        productKey: row.productKey,
        productName: row.productName,
        productType: row.productType,
        category: row.category,
        inventoryUnit: row.inventoryUnit,
        description: row.description,
        quickCheck: row.quickCheck || '',
      })
      return
    }
    if (type === normalizeComparable(ROW_TYPE.SKU)) {
      skus.push({
        productKey: row.productKey,
        skuRef: row.skuRef,
        skuCode: row.skuCode,
        unitName: row.unitName,
        conversionRate: row.conversionRate === '' || row.conversionRate == null ? '' : Number(row.conversionRate),
        isBaseUnit: boolLabel(row.isBaseUnit),
        retailPrice: row.retailPrice === '' || row.retailPrice == null ? '' : Number(row.retailPrice),
        salesTaxPercent: row.salesTaxPercent === '' || row.salesTaxPercent == null ? '' : Number(row.salesTaxPercent),
        costPrice: row.costPrice === '' || row.costPrice == null ? '' : Number(row.costPrice),
        barcode: row.barcode || '',
        isSellable: boolLabel(row.isSellable),
        minStock: row.minStock === '' || row.minStock == null ? '' : Number(row.minStock),
        maxStock: row.maxStock === '' || row.maxStock == null ? '' : Number(row.maxStock),
        quickCheck: row.quickCheck || '',
      })
      return
    }
    if (type === normalizeComparable(ROW_TYPE.ATTRIBUTE)) {
      attributes.push({
        productKey: row.productKey,
        attributeName: row.attributeName,
        attributeValue: row.attributeValue,
        quickCheck: row.quickCheck || '',
      })
      return
    }
    if (type === normalizeComparable(ROW_TYPE.BOM)) {
      boms.push({
        productKey: row.productKey,
        skuRef: row.skuRef,
        componentSku: row.componentSku,
        bomQuantity: row.bomQuantity === '' || row.bomQuantity == null ? '' : Number(row.bomQuantity),
        bomNote: row.bomNote || '',
        quickCheck: row.quickCheck || '',
      })
    }
  })

  return { products, skus, attributes, boms }
}

/**
 * @param {Array} exportRows
 * @param {{ mode?: 'template' | 'sample' }} options
 */
export function resolveProductCreationSheetData(exportRows = [], options = {}) {
  const mode = options.mode === 'sample' ? 'sample' : 'template'
  const hasExport = Array.isArray(exportRows) && exportRows.length > 0
  const data = hasExport
    ? groupExportRows(exportRows)
    : (mode === 'sample' ? richSampleProductRows() : demoProductRows())
  return {
    mode,
    hasExport,
    data,
    names: productNameLookup(data.products),
    blank: {
      product: hasExport ? 8 : (mode === 'sample' ? 6 : 12),
      sku: hasExport ? 12 : (mode === 'sample' ? 8 : 18),
      attribute: hasExport ? 8 : (mode === 'sample' ? 6 : 12),
      bom: hasExport ? 10 : (mode === 'sample' ? 8 : 15),
    },
  }
}

/**
 * Map sample/export categories onto live system category names so dropdown + import match.
 */
export function applyReferenceCategoriesToSheetData(data, referenceData = {}) {
  const categories = (referenceData.categories ?? [])
    .map((item) => ({
      display: typeof item === 'string' ? item : (item.categoryDisplay || item.categoryName || ''),
      productType: typeof item === 'string' ? '' : (item.productType || ''),
    }))
    .filter((item) => item.display)
  if (!categories.length) return data

  const fallback = categories[0].display
  const pick = (productType) => {
    const matched = categories.find((item) => item.productType && item.productType === productType)
    return matched?.display || fallback
  }

  return {
    ...data,
    products: (data.products ?? []).map((product) => ({
      ...product,
      category: pick(product.productType),
    })),
  }
}

/**
 * @param {object} referenceData
 * @param {Array} exportRows
 * @param {{ mode?: 'template' | 'sample' }} options
 */
export function buildMultiSheetProductCreationWorkbook(referenceData = {}, exportRows = [], options = {}) {
  const resolved = resolveProductCreationSheetData(exportRows, options)
  const data = applyReferenceCategoriesToSheetData(resolved.data, referenceData)
  const names = productNameLookup(data.products)
  const { blank, mode, hasExport } = resolved

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, buildGuideSheet({ isSample: mode === 'sample' && !hasExport }), MULTI_SHEET.guide)
  XLSX.utils.book_append_sheet(
    wb,
    buildDataSheet(PRODUCT_COLUMNS, data.products, blank.product, {
      title: '1. SẢN PHẨM — mỗi dòng là 1 sản phẩm',
      subtitle: 'Dropdown: Loại / Danh mục / Đơn vị tồn. Ảnh sản phẩm thêm sau trên web (upload local).',
      accent: THEME.sheetAccents.product,
      colorByProductType: true,
      markFilledAsSample: false,
    }),
    MULTI_SHEET.product,
  )
  XLSX.utils.book_append_sheet(
    wb,
    buildDataSheet(SKU_COLUMNS, data.skus, blank.sku, {
      title: '2. SKU — đơn vị bán theo từng sản phẩm',
      subtitle: 'Mỗi khối = 1 Mã SP. Cột Mã SKU để trống = hệ thống tự sinh. Dòng ▼ không import.',
      accent: THEME.sheetAccents.sku,
      groupByProduct: true,
      productNames: names,
      groupTheme: THEME.sheetGroups.sku,
    }),
    MULTI_SHEET.sku,
  )
  XLSX.utils.book_append_sheet(
    wb,
    buildDataSheet(ATTR_COLUMNS, data.attributes, blank.attribute, {
      title: '3. THUỘC TÍNH — tuỳ chọn',
      subtitle: 'Nhóm theo Mã SP. Có thể để trống nếu không dùng.',
      accent: THEME.sheetAccents.attribute,
      groupByProduct: true,
      productNames: names,
      groupTheme: THEME.sheetGroups.attribute,
    }),
    MULTI_SHEET.attribute,
  )
  XLSX.utils.book_append_sheet(
    wb,
    buildDataSheet(BOM_COLUMNS, data.boms, blank.bom, {
      title: '4. BOM — định mức nguyên liệu / bao bì',
      subtitle: 'Mỗi khối = 1 thành phẩm. Sản phẩm kệ (THANH_PHAM) bắt buộc có BOM trên SKU đơn vị cơ bản.',
      accent: THEME.sheetAccents.bom,
      groupByProduct: true,
      productNames: names,
      groupTheme: THEME.sheetGroups.bom,
    }),
    MULTI_SHEET.bom,
  )
  XLSX.utils.book_append_sheet(wb, buildReferenceSheet(referenceData), MULTI_SHEET.reference)
  return wb
}

export function buildMultiSheetProductCreationWorkbookBuffer(referenceData = {}, exportRows = [], options = {}) {
  const workbook = buildMultiSheetProductCreationWorkbook(referenceData, exportRows, options)
  return XLSX.write(workbook, { bookType: 'xlsx', type: 'array', cellStyles: true })
}

export function buildSampleProductCreationWorkbookBuffer(referenceData = {}) {
  return buildMultiSheetProductCreationWorkbookBuffer(referenceData, [], { mode: 'sample' })
}

export function isMultiSheetProductCreationWorkbook(workbook) {
  return Boolean(findSheet(workbook, MULTI_SHEET.product) && findSheet(workbook, MULTI_SHEET.sku))
}

function readSheetRows(sheet, columns, sheetName) {
  const header = findHeaderRow(sheet, columns)
  if (!header) {
    return {
      errors: [`Sheet "${sheetName}" thiếu dòng tiêu đề hợp lệ.`],
      rows: [],
    }
  }

  const range = XLSX.utils.decode_range(sheet['!ref'] ?? 'A1:Z1')
  const rows = []
  for (let rowIndex = header.rowIndex + 1; rowIndex <= range.e.r; rowIndex += 1) {
    const values = emptyValues(columns.map((column) => column.key))
    let hasAny = false
    columns.forEach((column, index) => {
      const columnIndex = header.columnByKey[index]
      if (columnIndex === undefined) return
      const preferRawNumber = THEME.moneyKeys.has(column.key)
      const value = getCellValue(sheet, rowIndex, columnIndex, { preferRawNumber })
      values[column.key] = value
      if (value) hasAny = true
    })
    if (!hasAny) continue
    if (isDecorativeImportRow(values)) continue
    rows.push({
      excelRow: `${sheetName}!${rowIndex + 1}`,
      values,
    })
  }
  return { errors: [], rows }
}

function toImportEntry(excelRow, rowType, values) {
  return {
    excelRow,
    rowType,
    values: {
      ...emptyValues(IMPORT_VALUE_KEYS),
      ...values,
      rowType,
    },
  }
}

export function collectImportRowsFromMultiSheet(workbook) {
  const errors = []
  const importRows = []

  const productSheet = findSheet(workbook, MULTI_SHEET.product)
  const skuSheet = findSheet(workbook, MULTI_SHEET.sku)
  const attrSheet = findSheet(workbook, MULTI_SHEET.attribute)
  const bomSheet = findSheet(workbook, MULTI_SHEET.bom)

  if (!productSheet || !skuSheet) {
    errors.push('File multi-sheet thiếu sheet 1_SanPham hoặc 2_SKU.')
    return { errors, importRows }
  }

  const products = readSheetRows(productSheet, PRODUCT_COLUMNS, MULTI_SHEET.product)
  const skus = readSheetRows(skuSheet, SKU_COLUMNS, MULTI_SHEET.sku)
  const attrs = attrSheet
    ? readSheetRows(attrSheet, ATTR_COLUMNS, MULTI_SHEET.attribute)
    : { errors: [], rows: [] }
  const boms = bomSheet
    ? readSheetRows(bomSheet, BOM_COLUMNS, MULTI_SHEET.bom)
    : { errors: [], rows: [] }

  errors.push(...products.errors, ...skus.errors, ...attrs.errors, ...boms.errors)

  products.rows.forEach(({ excelRow, values }) => {
    importRows.push(toImportEntry(excelRow, ROW_TYPE.PRODUCT, values))
  })

  const skuIndexByProduct = new Map()
  skus.rows.forEach(({ excelRow, values }) => {
    const productKey = normalizeText(values.productKey)
    const nextIndex = (skuIndexByProduct.get(productKey) || 0) + 1
    skuIndexByProduct.set(productKey, nextIndex)
    const skuCode = normalizeText(values.skuCode)
    const skuRef = normalizeText(values.skuRef) || skuCode || (productKey ? `${productKey}-U${nextIndex}` : '')
    importRows.push(toImportEntry(excelRow, ROW_TYPE.SKU, {
      ...values,
      skuRef,
      skuCode,
    }))
  })

  attrs.rows.forEach(({ excelRow, values }) => {
    importRows.push(toImportEntry(excelRow, ROW_TYPE.ATTRIBUTE, values))
  })

  boms.rows.forEach(({ excelRow, values }) => {
    importRows.push(toImportEntry(excelRow, ROW_TYPE.BOM, values))
  })

  return { errors, importRows }
}
