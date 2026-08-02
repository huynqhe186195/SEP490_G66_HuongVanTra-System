import { formatVietnamDateTimeMinute } from '../../../utils/vietnamDateTime.js'

function statusVi(status) {
  const map = {
    Completed: 'ÄÃ£ xong',
    Draft: 'NhÃ¡p',
    PendingApproval: 'Chá» duyá»‡t',
    Approved: 'ÄÃ£ duyá»‡t',
    Rejected: 'Tá»« chá»‘i',
    Cancelled: 'ÄÃ£ há»§y',
    Pending: 'Chá» xá»­ lÃ½',
    Processing: 'Äang lÃ m',
    PartiallyFulfilled: 'Má»™t pháº§n',
    Waiting: 'Chá» trá»« kho',
    Insufficient: 'Thiáº¿u hÃ ng',
    Confirmed: 'ÄÃ£ xÃ¡c nháº­n',
    Open: 'ChÆ°a xá»­ lÃ½',
  }
  return map[status] || status || 'â€”'
}

function ledgerTypeVi(type) {
  const map = {
    SUPPLIER_RECEIPT: 'Nháº­p NCC',
    STOCK_TRANSFER_WAREHOUSE_OUT: 'Xuáº¥t kho â†’ ká»‡',
    STOCK_TRANSFER_SHELF_IN: 'Nháº­p ká»‡',
    SHELF_REPLENISHMENT_OUT: 'Xuáº¥t kho â†’ ká»‡',
    SHELF_REPLENISHMENT_IN: 'Nháº­p ká»‡',
    PRODUCTION_MATERIAL_EXPORT: 'Xuáº¥t NL sáº£n xuáº¥t',
    PRODUCTION_FINISHED_RECEIPT: 'Nháº­p thÃ nh pháº©m',
    STOCKTAKE_ADJUSTMENT: 'Äiá»u chá»‰nh kiá»ƒm kÃª',
    SALES_DEDUCT_LATER: 'Trá»« kho theo Ä‘Æ¡n',
    CUSTOM_BUNDLE_MATERIAL_EXPORT: 'Xuáº¥t Ä‘Ã³ng gÃ³i',
    CUSTOMER_RETURN_RECEIPT: 'Nháº­n hÃ ng tráº£',
    SUPPLIER_RETURN: 'Tráº£ NCC',
  }
  return map[type] || type || 'KhÃ¡c'
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
    <Style ss:ID="Default"><Alignment ss:Vertical="Center"/><Font ss:FontName="Times New Roman" ss:Size="12"/></Style>
    <Style ss:ID="Title">
      <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
      <Font ss:FontName="Times New Roman" ss:Size="12.5" ss:Bold="1" ss:Color="#FFFFFF"/>
      <Interior ss:Color="#356647" ss:Pattern="Solid"/>
    </Style>
    <Style ss:ID="Subtitle">
      <Font ss:FontName="Times New Roman" ss:Size="12" ss:Italic="1" ss:Color="#356647"/>
      <Interior ss:Color="#E8F1EB" ss:Pattern="Solid"/>
    </Style>
    <Style ss:ID="Section">
      <Font ss:FontName="Times New Roman" ss:Size="12.5" ss:Bold="1" ss:Color="#FFFFFF"/>
      <Interior ss:Color="#356647" ss:Pattern="Solid"/>
    </Style>
    <Style ss:ID="SectionAmber">
      <Font ss:FontName="Times New Roman" ss:Size="12.5" ss:Bold="1" ss:Color="#FFFFFF"/>
      <Interior ss:Color="#B45309" ss:Pattern="Solid"/>
    </Style>
    <Style ss:ID="Header">
      <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>
      <Font ss:FontName="Times New Roman" ss:Size="12.5" ss:Bold="1" ss:Color="#FFFFFF"/>
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
      <Font ss:FontName="Times New Roman" ss:Size="12.5" ss:Bold="1" ss:Color="#FFFFFF"/>
      <Interior ss:Color="#B45309" ss:Pattern="Solid"/>
    </Style>
    <Style ss:ID="Label">
      <Font ss:FontName="Times New Roman" ss:Size="12" ss:Bold="1" ss:Color="#334155"/>
      <Interior ss:Color="#E8F1EB" ss:Pattern="Solid"/>
    </Style>
    <Style ss:ID="Value"><Font ss:FontName="Times New Roman" ss:Size="12"/></Style>
    <Style ss:ID="Note">
      <Font ss:FontName="Times New Roman" ss:Size="12" ss:Italic="1" ss:Color="#475569"/>
      <Interior ss:Color="#FEF3C7" ss:Pattern="Solid"/>
    </Style>
    <Style ss:ID="Warn">
      <Font ss:FontName="Times New Roman" ss:Size="12" ss:Bold="1" ss:Color="#B45309"/>
      <Interior ss:Color="#FEF3C7" ss:Pattern="Solid"/>
    </Style>
    <Style ss:ID="Cell">
      <Font ss:FontName="Times New Roman" ss:Size="12"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
      </Borders>
    </Style>
    <Style ss:ID="Zebra">
      <Font ss:FontName="Times New Roman" ss:Size="12"/>
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

function buildOverviewSheet({ dateLabel, date, generated, doneTotal, snap, openCount, stockLabel, openLabel, notes }) {
  const rows = [
    rowXml([cellXml('BÃO CÃO CUá»I NGÃ€Y KHO', 'Title'), cellXml('', 'Title')], 28),
    rowXml([cellXml('HÆ°Æ¡ng VÃ¢n TrÃ  â€” HVTPOSIMS', 'Subtitle'), cellXml('', 'Subtitle')], 20),
    rowXml([cellXml('', 'Value'), cellXml('', 'Value')]),
    rowXml([cellXml('NgÃ y xem', 'Label'), cellXml(dateLabel, 'Value')]),
    rowXml([cellXml('NgÃ y (YYYY-MM-DD)', 'Label'), cellXml(date, 'Value')]),
    rowXml([cellXml('Thá»i Ä‘iá»ƒm táº¡o bÃ¡o cÃ¡o', 'Label'), cellXml(generated, 'Value')]),
    rowXml([cellXml('', 'Value'), cellXml('', 'Value')]),
    rowXml([cellXml('TÃ“M Táº®T', 'Section'), cellXml('', 'Section')]),
    rowXml([cellXml('Chá»‰ sá»‘', 'Header'), cellXml('GiÃ¡ trá»‹', 'Header')]),
    rowXml([cellXml('Viá»‡c Ä‘Ã£ lÃ m trong ngÃ y', 'Label'), cellXml(doneTotal, 'NumCell', 'Number')]),
    rowXml([cellXml(stockLabel, 'Label'), cellXml(snap.totalWarehouseQuantity, 'NumCell', 'Number')]),
    rowXml([cellXml('Máº·t hÃ ng sáº¯p háº¿t', 'Label'), cellXml(snap.lowStockSkuCount, 'NumCell', 'Number')]),
    rowXml([cellXml('LÃ´ sáº¯p háº¿t háº¡n (30 ngÃ y)', 'Label'), cellXml(snap.expiringBatchCount30Days, 'NumCell', 'Number')]),
    rowXml([
      cellXml(openLabel, 'Label'),
      cellXml(openCount, openCount > 0 ? 'Warn' : 'NumCell', 'Number'),
    ]),
    rowXml([cellXml('', 'Value'), cellXml('', 'Value')]),
    rowXml([cellXml('GHI CHÃš', 'Section'), cellXml('', 'Section')]),
    ...notes.map((note) => rowXml([cellXml(note, 'Note'), cellXml('', 'Note')])),
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
      padRow(['NgÃ y xem', dateLabel], colCount).map((v, i) => cellXml(v, i === 0 ? 'Label' : 'Value')),
    ),
    ...extraMeta.map((meta) => rowXml(
      padRow(meta, colCount).map((v, i) => cellXml(v, amber ? 'Note' : (i === 0 ? 'Label' : 'Value'))),
    )),
    rowXml(padRow([], colCount).map(() => cellXml('', 'Value'))),
    rowXml(headers.map((h) => cellXml(h, headerStyle))),
  ]

  const data = rows.length
    ? rows
    : [padRow(['(KhÃ´ng cÃ³ dá»¯ liá»‡u)'], colCount)]

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
 * Xuáº¥t bÃ¡o cÃ¡o cuá»‘i ngÃ y kho ra Excel cÃ³ mÃ u (SpreadsheetML).
 * KhÃ´ng phá»¥ thuá»™c package ngoÃ i â€” cháº¡y Ä‘Æ°á»£c trong Docker.
 */
export function exportWarehouseDailyReportExcel({
  report,
  date,
  dateLabel,
  doneTotal,
  openRows,
  source = 'live',
}) {
  const snap = report.endingSnapshot
  const generated = formatVietnamDateTimeMinute(report.generatedAtUtc)
  const openCount = report.summary.openCarryCount
  const isSnapshot = source === 'snapshot'
  const isPointInTime = Boolean(snap?.isPointInTime) || isSnapshot
  const stockLabel = isPointInTime ? 'Tá»“n kho cuá»‘i ngÃ y' : 'Tá»“n kho hiá»‡n táº¡i'
  const openLabel = isSnapshot
    ? 'Viá»‡c cÃ²n dá»Ÿ lÃºc gá»­i'
    : isPointInTime
      ? 'Viá»‡c cÃ²n dá»Ÿ cuá»‘i ngÃ y'
      : 'Viá»‡c cÃ²n dá»Ÿ hiá»‡n táº¡i'
  const openSheetTitle = isSnapshot
    ? 'VIá»†C CÃ’N Dá»ž LÃšC Gá»¬I'
    : isPointInTime
      ? 'VIá»†C CÃ’N Dá»ž CUá»I NGÃ€Y'
      : 'VIá»†C CÃ’N Dá»ž HIá»†N Táº I'
  const notes = isSnapshot
    ? [
      'Xuáº¥t tá»« snapshot Ä‘Ã£ gá»­i â€” sá»‘ liá»‡u cá»‘ Ä‘á»‹nh táº¡i thá»i Ä‘iá»ƒm Thá»§ kho gá»­i.',
      'CÃ¡c sheet cÃ²n láº¡i liá»‡t kÃª viá»‡c Ä‘Ã£ hoÃ n táº¥t trong ngÃ y chá»n.',
    ]
    : isPointInTime
      ? [
        'Tá»“n kho / cÃ²n dá»Ÿ Ä‘Æ°á»£c tÃ¡i dá»±ng vá» cuá»‘i ngÃ y chá»n (khÃ´ng pháº£i thá»i Ä‘iá»ƒm xuáº¥t file).',
        'CÃ¡c sheet cÃ²n láº¡i liá»‡t kÃª viá»‡c Ä‘Ã£ hoÃ n táº¥t trong ngÃ y chá»n.',
      ]
      : [
        'Tá»“n kho / cÃ²n dá»Ÿ lÃ  sá»‘ liá»‡u hiá»‡n táº¡i táº¡i thá»i Ä‘iá»ƒm xuáº¥t.',
        'CÃ¡c sheet cÃ²n láº¡i liá»‡t kÃª viá»‡c Ä‘Ã£ hoÃ n táº¥t trong ngÃ y chá»n.',
      ]

  const sheets = [
    buildOverviewSheet({
      dateLabel,
      date,
      generated,
      doneTotal,
      snap,
      openCount,
      stockLabel,
      openLabel,
      notes,
    }),
    buildDataSheet({
      name: 'Nhap NCC',
      title: 'NHáº¬P NCC ÄÃƒ HOÃ€N Táº¤T',
      dateLabel,
      headers: ['MÃ£ phiáº¿u', 'NgÆ°á»i xá»­ lÃ½', 'GiÃ¡ trá»‹ (Ä‘)', 'HoÃ n táº¥t', 'Sá»‘ dÃ²ng'],
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
      title: 'Sáº¢N XUáº¤T ÄÃƒ HOÃ€N Táº¤T',
      dateLabel,
      headers: ['MÃ£ SX', 'NgÆ°á»i láº­p', 'Sá»‘ dÃ²ng NL', 'Sá»‘ dÃ²ng TP', 'HoÃ n táº¥t'],
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
      title: 'CHUYá»‚N Ká»† ÄÃƒ HOÃ€N Táº¤T',
      dateLabel,
      headers: ['MÃ£ phiáº¿u', 'YC / NgÆ°á»i', 'Sá»‘ lÆ°á»£ng', 'HoÃ n táº¥t'],
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
      title: 'DUYá»†T YÃŠU Cáº¦U Bá»” SUNG Ká»†',
      dateLabel,
      headers: ['MÃ£ YC', 'NgÆ°á»i xá»­ lÃ½', 'Tráº¡ng thÃ¡i', 'Thá»i Ä‘iá»ƒm'],
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
      title: 'TRá»ª KHO ÄÃƒ XÃC NHáº¬N',
      dateLabel,
      headers: ['MÃ£ Ä‘Æ¡n', 'NgÆ°á»i xÃ¡c nháº­n', 'Thá»i Ä‘iá»ƒm'],
      rows: report.stockDeductConfirmations.map((r) => [
        r.orderCode,
        r.confirmedByName || '',
        formatVietnamDateTimeMinute(r.confirmedAtUtc),
      ]),
      widths: [18, 18, 20],
    }),
    buildDataSheet({
      name: 'Kiem ke',
      title: 'KIá»‚M KÃŠ KHO ÄÃƒ DUYá»†T',
      dateLabel,
      headers: ['MÃ£ KK', 'NgÆ°á»i duyá»‡t', 'Sá»‘ dÃ²ng', 'Duyá»‡t lÃºc'],
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
      title: 'BIáº¾N Äá»˜NG KHO THEO LOáº I (TRONG NGÃ€Y)',
      dateLabel,
      headers: ['Loáº¡i biáº¿n Ä‘á»™ng', 'Sá»‘ láº§n', 'Î” sá»‘ lÆ°á»£ng'],
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
      title: openSheetTitle,
      dateLabel: isPointInTime ? dateLabel : 'Tá»“n Ä‘á»ng hiá»‡n táº¡i',
      headers: ['Loáº¡i viá»‡c', 'MÃ£ phiáº¿u / Ä‘Æ¡n', 'Tráº¡ng thÃ¡i'],
      rows: openRows.map((r) => [r.kind, r.code, statusVi(r.status)]),
      widths: [22, 22, 16],
      amber: true,
      extraMeta: [
        ['LÆ°u Ã½', isSnapshot ? 'Theo snapshot lÃºc gá»­i' : isPointInTime ? 'TÃ¡i dá»±ng cuá»‘i ngÃ y chá»n' : 'KhÃ´ng gáº¯n ngÃ y Ä‘ang xem'],
        ['Thá»i Ä‘iá»ƒm xuáº¥t', generated],
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
    <Title>BÃ¡o cÃ¡o cuá»‘i ngÃ y kho</Title>
    <Author>HVTPOSIMS</Author>
  </DocumentProperties>
  ${buildStylesXml()}
  ${sheets.join('\n')}
</Workbook>`

  downloadXmlExcel(`Bao_cao_cuoi_ngay_kho_${date}.xls`, xml)
}
