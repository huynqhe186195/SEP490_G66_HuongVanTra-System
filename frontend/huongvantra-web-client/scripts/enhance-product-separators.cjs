/**
 * Phân cách cụm sản phẩm rõ hơn nhưng gọn:
 * - Dòng ngăn: nền xanh xám nhạt, cao hơn, gộp A:X, không chữ to
 * - Dòng SẢN PHẨM: nền xanh rất nhạt để nhận đầu cụm
 * Áp dụng cho file mẫu trống + file có dữ liệu.
 */
const fs = require('fs')
const path = require('path')
const zlib = require('zlib')
const XLSX = require('xlsx')

const FILES = [
  path.join(__dirname, '../public/templates/FileMau_YeuCauTaoHangHoaMoi.xlsx'),
  path.join(__dirname, '../public/templates/FileMau_YeuCauTaoHangHoaMoi_CoDuLieu.xlsx'),
]
const COPIES = [
  path.join(process.env.USERPROFILE || '', 'Desktop'),
  path.join(process.env.USERPROFILE || '', 'Downloads'),
  path.join(__dirname, '../../..'),
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

function ensureSeparatorStyles(stylesXml) {
  let next = stylesXml
  if (!next.includes('<!--hvt-sep-styles-->')) {
    const fills = [
      '<fill><patternFill patternType="solid"><fgColor rgb="FFD7E5DC"/><bgColor indexed="64"/></patternFill></fill>',
      '<fill><patternFill patternType="solid"><fgColor rgb="FFE8F1EB"/><bgColor indexed="64"/></patternFill></fill>',
    ].join('')
    next = next.replace(
      /<fills count="(\d+)">([\s\S]*?)<\/fills>/,
      (_, count, body) => `<fills count="${Number(count) + 2}">${body}${fills}</fills>`,
    )
    const fillList = [...(next.match(/<fills[\s\S]*?<\/fills>/)?.[0].matchAll(/<fill>[\s\S]*?<\/fill>/g) || [])]
    const sepFill = fillList.findIndex((f) => f[0].includes('FFD7E5DC'))
    const productFill = fillList.findIndex((f) => f[0].includes('FFE8F1EB'))
    const xfs = [
      '<!--hvt-sep-styles-->',
      `<xf numFmtId="0" fontId="0" fillId="${sepFill}" borderId="0" xfId="0" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>`,
      `<xf numFmtId="0" fontId="7" fillId="${productFill}" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center"/></xf>`,
    ].join('')
    next = next.replace(
      /<cellXfs count="(\d+)">([\s\S]*?)<\/cellXfs>/,
      (_, count, body) => {
        if (body.includes('<!--hvt-sep-styles-->')) return `<cellXfs count="${count}">${body}</cellXfs>`
        return `<cellXfs count="${Number(count) + 2}">${body}${xfs}</cellXfs>`
      },
    )
  }
  const count = Number(next.match(/<cellXfs count="(\d+)">/)?.[1] || 0)
  return {
    stylesXml: next,
    sepStyle: String(count - 2),
    productStyle: String(count - 1),
  }
}

function readCellPayload(cellXml) {
  if (!cellXml) return { empty: true }
  if (/\st="s"/.test(cellXml)) {
    const v = cellXml.match(/<v>(\d+)<\/v>/)?.[1]
    return { shared: v }
  }
  if (/\st="inlineStr"/.test(cellXml)) {
    const t = cellXml.match(/<t[^>]*>([\s\S]*?)<\/t>/)?.[1] ?? ''
    return { inline: t.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"') }
  }
  if (/<f[\s>]/.test(cellXml)) {
    const f = cellXml.match(/<f[^>]*>([\s\S]*?)<\/f>/)?.[0] ?? cellXml.match(/<f[^>]*\/>/)?.[0] ?? ''
    const v = cellXml.match(/<v>([\s\S]*?)<\/v>/)?.[1]
    return { formulaXml: f, value: v }
  }
  if (/<v>/.test(cellXml)) {
    const v = cellXml.match(/<v>([\s\S]*?)<\/v>/)?.[1]
    return { number: v }
  }
  return { empty: true }
}

function rebuildCell(ref, styleId, payload) {
  const s = styleId ? ` s="${styleId}"` : ''
  if (payload.shared !== undefined) return `<c r="${ref}"${s} t="s"><v>${payload.shared}</v></c>`
  if (payload.inline !== undefined) {
    if (!payload.inline) return `<c r="${ref}"${s}/>`
    return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${escapeXml(payload.inline)}</t></is></c>`
  }
  if (payload.formulaXml) {
    const v = payload.value !== undefined ? `<v>${payload.value}</v>` : ''
    return `<c r="${ref}"${s} t="str">${payload.formulaXml}${v}</c>`
  }
  if (payload.number !== undefined) return `<c r="${ref}"${s}><v>${payload.number}</v></c>`
  return `<c r="${ref}"${s}/>`
}

function getCellXml(rowXml, ref) {
  return rowXml.match(new RegExp(`<c\\b[^>]*\\br="${ref}"[^>]*(?:/>|>[\\s\\S]*?</c>)`))?.[0] ?? ''
}

function restyleProductRow(rowXml, rowNumber, productStyle) {
  if (!rowXml) return rowXml
  const cols = 'ABCDEFGHIJKLMNOPQRSTUVWX'.split('')
  const cells = cols.map((col) => {
    const ref = `${col}${rowNumber}`
    const existing = getCellXml(rowXml, ref)
    const payload = readCellPayload(existing)
    // Keep X formula cells with original style if formula
    if (col === 'X' && payload.formulaXml) {
      const styleId = existing.match(/\ss="([^"]+)"/)?.[1] || productStyle
      return rebuildCell(ref, styleId, payload)
    }
    return rebuildCell(ref, productStyle, payload)
  })
  return `<row r="${rowNumber}" ht="22" customHeight="1" spans="1:24">${cells.join('')}</row>`
}

function buildSeparatorRow(rowNumber, sepStyle) {
  const cols = 'ABCDEFGHIJKLMNOPQRSTUVWX'.split('')
  const cells = cols.map((col) => `<c r="${col}${rowNumber}" s="${sepStyle}"/>`)
  return `<row r="${rowNumber}" ht="14" customHeight="1" spans="1:24">${cells.join('')}</row>`
}

function isProductStartRow(rowXml, rowNumber, ssXml) {
  const a = getCellXml(rowXml, `A${rowNumber}`)
  if (/\st="s"/.test(a)) {
    const idx = Number(a.match(/<v>(\d+)<\/v>/)?.[1])
    const sis = ssXml.split('<si>').slice(1).map((p) => p.split('</si>')[0])
    const text = (sis[idx]?.match(/<t[^>]*>([\s\S]*?)<\/t>/g) || [])
      .map((t) => t.replace(/<[^>]+>/g, ''))
      .join('')
    return text === 'SẢN PHẨM'
  }
  if (/\st="inlineStr"/.test(a)) {
    return /SẢN PHẨM/.test(a)
  }
  return false
}

function isBlankishRow(rowXml, rowNumber) {
  if (!rowXml) return true
  const cols = 'ABCDEFGHIJKLMNOPQRSTUVWX'.split('')
  return cols.every((col) => {
    if (col === 'X') return true
    const cell = getCellXml(rowXml, `${col}${rowNumber}`)
    if (!cell) return true
    const payload = readCellPayload(cell)
    if (payload.empty) return true
    if (payload.inline !== undefined) return !String(payload.inline).trim()
    if (payload.shared !== undefined) return false
    if (payload.number !== undefined) return false
    if (payload.formulaXml) return true
    return true
  })
}

function patchMergesForSeparators(sheetXml, separatorRows) {
  return sheetXml.replace(/<mergeCells([^>]*) count="(\d+)"[^>]*>([\s\S]*?)<\/mergeCells>/, (match, attrs, _count, body) => {
    let cleaned = body.replace(/<mergeCell ref="A(1[3-9]|[2-9]\d|10\d|11[0-2]):X\1"\/>/g, '')
    const extra = separatorRows.map((r) => `<mergeCell ref="A${r}:X${r}"/>`).join('')
    const merged = `${cleaned}${extra}`
    const newCount = (merged.match(/<mergeCell /g) || []).length
    return `<mergeCells${attrs} count="${newCount}">${merged}</mergeCells>`
  })
}

function enhanceFile(filePath) {
  const entries = readZip(filePath)
  const styled = ensureSeparatorStyles(entries['xl/styles.xml'].toString('utf8'))
  entries['xl/styles.xml'] = Buffer.from(styled.stylesXml, 'utf8')
  const ssXml = entries['xl/sharedStrings.xml']?.toString('utf8') || ''

  let sheet = entries['xl/worksheets/sheet1.xml'].toString('utf8')
  const separatorRows = []

  for (let row = 13; row <= 112; row += 1) {
    const rowXml = getRowXml(sheet, row)
    if (isProductStartRow(rowXml, row, ssXml)) {
      sheet = upsertRowXml(sheet, row, restyleProductRow(rowXml, row, styled.productStyle))
      continue
    }
    if (isBlankishRow(rowXml, row)) {
      // Only treat as separator if previous row has content and next has content/product,
      // or classic gap positions. Safer: any blank between 13-112 that sits after a filled row.
      const prev = getRowXml(sheet, row - 1)
      const next = getRowXml(sheet, row + 1)
      const prevFilled = prev && !isBlankishRow(prev, row - 1)
      const nextFilled = next && !isBlankishRow(next, row + 1)
      if (prevFilled && nextFilled) {
        sheet = upsertRowXml(sheet, row, buildSeparatorRow(row, styled.sepStyle))
        separatorRows.push(row)
      }
    }
  }

  sheet = patchMergesForSeparators(sheet, separatorRows)
  entries['xl/worksheets/sheet1.xml'] = Buffer.from(sheet, 'utf8')
  const out = writeZip(entries)
  fs.writeFileSync(filePath, out)
  console.log('Enhanced', path.basename(filePath), 'separators:', separatorRows.length)
  return out
}

function main() {
  for (const file of FILES) {
    if (!fs.existsSync(file)) continue
    enhanceFile(file)
    for (const dir of COPIES) {
      const dest = path.join(dir, path.basename(file))
      try {
        fs.copyFileSync(file, dest)
        console.log('Copied', dest)
      } catch (error) {
        console.warn('Skip', dest, error.code || error.message)
      }
    }
  }

  const rows = XLSX.utils.sheet_to_json(
    XLSX.readFile(FILES[1]).Sheets.NHAP_HANG_HOA,
    { header: 1, defval: '' },
  )
  console.log('Sample R13:', rows[12][0], rows[12][1])
  console.log('Sample R21 empty?', !String(rows[20][0] || '').trim())
  console.log('Sample R22:', rows[21][0], rows[21][1])
}

main()
