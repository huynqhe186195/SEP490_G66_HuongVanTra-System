/**
 * Chỉnh FileMau_YeuCauTaoHangHoaMoi.xlsx:
 * - Font Times New Roman
 * - Bố cục theo cụm sản phẩm (SẢN PHẨM → SKU → THUỘC TÍNH → BOM), cách bằng dòng trống xám nhạt
 * - Freeze tiêu đề, độ rộng cột dễ đọc
 * Giữ nguyên header dòng 12, bảng A12:X112, ví dụ từ ~115 (contract import).
 */
const fs = require('fs')
const path = require('path')
const zlib = require('zlib')
const XLSX = require('xlsx')

const TEMPLATE = path.join(__dirname, '../public/templates/FileMau_YeuCauTaoHangHoaMoi.xlsx')
const COPIES = [
  path.join(process.env.USERPROFILE || '', 'Desktop', 'FileMau_YeuCauTaoHangHoaMoi.xlsx'),
  path.join(process.env.USERPROFILE || '', 'Downloads', 'FileMau_YeuCauTaoHangHoaMoi.xlsx'),
  path.join(__dirname, '../../../FileMau_YeuCauTaoHangHoaMoi.xlsx'),
]

const FIRST_DATA_ROW = 13
const LAST_TABLE_ROW = 112
const BLOCK_SIZE = 9 // 8 dòng dữ liệu + 1 dòng trống
const BLOCK_COUNT = 10
const SI = { PRODUCT: null, SKU: null, ATTRIBUTE: null, BOM: null }

function readZip(filePath) {
  const buf = fs.readFileSync(filePath)
  let eocd = -1
  for (let i = buf.length - 22; i >= 0; i -= 1) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i
      break
    }
  }
  if (eocd < 0) throw new Error('EOCD not found')
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

function resolveSharedStringIndexes(ssXml) {
  const sis = ssXml.split('<si>').slice(1).map((part) => part.split('</si>')[0])
  const findExact = (label) => {
    const index = sis.findIndex((si) => {
      const text = (si.match(/<t[^>]*>([\s\S]*?)<\/t>/g) || [])
        .map((t) => t.replace(/<[^>]+>/g, ''))
        .join('')
      return text === label
    })
    if (index < 0) throw new Error(`Missing shared string: ${label}`)
    return index
  }
  SI.PRODUCT = findExact('SẢN PHẨM')
  SI.SKU = findExact('SKU')
  SI.ATTRIBUTE = findExact('THUỘC TÍNH')
  SI.BOM = findExact('BOM')
}

function setTimesNewRoman(stylesXml) {
  return stylesXml
    .replace(/<name val="Aptos"\/>/g, '<name val="Times New Roman"/>')
    .replace(/<name val="Carlito"\/>/g, '<name val="Times New Roman"/>')
    .replace(/<name val="Calibri"\/>/g, '<name val="Times New Roman"/>')
    .replace(/<name val="Arial"\/>/g, '<name val="Times New Roman"/>')
    .replace(/ scheme="minor"/g, '')
}

function ensureGapStyle(stylesXml) {
  let next = setTimesNewRoman(stylesXml)
  if (!next.includes('FFEEF2EF')) {
    next = next.replace(
      /<fills count="(\d+)">([\s\S]*?)<\/fills>/,
      (_, count, body) =>
        `<fills count="${Number(count) + 1}">${body}<fill><patternFill patternType="solid"><fgColor rgb="FFEEF2EF"/><bgColor indexed="64"/></patternFill></fill></fills>`,
    )
  }
  const fillsBlock = next.match(/<fills[\s\S]*?<\/fills>/)?.[0] || ''
  const fillParts = [...fillsBlock.matchAll(/<fill>[\s\S]*?<\/fill>/g)]
  let softFillId = fillParts.findIndex((part) => part[0].includes('FFEEF2EF'))
  if (softFillId < 0) softFillId = 7

  if (!next.includes('<!--hvt-gap-style-->')) {
    next = next.replace(
      /<cellXfs count="(\d+)">([\s\S]*?)<\/cellXfs>/,
      (_, count, body) => {
        if (body.includes('<!--hvt-gap-style-->')) return `<cellXfs count="${count}">${body}</cellXfs>`
        const xf = `<!--hvt-gap-style--><xf numFmtId="0" fontId="0" fillId="${softFillId}" borderId="0" xfId="0" applyFill="1" applyAlignment="1"><alignment vertical="center"/></xf>`
        return `<cellXfs count="${Number(count) + 1}">${body}${xf}</cellXfs>`
      },
    )
  }
  const count = Number(next.match(/<cellXfs count="(\d+)">/)?.[1] || 0)
  return { stylesXml: next, gapStyleId: String(Math.max(0, count - 1)) }
}

