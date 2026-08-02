import * as XLSX from 'xlsx'
import {
  downloadBlob,
  injectXlsxWorkbookColors,
  parseZipEntries,
  patchXlsxEntries,
} from '../../utils/xlsxColorInject.js'

export const SUPPLIER_PRODUCT_IMPORT_COLUMNS = [
  'Mã SKU',
  'Tên sản phẩm',
  'Mã hàng của NCC',
  'Tên hàng theo NCC',
  'Giá chào (VNĐ)',
  'Ghi chú',
]

export const SUPPLIER_PRODUCT_TEMPLATE_FILENAME = 'Mau_Danh_Muc_Hang_Cung_Ung.xlsx'
export const SUPPLIER_PRODUCT_SAMPLE_FILENAME = 'Mau_Danh_Muc_Hang_Cung_Ung_CoDuLieu.xlsx'

const DATA_SHEET = 'Hang_cung_ung'
const GUIDE_SHEET = 'Huong_dan'
const REFERENCE_SHEET = '_ThamChieu'
const DROPDOWN_EXTRA_ROWS = 40

const THEME = {
  titleBg: '1B5E3F',
  headerBg: '0F766E',
  headerFg: 'FFFFFF',
  subtitleBg: 'FFF4D6',
  zebra: 'EAF7F2',
  white: 'FFFFFF',
  border: 'A8C9C3',
  tipBg: 'FEF3C7',
  labelBg: 'D1FAE5',
  skuCol: 'ECFDF5',
  moneyCol: 'F0FDFA',
}

const FALLBACK_SKU_ITEMS = [
  { skuCode: 'LA-TRA-SEN-G', productName: 'Lá trà sen' },
  { skuCode: 'LA-TRA-DEN-G', productName: 'Lá trà đen' },
  { skuCode: 'LY-GIAY-350', productName: 'Ly giấy 350ml' },
  { skuCode: 'ONG-HUT-GIAY', productName: 'Ống hút giấy' },
  { skuCode: 'DUONG-PHEN-G', productName: 'Đường phèn' },
]

function cellText(value) {
  if (value == null) return ''
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10)
  return String(value).trim()
}

function normalizeKey(value) {
  return cellText(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .replace(/[\s_-]+/g, '')
}

/** Giá chào trong file có thể ghi "1.200.000", "1,200,000" hay "1200000 đ". */
function normalizePrice(value) {
  const text = cellText(value)
  if (!text) return ''
  const digits = text.replace(/[^\d.,]/g, '').replace(/\./g, '').replace(/,/g, '')
  return digits
}

function thinBorder(color = THEME.border) {
  const edge = { style: 'thin', color: { rgb: color } }
  return { top: edge, left: edge, bottom: edge, right: edge }
}

function styleOf({ bg, fg = '1B1C17', bold = false, italic = false, align = 'left', numFmt, size = 12 } = {}) {
  const style = {
    font: { name: 'Times New Roman', sz: size, bold, italic, color: { rgb: fg } },
    fill: { patternType: 'solid', fgColor: { rgb: bg } },
    alignment: { horizontal: align, vertical: 'center', wrapText: true },
    border: thinBorder(),
  }
  if (numFmt) style.numFmt = numFmt
  return style
}

function setCell(sheet, rowIndex, columnIndex, value, style) {
  const address = XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex })
  if (value === '' || value == null) {
    sheet[address] = { t: 's', v: '', s: style }
    return
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    sheet[address] = { t: 'n', v: value, s: style }
    return
  }
  sheet[address] = { t: 's', v: String(value), s: style }
}

function setFormulaCell(sheet, rowIndex, columnIndex, formula, cachedValue, style) {
  const address = XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex })
  sheet[address] = {
    t: 'str',
    f: formula,
    v: cachedValue == null ? '' : String(cachedValue),
    s: style,
  }
}

function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function productNameLookupFormula(excelRow, referenceEndRow) {
  return `IF(A${excelRow}="","",IFERROR(VLOOKUP(A${excelRow},'${REFERENCE_SHEET}'!$A$4:$C$${referenceEndRow},3,FALSE),""))`
}

function skuDisplayLabel(item) {
  const code = cellText(item?.skuCode)
  const name = cellText(item?.productName)
  if (code && name) return `${code} — ${name}`
  return code || name
}

