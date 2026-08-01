import { formatVietnamDateTimeMinute } from '../../../utils/vietnamDateTime.js'

function statusVi(status) {
  const map = {
    Completed: 'Đã xong',
    Draft: 'Nháp',
    PendingApproval: 'Chờ duyệt',
    Approved: 'Đã duyệt',
    Rejected: 'Từ chối',
    Cancelled: 'Đã hủy',
    Pending: 'Chờ xử lý',
    Processing: 'Đang làm',
    PartiallyFulfilled: 'Một phần',
    Waiting: 'Chờ trừ kho',
    Insufficient: 'Thiếu hàng',
    Confirmed: 'Đã xác nhận',
    Open: 'Chưa xử lý',
  }
  return map[status] || status || '—'
}

function ledgerTypeVi(type) {
  const map = {
    SUPPLIER_RECEIPT: 'Nhập NCC',
    STOCK_TRANSFER_WAREHOUSE_OUT: 'Xuất kho → kệ',
    STOCK_TRANSFER_SHELF_IN: 'Nhập kệ',
    SHELF_REPLENISHMENT_OUT: 'Xuất kho → kệ',
    SHELF_REPLENISHMENT_IN: 'Nhập kệ',
    PRODUCTION_MATERIAL_EXPORT: 'Xuất NL sản xuất',
    PRODUCTION_FINISHED_RECEIPT: 'Nhập thành phẩm',
    STOCKTAKE_ADJUSTMENT: 'Điều chỉnh kiểm kê',
    SALES_DEDUCT_LATER: 'Trừ kho theo đơn',
    CUSTOM_BUNDLE_MATERIAL_EXPORT: 'Xuất đóng gói',
    CUSTOMER_RETURN_RECEIPT: 'Nhận hàng trả',
    SUPPLIER_RETURN: 'Trả NCC',
  }
  return map[type] || type || 'Khác'
}

function escapeXml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function cellXml(value, styleId, type = 'String') {
  if (value == null || value === '') {
    return `<Cell ss:StyleID="${styleId}"/>`
  }
  if (type === 'Number' && typeof value === 'number' && Number.isFinite(value)) {
    return `<Cell ss:StyleID="${styleId}"><Data ss:Type="Number">${value}</Data></Cell>`
  }
  return `<Cell ss:StyleID="${styleId}"><Data ss:Type="String">${escapeXml(value)}</Data></Cell>`
}

function rowXml(cells, height) {
  const heightAttr = height ? ` ss:Height="${height}"` : ''
  return `<Row${heightAttr}>${cells.join('')}</Row>`
}

function padRow(values, colCount) {
  const next = values.slice(0, colCount)
  while (next.length < colCount) next.push('')
  return next
}