function improveLayout(sheetXml) {
  let next = sheetXml

  next = next.replace(
    /<sheetViews>[\s\S]*?<\/sheetViews>/,
    `<sheetViews>
  <sheetView workbookViewId="0">
    <pane ySplit="12" topLeftCell="A13" activePane="bottomLeft" state="frozen"/>
    <selection pane="bottomLeft" activeCell="A13" sqref="A13"/>
  </sheetView>
</sheetViews>`,
  )

  const colsXml = `<cols>
  <col min="1" max="1" width="13" customWidth="1"/>
  <col min="2" max="2" width="13" customWidth="1"/>
  <col min="3" max="3" width="15" customWidth="1"/>
  <col min="4" max="4" width="26" customWidth="1"/>
  <col min="5" max="5" width="14" customWidth="1"/>
  <col min="6" max="6" width="16" customWidth="1"/>
  <col min="7" max="7" width="13" customWidth="1"/>
  <col min="8" max="8" width="28" customWidth="1"/>
  <col min="9" max="9" width="12" customWidth="1"/>
  <col min="10" max="10" width="9" customWidth="1"/>
  <col min="11" max="11" width="12" customWidth="1"/>
  <col min="12" max="12" width="24" customWidth="1"/>
  <col min="13" max="13" width="11" customWidth="1"/>
  <col min="14" max="14" width="11" customWidth="1"/>
  <col min="15" max="15" width="14" customWidth="1"/>
  <col min="16" max="16" width="12" customWidth="1"/>
  <col min="17" max="17" width="11" customWidth="1"/>
  <col min="18" max="18" width="11" customWidth="1"/>
  <col min="19" max="19" width="15" customWidth="1"/>
  <col min="20" max="20" width="16" customWidth="1"/>
  <col min="21" max="21" width="18" customWidth="1"/>
  <col min="22" max="22" width="10" customWidth="1"/>
  <col min="23" max="23" width="18" customWidth="1"/>
  <col min="24" max="24" width="24" customWidth="1"/>
</cols>`

  if (/<cols>[\s\S]*?<\/cols>/.test(next)) next = next.replace(/<cols>[\s\S]*?<\/cols>/, colsXml)
  else next = next.replace(/(<sheetFormatPr[^/]*\/>)/, `$1${colsXml}`)

  next = next.replace(/<sheetFormatPr[^/]*\/>/, '<sheetFormatPr defaultRowHeight="18" defaultColWidth="12"/>')
  next = next
    .replace(/<row r="1"[^>]*>/, '<row r="1" ht="26" customHeight="1" spans="1:24">')
    .replace(/<row r="2"[^>]*>/, '<row r="2" ht="20" customHeight="1" spans="1:24">')
    .replace(/<row r="12"[^>]*>/, '<row r="12" ht="32" customHeight="1" spans="1:24">')

  return next
}