function scoreHeaderRow(row = []) {
  const cells = row.map(normalizeKey)
  const joined = cells.join('|')
  let score = 0
  if (cells.some((cell) => cell === 'masku' || cell === 'skucode' || cell === 'maso')) score += 5
  else if (cells.some((cell) => cell.includes('masku') || cell.includes('skucode'))) score += 3
  if (cells.some((cell) => cell === 'tensanpham' || cell.includes('productname'))) score += 2
  if (cells.some((cell) => cell.includes('mahang'))) score += 2
  if (cells.some((cell) => cell.includes('tenhang'))) score += 2
  if (cells.some((cell) => cell.includes('giachao') || cell === 'gia' || cell.includes('dongia'))) score += 2
  if (cells.some((cell) => cell.includes('ghichu') || cell === 'note')) score += 1
  if (cells.filter(Boolean).length < 3) score = Math.min(score, 2)
  if (joined.includes('donvi') || joined.includes('quydoi') || joined.includes('giaban')) score -= 4
  return score
}

function findHeaderRow(rows) {
  let bestIndex = -1
  let bestScore = 0
  for (let index = 0; index < rows.length; index += 1) {
    const score = scoreHeaderRow(rows[index])
    if (score > bestScore) {
      bestScore = score
      bestIndex = index
    }
  }
  return bestScore >= 5 ? bestIndex : -1
}

function resolveColumnIndexes(headerRow) {
  const headers = (headerRow || []).map(normalizeKey)
  const find = (...names) => {
    for (const name of names) {
      const exact = headers.findIndex((header) => header === name)
      if (exact >= 0) return exact
    }
    for (const name of names) {
      const partial = headers.findIndex((header) => header.includes(name))
      if (partial >= 0) return partial
    }
    return -1
  }

  return {
    skuCode: find('masku', 'skucode', 'maso'),
    productName: find('tensanpham', 'productname', 'tensp'),
    supplierItemCode: find('mahangcuancc', 'mahangncc', 'supplieritemcode', 'mahang'),
    supplierItemName: find('tenhangtheoncc', 'tenhangncc', 'supplieritemname', 'tenhang'),
    quotedPrice: find('giachao', 'quotedprice', 'dongia'),
    note: find('ghichu', 'note'),
  }
}

function isFooterRow(row) {
  const first = normalizeKey(row[0])
  return first === 'cong' || first.startsWith('tongcong') || first.startsWith('nguoilap')
}

function isDecorativeRow(row) {
  const first = cellText(row?.[0])
  const key = normalizeKey(first)
  return first.startsWith('▼')
    || first.startsWith('■')
    || first.startsWith('—')
    || key.startsWith('tip')
    || key.startsWith('luu')
    || key.startsWith('danhmuc')
    || key.startsWith('hoccach')
}

function sheetRows(sheet) {
  return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false })
}

function looksLikeProductCreationWorkbook(workbook) {
  const names = (workbook.SheetNames || []).map((name) => normalizeKey(name))
  return names.some((name) => name.includes('1sanpham') || name.includes('sanpham'))
    && names.some((name) => name.includes('2sku') || name === 'sku')
}

function pickDataSheet(workbook) {
  const scored = (workbook.SheetNames || []).map((name) => {
    const sheet = workbook.Sheets[name]
    const rows = sheetRows(sheet)
    const headerIndex = findHeaderRow(rows)
    const score = headerIndex >= 0 ? scoreHeaderRow(rows[headerIndex]) : 0
    const nameBonus = /hang|cung|ung|du\s*lieu|data/i.test(name) ? 1 : 0
    const guidePenalty = /huong|guide|thamchieu/i.test(name) ? -3 : 0
    return { name, sheet, rows, headerIndex, score: score + nameBonus + guidePenalty }
  })
  scored.sort((a, b) => b.score - a.score)
  return scored[0]?.score >= 5 ? scored[0] : null
}

/** Tách mã SKU nếu ô dropdown dạng "MÃ — Tên sản phẩm". */
function extractSkuCode(value) {
  const text = cellText(value)
  if (!text) return ''
  const separators = [' — ', ' – ', ' - ']
  for (const separator of separators) {
    const index = text.indexOf(separator)
    if (index > 0) return text.slice(0, index).trim().toUpperCase()
  }
  return text.toUpperCase()
}