function buildStylesXml() {
  return `
  <Styles>
    <Style ss:ID="Default"><Alignment ss:Vertical="Center"/><Font ss:FontName="Calibri" ss:Size="11"/></Style>
    <Style ss:ID="Title">
      <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
      <Font ss:FontName="Calibri" ss:Size="16" ss:Bold="1" ss:Color="#FFFFFF"/>
      <Interior ss:Color="#356647" ss:Pattern="Solid"/>
    </Style>
    <Style ss:ID="Subtitle">
      <Font ss:FontName="Calibri" ss:Size="11" ss:Italic="1" ss:Color="#356647"/>
      <Interior ss:Color="#E8F1EB" ss:Pattern="Solid"/>
    </Style>
    <Style ss:ID="Section">
      <Font ss:FontName="Calibri" ss:Size="12" ss:Bold="1" ss:Color="#FFFFFF"/>
      <Interior ss:Color="#356647" ss:Pattern="Solid"/>
    </Style>
    <Style ss:ID="SectionAmber">
      <Font ss:FontName="Calibri" ss:Size="12" ss:Bold="1" ss:Color="#FFFFFF"/>
      <Interior ss:Color="#B45309" ss:Pattern="Solid"/>
    </Style>
    <Style ss:ID="Header">
      <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>
      <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#FFFFFF"/>
      <Interior ss:Color="#538463" ss:Pattern="Solid"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#356647"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#356647"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#356647"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#356647"/>
      </Borders>
    </Style>
    <Style ss:ID="HeaderAmber">
      <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>
      <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#FFFFFF"/>
      <Interior ss:Color="#B45309" ss:Pattern="Solid"/>
    </Style>
    <Style ss:ID="Label">
      <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#334155"/>
      <Interior ss:Color="#E8F1EB" ss:Pattern="Solid"/>
    </Style>
    <Style ss:ID="Value"><Font ss:FontName="Calibri" ss:Size="11"/></Style>
    <Style ss:ID="Note">
      <Font ss:FontName="Calibri" ss:Size="10" ss:Italic="1" ss:Color="#475569"/>
      <Interior ss:Color="#FEF3C7" ss:Pattern="Solid"/>
    </Style>
    <Style ss:ID="Warn">
      <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#B45309"/>
      <Interior ss:Color="#FEF3C7" ss:Pattern="Solid"/>
    </Style>
    <Style ss:ID="Cell">
      <Font ss:FontName="Calibri" ss:Size="11"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
      </Borders>
    </Style>
    <Style ss:ID="Zebra">
      <Font ss:FontName="Calibri" ss:Size="11"/>
      <Interior ss:Color="#F8FAFC" ss:Pattern="Solid"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
      </Borders>
    </Style>
    <Style ss:ID="NumCell" ss:Parent="Cell"><NumberFormat ss:Format="#,##0"/></Style>
    <Style ss:ID="NumZebra" ss:Parent="Zebra"><NumberFormat ss:Format="#,##0"/></Style>
  </Styles>`
}

function columnXml(widths) {
  return widths.map((w) => `<Column ss:AutoFitWidth="0" ss:Width="${Math.round(w * 7)}"/>`).join('')
}

function buildOverviewSheet({ dateLabel, date, generated, doneTotal, snap, openCount }) {
  const rows = [
    rowXml([cellXml('BÁO CÁO CUỐI NGÀY KHO', 'Title'), cellXml('', 'Title')], 28),
    rowXml([cellXml('Hương Vân Trà — HVTPOSIMS', 'Subtitle'), cellXml('', 'Subtitle')], 20),
    rowXml([cellXml('', 'Value'), cellXml('', 'Value')]),
    rowXml([cellXml('Ngày xem', 'Label'), cellXml(dateLabel, 'Value')]),
    rowXml([cellXml('Ngày (YYYY-MM-DD)', 'Label'), cellXml(date, 'Value')]),
    rowXml([cellXml('Thời điểm tạo báo cáo', 'Label'), cellXml(generated, 'Value')]),
    rowXml([cellXml('', 'Value'), cellXml('', 'Value')]),
    rowXml([cellXml('TÓM TẮT', 'Section'), cellXml('', 'Section')]),
    rowXml([cellXml('Chỉ số', 'Header'), cellXml('Giá trị', 'Header')]),
    rowXml([cellXml('Việc đã làm trong ngày', 'Label'), cellXml(doneTotal, 'NumCell', 'Number')]),
    rowXml([cellXml('Tồn kho hiện tại', 'Label'), cellXml(snap.totalWarehouseQuantity, 'NumCell', 'Number')]),
    rowXml([cellXml('Mặt hàng sắp hết', 'Label'), cellXml(snap.lowStockSkuCount, 'NumCell', 'Number')]),
    rowXml([cellXml('Lô sắp hết hạn (30 ngày)', 'Label'), cellXml(snap.expiringBatchCount30Days, 'NumCell', 'Number')]),
    rowXml([
      cellXml('Việc còn dở hiện tại', 'Label'),
      cellXml(openCount, openCount > 0 ? 'Warn' : 'NumCell', 'Number'),
    ]),
    rowXml([cellXml('', 'Value'), cellXml('', 'Value')]),
    rowXml([cellXml('GHI CHÚ', 'Section'), cellXml('', 'Section')]),
    rowXml([cellXml('Phần “Còn dở” là tồn đọng hiện tại, không gắn ngày đang xem.', 'Note'), cellXml('', 'Note')]),
    rowXml([cellXml('Các sheet còn lại liệt kê việc đã hoàn tất trong ngày chọn.', 'Note'), cellXml('', 'Note')]),
  ]

  return `
  <Worksheet ss:Name="Tong quan">
    <Table>
      ${columnXml([38, 28])}
      ${rows.join('\n')}
    </Table>
  </Worksheet>`
}

