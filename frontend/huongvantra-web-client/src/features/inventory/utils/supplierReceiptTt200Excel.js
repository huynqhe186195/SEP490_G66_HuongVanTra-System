import * as XLSX from 'xlsx'

function cellText(value) {
  if (value == null) return ''
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10)
  }
  return String(value).trim()
}

function normalizeQuantity(value) {
  const text = cellText(value).replace(/,/g, '').replace(/\s/g, '')
  if (!text) return ''
  const num = Number(text)
  if (!Number.isFinite(num) || num <= 0) return text
  if (Number.isInteger(num)) return String(num)
  return text
}

function normalizeUnitCost(value) {
  const text = cellText(value)
  if (!text) return ''
  return text.replace(/[^\d.,]/g, '').replace(/\./g, '').replace(/,/g, '')
}

function isFooterOrMarkerRow(row) {
  const stt = cellText(row[0]).toUpperCase()
  const name = cellText(row[1]).toLowerCase()
  if (stt === 'A' && cellText(row[1]).toUpperCase() === 'B') return true
  if (name === 'cộng' || name.startsWith('cộng ')) return true
  if (name.includes('tổng số tiền') || name.includes('chứng từ gốc')) return true
  if (name.includes('người lập phiếu') || name.includes('ký, họ tên')) return true
  return false
}

function findSheet(workbook) {
  const preferred = workbook.SheetNames.find((name) =>
    /phiếu\s*nhập|phieu\s*nhap|tt\s*200|01\s*-\s*vt/i.test(name),
  )
  const skipGuide = workbook.SheetNames.find((name) => !/huong\s*dan|hướng\s*dẫn|guide/i.test(name))
  return workbook.Sheets[preferred || skipGuide || workbook.SheetNames[0]]
}

function findTableStart(rows) {
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index].map(cellText)
    const joined = row.join(' ').toLowerCase()
    const hasMaSo = joined.includes('mã số') || joined.includes('sku')
    const hasQty = joined.includes('số lượng') || joined.includes('thực nhập') || joined.includes('quantity')
    if (hasMaSo && (hasQty || joined.includes('đơn giá'))) {
      return index
    }
  }
  return -1
}

function resolveColumnIndexes(headerRow, subHeaderRow = []) {
  const normalize = (value) =>
    cellText(value)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[\s_-]+/g, '')

  const headers = headerRow.map(normalize)
  const subHeaders = subHeaderRow.map(normalize)

  const find = (...names) => {
    for (const name of names) {
      const inHeader = headers.findIndex((h) => h.includes(name))
      if (inHeader >= 0) return inHeader
      const inSub = subHeaders.findIndex((h) => h.includes(name))
      if (inSub >= 0) return inSub
    }
    return -1
  }

  return {
    skuCode: find('maso', 'skucode', 'sku', 'mahang'),
    submittedUnit: find('dvt', 'donvi', 'unit'),
    documentQuantity: find('theochungtu', 'documentquantity'),
    actualQuantity: find('thucnhap', 'actualquantity', 'soluong', 'quantity'),
    unitCost: find('dongia', 'unitcost', 'gia'),
    // Avoid matching "thanh tien" via bare "tien"
    lotCode: find('maloncc', 'supplierlotcode', 'lotcode', 'malo'),
    manufacturedAt: find('ngaysanxuat', 'ngaysx', 'manufacturedat', 'manufacturedate', 'nsx'),
    expiresAt: find('hansudung', 'handung', 'expiresat', 'expirydate', 'hsd'),
    qualityNote: find('ghichuchatluong', 'qualitynote', 'chatluong', 'ghichu', 'note'),
  }
}

function normalizeImportDate(value) {
  if (value == null || value === '') return ''
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10)
  }
  if (typeof value === 'number' && Number.isFinite(value) && value > 20000 && value < 100000) {
    // Excel serial date (approx)
    const utc = Date.UTC(1899, 11, 30) + Math.round(value) * 86400000
    return new Date(utc).toISOString().slice(0, 10)
  }
  return parseFlexibleDate(cellText(value))
}

function stripDots(value) {
  return cellText(value).replace(/\.+/g, ' ').replace(/\s+/g, ' ').trim()
}

