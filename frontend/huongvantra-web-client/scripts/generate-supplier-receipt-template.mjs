/**
 * Empty supplier-receipt Excel template for download.
 * Run: node scripts/generate-supplier-receipt-template.mjs
 */
import ExcelJS from 'exceljs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outPath = join(__dirname, '../public/templates/phieu-nhap-kho-excel-tt200.xlsx')

const GREEN_DARK = '356647'
const GREEN_LIGHT = 'E8F2EC'
const BORDER = 'A3B5A8'
const HEADER_BG = '356647'
const WHITE = 'FFFFFF'
const AMBER = 'FFF8E7'
const EMPTY_ROWS = 15

function thinBorder() {
  const edge = { style: 'thin', color: { argb: `FF${BORDER}` } }
  return { top: edge, left: edge, bottom: edge, right: edge }
}

function styleHeaderCell(cell, text) {
  cell.value = text
  cell.font = { name: 'Times New Roman', size: 10, bold: true, color: { argb: `FF${WHITE}` } }
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${HEADER_BG}` } }
  cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
  cell.border = thinBorder()
}

function styleEmptyDataRow(ws, rowNum, zebra) {
  const row = ws.getRow(rowNum)
  for (let col = 1; col <= 12; col += 1) {
    const cell = row.getCell(col)
    cell.value = col === 1 ? rowNum - 17 : ''
    if (col === 1) cell.value = ''
    cell.border = thinBorder()
    cell.font = { name: 'Times New Roman', size: 11 }
    cell.alignment = {
      vertical: 'middle',
      horizontal: [2, 3, 9, 12].includes(col) ? 'left' : [1, 4].includes(col) ? 'center' : 'right',
    }
    if (zebra) {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${GREEN_LIGHT}` } }
    }
    if (col >= 9 && col <= 11) {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: zebra ? 'FFE8F0FE' : 'FFF7FAFF' },
      }
    }
    if (col === 12) {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: zebra ? 'FFF5F0E8' : 'FFFAF7F2' },
      }
    }
    if (col === 10 || col === 11) cell.numFmt = 'yyyy-mm-dd'
    if (col === 7 || col === 8) cell.numFmt = '#,##0'
  }
}