function buildDataSheet({
  name,
  title,
  dateLabel,
  headers,
  rows,
  widths,
  numberCols = [],
  amber = false,
  extraMeta = [],
}) {
  const colCount = headers.length
  const titleStyle = amber ? 'SectionAmber' : 'Section'
  const headerStyle = amber ? 'HeaderAmber' : 'Header'
  const xmlRows = [
    rowXml(
      padRow([title], colCount).map((v) => cellXml(v, titleStyle)),
      26,
    ),
    rowXml(
      padRow(['Ngày xem', dateLabel], colCount).map((v, i) => cellXml(v, i === 0 ? 'Label' : 'Value')),
    ),
    ...extraMeta.map((meta) => rowXml(
      padRow(meta, colCount).map((v, i) => cellXml(v, amber ? 'Note' : (i === 0 ? 'Label' : 'Value'))),
    )),
    rowXml(padRow([], colCount).map(() => cellXml('', 'Value'))),
    rowXml(headers.map((h) => cellXml(h, headerStyle))),
  ]

  const data = rows.length
    ? rows
    : [padRow(['(Không có dữ liệu)'], colCount)]

  data.forEach((row, idx) => {
    const style = idx % 2 === 1 ? 'Zebra' : 'Cell'
    const numStyle = idx % 2 === 1 ? 'NumZebra' : 'NumCell'
    const padded = padRow(row, colCount)
    xmlRows.push(rowXml(
      padded.map((value, colIdx) => {
        const isNum = numberCols.includes(colIdx) && typeof value === 'number'
        return cellXml(value, isNum ? numStyle : style, isNum ? 'Number' : 'String')
      }),
    ))
  })

  return `
  <Worksheet ss:Name="${escapeXml(name)}">
    <Table>
      ${columnXml(widths)}
      ${xmlRows.join('\n')}
    </Table>
  </Worksheet>`
}