/**
 * Parse file Excel danh mục hàng cung ứng (6 cột: thêm Tên sản phẩm).
 * @param {ArrayBuffer|Uint8Array|Buffer} buffer
 * @returns {{ rawLines: Array<object>, errors: string[] }}
 */
export function parseSupplierProductsExcel(buffer) {
  let workbook
  try {
    workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
  } catch {
    return { rawLines: [], errors: ['Không đọc được file. Hãy dùng file mẫu từ nút “Tải file mẫu”.'] }
  }

  if (!workbook.SheetNames?.length) {
    return { rawLines: [], errors: ['File Excel trống hoặc bị lỗi. Hãy dùng file mẫu từ nút “Tải file mẫu”.'] }
  }

  if (looksLikeProductCreationWorkbook(workbook)) {
    return {
      rawLines: [],
      errors: [
        'Đây là file mẫu “Yêu cầu tạo hàng hóa mới”, không dùng cho trang Sản phẩm theo nhà cung cấp. Hãy bấm “Tải file mẫu” / “Tải file có dữ liệu mẫu” ngay trong hộp Import của trang này.',
      ],
    }
  }

  const picked = pickDataSheet(workbook)
  if (!picked) {
    return {
      rawLines: [],
      errors: [
        'File không đúng mẫu: thiếu cột “Mã SKU”. Hãy bấm “Tải file có dữ liệu mẫu” trên trang Sản phẩm theo nhà cung cấp, điền vào file đó rồi nạp lại.',
      ],
    }
  }

  const { rows, headerIndex } = picked
  const cols = resolveColumnIndexes(rows[headerIndex])
  const hasProductName = cols.productName >= 0
  const skuIdx = cols.skuCode >= 0 ? cols.skuCode : 0
  const productNameIdx = hasProductName ? cols.productName : -1
  const itemCodeIdx = cols.supplierItemCode >= 0 ? cols.supplierItemCode : (hasProductName ? 2 : 1)
  const itemNameIdx = cols.supplierItemName >= 0 ? cols.supplierItemName : (hasProductName ? 3 : 2)
  const priceIdx = cols.quotedPrice >= 0 ? cols.quotedPrice : (hasProductName ? 4 : 3)
  const noteIdx = cols.note >= 0 ? cols.note : (hasProductName ? 5 : 4)

  const rawLines = []
  for (let index = headerIndex + 1; index < rows.length; index += 1) {
    const row = rows[index] || []
    if (isFooterRow(row)) break
    if (isDecorativeRow(row)) continue

    const skuCode = extractSkuCode(row[skuIdx])
    const productName = productNameIdx >= 0 ? cellText(row[productNameIdx]).slice(0, 255) : ''
    const supplierItemCode = cellText(row[itemCodeIdx]).slice(0, 50)
    const supplierItemName = cellText(row[itemNameIdx]).slice(0, 255)
    const quotedPrice = normalizePrice(row[priceIdx])
    const note = cellText(row[noteIdx]).slice(0, 1000)

    if (!skuCode && !productName && !supplierItemCode && !supplierItemName && !quotedPrice && !note) continue
    if (normalizeKey(skuCode) === 'masku') continue

    rawLines.push({
      rowNumber: index + 1,
      skuCode,
      productName,
      supplierItemCode,
      supplierItemName,
      quotedPrice,
      note,
    })
  }

  const errors = []
  if (rawLines.length === 0) {
    errors.push('File chưa có dòng dữ liệu nào. Hãy điền ít nhất một dòng rồi nạp lại.')
  }

  return { rawLines, errors }
}

function normalizeSkuItems(skuItems = []) {
  return (Array.isArray(skuItems) ? skuItems : [])
    .map((item) => {
      if (typeof item === 'string') {
        return { skuCode: cellText(item).toUpperCase(), productName: '', unitName: '' }
      }
      const skuCode = cellText(item?.skuCode || item?.SkuCode).toUpperCase()
      const productName = cellText(item?.productName || item?.ProductName)
      const variantName = cellText(item?.variantName || item?.VariantName)
      const unitName = cellText(item?.unitName || item?.UnitName)
      const displayName = productName && variantName && normalizeKey(productName) !== normalizeKey(variantName)
        ? `${productName} — ${variantName}`
        : (productName || variantName)
      return { skuCode, productName: displayName, unitName }
    })
    .filter((item) => item.skuCode)
}

