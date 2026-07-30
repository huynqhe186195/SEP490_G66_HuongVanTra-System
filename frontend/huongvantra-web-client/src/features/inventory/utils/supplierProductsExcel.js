import * as XLSX from 'xlsx'

export const SUPPLIER_PRODUCT_IMPORT_COLUMNS = [
  'Mã SKU',
  'Mã hàng của NCC',
  'Tên hàng theo NCC',
  'Giá chào (VNĐ)',
  'Ghi chú',
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
    .replace(/[\s_-]+/g, '')
}

/** Giá chào trong file có thể ghi "1.200.000", "1,200,000" hay "1200000 đ". */
function normalizePrice(value) {
  const text = cellText(value)
  if (!text) return ''
  const digits = text.replace(/[^\d.,]/g, '').replace(/\./g, '').replace(/,/g, '')
  return digits
}

function findSheet(workbook) {
  const skipGuide = workbook.SheetNames.find((name) => !/huong\s*dan|hướng\s*dẫn|guide/i.test(name))
  return workbook.Sheets[skipGuide || workbook.SheetNames[0]]
}

function findHeaderRow(rows) {
  for (let index = 0; index < rows.length; index += 1) {
    const joined = (rows[index] || []).map(normalizeKey).join('|')
    if (joined.includes('masku') || joined.includes('maso') || joined.includes('skucode')) return index
  }
  return -1
}

function resolveColumnIndexes(headerRow) {
  const headers = (headerRow || []).map(normalizeKey)
  const find = (...names) => {
    for (const name of names) {
      const found = headers.findIndex((h) => h.includes(name))
      if (found >= 0) return found
    }
    return -1
  }
  return {
    skuCode: find('masku', 'skucode', 'maso', 'sku'),
    supplierItemCode: find('mahangcuancc', 'mahangncc', 'supplieritemcode', 'mahang'),
    supplierItemName: find('tenhangtheoncc', 'tenhangncc', 'supplieritemname', 'tenhang'),
    quotedPrice: find('giachao', 'quotedprice', 'dongia', 'gia'),
    note: find('ghichu', 'note'),
  }
}

function isFooterRow(row) {
  const first = normalizeKey(row[0])
  return first === 'cong' || first.startsWith('tongcong') || first.startsWith('nguoilap')
}

/**
 * Parse file Excel danh mục hàng cung ứng (5 cột).
 * Không throw — luôn trả về object để trang gọi tự quyết cách hiển thị.
 *
 * @param {ArrayBuffer} buffer
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

  const sheet = findSheet(workbook)
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false })
  const headerIndex = findHeaderRow(rows)
  if (headerIndex < 0) {
    return {
      rawLines: [],
      errors: ['File không đúng mẫu: thiếu cột “Mã SKU”. Hãy bấm “Tải file mẫu”, điền vào file đó rồi nạp lại.'],
    }
  }

  const cols = resolveColumnIndexes(rows[headerIndex])
  const skuIdx = cols.skuCode >= 0 ? cols.skuCode : 0
  const itemCodeIdx = cols.supplierItemCode >= 0 ? cols.supplierItemCode : 1
  const itemNameIdx = cols.supplierItemName >= 0 ? cols.supplierItemName : 2
  const priceIdx = cols.quotedPrice >= 0 ? cols.quotedPrice : 3
  const noteIdx = cols.note >= 0 ? cols.note : 4

  const rawLines = []
  for (let index = headerIndex + 1; index < rows.length; index += 1) {
    const row = rows[index] || []
    if (isFooterRow(row)) break

    const skuCode = cellText(row[skuIdx]).toUpperCase()
    const supplierItemCode = cellText(row[itemCodeIdx]).slice(0, 50)
    const supplierItemName = cellText(row[itemNameIdx]).slice(0, 255)
    const quotedPrice = normalizePrice(row[priceIdx])
    const note = cellText(row[noteIdx]).slice(0, 1000)

    if (!skuCode && !supplierItemCode && !supplierItemName && !quotedPrice && !note) continue

    rawLines.push({
      rowNumber: index + 1,
      skuCode,
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

/** Tải file mẫu 5 cột, kèm sheet hướng dẫn. Sinh tại chỗ nên không cần file tĩnh. */
export function downloadSupplierProductsTemplate(sampleSkuCodes = []) {
  const samples = sampleSkuCodes.slice(0, 3)
  const dataRows = samples.length > 0
    ? samples.map((code) => [code, '', '', '', ''])
    : [['SKU-VD-001', '', '', '', '']]

  const sheet = XLSX.utils.aoa_to_sheet([SUPPLIER_PRODUCT_IMPORT_COLUMNS, ...dataRows])
  sheet['!cols'] = [{ wch: 20 }, { wch: 20 }, { wch: 34 }, { wch: 16 }, { wch: 34 }]

  const guide = XLSX.utils.aoa_to_sheet([
    ['HƯỚNG DẪN NHẬP DANH MỤC HÀNG CUNG ỨNG'],
    [],
    ['Cột', 'Bắt buộc', 'Mô tả'],
    ['Mã SKU', 'Có', 'Mã SKU đã có trong hệ thống và được phép nhập từ nhà cung cấp.'],
    ['Mã hàng của NCC', 'Không', 'Mã nhà cung cấp dùng cho mặt hàng này. Tối đa 50 ký tự, không trùng nhau.'],
    ['Tên hàng theo NCC', 'Không', 'Tên nhà cung cấp gọi mặt hàng này. Tối đa 255 ký tự.'],
    ['Giá chào (VNĐ)', 'Không', 'Số dương. Có thể ghi 1.200.000 hoặc 1200000.'],
    ['Ghi chú', 'Không', 'Tối đa 1000 ký tự.'],
    [],
    ['Lưu ý'],
    ['- Không đổi tên hoặc xóa dòng tiêu đề ở sheet dữ liệu.'],
    ['- Mỗi SKU chỉ xuất hiện một lần trong file và chưa có trong danh mục của nhà cung cấp.'],
    ['- Dòng lỗi sẽ bị bỏ qua, các dòng hợp lệ vẫn được thêm.'],
  ])
  guide['!cols'] = [{ wch: 22 }, { wch: 12 }, { wch: 70 }]

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, 'Hang cung ung')
  XLSX.utils.book_append_sheet(workbook, guide, 'Huong dan')
  XLSX.writeFile(workbook, 'Mau_Danh_Muc_Hang_Cung_Ung.xlsx')
}