function parseVietnamDateParts(day, month, year) {
  const d = Number(day)
  const m = Number(month)
  const y = Number(year)
  if (!Number.isInteger(d) || !Number.isInteger(m) || !Number.isInteger(y)) return ''
  if (d < 1 || d > 31 || m < 1 || m > 12 || y < 1900) return ''
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function parseFlexibleDate(text) {
  const raw = stripDots(text)
  if (!raw) return ''
  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (iso) return parseVietnamDateParts(iso[3], iso[2], iso[1])
  const dmy = raw.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/)
  if (dmy) return parseVietnamDateParts(dmy[1], dmy[2], dmy[3])
  const words = raw.match(/(\d{1,2})\s*(?:\/|-|\s)?\s*(?:tháng)?\s*(\d{1,2})\s*(?:\/|-|\s)?\s*(?:năm)?\s*(\d{4})/i)
  if (words) return parseVietnamDateParts(words[1], words[2], words[3])
  return ''
}

function parseHeaderFields(rows, tableStart) {
  const headerPatch = {}
  const texts = rows.slice(0, Math.max(0, tableStart)).map((row) => row.map(cellText).join(' '))

  // Pass 1: ưu tiên dòng "Nhà cung cấp:" / "Ghi chú:" rõ ràng.
  for (const text of texts) {
    if (/Thông tư|TT-BTC|Mẫu số 01/i.test(text)) continue

    if (!headerPatch.note) {
      if (/Ghi chú chất lượng/i.test(text)) continue
      const match = text.match(/Ghi chú phiếu\s*:\s*(.+)$/i)
        || text.match(/Ghi chú\s*:\s*(.+)$/i)
        || text.match(/Note\s*:\s*(.+)$/i)
      const note = stripDots(match?.[1] || '')
      if (note) headerPatch.note = note.slice(0, 500)
    }

    const supplierMatch = text.match(/Nhà cung cấp\s*:\s*(.+)$/i)
      || text.match(/Nha cung cap\s*:\s*(.+)$/i)
      || text.match(/Supplier\s*:\s*(.+)$/i)
    if (supplierMatch) {
      const name = stripDots(supplierMatch[1] || '')
      if (name) headerPatch.supplierName = name.slice(0, 200)
    }
  }

  // Pass 2: các field còn lại; chỉ fallback NCC từ "Theo ... của ..." khi chưa có dòng Nhà cung cấp.
  for (const text of texts) {
    if (/Thông tư|TT-BTC|Mẫu số 01/i.test(text)) continue

    if (!headerPatch.deliveredByName) {
      const match = text.match(/Họ và tên người giao\s*:\s*(.+)$/i)
      const delivered = stripDots(match?.[1] || '')
      if (delivered) headerPatch.deliveredByName = delivered.slice(0, 200)
    }

    if (!headerPatch.originalDocumentReference && /^\s*-?\s*Theo\b/i.test(text) && /số\s+\S+/i.test(text)) {
      const docNumber = text.match(/số\s+([A-Za-z0-9\-_/]+)/i)
      const candidate = docNumber?.[1]?.replace(/\.+$/, '').trim() || ''
      if (candidate && /[A-Za-z0-9]/.test(candidate)) {
        headerPatch.originalDocumentReference = stripDots(text.replace(/^-+\s*/, '')).slice(0, 200)
        headerPatch.supplierDocumentNumber = candidate.slice(0, 100)
        const dateMatch = text.match(/ngày\s*([^\n]*?)(?:\s+của|$)/i)
        const parsed = dateMatch ? parseFlexibleDate(dateMatch[1]) : ''
        if (parsed) headerPatch.supplierDocumentDate = parsed

        if (!headerPatch.supplierName) {
          const ofMatch = text.match(/\bcủa\s+(.+?)\s*$/i)
          const ofName = stripDots(ofMatch?.[1] || '')
          if (ofName) headerPatch.supplierName = ofName.slice(0, 200)
        }
      }
    }

    if (/(?:^|\s)Số\s*:/.test(text) && !/^\s*-?\s*Theo\b/i.test(text)) {
      const match = text.match(/Số\s*:\s*([^NợCó]*?)(?:\s*(?:Nợ|Có)\s*:|$)/i)
        || text.match(/Số\s*:\s*(.+)$/i)
      const cleaned = stripDots(match?.[1] || '').replace(/\s*(Nợ|Có)\s*:.*$/i, '').trim()
      if (cleaned) {
        if (!headerPatch.supplierReference) headerPatch.supplierReference = cleaned.slice(0, 100)
        if (!headerPatch.supplierDocumentNumber) headerPatch.supplierDocumentNumber = cleaned.slice(0, 100)
      }
    }

    if (/Ngày.*tháng.*năm/i.test(text) && !/^\s*-?\s*Theo\b/i.test(text)) {
      const parsed = parseFlexibleDate(text)
      if (parsed) {
        headerPatch.receivedDate = parsed
        if (!headerPatch.supplierDocumentDate) headerPatch.supplierDocumentDate = parsed
      }
    }
  }

  return headerPatch
}