async function main() {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Huong Van Tra POS'
  wb.created = new Date()

  const ws = wb.addWorksheet('Phieu nhap kho TT200', {
    pageSetup: {
      paperSize: 9,
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    },
    properties: { defaultRowHeight: 18 },
  })

  ws.columns = [
    { width: 6 },
    { width: 34 },
    { width: 15 },
    { width: 7 },
    { width: 11 },
    { width: 11 },
    { width: 11 },
    { width: 12 },
    { width: 13 },
    { width: 11 },
    { width: 11 },
    { width: 28 },
  ]

  ws.mergeCells('A1:B1')
  ws.getCell('A1').value = 'Đơn vị: ...................'
  ws.getCell('A1').font = { name: 'Times New Roman', size: 11, italic: true }
  ws.mergeCells('E1:L1')
  ws.getCell('E1').value = 'Mẫu số 01 - VT'
  ws.getCell('E1').font = { name: 'Times New Roman', size: 11, bold: true, color: { argb: `FF${GREEN_DARK}` } }
  ws.getCell('E1').alignment = { horizontal: 'right' }

  ws.mergeCells('A2:B2')
  ws.getCell('A2').value = 'Bộ phận: ................'
  ws.getCell('A2').font = { name: 'Times New Roman', size: 11, italic: true }
  ws.mergeCells('E2:L2')
  ws.getCell('E2').value = '(Ban hành theo Thông tư số 200/2014/TT-BTC)'
  ws.getCell('E2').font = { name: 'Times New Roman', size: 9, italic: true, color: { argb: 'FF666666' } }
  ws.getCell('E2').alignment = { horizontal: 'right' }

  ws.mergeCells('E3:L3')
  ws.getCell('E3').value = 'Ngày 22/12/2014 của Bộ Tài chính'
  ws.getCell('E3').font = { name: 'Times New Roman', size: 9, italic: true, color: { argb: 'FF666666' } }
  ws.getCell('E3').alignment = { horizontal: 'right' }

  ws.mergeCells('A5:L5')
  ws.getCell('A5').value = 'PHIẾU NHẬP KHO'
  ws.getCell('A5').font = { name: 'Times New Roman', size: 20, bold: true, color: { argb: `FF${GREEN_DARK}` } }
  ws.getCell('A5').alignment = { horizontal: 'center', vertical: 'middle' }
  ws.getRow(5).height = 28

  ws.mergeCells('C6:D6')
  ws.getCell('C6').value = 'Ngày .... tháng .... năm ........'
  ws.getCell('C6').font = { name: 'Times New Roman', size: 12 }
  ws.getCell('C6').alignment = { horizontal: 'center' }
  ws.mergeCells('E6:F6')
  ws.getCell('E6').value = 'Nợ: ................'
  ws.getCell('E6').font = { name: 'Times New Roman', size: 11 }

  ws.mergeCells('C7:D7')
  ws.getCell('C7').value = 'Số: ................'
  ws.getCell('C7').font = { name: 'Times New Roman', size: 12 }
  ws.getCell('C7').alignment = { horizontal: 'center' }
  ws.mergeCells('E7:F7')
  ws.getCell('E7').value = 'Có: ................'
  ws.getCell('E7').font = { name: 'Times New Roman', size: 11 }

  ws.mergeCells('A9:L9')
  ws.getCell('A9').value = '- Họ và tên người giao: ................................................'
  ws.getCell('A9').font = { name: 'Times New Roman', size: 12 }
  ws.getCell('A9').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${AMBER}` } }

  ws.mergeCells('A10:L10')
  ws.getCell('A10').value =
    '- Theo ................ số ................ ngày .... tháng .... năm ........ của ................................................'
  ws.getCell('A10').font = { name: 'Times New Roman', size: 12 }
  ws.getCell('A10').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${AMBER}` } }

  ws.mergeCells('A11:L11')
  ws.getCell('A11').value = 'Nhập tại kho: ................................................ địa điểm: ................................................'
  ws.getCell('A11').font = { name: 'Times New Roman', size: 12 }
  ws.getCell('A11').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${GREEN_LIGHT}` } }

  ws.mergeCells('A12:L12')
  ws.getCell('A12').value = 'Nhà cung cấp: ................................................'
  ws.getCell('A12').font = { name: 'Times New Roman', size: 12, bold: true }
  ws.getCell('A12').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE3F2FD' } }

  ws.mergeCells('A13:L13')
  ws.getCell('A13').value = 'Ghi chú: ................................................'
  ws.getCell('A13').font = { name: 'Times New Roman', size: 12 }
  ws.getCell('A13').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFDE7' } }

  const headerRow = 15
  ws.mergeCells(`A${headerRow}:A${headerRow + 1}`)
  ws.mergeCells(`B${headerRow}:B${headerRow + 1}`)
  ws.mergeCells(`C${headerRow}:C${headerRow + 1}`)
  ws.mergeCells(`D${headerRow}:D${headerRow + 1}`)
  ws.mergeCells(`E${headerRow}:F${headerRow}`)
  ws.mergeCells(`G${headerRow}:G${headerRow + 1}`)
  ws.mergeCells(`H${headerRow}:H${headerRow + 1}`)
  ws.mergeCells(`I${headerRow}:I${headerRow + 1}`)
  ws.mergeCells(`J${headerRow}:J${headerRow + 1}`)
  ws.mergeCells(`K${headerRow}:K${headerRow + 1}`)
  ws.mergeCells(`L${headerRow}:L${headerRow + 1}`)

  styleHeaderCell(ws.getCell(`A${headerRow}`), 'STT')
  styleHeaderCell(
    ws.getCell(`B${headerRow}`),
    'Tên, nhãn hiệu, quy cách, phẩm chất vật tư, dụng cụ, sp, hàng hoá',
  )
  styleHeaderCell(ws.getCell(`C${headerRow}`), 'Mã số')
  styleHeaderCell(ws.getCell(`D${headerRow}`), 'ĐVT')
  styleHeaderCell(ws.getCell(`E${headerRow}`), 'Số lượng')
  styleHeaderCell(ws.getCell(`G${headerRow}`), 'Đơn giá')
  styleHeaderCell(ws.getCell(`H${headerRow}`), 'Thành tiền')
  styleHeaderCell(ws.getCell(`I${headerRow}`), 'Mã lô NCC')
  styleHeaderCell(ws.getCell(`J${headerRow}`), 'Ngày SX')
  styleHeaderCell(ws.getCell(`K${headerRow}`), 'Hạn dùng')
  styleHeaderCell(ws.getCell(`L${headerRow}`), 'Ghi chú chất lượng')

  for (const col of ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']) {
    for (const r of [headerRow, headerRow + 1]) {
      const cell = ws.getCell(`${col}${r}`)
      cell.border = thinBorder()
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${HEADER_BG}` } }
      cell.font = { name: 'Times New Roman', size: 10, bold: true, color: { argb: `FF${WHITE}` } }
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
    }
  }
  ws.getCell(`E${headerRow + 1}`).value = 'Theo chứng từ'
  ws.getCell(`F${headerRow + 1}`).value = 'Thực nhập'
  for (const col of ['I', 'J', 'K']) {
    for (const r of [headerRow, headerRow + 1]) {
      ws.getCell(`${col}${r}`).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF2F5D8A' },
      }
    }
  }
  for (const r of [headerRow, headerRow + 1]) {
    ws.getCell(`L${r}`).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF6B5B3E' },
    }
  }
  ws.getRow(headerRow).height = 22
  ws.getRow(headerRow + 1).height = 20

  const markerRow = headerRow + 2
  ;['A', 'B', 'C', 'D', '1', '2', '3', '4', '5', '6', '7', '8'].forEach((v, i) => {
    const cell = ws.getCell(markerRow, i + 1)
    cell.value = v
    cell.font = { name: 'Times New Roman', size: 9, italic: true, color: { argb: 'FF888888' } }
    cell.alignment = { horizontal: 'center' }
    cell.border = thinBorder()
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } }
  })

  const dataStart = headerRow + 3
  for (let i = 0; i < EMPTY_ROWS; i += 1) {
    styleEmptyDataRow(ws, dataStart + i, i % 2 === 1)
  }

  const congRow = dataStart + EMPTY_ROWS
  ws.getCell(`B${congRow}`).value = 'Cộng'
  ws.getCell(`B${congRow}`).font = { name: 'Times New Roman', size: 12, bold: true }
  ;['C', 'D', 'E', 'F', 'G', 'I', 'J', 'K', 'L'].forEach((c) => {
    ws.getCell(`${c}${congRow}`).value = 'x'
    ws.getCell(`${c}${congRow}`).alignment = { horizontal: 'center' }
  })
  ws.getCell(`H${congRow}`).value = ''
  for (let c = 1; c <= 12; c += 1) {
    const cell = ws.getCell(congRow, c)
    cell.border = thinBorder()
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3CD' } }
  }

  const noteRow = congRow + 2
  ws.mergeCells(`A${noteRow}:L${noteRow}`)
  ws.getCell(`A${noteRow}`).value = '- Tổng số tiền (viết bằng chữ): ................................................'
  ws.getCell(`A${noteRow}`).font = { name: 'Times New Roman', size: 11, italic: true }

  ws.mergeCells(`A${noteRow + 1}:L${noteRow + 1}`)
  ws.getCell(`A${noteRow + 1}`).value = '- Số chứng từ gốc kèm theo: ................................................'
  ws.getCell(`A${noteRow + 1}`).font = { name: 'Times New Roman', size: 11, italic: true }

  const signRow = noteRow + 3
  const signs = [
    ['A', 'Người lập phiếu'],
    ['C', 'Người giao hàng'],
    ['E', 'Thủ kho'],
    ['G', 'Kế toán trưởng'],
  ]
  for (const [col, label] of signs) {
    const end = String.fromCharCode(col.charCodeAt(0) + 1)
    ws.mergeCells(`${col}${signRow}:${end}${signRow}`)
    ws.getCell(`${col}${signRow}`).value = label
    ws.getCell(`${col}${signRow}`).font = { name: 'Times New Roman', size: 11, bold: true }
    ws.getCell(`${col}${signRow}`).alignment = { horizontal: 'center' }
    ws.mergeCells(`${col}${signRow + 1}:${end}${signRow + 1}`)
    ws.getCell(`${col}${signRow + 1}`).value = '(Ký, họ tên)'
    ws.getCell(`${col}${signRow + 1}`).font = {
      name: 'Times New Roman',
      size: 9,
      italic: true,
      color: { argb: 'FF777777' },
    }
    ws.getCell(`${col}${signRow + 1}`).alignment = { horizontal: 'center' }
  }

  const guide = wb.addWorksheet('Huong dan import')
  guide.getColumn(1).width = 96
  guide.getCell('A1').value = 'Hướng dẫn nạp phiếu nhập kho (Hương Vân Trà)'
  guide.getCell('A1').font = { name: 'Calibri', size: 14, bold: true, color: { argb: `FF${GREEN_DARK}` } }
  const tips = [
    '',
    'Mẫu này để trống — điền rồi nạp vào trang Tạo phiếu nhập.',
    '1. Điền Nhà cung cấp: (khớp đúng tên NCC trong hệ thống).',
    '2. Điền Ghi chú: (ghi chú phiếu, tùy chọn).',
    '3. Điền bảng hàng: Mã số, SL theo chứng từ, SL thực nhập, Đơn giá.',
    '4. Cột I–K (Mã lô NCC, Ngày SX, Hạn dùng) bắt buộc nếu muốn Gửi duyệt ngay.',
    '5. Cột L (Ghi chú chất lượng) tùy chọn.',
    '6. Có thể thêm dòng phía trên “Cộng”; giữ nguyên tiêu đề cột.',
    '7. Ngày SX/HSD dạng yyyy-mm-dd. Mã lô: chữ, số, - và _.',
  ]
  tips.forEach((text, i) => {
    guide.getCell(`A${i + 2}`).value = text
    guide.getCell(`A${i + 2}`).font = { name: 'Calibri', size: 11 }
  })

  await wb.xlsx.writeFile(outPath)
  console.log(`Wrote empty template ${outPath} with ${EMPTY_ROWS} blank rows`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
