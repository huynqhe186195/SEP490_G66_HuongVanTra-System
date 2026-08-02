/**
 * Dựng lại FileMau tải về cho người mới:
 * - Times New Roman
 * - Hướng dẫn 1/2/3 gọn (2 dòng)
 * - Cụm 1: có dữ liệu minh họa đầy đủ
 * - Cụm 2–5: khung trống sẵn loại dòng + mã SP
 * - Dải ngăn xám-xanh giữa các cụm; dòng SẢN PHẨM nền nhạt
 * - Freeze tiêu đề, độ rộng cột
 *
 * Luôn verify workbook đọc được sau khi ghi.
 */
const fs = require('fs')
const path = require('path')
const zlib = require('zlib')
const XLSX = require('xlsx')

const TEMPLATE = path.join(__dirname, '../public/templates/FileMau_YeuCauTaoHangHoaMoi.xlsx')
const SAMPLE_OUT = path.join(__dirname, '../public/templates/FileMau_YeuCauTaoHangHoaMoi_CoDuLieu.xlsx')

function readZip(filePath) {
  const buf = fs.readFileSync(filePath)
  let eocd = -1
  for (let i = buf.length - 22; i >= 0; i -= 1) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i
      break
    }
  }
  if (eocd < 0) throw new Error('EOCD missing')
  const cdOffset = buf.readUInt32LE(eocd + 16)
  const cdCount = buf.readUInt16LE(eocd + 10)
  const entries = {}
  let p = cdOffset
  for (let n = 0; n < cdCount; n += 1) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error(`Bad CD at ${p}`)
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
  // Keep original-ish order but only real files
  const names = Object.keys(entries).filter((n) => n && !n.endsWith('/'))
  for (const name of names) {
    const data = Buffer.isBuffer(entries[name]) ? entries[name] : Buffer.from(String(entries[name]), 'utf8')
    const nameBuf = Buffer.from(name, 'utf8')
    const compressed = zlib.deflateRawSync(data, { level: 6 })
    const crc = crc32(data)

    const local = Buffer.alloc(30 + nameBuf.length)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4) // version needed
    local.writeUInt16LE(0, 6) // flags
    local.writeUInt16LE(8, 8) // deflate
    local.writeUInt16LE(0, 10)
    local.writeUInt16LE(0, 12)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(compressed.length, 18)
    local.writeUInt32LE(data.length, 22)
    local.writeUInt16LE(nameBuf.length, 26)
    local.writeUInt16LE(0, 28)
    nameBuf.copy(local, 30)

    const central = Buffer.alloc(46 + nameBuf.length)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(20, 4)
    central.writeUInt16LE(20, 6)
    central.writeUInt16LE(0, 8)
    central.writeUInt16LE(8, 10)
    central.writeUInt16LE(0, 12)
    central.writeUInt16LE(0, 14)
    central.writeUInt32LE(crc, 16)
    central.writeUInt32LE(compressed.length, 20)
    central.writeUInt32LE(data.length, 24)
    central.writeUInt16LE(nameBuf.length, 28)
    central.writeUInt16LE(0, 30)
    central.writeUInt16LE(0, 32)
    central.writeUInt16LE(0, 34)
    central.writeUInt16LE(0, 36)
    central.writeUInt32LE(0, 38)
    central.writeUInt32LE(offset, 42)
    nameBuf.copy(central, 46)

    localParts.push(local, compressed)
    centralParts.push(central)
    offset += local.length + compressed.length
  }

  const centralDir = Buffer.concat(centralParts)
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0)
  eocd.writeUInt16LE(0, 4)
  eocd.writeUInt16LE(0, 6)
  eocd.writeUInt16LE(names.length, 8)
  eocd.writeUInt16LE(names.length, 10)
  eocd.writeUInt32LE(centralDir.length, 12)
  eocd.writeUInt32LE(offset, 16)
  eocd.writeUInt16LE(0, 20)
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

