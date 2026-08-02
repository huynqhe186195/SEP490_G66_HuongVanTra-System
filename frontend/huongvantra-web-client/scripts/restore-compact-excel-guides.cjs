/**
 * Khôi phục hướng dẫn 1/2/3 dạng gọn (2 dòng), dễ nhìn.
 * Không dùng banner "KHỐI" to; chỉ 3 cột ngắn.
 */
const fs = require('fs')
const path = require('path')
const zlib = require('zlib')
const XLSX = require('xlsx')

const TEMPLATE = path.join(__dirname, '../public/templates/FileMau_YeuCauTaoHangHoaMoi.xlsx')
const SAMPLE = path.join(__dirname, '../public/templates/FileMau_YeuCauTaoHangHoaMoi_CoDuLieu.xlsx')
const COPIES = [
  [TEMPLATE, path.join(process.env.USERPROFILE || '', 'Desktop', 'FileMau_YeuCauTaoHangHoaMoi.xlsx')],
  [TEMPLATE, path.join(process.env.USERPROFILE || '', 'Downloads', 'FileMau_YeuCauTaoHangHoaMoi.xlsx')],
  [TEMPLATE, path.join(__dirname, '../../../FileMau_YeuCauTaoHangHoaMoi.xlsx')],
  [SAMPLE, path.join(process.env.USERPROFILE || '', 'Desktop', 'FileMau_YeuCauTaoHangHoaMoi_CoDuLieu.xlsx')],
  [SAMPLE, path.join(process.env.USERPROFILE || '', 'Downloads', 'FileMau_YeuCauTaoHangHoaMoi_CoDuLieu.xlsx')],
  [SAMPLE, path.join(__dirname, '../../../FileMau_YeuCauTaoHangHoaMoi_CoDuLieu.xlsx')],
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

function upsertRowXml(sheetXml, rowNumber, rowXml) {
  const rowPattern = new RegExp(`<row\\b[^>]*\\br="${rowNumber}"[^>]*(?:/>|>[\\s\\S]*?</row>)`)
  if (rowPattern.test(sheetXml)) return sheetXml.replace(rowPattern, rowXml)
  return sheetXml.replace('</sheetData>', `${rowXml}</sheetData>`)
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

function ensureGuideStyles(stylesXml) {
  let next = stylesXml
    .replace(/<name val="Aptos"\/>/g, '<name val="Times New Roman"/>')
    .replace(/<name val="Carlito"\/>/g, '<name val="Times New Roman"/>')
    .replace(/<name val="Calibri"\/>/g, '<name val="Times New Roman"/>')

  if (!next.includes('<!--hvt-guide-styles-->')) {
    // Soft fills: sage / cream / mist
    const extraFills = [
      '<fill><patternFill patternType="solid"><fgColor rgb="FF356647"/><bgColor indexed="64"/></patternFill></fill>',
      '<fill><patternFill patternType="solid"><fgColor rgb="FFF7F4EC"/><bgColor indexed="64"/></patternFill></fill>',
      '<fill><patternFill patternType="solid"><fgColor rgb="FFEEF5F0"/><bgColor indexed="64"/></patternFill></fill>',
      '<fill><patternFill patternType="solid"><fgColor rgb="FFF3F0FA"/><bgColor indexed="64"/></patternFill></fill>',
    ].join('')
    next = next.replace(
      /<fills count="(\d+)">([\s\S]*?)<\/fills>/,
      (_, count, body) => `<fills count="${Number(count) + 4}">${body}${extraFills}</fills>`,
    )

    const fills = [...(next.match(/<fills[\s\S]*?<\/fills>/)?.[0].matchAll(/<fill>[\s\S]*?<\/fill>/g) || [])]
    const idOf = (rgb) => fills.findIndex((f) => f[0].includes(rgb))
    const headFill = idOf('FF356647')
    const body1 = idOf('FFF7F4EC')
    const body2 = idOf('FFEEF5F0')
    const body3 = idOf('FFF3F0FA')

    // Add small white bold + body fonts if needed — reuse fontId 1 (white bold) and fontId 6/11
    const extraXfs = [
      '<!--hvt-guide-styles-->',
      `<xf numFmtId="0" fontId="1" fillId="${headFill}" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>`,
      `<xf numFmtId="0" fontId="6" fillId="${body1}" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="left" vertical="top" wrapText="1"/></xf>`,
      `<xf numFmtId="0" fontId="6" fillId="${body2}" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="left" vertical="top" wrapText="1"/></xf>`,
      `<xf numFmtId="0" fontId="6" fillId="${body3}" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="left" vertical="top" wrapText="1"/></xf>`,
    ].join('')

    next = next.replace(
      /<cellXfs count="(\d+)">([\s\S]*?)<\/cellXfs>/,
      (_, count, body) => {
        if (body.includes('<!--hvt-guide-styles-->')) return `<cellXfs count="${count}">${body}</cellXfs>`
        return `<cellXfs count="${Number(count) + 4}">${body}${extraXfs}</cellXfs>`
      },
    )
  }

  const count = Number(next.match(/<cellXfs count="(\d+)">/)?.[1] || 0)
  // last 4 styles: head, body1, body2, body3
  return {
    stylesXml: next,
    head: String(count - 4),
    body1: String(count - 3),
    body2: String(count - 2),
    body3: String(count - 1),
  }
}

function buildGuideRow4(styles) {
  const cols = 'ABCDEFGHIJKLMNOPQRSTUVWX'.split('')
  const cells = cols.map((col, index) => {
    if (index === 0) return cellInline(`${col}4`, styles.head, '1. Cách điền')
    if (index === 8) return cellInline(`${col}4`, styles.head, '2. Quy tắc nhanh')
    if (index === 16) return cellInline(`${col}4`, styles.head, '3. Loại dòng')
    if (index < 8) return cellEmpty(`${col}4`, styles.head)
    if (index < 16) return cellEmpty(`${col}4`, styles.head)
    return cellEmpty(`${col}4`, styles.head)
  })
  return `<row r="4" ht="22" customHeight="1" spans="1:24">${cells.join('')}</row>`
}

function buildGuideRow5(styles) {
  const text1 = '• 1 cụm = 1 sản phẩm\n• Bắt đầu bằng SẢN PHẨM\n• Cùng mã SP trong cụm\n• Copy cả cụm để thêm SP mới'
  const text2 = '• Có đúng 1 SKU cơ bản (Quy đổi = 1)\n• SKU quy đổi: giá = giá cơ bản × quy đổi\n• BOM gắn SKU cơ bản\n• Quy đổi & định mức: số nguyên dương'
  const text3 = 'SẢN PHẨM — thông tin chung\nSKU — đơn vị / giá / tồn\nTHUỘC TÍNH — tên + giá trị\nBOM — component + định mức'
  const cols = 'ABCDEFGHIJKLMNOPQRSTUVWX'.split('')
  const cells = cols.map((col, index) => {
    if (index === 0) return cellInline(`${col}5`, styles.body1, text1)
    if (index === 8) return cellInline(`${col}5`, styles.body2, text2)
    if (index === 16) return cellInline(`${col}5`, styles.body3, text3)
    if (index < 8) return cellEmpty(`${col}5`, styles.body1)
    if (index < 16) return cellEmpty(`${col}5`, styles.body2)
    return cellEmpty(`${col}5`, styles.body3)
  })
  return `<row r="5" ht="72" customHeight="1" spans="1:24">${cells.join('')}</row>`
}

function patchMerges(sheetXml) {
  const needed = [
    'A4:H4',
    'I4:P4',
    'Q4:X4',
    'A5:H5',
    'I5:P5',
    'Q5:X5',
  ]
  return sheetXml.replace(/<mergeCells([^>]*) count="(\d+)"[^>]*>([\s\S]*?)<\/mergeCells>/, (match, attrs, _count, body) => {
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
    const extra = needed.map((ref) => `<mergeCell ref="${ref}"/>`).join('')
    const merged = `${cleaned}${extra}`
    const newCount = (merged.match(/<mergeCell /g) || []).length
    return `<mergeCells${attrs} count="${newCount}">${merged}</mergeCells>`
  })
}

function applyCompactGuides(filePath, isSample) {
  const entries = readZip(filePath)
  const styled = ensureGuideStyles(entries['xl/styles.xml'].toString('utf8'))
  entries['xl/styles.xml'] = Buffer.from(styled.stylesXml, 'utf8')

  let sheet = entries['xl/worksheets/sheet1.xml'].toString('utf8')
  // Clear old tall guide rows 6-9
  for (let row = 6; row <= 9; row += 1) {
    sheet = upsertRowXml(sheet, row, `<row r="${row}" ht="3" customHeight="1" spans="1:24"/>`)
  }
  sheet = upsertRowXml(sheet, 4, buildGuideRow4(styled))
  sheet = upsertRowXml(sheet, 5, buildGuideRow5(styled))
  sheet = patchMerges(sheet)
  entries['xl/worksheets/sheet1.xml'] = Buffer.from(sheet, 'utf8')

  if (entries['xl/sharedStrings.xml']) {
    let ss = entries['xl/sharedStrings.xml'].toString('utf8')
    ss = ss
      .replace('Mẫu v3.1 · Times New Roman', 'Mẫu v3.2 · Times New Roman · Hướng dẫn gọn')
      .replace('Bảng nhập bắt đầu từ dòng 13.', 'Bảng nhập từ dòng 13 · Xem hướng dẫn ngắn phía trên')
    if (isSample) {
      // keep sample title
    }
    entries['xl/sharedStrings.xml'] = Buffer.from(ss, 'utf8')
  }

  const out = writeZip(entries)
  fs.writeFileSync(filePath, out)
  return out
}

function main() {
  applyCompactGuides(TEMPLATE, false)
  if (fs.existsSync(SAMPLE)) applyCompactGuides(SAMPLE, true)

  for (const [src, dest] of COPIES) {
    if (!fs.existsSync(src)) continue
    try {
      fs.copyFileSync(src, dest)
      console.log('Copied', dest)
    } catch (error) {
      console.warn('Skip', dest, error.code || error.message)
    }
  }

  const rows = XLSX.utils.sheet_to_json(
    XLSX.readFile(TEMPLATE).Sheets.NHAP_HANG_HOA,
    { header: 1, defval: '' },
  )
  console.log('R4:', rows[3][0], '|', rows[3][8], '|', rows[3][16])
  console.log('R5A:', String(rows[4][0]).replace(/\n/g, ' / '))
  console.log('R5I:', String(rows[4][8]).replace(/\n/g, ' / '))
  console.log('R5Q:', String(rows[4][16]).replace(/\n/g, ' / '))
  console.log('R6 empty?', !String(rows[5][0] || '').trim())
  console.log('R13:', rows[12][0], rows[12][1])
}

main()