function improveSharedStrings(ssXml) {
  const pairs = [
    ['MẪU IMPORT YÊU CẦU TẠO HÀNG HÓA — 1 SHEET', 'MẪU EXCEL — TẠO HÀNG HÓA'],
    [
      'Dùng để tạo đồng thời nhiều sản phẩm, nhiều SKU/đơn vị, thuộc tính và BOM trong cùng một file.',
      'Mỗi sản phẩm là một cụm dòng: SẢN PHẨM → SKU → THUỘC TÍNH → BOM, cách nhau bằng dòng trống. Copy cả cụm để thêm sản phẩm (đổi mã SP).',
    ],
    ['Template v2.0 • 20/07/2026', 'Mẫu v3.0 • Times New Roman · Cụm sản phẩm · Cố định tiêu đề'],
    [
      '1. CÁCH NHẬP DỮ LIỆU',
      '1. CÁCH ĐIỀN',
    ],
    [
      '• Mỗi sản phẩm bắt đầu bằng 1 dòng SẢN PHẨM.&#10;• Các dòng SKU, THUỘC TÍNH và BOM dùng cùng Mã sản phẩm.&#10;• Có thể sao chép nguyên cụm dòng để tạo nhanh sản phẩm tiếp theo.&#10;• Dòng để trống hoàn toàn sẽ được bỏ qua khi import.',
      '1) Một cụm = một sản phẩm&#10;2) Bắt đầu bằng SẢN PHẨM, rồi SKU / THUỘC TÍNH / BOM&#10;3) Cùng mã SP trong cụm (SP01, SP02…)&#10;4) Dòng trống xám = hết sản phẩm; copy cả cụm để thêm mới',
    ],
    [
      'BẢNG NHẬP DỮ LIỆU • Chỉ nhập các cột phù hợp với Loại dòng. Cột “Kiểm tra nhanh” do Excel tự tính và không import.',
      'BẢNG NHẬP (từ dòng 13) • Điền đúng cột theo Loại dòng. Cột “Kiểm tra nhanh” chỉ để đối chiếu, không import.',
    ],
  ]
  let next = ssXml
  for (const [from, to] of pairs) {
    if (next.includes(from)) next = next.split(from).join(to)
    else console.warn('sharedStrings miss:', from.slice(0, 50))
  }
  return next
}

function cellShared(ref, styleId, si) {
  const s = styleId ? ` s="${styleId}"` : ''
  return `<c r="${ref}"${s} t="s"><v>${si}</v></c>`
}