function catalogForReference(skuItems = []) {
  const items = normalizeSkuItems(skuItems)
  return items.length ? items : FALLBACK_SKU_ITEMS.map((item) => ({ ...item, unitName: '' }))
}

function defaultSampleRows(skuItems = []) {
  const items = normalizeSkuItems(skuItems)
  const fallback = [
    ['LA-TRA-SEN-G — Lá trà sen', 'Lá trà sen', 'NCC-TRA-SEN-01', 'Lá trà sen (bao 1kg)', 85000, 'Giá chào tham khảo — sửa trước khi import'],
    ['LA-TRA-DEN-G — Lá trà đen', 'Lá trà đen', 'NCC-TRA-DEN-01', 'Lá trà đen (bao 1kg)', 72000, 'Nguyên liệu pha chế'],
    ['LY-GIAY-350 — Ly giấy 350ml', 'Ly giấy 350ml', 'NCC-LY-350', 'Ly giấy 350ml', 1200, 'Bao bì mang đi'],
    ['ONG-HUT-GIAY — Ống hút giấy', 'Ống hút giấy', 'NCC-ONG-HUT', 'Ống hút giấy', 350, ''],
    ['DUONG-PHEN-G — Đường phèn', 'Đường phèn', 'NCC-DUONG-01', 'Đường phèn', 28000, 'Có thể xóa dòng này nếu không dùng'],
  ]

  if (!items.length) return fallback

  return items.slice(0, Math.min(items.length, 20)).map((item, index) => {
    const demo = fallback[index % fallback.length]
    return [
      skuDisplayLabel(item) || item.skuCode,
      item.productName || demo[1],
      demo[2],
      item.productName ? `${item.productName} (theo NCC)` : demo[3],
      demo[4],
      index === 0 ? 'Chọn từ dropdown — Tên sản phẩm tự điền' : '',
    ]
  })
}

function blankRowsFromSkuItems(skuItems = []) {
  const items = normalizeSkuItems(skuItems).slice(0, 3)
  if (!items.length) return [['', '', '', '', '', '']]
  return items.map((item) => [skuDisplayLabel(item) || item.skuCode, item.productName, '', '', '', ''])
}