/**
 * Parse TT200 / tabular supplier receipt Excel.
 * Returns goods lines + optional header fields (người giao, số CT, ngày...).
 * Nhà cung cấp vẫn chọn trên UI.
 *
 * @param {ArrayBuffer} buffer
 * @returns {{ headerPatch: object, rawLines: Array<object>, errors: string[] }}
 */
export function parseSupplierReceiptTt200Excel(buffer) {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
  if (!workbook.SheetNames?.length) {
    return { headerPatch: {}, rawLines: [], errors: ['File Excel trống hoặc bị lỗi. Hãy dùng file mẫu từ nút “Tải mẫu”.'] }
  }

  const sheet = findSheet(workbook)
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false })
  const tableStart = findTableStart(rows)
  if (tableStart < 0) {
    return {
      headerPatch: {},
      rawLines: [],
      errors: ['File không đúng mẫu phiếu nhập. Hãy bấm “Tải mẫu”, điền vào file đó, rồi nạp lại.'],
    }
  }

  const headerPatch = parseHeaderFields(rows, tableStart)
  const headerRow = rows[tableStart] || []
  const maybeSub = rows[tableStart + 1] || []
  const cols = resolveColumnIndexes(headerRow, maybeSub)

  // Fallback: ... I=Mã lô, J=NSX, K=HSD, L=Ghi chú chất lượng
  const skuIdx = cols.skuCode >= 0 ? cols.skuCode : 2
  const unitIdx = cols.submittedUnit >= 0 ? cols.submittedUnit : 3
  const docQtyIdx = cols.documentQuantity >= 0 ? cols.documentQuantity : 4
  const actualQtyIdx = cols.actualQuantity >= 0 ? cols.actualQuantity : 5
  const costIdx = cols.unitCost >= 0 ? cols.unitCost : 6
  const lotIdx = cols.lotCode >= 0 ? cols.lotCode : 8
  const mfgIdx = cols.manufacturedAt >= 0 ? cols.manufacturedAt : 9
  const expIdx = cols.expiresAt >= 0 ? cols.expiresAt : 10
  const noteIdx = cols.qualityNote >= 0 ? cols.qualityNote : 11

  let dataStart = tableStart + 1
  // Skip "Theo chứng từ / Thực nhập" sub-header and A/B/C/D marker when present.
  while (dataStart < rows.length) {
    const row = rows[dataStart] || []
    const joined = row.map(cellText).join(' ').toLowerCase()
    if (
      isFooterOrMarkerRow(row)
      || /theo chứng từ|thực nhập/.test(joined)
      || (/^a$/i.test(cellText(row[0])) && /^b$/i.test(cellText(row[1])))
    ) {
      dataStart += 1
      continue
    }
    break
  }

  const errors = []
  const rawLines = []

  for (let index = dataStart; index < rows.length; index += 1) {
    const row = rows[index] || []
    if (isFooterOrMarkerRow(row)) break

    const skuCode = cellText(row[skuIdx]).toUpperCase()
    const submittedUnit = cellText(row[unitIdx])
    const documentQuantity = normalizeQuantity(row[docQtyIdx])
    const actualQuantity = normalizeQuantity(row[actualQtyIdx]) || documentQuantity
    const unitCost = normalizeUnitCost(row[costIdx])
    const lotCode = cellText(row[lotIdx])
    const manufacturedAt = normalizeImportDate(row[mfgIdx])
    const expiresAt = normalizeImportDate(row[expIdx])
    const qualityNote = cellText(row[noteIdx]).slice(0, 300)

    if (!skuCode && !documentQuantity && !actualQuantity && !unitCost && !lotCode) continue
    if (!skuCode && !actualQuantity) continue

    rawLines.push({
      rowNumber: index + 1,
      skuCode,
      submittedUnit,
      documentQuantity,
      actualQuantity,
      unitCost,
      lotCode,
      manufacturedAt,
      expiresAt,
      qualityNote,
      nameHint: cellText(row[1]),
    })
  }

  if (rawLines.length === 0) {
    errors.push(
      'File chưa có dòng hàng. Hãy điền Mã số, Số lượng (và Đơn giá nếu cần) vào bảng phía trên chữ “Cộng”, rồi nạp lại.',
    )
  }

  return { headerPatch, rawLines, errors }
}

export const TT200_TEMPLATE_URL = '/templates/phieu-nhap-kho-excel-tt200.xlsx'
