/**
 * 1) Bỏ khối hướng dẫn 1/2/3 (dòng 4–8) trên file mẫu chính.
 * 2) Tạo FileMau_YeuCauTaoHangHoaMoi_CoDuLieu.xlsx đã điền dữ liệu mẫu.
 */
const fs = require('fs')
const path = require('path')
const zlib = require('zlib')
const XLSX = require('xlsx')

const TEMPLATE = path.join(__dirname, '../public/templates/FileMau_YeuCauTaoHangHoaMoi.xlsx')
const SAMPLE = path.join(__dirname, '../public/templates/FileMau_YeuCauTaoHangHoaMoi_CoDuLieu.xlsx')
const COPIES_TEMPLATE = [
  path.join(process.env.USERPROFILE || '', 'Desktop', 'FileMau_YeuCauTaoHangHoaMoi.xlsx'),
  path.join(process.env.USERPROFILE || '', 'Downloads', 'FileMau_YeuCauTaoHangHoaMoi.xlsx'),
  path.join(__dirname, '../../../FileMau_YeuCauTaoHangHoaMoi.xlsx'),
]
const COPIES_SAMPLE = [
  path.join(process.env.USERPROFILE || '', 'Desktop', 'FileMau_YeuCauTaoHangHoaMoi_CoDuLieu.xlsx'),
  path.join(process.env.USERPROFILE || '', 'Downloads', 'FileMau_YeuCauTaoHangHoaMoi_CoDuLieu.xlsx'),
  path.join(__dirname, '../../../FileMau_YeuCauTaoHangHoaMoi_CoDuLieu.xlsx'),
]

function readZip(filePath) {
  const buf = fs.readFileSync(filePath)
  let eocd = -1
  for (let i = buf.length - 22; i >= 0; i -= 1) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i
      break
    }
  }
  const cdOffset = buf.readUInt32LE(eocd + 16)
  const cdCount = buf.readUInt16LE(eocd + 10)
  const entries = {}
  let p = cdOffset
  for (let n = 0; n < cdCount; n += 1) {
    const method = buf.readUInt16LE(p + 10)
    const compSize = buf.readUInt32LE(p + 20)
    const nameLen = buf.readUInt16LE(p + 28)
    const extraLen = buf.readUInt16LE(p + 30)
    const commentLen = buf.readUInt16LE(p + 32)
    const lh = buf.readUInt32LE(p + 42)
    const name = buf.slice(p + 46, p + 46 + nameLen).toString('utf8')
    const dataStart = lh + 30 + buf.readUInt16LE(lh + 26) + buf.readUInt16LE(lh + 28)
    const data = buf.slice(dataStart, dataStart + compSize)
    entries[name] = method === 0 ? Buffer.from(data) : zlib.inflateRawSync(data)
    p += 46 + nameLen + extraLen + commentLen
  }
  return entries
}