function colName(i) {
  let n = i + 1
  let s = ''
  while (n > 0) {
    const r = (n - 1) % 26
    s = String.fromCharCode(65 + r) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

function cellS(ref, styleId, si) {
  return `<c r="${ref}"${styleId ? ` s="${styleId}"` : ''} t="s"><v>${si}</v></c>`
}
function cellI(ref, styleId, text) {
  if (text === '' || text === null || text === undefined) {
    return `<c r="${ref}"${styleId ? ` s="${styleId}"` : ''}/>`
  }
  if (typeof text === 'number') {
    return `<c r="${ref}"${styleId ? ` s="${styleId}"` : ''}><v>${text}</v></c>`
  }
  return `<c r="${ref}"${styleId ? ` s="${styleId}"` : ''} t="inlineStr"><is><t xml:space="preserve">${escapeXml(text)}</t></is></c>`
}
function cellE(ref, styleId) {
  return `<c r="${ref}"${styleId ? ` s="${styleId}"` : ''}/>`
}

function findSi(ssXml, label) {
  const sis = ssXml.split('<si>').slice(1).map((p) => p.split('</si>')[0])
  const idx = sis.findIndex((si) => {
    const text = (si.match(/<t[^>]*>([\s\S]*?)<\/t>/g) || []).map((t) => t.replace(/<[^>]+>/g, '')).join('')
    return text === label
  })
  if (idx < 0) throw new Error(`SI missing: ${label}`)
  return idx
}

function setTimesNewRoman(stylesXml) {
  return stylesXml
    .replace(/<name val="Aptos"\/>/g, '<name val="Times New Roman"/>')
    .replace(/<name val="Carlito"\/>/g, '<name val="Times New Roman"/>')
    .replace(/<name val="Calibri"\/>/g, '<name val="Times New Roman"/>')
    .replace(/ scheme="minor"/g, '')
}

function ensureStyles(stylesXml) {
  let next = setTimesNewRoman(stylesXml)
  if (next.includes('<!--hvt-beginner-styles-->')) {
    const count = Number(next.match(/<cellXfs count="(\d+)">/)?.[1] || 0)
    return {
      stylesXml: next,
      guideHead: String(count - 6),
      guide1: String(count - 5),
      guide2: String(count - 4),
      guide3: String(count - 3),
      product: String(count - 2),
      sep: String(count - 1),
    }
  }

  const extraFills = [
    '<fill><patternFill patternType="solid"><fgColor rgb="FF356647"/><bgColor indexed="64"/></patternFill></fill>',
    '<fill><patternFill patternType="solid"><fgColor rgb="FFF7F4EC"/><bgColor indexed="64"/></patternFill></fill>',
    '<fill><patternFill patternType="solid"><fgColor rgb="FFEEF5F0"/><bgColor indexed="64"/></patternFill></fill>',
    '<fill><patternFill patternType="solid"><fgColor rgb="FFF3F0FA"/><bgColor indexed="64"/></patternFill></fill>',
    '<fill><patternFill patternType="solid"><fgColor rgb="FFE8F1EB"/><bgColor indexed="64"/></patternFill></fill>',
    '<fill><patternFill patternType="solid"><fgColor rgb="FFD7E5DC"/><bgColor indexed="64"/></patternFill></fill>',
  ].join('')
  next = next.replace(
    /<fills count="(\d+)">([\s\S]*?)<\/fills>/,
    (_, c, body) => `<fills count="${Number(c) + 6}">${body}${extraFills}</fills>`,
  )
  const fills = [...(next.match(/<fills[\s\S]*?<\/fills>/)?.[0].matchAll(/<fill>[\s\S]*?<\/fill>/g) || [])]
  const id = (rgb) => fills.findIndex((f) => f[0].includes(rgb))
  const fHead = id('FF356647')
  const f1 = id('FFF7F4EC')
  const f2 = id('FFEEF5F0')
  const f3 = id('FFF3F0FA')
  const fProd = id('FFE8F1EB')
  const fSep = id('FFD7E5DC')

  const xfs = `<!--hvt-beginner-styles-->`
    + `<xf numFmtId="0" fontId="1" fillId="${fHead}" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>`
    + `<xf numFmtId="0" fontId="6" fillId="${f1}" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="left" vertical="top" wrapText="1"/></xf>`
    + `<xf numFmtId="0" fontId="6" fillId="${f2}" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="left" vertical="top" wrapText="1"/></xf>`
    + `<xf numFmtId="0" fontId="6" fillId="${f3}" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="left" vertical="top" wrapText="1"/></xf>`
    + `<xf numFmtId="0" fontId="7" fillId="${fProd}" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center"/></xf>`
    + `<xf numFmtId="0" fontId="0" fillId="${fSep}" borderId="0" xfId="0" applyFill="1" applyAlignment="1"><alignment vertical="center"/></xf>`

  next = next.replace(
    /<cellXfs count="(\d+)">([\s\S]*?)<\/cellXfs>/,
    (_, c, body) => `<cellXfs count="${Number(c) + 6}">${body}${xfs}</cellXfs>`,
  )
  const count = Number(next.match(/<cellXfs count="(\d+)">/)?.[1] || 0)
  return {
    stylesXml: next,
    guideHead: String(count - 6),
    guide1: String(count - 5),
    guide2: String(count - 4),
    guide3: String(count - 3),
    product: String(count - 2),
    sep: String(count - 1),
  }
}

function improveSharedStrings(ssXml) {
  const pairs = [
    ['MẪU IMPORT YÊU CẦU TẠO HÀNG HÓA — 1 SHEET', 'MẪU EXCEL — TẠO HÀNG HÓA (DỄ ĐIỀN)'],
    [
      'Dùng để tạo đồng thời nhiều sản phẩm, nhiều SKU/đơn vị, thuộc tính và BOM trong cùng một file.',
      'Cụm đầu đã có ví dụ. Làm theo cụm đó, rồi copy cụm trống bên dưới để thêm sản phẩm (đổi mã SP).',
    ],
    ['Template v2.0 • 20/07/2026', 'Mẫu v4.0 · Times New Roman · Có ví dụ điền sẵn'],
    ['1. CÁCH NHẬP DỮ LIỆU', '1. Cách điền'],
    ['2. QUY TẮC SKU & BOM', '2. Quy tắc nhanh'],
    ['3. PHÂN LOẠI DÒNG', '3. Loại dòng'],
    [
      'BẢNG NHẬP DỮ LIỆU • Chỉ nhập các cột phù hợp với Loại dòng. Cột “Kiểm tra nhanh” do Excel tự tính và không import.',
      'Bảng nhập từ dòng 13 · Cụm 1 = ví dụ · Cụm sau = chỗ điền thêm',
    ],
  ]
  let next = ssXml
  for (const [from, to] of pairs) {
    if (next.includes(from)) next = next.split(from).join(to)
  }
  // Compact old long bullets if still present
  next = next.replace(
    /• Mỗi sản phẩm bắt đầu bằng 1 dòng SẢN PHẨM\.&#10;• Các dòng SKU, THUỘC TÍNH và BOM dùng cùng Mã sản phẩm\.&#10;• Có thể sao chép nguyên cụm dòng để tạo nhanh sản phẩm tiếp theo\.&#10;• Dòng để trống hoàn toàn sẽ được bỏ qua khi import\./g,
    '• Xem cụm ví dụ đầu tiên&#10;• 1 cụm = 1 sản phẩm&#10;• Copy cụm trống để thêm SP&#10;• Đổi mã SP02, SP03…',
  )
  return next
}

function layoutSheet(sheetXml) {
  let next = sheetXml
  next = next.replace(
    /<sheetViews>[\s\S]*?<\/sheetViews>/,
    `<sheetViews><sheetView workbookViewId="0"><pane ySplit="12" topLeftCell="A13" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A13" sqref="A13"/></sheetView></sheetViews>`,
  )
  const cols = `<cols>
<col min="1" max="1" width="13" customWidth="1"/>
<col min="2" max="2" width="12" customWidth="1"/>
<col min="3" max="3" width="14" customWidth="1"/>
<col min="4" max="4" width="26" customWidth="1"/>
<col min="5" max="5" width="14" customWidth="1"/>
<col min="6" max="6" width="16" customWidth="1"/>
<col min="7" max="7" width="12" customWidth="1"/>
<col min="8" max="8" width="26" customWidth="1"/>
<col min="9" max="9" width="11" customWidth="1"/>
<col min="10" max="10" width="9" customWidth="1"/>
<col min="11" max="11" width="12" customWidth="1"/>
<col min="12" max="12" width="22" customWidth="1"/>
<col min="13" max="14" width="11" customWidth="1"/>
<col min="15" max="15" width="14" customWidth="1"/>
<col min="16" max="16" width="11" customWidth="1"/>
<col min="17" max="18" width="11" customWidth="1"/>
<col min="19" max="20" width="14" customWidth="1"/>
<col min="21" max="21" width="18" customWidth="1"/>
<col min="22" max="22" width="10" customWidth="1"/>
<col min="23" max="23" width="16" customWidth="1"/>
<col min="24" max="24" width="22" customWidth="1"/>
</cols>`
  if (/<cols>[\s\S]*?<\/cols>/.test(next)) next = next.replace(/<cols>[\s\S]*?<\/cols>/, cols)
  else next = next.replace(/(<sheetFormatPr[^/]*\/>)/, `$1${cols}`)
  next = next.replace(/<sheetFormatPr[^/]*\/>/, '<sheetFormatPr defaultRowHeight="18" defaultColWidth="12"/>')
  return next
}

function buildGuide(styles) {
  const heads = ['1. Cách điền', '2. Quy tắc nhanh', '3. Loại dòng']
  const bodies = [
    '• Xem cụm ví dụ đầu tiên\n• 1 cụm = 1 sản phẩm\n• Copy cụm trống để thêm SP\n• Đổi mã SP02, SP03…',
    '• Có 1 SKU cơ bản (Quy đổi = 1)\n• SKU quy đổi: giá = giá cơ bản × quy đổi\n• BOM gắn SKU cơ bản\n• Quy đổi & định mức: số nguyên dương',
    'SẢN PHẨM — thông tin chung\nSKU — đơn vị / giá / tồn\nTHUỘC TÍNH — tên + giá trị\nBOM — component + định mức',
  ]
  const bodyStyles = [styles.guide1, styles.guide2, styles.guide3]
  const row4 = []
  const row5 = []
  for (let c = 0; c < 24; c += 1) {
    const col = colName(c)
    const group = c < 8 ? 0 : c < 16 ? 1 : 2
    row4.push(c === 0 || c === 8 || c === 16
      ? cellI(`${col}4`, styles.guideHead, heads[group])
      : cellE(`${col}4`, styles.guideHead))
    row5.push(c === 0 || c === 8 || c === 16
      ? cellI(`${col}5`, bodyStyles[group], bodies[group])
      : cellE(`${col}5`, bodyStyles[group]))
  }
  return {
    r4: `<row r="4" ht="22" customHeight="1" spans="1:24">${row4.join('')}</row>`,
    r5: `<row r="5" ht="68" customHeight="1" spans="1:24">${row5.join('')}</row>`,
  }
}

function patchGuideMerges(sheetXml) {
  const needed = ['A4:H4', 'I4:P4', 'Q4:X4', 'A5:H5', 'I5:P5', 'Q5:X5']
  return sheetXml.replace(/<mergeCells([^>]*) count="(\d+)"[^>]*>([\s\S]*?)<\/mergeCells>/, (match, attrs, _c, body) => {
    let cleaned = body
      .replace(/<mergeCell ref="A4:H4"\/>/g, '')
      .replace(/<mergeCell ref="I4:P4"\/>/g, '')
      .replace(/<mergeCell ref="Q4:X4"\/>/g, '')
      .replace(/<mergeCell ref="A5:H9"\/>/g, '')
      .replace(/<mergeCell ref="I5:P9"\/>/g, '')
      .replace(/<mergeCell ref="A5:H5"\/>/g, '')
      .replace(/<mergeCell ref="I5:P5"\/>/g, '')
      .replace(/<mergeCell ref="Q5:X5"\/>/g, '')
      .replace(/<mergeCell ref="S5:X5"\/>/g, '')
      .replace(/<mergeCell ref="S6:X6"\/>/g, '')
      .replace(/<mergeCell ref="S7:X7"\/>/g, '')
      .replace(/<mergeCell ref="S8:X8"\/>/g, '')
      .replace(/<mergeCell ref="A(1[3-9]|[2-9]\d|10\d|11[0-2]):X\1"\/>/g, '')
    const extra = needed.map((ref) => `<mergeCell ref="${ref}"/>`).join('')
    // separator merges added later
    const merged = cleaned + extra
    return `<mergeCells${attrs} count="${(merged.match(/<mergeCell /g) || []).length}">${merged}</mergeCells>`
  })
}

function addSepMerges(sheetXml, sepRows) {
  return sheetXml.replace(/<mergeCells([^>]*) count="(\d+)"[^>]*>([\s\S]*?)<\/mergeCells>/, (match, attrs, _c, body) => {
    const extra = sepRows.map((r) => `<mergeCell ref="A${r}:X${r}"/>`).join('')
    const merged = body + extra
    return `<mergeCells${attrs} count="${(merged.match(/<mergeCell /g) || []).length}">${merged}</mergeCells>`
  })
}

function rowFromValues(rowNumber, values, baseStyles, overrideAStyle) {
  const cells = []
  for (let c = 0; c < 24; c += 1) {
    const col = colName(c)
    const styleId = c === 0 && overrideAStyle ? overrideAStyle : baseStyles[col]
    const v = values[c]
    cells.push(v === '' || v === undefined || v === null ? cellE(`${col}${rowNumber}`, styleId) : cellI(`${col}${rowNumber}`, styleId, v))
  }
  return `<row r="${rowNumber}" ht="20" customHeight="1" spans="1:24">${cells.join('')}</row>`
}

function sepRow(rowNumber, sepStyle) {
  const cells = []
  for (let c = 0; c < 24; c += 1) cells.push(cellE(`${colName(c)}${rowNumber}`, sepStyle))
  return `<row r="${rowNumber}" ht="12" customHeight="1" spans="1:24">${cells.join('')}</row>`
}

function verifyWorkbook(filePath) {
  const wb = XLSX.readFile(filePath)
  if (!wb.SheetNames.length) throw new Error('No sheets')
  const name = wb.SheetNames[0]
  const sheet = wb.Sheets[name]
  if (!sheet || !sheet['!ref']) throw new Error('Sheet body missing after write')
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })
  if (String(rows[11][0]).trim() !== 'Loại dòng *') throw new Error('Header row broken')
  return rows
}