function downloadXmlExcel(filename, xml) {
  const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

/**
 * Xuất báo cáo cuối ngày kho ra Excel có màu (SpreadsheetML).
 * Không phụ thuộc package ngoài — chạy được trong Docker.
 */
export function exportWarehouseDailyReportExcel({
  report,
  date,
  dateLabel,
  doneTotal,
  openRows,
}) {
  const snap = report.endingSnapshot
  const generated = formatVietnamDateTimeMinute(report.generatedAtUtc)
  const openCount = report.summary.openCarryCount

  const sheets = [
    buildOverviewSheet({ dateLabel, date, generated, doneTotal, snap, openCount }),
    buildDataSheet({
      name: 'Nhap NCC',
      title: 'NHẬP NCC ĐÃ HOÀN TẤT',
      dateLabel,
      headers: ['Mã phiếu', 'Người xử lý', 'Giá trị (đ)', 'Hoàn tất', 'Số dòng'],
      rows: report.supplierReceipts.map((r) => [
        r.code,
        r.actorName || '',
        Math.round(Number(r.totalAmount) || 0),
        formatVietnamDateTimeMinute(r.completedAtUtc),
        r.lineCount ?? '',
      ]),
      widths: [18, 18, 14, 20, 10],
      numberCols: [2, 4],
    }),
    buildDataSheet({
      name: 'San xuat',
      title: 'SẢN XUẤT ĐÃ HOÀN TẤT',
      dateLabel,
      headers: ['Mã SX', 'Người lập', 'Số dòng NL', 'Số dòng TP', 'Hoàn tất'],
      rows: report.productionOrders.map((r) => [
        r.code,
        r.actorName || '',
        r.materialLineCount,
        r.outputLineCount,
        formatVietnamDateTimeMinute(r.completedAtUtc),
      ]),
      widths: [18, 18, 12, 12, 20],
      numberCols: [2, 3],
    }),
    buildDataSheet({
      name: 'Chuyen ke',
      title: 'CHUYỂN KỆ ĐÃ HOÀN TẤT',
      dateLabel,
      headers: ['Mã phiếu', 'YC / Người', 'Số lượng', 'Hoàn tất'],
      rows: report.stockTransfers.map((r) => [
        r.code,
        r.sourceRequestCode || r.actorName || '',
        r.totalQuantity,
        formatVietnamDateTimeMinute(r.completedAtUtc),
      ]),
      widths: [18, 22, 12, 20],
      numberCols: [2],
    }),
    buildDataSheet({
      name: 'Duyet YC ke',
      title: 'DUYỆT YÊU CẦU BỔ SUNG KỆ',
      dateLabel,
      headers: ['Mã YC', 'Người xử lý', 'Trạng thái', 'Thời điểm'],
      rows: report.stockAdjustmentReviews.map((r) => [
        r.code,
        r.reviewedByName || '',
        statusVi(r.status),
        formatVietnamDateTimeMinute(r.reviewedAtUtc),
      ]),
      widths: [18, 18, 14, 20],
    }),
    buildDataSheet({
      name: 'Tru kho',
      title: 'TRỪ KHO ĐÃ XÁC NHẬN',
      dateLabel,
      headers: ['Mã đơn', 'Người xác nhận', 'Thời điểm'],
      rows: report.stockDeductConfirmations.map((r) => [
        r.orderCode,
        r.confirmedByName || '',
        formatVietnamDateTimeMinute(r.confirmedAtUtc),
      ]),
      widths: [18, 18, 20],
    }),
    buildDataSheet({
      name: 'Kiem ke',
      title: 'KIỂM KÊ KHO ĐÃ DUYỆT',
      dateLabel,
      headers: ['Mã KK', 'Người duyệt', 'Số dòng', 'Duyệt lúc'],
      rows: report.warehouseStocktakes.map((r) => [
        r.code,
        r.reviewedByName || '',
        r.itemCount,
        formatVietnamDateTimeMinute(r.reviewedAtUtc),
      ]),
      widths: [18, 18, 10, 20],
      numberCols: [2],
    }),
    buildDataSheet({
      name: 'Bien dong',
      title: 'BIẾN ĐỘNG KHO THEO LOẠI (TRONG NGÀY)',
      dateLabel,
      headers: ['Loại biến động', 'Số lần', 'Δ số lượng'],
      rows: report.ledgerByType.map((r) => [
        ledgerTypeVi(r.transactionType),
        r.entryCount,
        r.netQuantityDelta,
      ]),
      widths: [32, 10, 14],
      numberCols: [1, 2],
    }),
    buildDataSheet({
      name: 'Con do',
      title: 'VIỆC CÒN DỞ HIỆN TẠI',
      dateLabel: 'Tồn đọng hiện tại',
      headers: ['Loại việc', 'Mã phiếu / đơn', 'Trạng thái'],
      rows: openRows.map((r) => [r.kind, r.code, statusVi(r.status)]),
      widths: [22, 22, 16],
      amber: true,
      extraMeta: [
        ['Lưu ý', 'Không gắn ngày đang xem'],
        ['Thời điểm xuất', generated],
      ],
    }),
  ]

  const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
  <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
    <Title>Báo cáo cuối ngày kho</Title>
    <Author>HVTPOSIMS</Author>
  </DocumentProperties>
  ${buildStylesXml()}
  ${sheets.join('\n')}
</Workbook>`

  downloadXmlExcel(`Bao_cao_cuoi_ngay_kho_${date}.xls`, xml)
}