function crc32(buf) {
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i += 1) {
    crc ^= buf[i]
    for (let b = 0; b < 8; b += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function writeZip(entries) {
  const localParts = []
  const centralParts = []
  let offset = 0
  const names = Object.keys(entries).filter((n) => !n.endsWith('/')).sort()
  for (const name of names) {
    const data = Buffer.isBuffer(entries[name]) ? entries[name] : Buffer.from(entries[name], 'utf8')
    const nameBuf = Buffer.from(name, 'utf8')
    const compressed = zlib.deflateRawSync(data)
    const crc = crc32(data)
    const local = Buffer.alloc(30 + nameBuf.length)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(8, 8)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(compressed.length, 18)
    local.writeUInt32LE(data.length, 22)
    local.writeUInt16LE(nameBuf.length, 26)
    nameBuf.copy(local, 30)
    const central = Buffer.alloc(46 + nameBuf.length)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(20, 4)
    central.writeUInt16LE(20, 6)
    central.writeUInt16LE(8, 10)
    central.writeUInt32LE(crc, 16)
    central.writeUInt32LE(compressed.length, 20)
    central.writeUInt32LE(data.length, 24)
    central.writeUInt16LE(nameBuf.length, 28)
    central.writeUInt32LE(offset, 42)
    nameBuf.copy(central, 46)
    localParts.push(local, compressed)
    centralParts.push(central)
    offset += local.length + compressed.length
  }
  const centralDir = Buffer.concat(centralParts)
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0)
  eocd.writeUInt16LE(names.length, 8)
  eocd.writeUInt16LE(names.length, 10)
  eocd.writeUInt32LE(centralDir.length, 12)
  eocd.writeUInt32LE(offset, 16)
  return Buffer.concat([...localParts, centralDir, eocd])
}

function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function getRowXml(sheetXml, rowNumber) {
  return sheetXml.match(new RegExp(`<row\\b[^>]*\\br="${rowNumber}"[^>]*(?:/>|>[\\s\\S]*?</row>)`))?.[0] ?? ''
}

function upsertRowXml(sheetXml, rowNumber, rowXml) {
  const rowPattern = new RegExp(`<row\\b[^>]*\\br="${rowNumber}"[^>]*(?:/>|>[\\s\\S]*?</row>)`)
  if (rowPattern.test(sheetXml)) return sheetXml.replace(rowPattern, rowXml)
  return sheetXml.replace('</sheetData>', `${rowXml}</sheetData>`)
}

function styleOf(rowXml, col, rowNumber) {
  return rowXml.match(new RegExp(`<c\\b[^>]*\\br="${col}${rowNumber}"[^>]*\\ss="([^"]+)"`))?.[1] ?? ''
}

function colName(index) {
  let n = index + 1
  let s = ''
  while (n > 0) {
    const r = (n - 1) % 26
    s = String.fromCharCode(65 + r) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

function cellInline(ref, styleId, text) {
  const s = styleId ? ` s="${styleId}"` : ''
  if (text === '' || text === null || text === undefined) return `<c r="${ref}"${s}/>`
  if (typeof text === 'number') return `<c r="${ref}"${s}><v>${text}</v></c>`
  return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${escapeXml(text)}</t></is></c>`
}

function cellEmpty(ref, styleId) {
  const s = styleId ? ` s="${styleId}"` : ''
  return `<c r="${ref}"${s}/>`
}

function clearGuideRows(sheetXml) {
  let next = sheetXml
  // Clear instruction rows 4–9 (keep structure, remove content)
  for (let row = 4; row <= 9; row += 1) {
    next = upsertRowXml(next, row, `<row r="${row}" ht="4" customHeight="1" spans="1:24"/>`)
  }
  // Drop merges that belonged to the 1/2/3 guide panels
  next = next.replace(/<mergeCells([^>]*) count="(\d+)"[^>]*>([\s\S]*?)<\/mergeCells>/, (match, attrs, _count, body) => {
    const cleaned = body
      .replace(/<mergeCell ref="A4:H4"\/>/g, '')
      .replace(/<mergeCell ref="I4:P4"\/>/g, '')
      .replace(/<mergeCell ref="Q4:X4"\/>/g, '')
      .replace(/<mergeCell ref="A5:H9"\/>/g, '')
      .replace(/<mergeCell ref="I5:P9"\/>/g, '')
      .replace(/<mergeCell ref="S5:X5"\/>/g, '')
      .replace(/<mergeCell ref="S6:X6"\/>/g, '')
      .replace(/<mergeCell ref="S7:X7"\/>/g, '')
      .replace(/<mergeCell ref="S8:X8"\/>/g, '')
    const newCount = (cleaned.match(/<mergeCell /g) || []).length
    return `<mergeCells${attrs} count="${newCount}">${cleaned}</mergeCells>`
  })
  return next
}

function simplifySharedStrings(ssXml) {
  let next = ssXml
  const pairs = [
    [
      'Mỗi sản phẩm là một cụm dòng: SẢN PHẨM → SKU → THUỘC TÍNH → BOM, cách nhau bằng dòng trống. Copy cả cụm để thêm sản phẩm (đổi mã SP).',
      'Mỗi sản phẩm một cụm dòng (SẢN PHẨM → SKU → THUỘC TÍNH → BOM), cách bằng dòng trống.',
    ],
    [
      'BẢNG NHẬP (từ dòng 13) • Điền đúng cột theo Loại dòng. Cột “Kiểm tra nhanh” chỉ để đối chiếu, không import.',
      'Bảng nhập bắt đầu từ dòng 13.',
    ],
    ['Mẫu v3.0 • Times New Roman · Cụm sản phẩm · Cố định tiêu đề', 'Mẫu v3.1 · Times New Roman'],
  ]
  for (const [from, to] of pairs) {
    if (next.includes(from)) next = next.split(from).join(to)
  }
  return next
}

function writeCopies(buffer, destinations) {
  for (const dest of destinations) {
    try {
      fs.writeFileSync(dest, buffer)
      console.log('Wrote', dest)
    } catch (error) {
      console.warn('Skip', dest, error.code || error.message)
    }
  }
}

function setDataRow(sheetXml, templateRowXml, rowNumber, values) {
  const cells = []
  for (let c = 0; c < 24; c += 1) {
    const col = colName(c)
    const styleId = styleOf(templateRowXml, col, 13) || styleOf(templateRowXml, col, 14)
    const value = values[c]
    if (value === undefined || value === null || value === '') {
      // keep X formula cells if present in template style area — for sample use empty
      cells.push(cellEmpty(`${col}${rowNumber}`, styleId))
    } else {
      cells.push(cellInline(`${col}${rowNumber}`, styleId, value))
    }
  }
  return upsertRowXml(
    sheetXml,
    rowNumber,
    `<row r="${rowNumber}" ht="20" customHeight="1" spans="1:24">${cells.join('')}</row>`,
  )
}

function buildSampleSheet(baseEntries) {
  const entries = { ...baseEntries }
  let sheet = entries['xl/worksheets/sheet1.xml'].toString('utf8')
  const templateRow = getRowXml(sheet, 13) || getRowXml(sheet, 14)

  if (entries['xl/sharedStrings.xml']) {
    let ss = entries['xl/sharedStrings.xml'].toString('utf8')
    ss = ss
      .replace('MẪU EXCEL — TẠO HÀNG HÓA', 'FILE MẪU CÓ DỮ LIỆU — CÓ THỂ IMPORT THỬ')
      .replace(
        'Mỗi sản phẩm một cụm dòng (SẢN PHẨM → SKU → THUỘC TÍNH → BOM), cách bằng dòng trống.',
        'Đã điền sẵn 2 sản phẩm demo (P001, P002). Có thể Import Excel để thử. Sửa Danh mục / Component SKU cho khớp hệ thống nếu cần.',
      )
    entries['xl/sharedStrings.xml'] = Buffer.from(ss, 'utf8')
  }

  // 24 columns A..X
  const sampleRows = [
    // P001 product cluster starting row 13
    ['SẢN PHẨM', 'P001', '', 'Trà Nhài Demo', 'THANH_PHAM', 'Trà thành phẩm', 'Piece', 'Trà Nhài bán lẻ theo hộp và đóng thùng', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
    ['SKU', 'P001', 'P001-U1', '', '', '', '', '', 'Hộp', 1, 'Có', 'TRA-NHAI-DEMO-HOP', 20000, 12000, '893000000001', 'Có', 5, 500, '', '', '', '', '', ''],
    ['THUỘC TÍNH', 'P001', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', 'Hương vị', 'Nhài', '', '', '', ''],
    ['THUỘC TÍNH', 'P001', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', 'Màu sắc', 'Xanh', '', '', '', ''],
    ['BOM', 'P001', 'P001-U1', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', 'UAT-SEED-RAW-TEA', 100, 'Theo gram', ''],
    ['BOM', 'P001', 'P001-U1', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', 'UAT-SEED-PKG-BAG', 1, 'Theo chiếc', ''],
    ['SKU', 'P001', 'P001-U2', '', '', '', '', '', 'Thùng', 10, 'Không', 'TRA-NHAI-DEMO-THUNG-10', 200000, 0, '893000000010', 'Có', 0, 100, '', '', '', '', '', ''],
    ['BOM', 'P001', 'P001-U2', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', 'UAT-SEED-PKG-BOX', 1, 'BOM thùng', ''],
    // gap row 21 stays empty from template structure — overwrite row 21 as empty then P002 at 22
  ]

  // Current template blocks: 13-20 data, 21 gap, 22+ next. Put P001 in 13-20, keep 21 gap, P002 in 22-29
  let next = sheet
  sampleRows.forEach((values, index) => {
    next = setDataRow(next, templateRow, 13 + index, values)
  })
  // ensure gap 21 empty
  next = setDataRow(next, templateRow, 21, Array(24).fill(''))

  const p002 = [
    ['SẢN PHẨM', 'P002', '', 'Hộp quà Trà Tổng Hợp', 'THANH_PHAM', 'Quà tặng', 'Piece', 'Thành phẩm gồm nhiều thành phần', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
    ['SKU', 'P002', 'P002-U1', '', '', '', '', '', 'Hộp quà', 1, 'Có', 'HOP-QUA-TRA-TONG-HOP', 350000, 260000, '893000000020', 'Có', 2, 100, '', '', '', '', '', ''],
    ['THUỘC TÍNH', 'P002', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', 'Dịp sử dụng', 'Quà biếu', '', '', '', ''],
    ['BOM', 'P002', 'P002-U1', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', 'TRA-NHAI-DEMO-HOP', 1, 'Sản phẩm kệ', ''],
    ['BOM', 'P002', 'P002-U1', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', 'UAT-SEED-PKG-BOX', 1, 'Bao bì', ''],
    ['BOM', 'P002', 'P002-U1', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', 'UAT-SEED-RAW-TEA', 50, 'Nguyên liệu', ''],
  ]
  // Clear rest of block 2 then fill
  for (let r = 22; r <= 30; r += 1) next = setDataRow(next, templateRow, r, Array(24).fill(''))
  p002.forEach((values, index) => {
    next = setDataRow(next, templateRow, 22 + index, values)
  })

  entries['xl/worksheets/sheet1.xml'] = Buffer.from(next, 'utf8')
  return entries
}

function main() {
  const entries = readZip(TEMPLATE)
  let sheet = entries['xl/worksheets/sheet1.xml'].toString('utf8')
  sheet = clearGuideRows(sheet)
  entries['xl/worksheets/sheet1.xml'] = Buffer.from(sheet, 'utf8')

  if (entries['xl/sharedStrings.xml']) {
    entries['xl/sharedStrings.xml'] = Buffer.from(
      simplifySharedStrings(entries['xl/sharedStrings.xml'].toString('utf8')),
      'utf8',
    )
  }

  const templateBuf = writeZip(entries)
  fs.writeFileSync(TEMPLATE, templateBuf)
  writeCopies(templateBuf, COPIES_TEMPLATE)

  const sampleEntries = buildSampleSheet(entries)
  const sampleBuf = writeZip(sampleEntries)
  fs.writeFileSync(SAMPLE, sampleBuf)
  writeCopies(sampleBuf, COPIES_SAMPLE)

  const wb = XLSX.readFile(TEMPLATE)
  const rows = XLSX.utils.sheet_to_json(wb.Sheets.NHAP_HANG_HOA, { header: 1, defval: '' })
  console.log('Template R1:', rows[0][0])
  console.log('Template R4 empty?', !String(rows[3][0] || '').trim() && !String(rows[3][8] || '').trim())
  console.log('Template R13:', rows[12][0], rows[12][1])

  const sampleWb = XLSX.readFile(SAMPLE)
  const srows = XLSX.utils.sheet_to_json(sampleWb.Sheets.NHAP_HANG_HOA, { header: 1, defval: '' })
  console.log('Sample title:', srows[0][0])
  console.log('Sample R13:', srows[12].slice(0, 5).filter(Boolean).join(' | '))
  console.log('Sample R14:', srows[13].slice(0, 6).filter(Boolean).join(' | '))
  console.log('Sample R22:', srows[21].slice(0, 5).filter(Boolean).join(' | '))
}

main()