function copyOut(filePath) {
  const name = path.basename(filePath)
  const dests = [
    path.join(process.env.USERPROFILE || '', 'Desktop', name),
    path.join(process.env.USERPROFILE || '', 'Downloads', name),
    path.join(__dirname, '../../../', name),
  ]
  for (const dest of dests) {
    try {
      fs.copyFileSync(filePath, dest)
      console.log('Copied', dest)
    } catch (e) {
      console.warn('Skip', dest, e.code || e.message)
    }
  }
}

function main() {
  const entries = readZip(TEMPLATE)
  const ssXml = entries['xl/sharedStrings.xml'].toString('utf8')
  const SI = {
    PRODUCT: findSi(ssXml, 'SẢN PHẨM'),
    SKU: findSi(ssXml, 'SKU'),
    ATTRIBUTE: findSi(ssXml, 'THUỘC TÍNH'),
    BOM: findSi(ssXml, 'BOM'),
  }

  const styled = ensureStyles(entries['xl/styles.xml'].toString('utf8'))
  entries['xl/styles.xml'] = Buffer.from(styled.stylesXml, 'utf8')
  entries['xl/sharedStrings.xml'] = Buffer.from(improveSharedStrings(ssXml), 'utf8')

  let sheet = entries['xl/worksheets/sheet1.xml'].toString('utf8')
  sheet = layoutSheet(sheet)

  // Clear old guide rows 4-9 then write compact guides
  for (let r = 4; r <= 9; r += 1) sheet = upsertRowXml(sheet, r, `<row r="${r}" ht="3" customHeight="1" spans="1:24"/>`)
  const guide = buildGuide(styled)
  sheet = upsertRowXml(sheet, 4, guide.r4)
  sheet = upsertRowXml(sheet, 5, guide.r5)
  sheet = patchGuideMerges(sheet)

  const templateRow = getRowXml(sheet, 13) || getRowXml(sheet, 112)
  if (!templateRow) throw new Error('No template row')
  const baseStyles = {}
  for (let c = 0; c < 24; c += 1) {
    const col = colName(c)
    baseStyles[col] = styleOf(templateRow, col, 13) || styleOf(templateRow, col, 112)
  }

  // Demo product (cluster 1) — full example for beginners
  const demo = [
    ['SẢN PHẨM', 'P001', '', 'Trà Nhài (ví dụ)', 'THANH_PHAM', 'Trà thành phẩm', 'Piece', 'Sửa tên/danh mục cho đúng hệ thống của bạn', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
    ['SKU', 'P001', 'P001-U1', '', '', '', '', '', 'Hộp', 1, 'Có', 'TRA-NHAI-MAU-HOP', 20000, 12000, '893000000001', 'Có', 5, 500, '', '', '', '', '', ''],
    ['THUỘC TÍNH', 'P001', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', 'Hương vị', 'Nhài', '', '', '', ''],
    ['THUỘC TÍNH', 'P001', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', 'Màu sắc', 'Xanh', '', '', '', ''],
    ['BOM', 'P001', 'P001-U1', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', 'UAT-SEED-RAW-TEA', 100, 'Theo gram', ''],
    ['BOM', 'P001', 'P001-U1', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', 'UAT-SEED-PKG-BAG', 1, 'Theo chiếc', ''],
    ['SKU', 'P001', 'P001-U2', '', '', '', '', '', 'Thùng', 10, 'Không', 'TRA-NHAI-MAU-THUNG', 200000, 0, '893000000010', 'Có', 0, 100, '', '', '', '', '', ''],
    ['BOM', 'P001', 'P001-U2', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', 'UAT-SEED-PKG-BOX', 1, 'BOM thùng', ''],
  ]

  const emptyKinds = [
    ['SẢN PHẨM'],
    ['SKU'],
    ['SKU'],
    ['THUỘC TÍNH'],
    ['THUỘC TÍNH'],
    ['BOM'],
    ['BOM'],
    ['BOM'],
  ]

  const sepRows = []
  let row = 13

  // Cluster 1 demo
  demo.forEach((values, idx) => {
    const override = idx === 0 ? styled.product : null
    // Use shared string indexes for row type column for CF colors
    const vals = values.slice()
    const type = vals[0]
    const cells = []
    for (let c = 0; c < 24; c += 1) {
      const col = colName(c)
      const styleId = c === 0 && override ? override : (c < 24 && override && c !== 23 ? override : baseStyles[col])
      // For product row use product style on all except keep X formula style from base
      const st = idx === 0 && c !== 23 ? styled.product : baseStyles[col]
      if (c === 0) {
        const si = type === 'SẢN PHẨM' ? SI.PRODUCT : type === 'SKU' ? SI.SKU : type === 'THUỘC TÍNH' ? SI.ATTRIBUTE : SI.BOM
        cells.push(cellS(`${col}${row}`, st, si))
      } else if (vals[c] === '' || vals[c] === undefined) {
        cells.push(cellE(`${col}${row}`, st))
      } else {
        cells.push(cellI(`${col}${row}`, st, vals[c]))
      }
    }
    sheet = upsertRowXml(sheet, row, `<row r="${row}" ht="20" customHeight="1" spans="1:24">${cells.join('')}</row>`)
    row += 1
  })

  // separator
  sheet = upsertRowXml(sheet, row, sepRow(row, styled.sep))
  sepRows.push(row)
  row += 1

  // Empty clusters SP02..SP05
  for (let block = 2; block <= 5; block += 1) {
    const code = `SP${String(block).padStart(2, '0')}`
    emptyKinds.forEach((kindArr, idx) => {
      const type = kindArr[0]
      const si = type === 'SẢN PHẨM' ? SI.PRODUCT : type === 'SKU' ? SI.SKU : type === 'THUỘC TÍNH' ? SI.ATTRIBUTE : SI.BOM
      const cells = []
      for (let c = 0; c < 24; c += 1) {
        const col = colName(c)
        const st = idx === 0 && c !== 23 ? styled.product : baseStyles[col]
        if (c === 0) cells.push(cellS(`${col}${row}`, st, si))
        else if (c === 1) cells.push(cellI(`${col}${row}`, st, code))
        else cells.push(cellE(`${col}${row}`, st))
      }
      sheet = upsertRowXml(sheet, row, `<row r="${row}" ht="20" customHeight="1" spans="1:24">${cells.join('')}</row>`)
      row += 1
    })
    if (block < 5) {
      sheet = upsertRowXml(sheet, row, sepRow(row, styled.sep))
      sepRows.push(row)
      row += 1
    }
  }

  // Clear remaining editable rows to empty (keep styles)
  while (row <= 112) {
    const cells = []
    for (let c = 0; c < 24; c += 1) {
      const col = colName(c)
      cells.push(cellE(`${col}${row}`, baseStyles[col]))
    }
    sheet = upsertRowXml(sheet, row, `<row r="${row}" ht="20" customHeight="1" spans="1:24">${cells.join('')}</row>`)
    row += 1
  }

  sheet = addSepMerges(sheet, sepRows)
  // Keep shared formula on X if original had it — skip complex formula rewrite; CF still works via A column values

  entries['xl/worksheets/sheet1.xml'] = Buffer.from(sheet, 'utf8')
  const out = writeZip(entries)
  fs.writeFileSync(TEMPLATE, out)
  fs.writeFileSync(SAMPLE_OUT, out)

  const rows = verifyWorkbook(TEMPLATE)
  console.log('Title:', rows[0][0])
  console.log('R4:', rows[3][0], '|', rows[3][8], '|', rows[3][16])
  console.log('R13:', rows[12][0], rows[12][1], rows[12][3])
  console.log('R14:', rows[13][0], rows[13][1], rows[13][8])
  console.log('R21 gap?', !String(rows[20][0] || '').trim())
  console.log('R22:', rows[21][0], rows[21][1])
  verifyWorkbook(SAMPLE_OUT)
  copyOut(TEMPLATE)
  copyOut(SAMPLE_OUT)
  console.log('OK beginner template ready')
}

main()
