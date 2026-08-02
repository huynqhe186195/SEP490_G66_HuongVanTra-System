/**
 * Inject real Excel fills/fonts into an .xlsx that SheetJS wrote without styles.
 * Uses the same zip patch approach as dropdown injection.
 */

function toUint8Array(buffer) {
  if (buffer instanceof Uint8Array) return buffer
  return new Uint8Array(buffer)
}

function readUint16(bytes, offset) {
  return bytes[offset] | (bytes[offset + 1] << 8)
}

function readUint32(bytes, offset) {
  return (
    (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0
  )
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
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  chunks.forEach((chunk) => {
    out.set(chunk, offset)
    offset += chunk.length
  })
  return out
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let index = 0; index < 256; index += 1) {
    let value = index
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? (0xedb88320 ^ (value >>> 1)) : value >>> 1
    }
    table[index] = value >>> 0
  }
  return table
})()

function crc32(bytes) {
  let crc = 0xffffffff
  for (let index = 0; index < bytes.length; index += 1) {
    crc = CRC_TABLE[(crc ^ bytes[index]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function buildZip(entries) {
  const encoder = new TextEncoder()
  const localChunks = []
  const centralChunks = []
  let localOffset = 0

  entries.forEach((entry) => {
    const nameBytes = encoder.encode(entry.name)
    const dataBytes = entry.bytes
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

    if ((flags & 0x08) !== 0) throw new Error('Không thể đọc file Excel có data descriptor.')

    let entryBytes
    if (method === 0) entryBytes = bytes.slice(dataStart, dataEnd)
    else if (method === 8) entryBytes = await inflateRawBytes(bytes.slice(dataStart, dataEnd))
    else throw new Error('Không thể đọc định dạng nén trong file Excel.')

    entries.push({ name, bytes: entryBytes })
    offset = dataEnd
  }

  return entries
}

async function patchXlsxEntries(arrayBuffer, transforms = {}, replacements = {}) {
  const decoder = new TextDecoder()
  const encoder = new TextEncoder()
  const nextEntries = []
  const seen = new Set()

  for (const entry of await parseZipEntries(arrayBuffer)) {
    seen.add(entry.name)
    if (Object.prototype.hasOwnProperty.call(replacements, entry.name)) {
      const value = replacements[entry.name]
      nextEntries.push({
        name: entry.name,
        bytes: typeof value === 'string' ? encoder.encode(value) : value,
      })
      continue
    }
    const transform = transforms[entry.name]
    if (transform) {
      const text = decoder.decode(entry.bytes)
      nextEntries.push({ name: entry.name, bytes: encoder.encode(transform(text)) })
    } else {
      nextEntries.push(entry)
    }
  }

  Object.entries(replacements).forEach(([name, value]) => {
    if (seen.has(name)) return
    nextEntries.push({
      name,
      bytes: typeof value === 'string' ? encoder.encode(value) : value,
    })
  })

  return buildZip(nextEntries)
}

function escapeXml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function fillXml(rgb) {
  return `<fill><patternFill patternType="solid"><fgColor rgb="FF${rgb}"/><bgColor indexed="64"/></patternFill></fill>`
}

function fontXml({ size = 12, bold = false, italic = false, color = 'FF1B1C17' } = {}) {
  return `<font>${bold ? '<b/>' : ''}${italic ? '<i/>' : ''}<sz val="${size}"/><color rgb="${color}"/><name val="Times New Roman"/><family val="1"/></font>`
}

function borderXml(rgb = 'FFC1C9C0') {
  const edge = `<left style="thin"><color rgb="${rgb}"/></left><right style="thin"><color rgb="${rgb}"/></right><top style="thin"><color rgb="${rgb}"/></top><bottom style="thin"><color rgb="${rgb}"/></bottom>`
  return `<border>${edge}</border>`
}

function xfXml({ fontId = 0, fillId = 0, borderId = 0, boldAlign = 'left', wrap = true, numFmtId = 0 } = {}) {
  const align = `<alignment horizontal="${boldAlign}" vertical="center"${wrap ? ' wrapText="1"' : ''}/>`
  return `<xf numFmtId="${numFmtId}" fontId="${fontId}" fillId="${fillId}" borderId="${borderId}" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">${align}</xf>`
}

/** Style IDs used by colorizeWorksheetXml */
export const STYLE_ID = {
  default: 0,
  title: 1,
  subtitle: 2,
  header: 3,
  headerAlt: 4,
  banner: 5,
  bannerAlt: 6,
  dataEven: 7,
  dataOdd: 8,
  dataMoneyEven: 9,
  dataMoneyOdd: 10,
  empty: 11,
  spacer: 12,
  tip: 13,
  typeTp: 14,
  typeNl: 15,
  typeBb: 16,
  requiredCol: 17,
  section: 18,
  label: 19,
  guideBody: 20,
}

export function buildRichStylesXml() {
  // 0 default text 12; title/section 12.5; còn lại text 12
  const fontsFixed = [
    fontXml({ size: 12 }), // 0 default text
    fontXml({ size: 12.5, bold: true, color: 'FFFFFFFF' }), // 1 title
    fontXml({ size: 12, italic: true, color: 'FF5A4A20' }), // 2 subtitle
    fontXml({ size: 12, bold: true, color: 'FFFFFFFF' }), // 3 header
    fontXml({ size: 12, bold: true, color: 'FF1A4F44' }), // 4 banner text
    fontXml({ size: 12, bold: true, color: 'FF243B5C' }), // 5 banner alt text
    fontXml({ size: 12, italic: true, color: 'FF5B4A20' }), // 6 tip
    fontXml({ size: 12.5, bold: true, color: 'FFFFFFFF' }), // 7 section title
    fontXml({ size: 12, bold: true, color: 'FF334155' }), // 8 label
  ]

  const fillsFixed = [
    '<fill><patternFill patternType="none"/></fill>',
    '<fill><patternFill patternType="gray125"/></fill>',
    fillXml('1B5E3F'), // 2 title
    fillXml('FFF4D6'), // 3 subtitle
    fillXml('2F7A6B'), // 4 header teal/green
    fillXml('3F5F8A'), // 5 header blue
    fillXml('7A6548'), // 6 header brown
    fillXml('B8E0D6'), // 7 banner
    fillXml('C5D4E8'), // 8 banner alt
    fillXml('EAF7F2'), // 9 data even
    fillXml('FFFFFF'), // 10 data odd / white
    fillXml('F3F7F5'), // 11 empty
    fillXml('E8ECEA'), // 12 spacer
    fillXml('FEF3C7'), // 13 tip
    fillXml('D1FAE5'), // 14 TP
    fillXml('FDE68A'), // 15 NL
    fillXml('BFDBFE'), // 16 BB
    fillXml('ECFDF5'), // 17 required
    fillXml('356647'), // 18 section
    fillXml('E8F1EB'), // 19 label
    fillXml('F8FAF8'), // 20 guide
    fillXml('1B5E3F'), // 21 title same
  ]

  const borders = [
    '<border/>',
    borderXml('FFA8C9C3'),
    borderXml('FF9BB0C9'),
    borderXml('FFC9B89A'),
    borderXml('FFC1C9C0'),
  ]

  const cellXfs = [
    xfXml({ fontId: 0, fillId: 0, borderId: 0 }), // 0 default
    xfXml({ fontId: 1, fillId: 2, borderId: 0, boldAlign: 'left' }), // 1 title
    xfXml({ fontId: 2, fillId: 3, borderId: 4, boldAlign: 'left' }), // 2 subtitle
    xfXml({ fontId: 3, fillId: 4, borderId: 1, boldAlign: 'center' }), // 3 header green
    xfXml({ fontId: 3, fillId: 5, borderId: 2, boldAlign: 'center' }), // 4 header blue
    xfXml({ fontId: 3, fillId: 6, borderId: 3, boldAlign: 'center' }), // 5 header brown
    xfXml({ fontId: 4, fillId: 7, borderId: 1, boldAlign: 'left' }), // 6 banner
    xfXml({ fontId: 5, fillId: 8, borderId: 2, boldAlign: 'left' }), // 7 banner alt
    xfXml({ fontId: 0, fillId: 9, borderId: 4, boldAlign: 'left' }), // 8 data even
    xfXml({ fontId: 0, fillId: 10, borderId: 4, boldAlign: 'left' }), // 9 data odd
    xfXml({ fontId: 0, fillId: 9, borderId: 4, boldAlign: 'right', numFmtId: 3 }), // 10 money even
    xfXml({ fontId: 0, fillId: 10, borderId: 4, boldAlign: 'right', numFmtId: 3 }), // 11 money odd
    xfXml({ fontId: 0, fillId: 11, borderId: 4 }), // 12 empty
    xfXml({ fontId: 0, fillId: 12, borderId: 0 }), // 13 spacer
    xfXml({ fontId: 6, fillId: 13, borderId: 4 }), // 14 tip
    xfXml({ fontId: 0, fillId: 14, borderId: 4 }), // 15 type TP
    xfXml({ fontId: 0, fillId: 15, borderId: 4 }), // 16 type NL
    xfXml({ fontId: 0, fillId: 16, borderId: 4 }), // 17 type BB
    xfXml({ fontId: 0, fillId: 17, borderId: 4 }), // 18 required tint
    xfXml({ fontId: 7, fillId: 18, borderId: 0, boldAlign: 'left' }), // 19 section
    xfXml({ fontId: 8, fillId: 19, borderId: 4 }), // 20 label
    xfXml({ fontId: 0, fillId: 20, borderId: 0 }), // 21 guide body
  ]

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0"/></numFmts>
  <fonts count="${fontsFixed.length}">${fontsFixed.join('')}</fonts>
  <fills count="${fillsFixed.length}">${fillsFixed.join('')}</fills>
  <borders count="${borders.length}">${borders.join('')}</borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="${cellXfs.length}">${cellXfs.map((xf) => xf.replace('numFmtId="3"', 'numFmtId="164"')).join('')}</cellXfs>
</styleSheet>`
}

function cellInnerText(cellXml) {
  const inline = cellXml.match(/<t[^>]*>([^<]*)<\/t>/)
  if (inline) return inline[1]
  const value = cellXml.match(/<v>([^<]*)<\/v>/)
  return value ? value[1] : ''
}

function setCellStyle(cellXml, styleId) {
  if (/\ss="\d+"/.test(cellXml)) {
    return cellXml.replace(/\ss="\d+"/, ` s="${styleId}"`)
  }
  return cellXml.replace(/<c\b/, `<c s="${styleId}"`)
}

function headerStyleForSheet(sheetName = '') {
  const key = sheetName.toLowerCase()
  if (key.includes('bom') || key.includes('4_')) return 4
  if (key.includes('thuoc') || key.includes('attr') || key.includes('3_')) return 5
  if (key.includes('sku') || key.includes('2_')) return 3
  return 3
}

function bannerStyleForSheet(sheetName = '') {
  const key = sheetName.toLowerCase()
  if (key.includes('bom') || key.includes('4_')) return 7
  return 6
}

function isMoneyColumn(columnLetter, sheetName = '') {
  const key = sheetName.toLowerCase()
  if (key.includes('sku') || key.includes('2_')) return ['G', 'H'].includes(columnLetter)
  if (key.includes('hang_cung') || key.includes('cung')) return columnLetter === 'E'
  return false
}

/**
 * Colorize one worksheet XML.
 * @param {string} sheetXml
 * @param {{ sheetName?: string, mode?: 'product' | 'supplier' | 'guide' }} options
 */
export function colorizeWorksheetXml(sheetXml, options = {}) {
  const sheetName = options.sheetName || ''
  const mode = options.mode || 'product'
  const headerStyle = headerStyleForSheet(sheetName)
  const bannerStyle = bannerStyleForSheet(sheetName)
  let dataIndex = 0

  return sheetXml.replace(/<row\b[^>]*>[\s\S]*?<\/row>/g, (rowXml) => {
    const rowMatch = rowXml.match(/\br="(\d+)"/)
    const rowNumber = rowMatch ? Number(rowMatch[1]) : 0
    const cells = [...rowXml.matchAll(/<c\b[^>]*\/?>|<c\b[^>]*>[\s\S]*?<\/c>/g)].map((match) => match[0])
    const firstText = cellInnerText(cells[0] || '').trim()
    const joined = cells.map(cellInnerText).join('').trim()
    const upper = firstText.toUpperCase()

    let rowStyle = 9
    if (mode === 'guide') {
      if (rowNumber === 1) rowStyle = 1
      else if (rowNumber === 2) rowStyle = 2
      else if (/^CÁCH|^QUY|^MẸO|^LƯU|^CỘT/i.test(firstText) || upper.includes('HƯỚNG DẪN')) rowStyle = firstText.includes('HƯỚNG') || rowNumber === 1 ? 1 : 19
      else if (firstText.startsWith('•') || firstText.startsWith('Tip')) rowStyle = 14
      else rowStyle = 21
    } else if (rowNumber === 1) {
      rowStyle = 1
    } else if (rowNumber === 2) {
      rowStyle = 2
    } else if (rowNumber === 3 || /^(MÃ SP|MÃ SẢN PHẨM|MÃ SKU|SKU THAM CHIẾU|THUỘC TÍNH|COMPONENT)/i.test(firstText)) {
      rowStyle = headerStyle
      dataIndex = 0
    } else if (firstText.startsWith('▼') || firstText.startsWith('■')) {
      rowStyle = bannerStyle
    } else if (!joined) {
      rowStyle = 13
    } else if (upper.startsWith('TIP') || firstText.startsWith('Tip:')) {
      rowStyle = 14
    } else {
      const even = dataIndex % 2 === 0
      dataIndex += 1
      if (mode === 'product' && sheetName.toLowerCase().includes('1_sanpham')) {
        const typeCell = cellInnerText(cells[2] || '')
        if (typeCell.includes('THANH_PHAM')) rowStyle = 15
        else if (typeCell.includes('NGUYEN_LIEU')) rowStyle = 16
        else if (typeCell.includes('BAO_BI')) rowStyle = 17
        else rowStyle = even ? 8 : 9
      } else {
        rowStyle = even ? 8 : 9
      }
    }

    let nextRow = rowXml
    cells.forEach((cellXml) => {
      const ref = cellXml.match(/\br="([A-Z]+)(\d+)"/)
      const col = ref?.[1] || 'A'
      let styleId = rowStyle
      if (rowStyle === 8 || rowStyle === 9) {
        if (isMoneyColumn(col, sheetName)) styleId = rowStyle === 8 ? 10 : 11
        if ((col === 'A' || col === 'B') && mode === 'supplier') styleId = 18
      }
      if (rowStyle === headerStyle) styleId = headerStyle
      nextRow = nextRow.replace(cellXml, setCellStyle(cellXml, styleId))
    })
    return nextRow
  })
}

function resolveSheetNames(workbookXml, relsXml) {
  const nameBySheetId = new Map()
  for (const match of workbookXml.matchAll(/<sheet\b[^>]*name="([^"]+)"[^>]*r:id="([^"]+)"[^>]*\/>/g)) {
    nameBySheetId.set(match[2], match[1])
  }
  const pathByName = new Map()
  for (const match of relsXml.matchAll(/<Relationship\b[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"[^>]*\/>/g)) {
    const name = nameBySheetId.get(match[1])
    if (!name) continue
    const target = match[2].replace(/^\//, '')
    const path = target.startsWith('xl/') ? target : `xl/${target.replace(/^\.\//, '')}`
    pathByName.set(name, path)
  }
  return pathByName
}

/**
 * @param {ArrayBuffer|Uint8Array} arrayBuffer
 * @param {{ kind?: 'productCreation' | 'supplierProducts' }} options
 */
export async function injectXlsxWorkbookColors(arrayBuffer, options = {}) {
  const kind = options.kind || 'productCreation'
  const decoder = new TextDecoder()
  const entries = await parseZipEntries(arrayBuffer)
  const byName = new Map(entries.map((entry) => [entry.name, entry]))
  const workbookXml = decoder.decode(byName.get('xl/workbook.xml')?.bytes || new Uint8Array())
  const relsXml = decoder.decode(byName.get('xl/_rels/workbook.xml.rels')?.bytes || new Uint8Array())
  if (!workbookXml || !relsXml) return arrayBuffer

  const pathByName = resolveSheetNames(workbookXml, relsXml)
  const transforms = {}

  pathByName.forEach((path, sheetName) => {
    const lower = sheetName.toLowerCase()
    let mode = 'product'
    if (kind === 'supplierProducts') {
      mode = lower.includes('huong') ? 'guide' : (lower.includes('thamchieu') || lower.includes('tham_chieu') ? 'guide' : 'supplier')
    }
    else if (lower.includes('huong') || lower.includes('guide')) mode = 'guide'
    transforms[path] = (sheetXml) => colorizeWorksheetXml(sheetXml, { sheetName, mode })
  })

  return patchXlsxEntries(arrayBuffer, transforms, {
    'xl/styles.xml': buildRichStylesXml(),
  })
}

/** Exported for Excel dropdown / validation zip patches. */
export { parseZipEntries, patchXlsxEntries }

export function downloadBlob(buffer, filename, mime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
  const blob = new Blob([bytes], { type: mime })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

// silence unused in case tree-shake warnings
void escapeXml