function cellInline(ref, styleId, text) {
  const s = styleId ? ` s="${styleId}"` : ''
  if (!text) return `<c r="${ref}"${s}/>`
  return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${escapeXml(text)}</t></is></c>`
}

function cellEmpty(ref, styleId) {
  const s = styleId ? ` s="${styleId}"` : ''
  return `<c r="${ref}"${s}/>`
}

function cellSharedFormulaX(ref, styleId, isMaster, formula) {
  const s = styleId ? ` s="${styleId}"` : ''
  if (isMaster) {
    return `<c r="${ref}"${s} t="str"><f t="shared" ref="X${FIRST_DATA_ROW}:X${LAST_TABLE_ROW}" si="0">${formula}</f><v></v></c>`
  }
  return `<c r="${ref}"${s} t="str"><f t="shared" si="0"/><v></v></c>`
}

const MASTER_X_FORMULA =
  'IF(COUNTA(A13:W13)=0,"",IF(A13="SẢN PHẨM",IF(AND(B13<>"",D13<>"",E13<>"",F13<>"",G13<>""),"Hợp lệ","Thiếu thông tin sản phẩm"),IF(A13="SKU",IF(AND(B13<>"",C13<>"",I13<>"",ISNUMBER(J13),J13>=1,MOD(J13,1)=0,K13<>"",OR(M13="",AND(ISNUMBER(M13),M13>=0)),P13<>""),"Hợp lệ","Kiểm tra SKU / đơn vị"),IF(A13="THUỘC TÍNH",IF(AND(B13<>"",S13<>"",T13<>""),"Hợp lệ","Thiếu tên hoặc giá trị"),IF(A13="BOM",IF(AND(B13<>"",C13<>"",U13<>"",ISNUMBER(V13),V13>=1,MOD(V13,1)=0),"Hợp lệ","Kiểm tra BOM"),"Chọn Loại dòng")))))'

const BLOCK_KINDS = ['PRODUCT', 'SKU', 'SKU', 'ATTRIBUTE', 'ATTRIBUTE', 'BOM', 'BOM', 'BOM', 'GAP']

function buildRow(templateRowXml, rowNumber, kind, productCode, gapStyleId) {
  const cols = 'ABCDEFGHIJKLMNOPQRSTUVWX'.split('')
  const styles = Object.fromEntries(
    cols.map((col) => [col, styleOf(templateRowXml, col, 13) || styleOf(templateRowXml, col, 112)]),
  )
  const cells = []

  if (kind === 'GAP') {
    for (const col of cols) cells.push(cellEmpty(`${col}${rowNumber}`, gapStyleId))
    return `<row r="${rowNumber}" ht="10" customHeight="1" spans="1:24">${cells.join('')}</row>`
  }

  cells.push(cellShared(`A${rowNumber}`, styles.A, SI[kind]))
  cells.push(cellInline(`B${rowNumber}`, styles.B, productCode))
  cells.push(cellEmpty(`C${rowNumber}`, styles.C))
  cells.push(cellEmpty(`D${rowNumber}`, styles.D))
  for (const col of cols.slice(4, 23)) cells.push(cellEmpty(`${col}${rowNumber}`, styles[col]))
  cells.push(cellSharedFormulaX(`X${rowNumber}`, styles.X, rowNumber === FIRST_DATA_ROW, MASTER_X_FORMULA))
  return `<row r="${rowNumber}" ht="20" customHeight="1" spans="1:24">${cells.join('')}</row>`
}

function main() {
  const entries = readZip(TEMPLATE)
  resolveSharedStringIndexes(entries['xl/sharedStrings.xml'].toString('utf8'))

  const styled = ensureGapStyle(entries['xl/styles.xml'].toString('utf8'))
  entries['xl/styles.xml'] = Buffer.from(styled.stylesXml, 'utf8')
  const gapStyleId = styled.gapStyleId

  entries['xl/sharedStrings.xml'] = Buffer.from(
    improveSharedStrings(entries['xl/sharedStrings.xml'].toString('utf8')),
    'utf8',
  )

  let sheet = entries['xl/worksheets/sheet1.xml'].toString('utf8')
  sheet = improveLayout(sheet)
  sheet = sheet.replace(/ref="X13:X\d+"/g, `ref="X${FIRST_DATA_ROW}:X${LAST_TABLE_ROW}"`)

  const templateRow = getRowXml(sheet, 13) || getRowXml(sheet, 112)
  if (!templateRow) throw new Error('Missing template row 13/112')

  for (let block = 0; block < BLOCK_COUNT; block += 1) {
    const start = FIRST_DATA_ROW + block * BLOCK_SIZE
    const code = `SP${String(block + 1).padStart(2, '0')}`
    for (let offset = 0; offset < BLOCK_SIZE; offset += 1) {
      const rowNumber = start + offset
      sheet = upsertRowXml(sheet, rowNumber, buildRow(templateRow, rowNumber, BLOCK_KINDS[offset], code, gapStyleId))
    }
  }

  for (let rowNumber = FIRST_DATA_ROW + BLOCK_COUNT * BLOCK_SIZE; rowNumber <= LAST_TABLE_ROW; rowNumber += 1) {
    const cols = 'ABCDEFGHIJKLMNOPQRSTUVWX'.split('')
    const cells = cols.map((col) => {
      const styleId = styleOf(templateRow, col, 13)
      if (col === 'X') return cellSharedFormulaX(`${col}${rowNumber}`, styleId, false, MASTER_X_FORMULA)
      return cellEmpty(`${col}${rowNumber}`, styleId)
    })
    sheet = upsertRowXml(sheet, rowNumber, `<row r="${rowNumber}" ht="20" customHeight="1" spans="1:24">${cells.join('')}</row>`)
  }

  entries['xl/worksheets/sheet1.xml'] = Buffer.from(sheet, 'utf8')
  const out = writeZip(entries)
  fs.writeFileSync(TEMPLATE, out)
  for (const dest of COPIES) {
    try {
      fs.writeFileSync(dest, out)
      console.log('Wrote', dest)
    } catch (error) {
      console.warn('Skip', dest, error.code || error.message)
    }
  }

  const wb = XLSX.readFile(TEMPLATE)
  const rows = XLSX.utils.sheet_to_json(wb.Sheets.NHAP_HANG_HOA, { header: 1, defval: '' })
  const headers = rows[11]
  const expected = ['Loại dòng *', 'Mã sản phẩm *', 'Mã SKU tham chiếu', 'Tên sản phẩm']
  expected.forEach((label, i) => {
    if (String(headers[i]).trim() !== label) throw new Error(`Header mismatch: ${headers[i]}`)
  })
  console.log('Title:', rows[0][0])
  console.log('Guide:', String(rows[1][0]).slice(0, 110))
  console.log('R13:', rows[12][0], rows[12][1])
  console.log('R14:', rows[13][0], rows[13][1])
  console.log('R21:', JSON.stringify(rows[20][0]), '| R22:', rows[21][0], rows[21][1])
  console.log('OK · gapStyle', gapStyleId)
}

main()
