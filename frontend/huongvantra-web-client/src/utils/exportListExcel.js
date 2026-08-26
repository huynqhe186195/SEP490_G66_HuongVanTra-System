import { downloadBlob } from '../lib/apiClient.js'
import { formatVietnamDateTime } from './vietnamDateTime.js'

const BRAND = 'FF356647'
const HEADER_BG = 'FFF6F4EC'
const ZEBRA = 'FFFBF9F1'
const MUTED = 'FF717971'
const INK = 'FF1B1C17'
const BORDER = 'FFC1C9C0'
const FONT_NAME = 'Times New Roman'
const FONT_SIZE = 12
const MONEY_FORMAT = '#,##0'
const DATE_FORMAT = 'dd/mm/yyyy hh:mm'

function cellFont({ bold = false, italic = false, color = INK } = {}) {
  return { name: FONT_NAME, size: FONT_SIZE, bold, italic, color: { argb: color } }
}

const THIN_BORDER = {
  top: { style: 'thin', color: { argb: BORDER } },
  left: { style: 'thin', color: { argb: BORDER } },
  bottom: { style: 'thin', color: { argb: BORDER } },
  right: { style: 'thin', color: { argb: BORDER } },
}

function vnTimestamp() {
  const now = new Date()
  const pad = (value) => String(value).padStart(2, '0')
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`
}

function normalizeColumnIndexSet(values = []) {
  return new Set((values || []).map((value) => Number(value)).filter((value) => Number.isInteger(value) && value >= 0))
}

/**
 * Xuất danh sách dạng bảng với tiêu đề, header có màu thương hiệu, lọc tự động và định dạng số/ngày.
 */
export async function exportFormattedListExcel({
  sheetName = 'Danh sách',
  title = 'Danh sách',
  subtitle,
  headers = [],
  rows = [],
  columnWidths = [],
  moneyColumns = [],
  integerColumns = [],
  dateColumns = [],
  filename,
}) {
  let ExcelJS
  try {
    ExcelJS = (await import('exceljs')).default
  } catch (error) {
    console.error('Failed to load exceljs', error)
    throw new Error(
      'Chưa cài thư viện xuất Excel (exceljs). Chạy npm install trong frontend rồi thử lại.',
    )
  }

  const money = normalizeColumnIndexSet(moneyColumns)
  const integers = normalizeColumnIndexSet(integerColumns)
  const dates = normalizeColumnIndexSet(dateColumns)
  const colCount = Math.max(headers.length, 1)
  const widths = columnWidths.length
    ? columnWidths
    : headers.map(() => 18)

  const wb = new ExcelJS.Workbook()
  wb.creator = 'Hương Vân Trà POS'
  wb.created = new Date()

  const ws = wb.addWorksheet(sheetName.slice(0, 31), {
    pageSetup: {
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    },
  })
  ws.columns = widths.map((width) => ({ width }))

  const titleRow = ws.addRow([title])
  ws.mergeCells(titleRow.number, 1, titleRow.number, colCount)
  titleRow.height = 26
  titleRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND } }
  titleRow.getCell(1).font = cellFont({ bold: true, color: 'FFFFFFFF' })
  titleRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' }

  const subtitleText = subtitle
    || `Xuất lúc ${formatVietnamDateTime(new Date().toISOString())} · Tổng ${rows.length} dòng (tối đa 10.000 theo bộ lọc hiện tại)`
  const subtitleRow = ws.addRow([subtitleText])
  ws.mergeCells(subtitleRow.number, 1, subtitleRow.number, colCount)
  subtitleRow.getCell(1).font = cellFont({ italic: true, color: MUTED })
  subtitleRow.getCell(1).alignment = { vertical: 'middle', wrapText: true }

  ws.addRow([])

  const headerRow = ws.addRow(headers)
  headerRow.height = 24
  for (let col = 1; col <= colCount; col += 1) {
    const cell = headerRow.getCell(col)
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BG } }
    cell.font = cellFont({ bold: true })
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
    cell.border = { ...THIN_BORDER, bottom: { style: 'medium', color: { argb: BRAND } } }
  }

  const firstDataRow = headerRow.number + 1
  rows.forEach((values, index) => {
    const excelRow = ws.addRow(values)
    const zebra = index % 2 === 1
    for (let col = 1; col <= colCount; col += 1) {
      const cell = excelRow.getCell(col)
      cell.border = THIN_BORDER
      cell.font = cellFont()
      cell.alignment = { vertical: 'top', wrapText: true }
      if (zebra) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ZEBRA } }
      }

      const zeroBased = col - 1
      if (dates.has(zeroBased) && cell.value instanceof Date) {
        cell.numFmt = DATE_FORMAT
        cell.alignment = { vertical: 'top', horizontal: 'left' }
      } else if (money.has(zeroBased) && typeof cell.value === 'number') {
        cell.numFmt = MONEY_FORMAT
        cell.alignment = { vertical: 'top', horizontal: 'right' }
      } else if (integers.has(zeroBased) && typeof cell.value === 'number') {
        cell.numFmt = '#,##0'
        cell.alignment = { vertical: 'top', horizontal: 'right' }
      }
    }
  })

  if (rows.length > 0) {
    ws.autoFilter = {
      from: { row: headerRow.number, column: 1 },
      to: { row: firstDataRow + rows.length - 1, column: colCount },
    }
  }
  ws.views = [{ state: 'frozen', ySplit: headerRow.number }]

  const buffer = await wb.xlsx.writeBuffer()
  downloadBlob(
    new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    `${filename || 'Export'}_${vnTimestamp()}.xlsx`,
  )
}