function buildDataSheet({ title, subtitle, dataRows, blankRows, referenceEndRow }) {
  const sheet = {}
  const colCount = 6
  const widths = [36, 28, 20, 28, 14, 32]
  const hasLookup = referenceEndRow >= 4

  for (let c = 0; c < colCount; c += 1) {
    setCell(sheet, 0, c, c === 0 ? title : '', styleOf({ bg: THEME.titleBg, fg: THEME.headerFg, bold: true, size: 12.5 }))
    setCell(sheet, 1, c, c === 0 ? subtitle : '', styleOf({ bg: THEME.subtitleBg, fg: '5A4A20', italic: true, size: 12 }))
  }
  SUPPLIER_PRODUCT_IMPORT_COLUMNS.forEach((header, c) => {
    setCell(sheet, 2, c, header, styleOf({ bg: THEME.headerBg, fg: THEME.headerFg, bold: true, align: 'center' }))
  })

  let rowIndex = 3
  const writeDataRow = (row, index) => {
    const bg = index % 2 === 1 ? THEME.zebra : THEME.white
    const excelRow = rowIndex + 1
    row.forEach((value, c) => {
      const isMoney = c === 4
      const isSku = c === 0
      const isProductName = c === 1
      const style = styleOf({
        bg: isSku || isProductName ? THEME.skuCol : isMoney ? THEME.moneyCol : bg,
        align: isMoney ? 'right' : 'left',
        bold: isSku,
        numFmt: isMoney ? '#,##0' : undefined,
      })
      if (isProductName && hasLookup) {
        setFormulaCell(sheet, rowIndex, c, productNameLookupFormula(excelRow, referenceEndRow), value || '', style)
      } else {
        setCell(sheet, rowIndex, c, value, style)
      }
    })
    rowIndex += 1
  }

  dataRows.forEach((row, index) => writeDataRow(row, index))

  for (let i = 0; i < blankRows; i += 1) {
    writeDataRow(['', '', '', '', '', ''], dataRows.length + i)
  }

  for (let i = 0; i < DROPDOWN_EXTRA_ROWS; i += 1) {
    writeDataRow(['', '', '', '', '', ''], dataRows.length + blankRows + i)
  }

  for (let c = 0; c < colCount; c += 1) {
    setCell(
      sheet,
      rowIndex,
      c,
      c === 0
        ? 'Tip: cột Mã SKU có dropdown theo danh mục hệ thống. Chọn mã → Tên sản phẩm tự điền. Chỉ cần điền thông tin phía NCC.'
        : '',
      styleOf({ bg: THEME.tipBg, fg: '475569', italic: true }),
    )
  }

  const dataLastExcelRow = 3 + dataRows.length + blankRows + DROPDOWN_EXTRA_ROWS
  sheet['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rowIndex, c: colCount - 1 } })
  sheet['!cols'] = widths.map((wch) => ({ wch }))
  sheet['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: colCount - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: colCount - 1 } },
    { s: { r: rowIndex, c: 0 }, e: { r: rowIndex, c: colCount - 1 } },
  ]
  sheet['!rows'] = [
    { hpt: 26 },
    { hpt: 32 },
    { hpt: 22 },
  ]
  return { sheet, dataLastExcelRow }
}

function buildReferenceSheet(skuItems = []) {
  const items = catalogForReference(skuItems)
  const sheet = {}
  const headers = ['Chọn nhanh (Mã — Tên)', 'Mã SKU', 'Tên sản phẩm']
  const widths = [42, 20, 32]

  for (let c = 0; c < 3; c += 1) {
    setCell(sheet, 0, c, c === 0 ? 'THAM CHIẾU SKU — DANH MỤC HIỆN TẠI TRÊN HỆ THỐNG' : '', styleOf({ bg: THEME.titleBg, fg: THEME.headerFg, bold: true, size: 12.5 }))
    setCell(
      sheet,
      1,
      c,
      c === 0
        ? 'Sheet này chỉ để dropdown / tra cứu. Không import. Cột A là danh sách chọn ở Hang_cung_ung.'
        : '',
      styleOf({ bg: THEME.subtitleBg, fg: '5A4A20', italic: true, size: 12 }),
    )
  }
  headers.forEach((header, c) => {
    setCell(sheet, 2, c, header, styleOf({ bg: THEME.headerBg, fg: THEME.headerFg, bold: true, align: 'center' }))
  })

  items.forEach((item, index) => {
    const rowIndex = 3 + index
    const bg = index % 2 === 1 ? THEME.zebra : THEME.white
    setCell(sheet, rowIndex, 0, skuDisplayLabel(item), styleOf({ bg: THEME.skuCol, bold: true }))
    setCell(sheet, rowIndex, 1, item.skuCode, styleOf({ bg }))
    setCell(sheet, rowIndex, 2, item.productName, styleOf({ bg }))
  })

  const lastRow = Math.max(3, 2 + items.length)
  sheet['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: lastRow, c: 2 } })
  sheet['!cols'] = widths.map((wch) => ({ wch }))
  sheet['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 2 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 2 } },
  ]
  return { sheet, referenceEndRow: 3 + Math.max(items.length, 1), skuCount: items.length }
}

function buildGuideSheet() {
  const lines = [
    ['HƯỚNG DẪN NHẬP DANH MỤC HÀNG CUNG ỨNG', 'title'],
    ['Dùng cho trang Sản phẩm theo nhà cung cấp (/inventory/supplier-products)', 'subtitle'],
    ['', 'blank'],
    ['Cột', 'Bắt buộc', 'Mô tả'],
    ['Mã SKU', 'Có', 'Chọn từ dropdown dạng “Mã — Tên” (danh mục SKU hiện tại trên hệ thống).'],
    ['Tên sản phẩm', 'Không', 'Tự điền khi chọn dropdown. Không cần gõ tay.'],
    ['Mã hàng của NCC', 'Không', 'Mã NCC gọi mặt hàng. Tối đa 50 ký tự.'],
    ['Tên hàng theo NCC', 'Không', 'Tên NCC gọi mặt hàng. Tối đa 255 ký tự.'],
    ['Giá chào (VNĐ)', 'Không', 'Số dương. Có thể ghi 1200000.'],
    ['Ghi chú', 'Không', 'Tối đa 1000 ký tự.'],
    ['', 'blank'],
    ['Lưu ý', 'section'],
    ['• Tải file từ trang này để có dropdown đúng dữ liệu hệ thống lúc tải.', 'tip'],
    ['• Sheet _ThamChieu chứa toàn bộ SKU tham chiếu — không import sheet đó.', 'tip'],
    ['• Không dùng file mẫu “Yêu cầu tạo hàng hóa mới” cho trang này.', 'tip'],
    ['• Không đổi / xóa dòng tiêu đề xanh ở sheet Hang_cung_ung.', 'tip'],
    ['• Mỗi SKU chỉ một lần trong file và chưa có trong danh mục NCC.', 'tip'],
  ]

  const sheet = {}
  let rowIndex = 0
  lines.forEach((line) => {
    const kind = line[1]
    if (kind === 'title') {
      for (let c = 0; c < 3; c += 1) setCell(sheet, rowIndex, c, c === 0 ? line[0] : '', styleOf({ bg: THEME.titleBg, fg: THEME.headerFg, bold: true, size: 12.5 }))
    } else if (kind === 'subtitle') {
      for (let c = 0; c < 3; c += 1) setCell(sheet, rowIndex, c, c === 0 ? line[0] : '', styleOf({ bg: THEME.subtitleBg, fg: '5A4A20', italic: true, size: 12 }))
    } else if (kind === 'section') {
      for (let c = 0; c < 3; c += 1) setCell(sheet, rowIndex, c, c === 0 ? line[0] : '', styleOf({ bg: THEME.headerBg, fg: THEME.headerFg, bold: true, size: 12.5 }))
    } else if (kind === 'tip') {
      for (let c = 0; c < 3; c += 1) setCell(sheet, rowIndex, c, c === 0 ? line[0] : '', styleOf({ bg: THEME.tipBg, italic: true, size: 12 }))
    } else if (kind === 'blank') {
      for (let c = 0; c < 3; c += 1) setCell(sheet, rowIndex, c, '', styleOf({ bg: THEME.white, size: 12 }))
    } else if (line[0] === 'Cột') {
      ;[line[0], line[1], line[2]].forEach((value, c) => setCell(sheet, rowIndex, c, value, styleOf({ bg: THEME.headerBg, fg: THEME.headerFg, bold: true, align: 'center', size: 12 })))
    } else {
      setCell(sheet, rowIndex, 0, line[0], styleOf({ bg: THEME.labelBg, bold: true, size: 12 }))
      setCell(sheet, rowIndex, 1, line[1], styleOf({ bg: THEME.white, size: 12 }))
      setCell(sheet, rowIndex, 2, line[2], styleOf({ bg: THEME.white, size: 12 }))
    }
    rowIndex += 1
  })

  sheet['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(rowIndex - 1, 0), c: 2 } })
  sheet['!cols'] = [{ wch: 24 }, { wch: 12 }, { wch: 70 }]
  sheet['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 2 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 2 } },
  ]
  return sheet
}

function buildWorkbook({ mode = 'sample', skuItems = [] } = {}) {
  const isSample = mode === 'sample'
  const reference = buildReferenceSheet(skuItems)
  const dataRows = isSample ? defaultSampleRows(skuItems) : blankRowsFromSkuItems(skuItems)
  const blankRows = isSample ? 6 : 12
  const title = isSample
    ? 'DANH MỤC HÀNG CUNG ỨNG — BẢN CÓ DỮ LIỆU MẪU'
    : 'DANH MỤC HÀNG CUNG ỨNG — FILE MẪU'
  const subtitle = isSample
    ? 'Chọn từ dropdown (Mã — Tên theo hệ thống). Tên sản phẩm tự điền. Điền thêm thông tin NCC rồi import.'
    : 'Chọn từ dropdown — không cần gõ mã tay. Tên sản phẩm tự điền. Giữ nguyên dòng tiêu đề xanh.'

  const { sheet: dataSheet, dataLastExcelRow } = buildDataSheet({
    title,
    subtitle,
    dataRows,
    blankRows,
    referenceEndRow: reference.referenceEndRow,
  })

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, dataSheet, DATA_SHEET)
  XLSX.utils.book_append_sheet(wb, buildGuideSheet(), GUIDE_SHEET)
  XLSX.utils.book_append_sheet(wb, reference.sheet, REFERENCE_SHEET)
  return {
    workbook: wb,
    meta: {
      skuCount: reference.skuCount,
      referenceEndRow: reference.referenceEndRow,
      dataLastExcelRow,
    },
  }
}

function buildValidationXml(sqref, formula1) {
  return `<dataValidation type="list" allowBlank="1" showErrorMessage="1" showDropDown="0" errorStyle="warning" errorTitle="Giá trị không hợp lệ" error="Vui lòng chọn Mã SKU từ danh sách dropdown." sqref="${escapeXml(sqref)}"><formula1>${escapeXml(formula1)}</formula1></dataValidation>`
}

function injectDataValidationsIntoSheetXml(sheetXml, validations) {
  if (!validations.length) return sheetXml
  const validationXml = `<dataValidations count="${validations.length}">${validations.join('')}</dataValidations>`
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

async function injectSupplierSkuDropdowns(arrayBuffer, meta = {}) {
  const skuCount = Math.max(1, Number(meta.skuCount) || 1)
  const referenceEndRow = Math.max(4, Number(meta.referenceEndRow) || (3 + skuCount))
  const dataLastExcelRow = Math.max(4, Number(meta.dataLastExcelRow) || 50)

  const decoder = new TextDecoder()
  const entries = await parseZipEntries(arrayBuffer)
  const byName = new Map(entries.map((entry) => [entry.name, entry]))
  const workbookXml = decoder.decode(byName.get('xl/workbook.xml')?.bytes || new Uint8Array())
  const relsXml = decoder.decode(byName.get('xl/_rels/workbook.xml.rels')?.bytes || new Uint8Array())
  if (!workbookXml || !relsXml) return arrayBuffer

  const sheetPathByName = resolveWorkbookSheetPartPaths(workbookXml, relsXml)
  const dataPart = sheetPathByName.get(DATA_SHEET)
  if (!dataPart || !byName.has(dataPart)) return arrayBuffer

  const formula1 = `'${REFERENCE_SHEET}'!$A$4:$A$${referenceEndRow}`
  const validations = [buildValidationXml(`A4:A${dataLastExcelRow}`, formula1)]

  return patchXlsxEntries(arrayBuffer, {
    [dataPart]: (sheetXml) => injectDataValidationsIntoSheetXml(sheetXml, validations),
  })
}

async function finalizeWorkbookBuffer(workbook, meta) {
  let buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array', cellStyles: true })
  buffer = await injectXlsxWorkbookColors(buffer, { kind: 'supplierProducts' })
  buffer = await injectSupplierSkuDropdowns(buffer, meta)
  return buffer
}

async function downloadWorkbook(workbook, filename, meta) {
  const buffer = await finalizeWorkbookBuffer(workbook, meta)
  downloadBlob(buffer, filename)
}

/** Tải file mẫu trống + dropdown SKU theo danh mục hệ thống hiện tại. */
export async function downloadSupplierProductsTemplate(skuItems = []) {
  const { workbook, meta } = buildWorkbook({ mode: 'template', skuItems })
  await downloadWorkbook(workbook, SUPPLIER_PRODUCT_TEMPLATE_FILENAME, meta)
}

/** Tải file mẫu có dữ liệu minh họa + dropdown SKU theo danh mục hiện tại. */
export async function downloadSupplierProductsSample(skuItems = []) {
  const { workbook, meta } = buildWorkbook({ mode: 'sample', skuItems })
  await downloadWorkbook(workbook, SUPPLIER_PRODUCT_SAMPLE_FILENAME, meta)
}

/** Dùng cho script ghi file tĩnh. */
export async function buildSupplierProductsWorkbookBuffer(skuItems = [], mode = 'sample') {
  const { workbook, meta } = buildWorkbook({ mode, skuItems })
  return finalizeWorkbookBuffer(workbook, meta)
}

/** @deprecated */
export async function buildSupplierProductsSampleXml() {
  return buildSupplierProductsWorkbookBuffer([], 'sample')
}

export async function buildSupplierProductsTemplateXml() {
  return buildSupplierProductsWorkbookBuffer([], 'template')
}
