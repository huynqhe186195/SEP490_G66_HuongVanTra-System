import { formatVietnamDateTime } from '../../../utils/vietnamDateTime.js'
import { paymentMethodLabel, paymentPurposeLabel } from './cashReportLabels.js'
import { getOrderStatusLabel } from '../../orders/utils/orderDisplay.js'

const MONEY_FORMAT = '#,##0'

// Bảng màu lấy từ giao diện web để file Excel nhìn ra ngay là tài liệu của hệ thống.
const BRAND = 'FF356647'
const BAND = 'FFE7EDE8'
const BORDER = 'FFC1C9C0'
const WARN_BG = 'FFFDF1D6'
const WARN_FG = 'FF7E5700'
const TOTAL_BG = 'FFF1EFE7'
const ZEBRA = 'FFFBF9F1'
const MUTED = 'FF717971'
const INK = 'FF1B1C17'

const THIN_BORDER = {
  top: { style: 'thin', color: { argb: BORDER } },
  left: { style: 'thin', color: { argb: BORDER } },
  bottom: { style: 'thin', color: { argb: BORDER } },
  right: { style: 'thin', color: { argb: BORDER } },
}

function timeOnly(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function dateTime(iso) {
  if (!iso) return '—'
  return formatVietnamDateTime(iso)
}

// Mỗi dòng của sheet được mô tả bằng "loại dòng" thay vì tự gắn style tại chỗ, để sáu
// sheet dùng chung một bộ định dạng và không bị lệch nhau khi sửa về sau.
const title = (text) => ({ kind: 'title', cells: [text] })
const subtitle = (text) => ({ kind: 'subtitle', cells: [text] })
const meta = (label, value) => ({ kind: 'meta', cells: [label, value] })
const warn = (text) => ({ kind: 'warn', cells: [text] })
const section = (text) => ({ kind: 'section', cells: [text] })
const head = (cells, options = {}) => ({ kind: 'head', cells, ...options })
const row = (cells) => ({ kind: 'row', cells })
const total = (cells) => ({ kind: 'total', cells })
const note = (text) => ({ kind: 'note', cells: [text] })
const blank = () => ({ kind: 'blank', cells: [] })

const HEADER_KINDS = new Set(['title', 'subtitle', 'meta', 'warn', 'blank'])

function metaBlock({ periodLabel, creatorName, agencyName, employeeName, truncationNotes }) {
  const rows = [
    title('BÁO CÁO CUỐI NGÀY'),
    subtitle('Hệ thống Quản lý Hương Vân Trà'),
    meta('Kỳ báo cáo', periodLabel),
    meta('Thời gian tạo', dateTime(new Date().toISOString())),
    meta('Chi nhánh', agencyName),
    meta('Nhân viên', employeeName),
    meta('Người tạo', creatorName),
  ]
  // Nếu file chưa chứa đủ dòng chi tiết thì ghi ngay dưới phần đầu của MỌI sheet, để
  // người đọc không tưởng nhầm là đã đầy đủ.
  if ((truncationNotes || []).length > 0) {
    rows.push(warn('LƯU Ý: FILE NÀY CHƯA CHỨA ĐỦ DÒNG CHI TIẾT'))
    truncationNotes.forEach((n) => rows.push(warn(n)))
  }
  rows.push(blank())
  return rows
}

/** Ghi chú giới hạn dữ liệu do backend trả về, để người đọc file biết số nào chưa đầy đủ. */
function pushDataGaps(rows, gaps) {
  if (!gaps || gaps.length === 0) return
  rows.push(blank(), warn('GIỚI HẠN DỮ LIỆU'))
  gaps.forEach((g) => rows.push(warn(g)))
}

/**
 * Dựng một sheet đã định dạng từ danh sách dòng.
 *
 * Ô tiền giữ nguyên kiểu số và chỉ gắn định dạng hiển thị, để người dùng còn cộng trừ
 * được trong Excel thay vì nhận chuỗi có chữ "đ".
 */
function renderSheet(wb, name, { columns, rows, moneyColumns = [] }) {
  const ws = wb.addWorksheet(name, {
    pageSetup: {
      paperSize: 9,
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
    },
  })
  ws.columns = columns.map((width) => ({ width }))

  const span = columns.length
  const money = new Set(moneyColumns)
  // Chiều rộng bảng hiện hành: dòng dữ liệu chỉ kẻ viền trong phạm vi bảng của nó, nếu
  // kẻ hết span thì các khối 2 cột sẽ bị kéo lưới ra tận cột cuối sheet.
  let tableWidth = 0
  let zebra = false
  let filterFrom = null
  let filterTo = null
  let autoFilter = null
  // Khối tiêu đề đầu sheet được ghim lại để cuộn xuống vẫn thấy kỳ báo cáo và người tạo.
  let freezeAt = 0
  let leadingHeader = true

  const merge = (excelRow) => {
    if (span > 1) ws.mergeCells(excelRow.number, 1, excelRow.number, span)
  }

  rows.forEach((r) => {
    if (leadingHeader && HEADER_KINDS.has(r.kind)) freezeAt = ws.rowCount + 1
    else leadingHeader = false

    const excelRow = ws.addRow(r.cells)

    // Đóng vùng lọc khi ra khỏi khối bảng đang mở.
    if (filterFrom !== null && r.kind !== 'row' && r.kind !== 'head') {
      autoFilter = { from: { row: filterFrom, column: 1 }, to: { row: filterTo, column: tableWidth || span } }
      filterFrom = null
    }

    switch (r.kind) {
      case 'title':
        merge(excelRow)
        excelRow.height = 26
        excelRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND } }
        excelRow.getCell(1).font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } }
        excelRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' }
        tableWidth = 0
        break

      case 'subtitle':
        merge(excelRow)
        excelRow.getCell(1).font = { italic: true, size: 10, color: { argb: MUTED } }
        excelRow.getCell(1).alignment = { horizontal: 'center' }
        tableWidth = 0
        break

      case 'meta':
        excelRow.getCell(1).font = { bold: true, size: 10, color: { argb: MUTED } }
        excelRow.getCell(2).font = { size: 10, color: { argb: INK } }
        excelRow.getCell(2).alignment = { horizontal: 'left' }
        tableWidth = 0
        break

      case 'warn':
        merge(excelRow)
        excelRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: WARN_BG } }
        excelRow.getCell(1).font = { bold: true, size: 10, color: { argb: WARN_FG } }
        excelRow.getCell(1).alignment = { vertical: 'middle', wrapText: true }
        tableWidth = 0
        break

      case 'section':
        merge(excelRow)
        excelRow.height = 20
        excelRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BAND } }
        excelRow.getCell(1).font = { bold: true, size: 11, color: { argb: BRAND } }
        excelRow.getCell(1).alignment = { vertical: 'middle' }
        excelRow.getCell(1).border = { bottom: { style: 'medium', color: { argb: BRAND } } }
        tableWidth = 0
        break

      case 'head':
        tableWidth = r.cells.length
        zebra = false
        excelRow.height = 24
        for (let c = 1; c <= tableWidth; c += 1) {
          const cell = excelRow.getCell(c)
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND } }
          cell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } }
          cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
          cell.border = THIN_BORDER
        }
        if (r.filter) {
          filterFrom = excelRow.number
          filterTo = excelRow.number
        }
        break

      case 'row': {
        const width = Math.max(tableWidth, r.cells.length)
        for (let c = 1; c <= width; c += 1) {
          const cell = excelRow.getCell(c)
          cell.border = THIN_BORDER
          cell.font = { size: 10, color: { argb: INK } }
          if (zebra) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ZEBRA } }
          if (money.has(c - 1) && typeof cell.value === 'number') cell.numFmt = MONEY_FORMAT
        }
        zebra = !zebra
        if (filterFrom !== null) filterTo = excelRow.number
        break
      }

      case 'total': {
        const width = Math.max(tableWidth, r.cells.length)
        for (let c = 1; c <= width; c += 1) {
          const cell = excelRow.getCell(c)
          cell.border = { ...THIN_BORDER, top: { style: 'medium', color: { argb: BRAND } } }
          cell.font = { bold: true, size: 10, color: { argb: INK } }
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TOTAL_BG } }
          if (money.has(c - 1) && typeof cell.value === 'number') cell.numFmt = MONEY_FORMAT
        }
        zebra = false
        break
      }

      case 'note':
        merge(excelRow)
        excelRow.getCell(1).font = { italic: true, size: 9, color: { argb: MUTED } }
        excelRow.getCell(1).alignment = { wrapText: true, vertical: 'top' }
        tableWidth = 0
        break

      default:
        tableWidth = 0
        zebra = false
        break
    }
  })

  if (filterFrom !== null) {
    autoFilter = { from: { row: filterFrom, column: 1 }, to: { row: filterTo, column: tableWidth || span } }
  }
  if (autoFilter && autoFilter.to.row > autoFilter.from.row) ws.autoFilter = autoFilter
  if (freezeAt > 0) ws.views = [{ state: 'frozen', ySplit: freezeAt }]

  return ws
}

function overviewRows(report, m) {
  const b = report.bridge || {}

  const rows = [
    ...metaBlock(m),
    section('BA CHỈ SỐ CỐT LÕI'),
    head(['Chỉ tiêu', 'Giá trị', 'Ý nghĩa']),
    row([
      'Doanh thu ghi nhận',
      report.netRecognizedRevenue || 0,
      'Giá trị hàng đã bán trong kỳ, không phụ thuộc lúc nào thu tiền',
    ]),
    row(['Tổng tiền thu vào', report.totalCashIn || 0, 'Toàn bộ tiền thực nhận, gồm cả tiền mặt và chuyển khoản']),
    row([
      'Tiền mặt tại két',
      report.cashOnHand || 0,
      'Chỉ phần tiền mặt vật lý; VietQR và chuyển khoản không tính vào đây',
    ]),
    note('Ba chỉ số trên không thay thế cho nhau và thường không bằng nhau.'),

    blank(),
    section('CHỈ SỐ BÁN HÀNG'),
    head(['Chỉ tiêu', 'Giá trị']),
    row(['Doanh thu đơn hoàn tất', report.salesRevenue || 0]),
    row(['Giảm giá', report.salesDiscount || 0]),
    row(['Trừ hàng trả', report.returnedRevenue || 0]),
    total(['Doanh thu ghi nhận thuần', report.netRecognizedRevenue || 0]),
    row(['Đơn hoàn tất', report.completedOrders || 0]),
    row(['Tổng dòng hàng', report.totalLineCount || 0]),
    row(['Số sản phẩm phát sinh', report.distinctSkuCount || 0]),

    blank(),
    section('DÒNG TIỀN'),
    head(['Chỉ tiêu', 'Giá trị']),
    row(['Tổng thu vào', report.totalCashIn || 0]),
    row(['Tổng chi ra', report.totalCashOut || 0]),
    total(['Chênh lệch ròng', report.netCashFlow || 0]),
    row(['Cọc bị giữ do hủy đơn', report.forfeitedDepositIncome || 0]),

    blank(),
    section('CẦU NỐI DOANH THU VÀ DÒNG TIỀN'),
    head(['Chỉ tiêu', 'Giá trị']),
    row(['Doanh thu ghi nhận', b.recognizedRevenue || 0]),
    row(['(-) Doanh thu chưa thu tiền', b.unpaidRevenue || 0]),
    row(['(+) Tiền thu của đơn kỳ trước', b.priorPeriodCollections || 0]),
    row(['(+) Tiền thu trước của đơn chưa hoàn tất', b.advanceOnOpenOrders || 0]),
    row(['(+) Cọc bị giữ do hủy đơn', b.forfeitedDeposit || 0]),
    row(['(-) Hoàn tiền trả hàng', b.refunds || 0]),
    total(['= Tổng tiền thu vào', b.totalCashIn || 0]),
  ]

  pushDataGaps(rows, report.dataGaps)
  return rows
}

/**
 * Sheet đơn hàng: phần đầu là các bảng tổng hợp bán hàng do backend tính, phần sau là
 * danh sách từng đơn.
 */
function ordersRows(report, m) {
  const rows = [...metaBlock(m), section('THEO NHÂN VIÊN BÁN HÀNG'), head(['Nhân viên', 'Số đơn', 'Giảm giá', 'Doanh thu'])]
  ;(report.byEmployee || []).forEach((e) =>
    rows.push(row([e.employeeName || '—', e.orderCount || 0, e.discount || 0, e.revenue || 0])),
  )

  rows.push(blank(), section('THEO KÊNH BÁN'), head(['Kênh', 'Số đơn', 'Doanh thu']))
  ;(report.byChannel || []).forEach((c) => rows.push(row([c.label || c.channel, c.orderCount || 0, c.revenue || 0])))

  rows.push(
    blank(),
    section('THEO PHƯƠNG THỨC BÁN HÀNG'),
    head(['Phương thức', 'Số đơn', 'Số dòng hàng', 'Doanh thu']),
  )
  ;(report.bySalesMode || []).forEach((s) =>
    rows.push(row([s.label || s.salesMode, s.orderCount || 0, s.quantity || 0, s.revenue || 0])),
  )

  rows.push(blank(), section('DOANH THU THEO GIỜ'), head(['Khung giờ', 'Số đơn', 'Doanh thu']))
  ;(report.hourlyRevenue || []).forEach((h) =>
    rows.push(row([h.label || `${String(h.hour).padStart(2, '0')}:00`, h.orderCount || 0, h.revenue || 0])),
  )

  rows.push(
    blank(),
    section('CHI TIẾT TỪNG ĐƠN'),
    head(
      [
        'Mã đơn',
        'Thời gian',
        'Khách hàng',
        'Nhân viên',
        'Kênh',
        'Phương thức bán',
        'Trạng thái',
        'Dòng hàng',
        'Tạm tính',
        'Giảm giá',
        'Thành tiền',
        'Đã thu',
        'Còn thiếu',
        'PT thanh toán',
      ],
      { filter: true },
    ),
  )
  ;(report.orders || []).forEach((o) =>
    rows.push(
      row([
        o.orderCode,
        dateTime(o.createdAt),
        o.customerName || 'Khách lẻ',
        o.employeeName || '—',
        o.channelLabel || o.orderChannel,
        o.salesModeLabel || '—',
        getOrderStatusLabel(o.orderStatus),
        o.lineCount || 0,
        o.totalAmount || 0,
        o.discountAmount || 0,
        o.finalAmount || 0,
        o.paidAmount || 0,
        Math.max(0, (o.finalAmount || 0) - (o.paidAmount || 0)),
        o.paymentMethods || '—',
      ]),
    ),
  )

  return rows
}

function paymentsRows(report, m) {
  const rows = [...metaBlock(m), section('TIỀN THU VÀO'), head(['Loại thu', 'Số lượt', 'Số tiền'])]
  ;(report.cashIn || []).forEach((l) => rows.push(row([l.label, l.count || 0, l.amount || 0])))
  rows.push(total(['Tổng thu vào', null, report.totalCashIn || 0]))

  rows.push(blank(), section('TIỀN CHI RA (HOÀN TRẢ HÀNG)'), head(['Phương thức hoàn', 'Số lượt', 'Số tiền']))
  ;(report.cashOut || []).forEach((l) => rows.push(row([l.label, l.count || 0, l.amount || 0])))
  rows.push(total(['Tổng chi ra', null, report.totalCashOut || 0]))

  rows.push(
    blank(),
    section('TỔNG HỢP DÒNG TIỀN THEO PHƯƠNG THỨC THANH TOÁN'),
    head(['Phương thức', 'Loại', 'Thu vào', 'Chi ra', 'Còn lại']),
  )
  ;(report.byPaymentMethod || []).forEach((l) =>
    rows.push(row([l.label, l.isCash ? 'Tiền két' : 'Tài khoản', l.amountIn || 0, l.amountOut || 0, l.net || 0])),
  )
  rows.push(total(['Tiền mặt tại két', 'Tiền két', null, null, report.cashOnHand || 0]))

  rows.push(
    blank(),
    section('CHI TIẾT CÁC KHOẢN THU'),
    head(
      [
        'Mã đơn',
        'Ngày tạo đơn',
        'Thời gian thu',
        'Phương thức',
        'Mục đích',
        'Nhân viên',
        'Khách hàng',
        'Trạng thái đơn',
        'Số tiền',
      ],
      { filter: true },
    ),
  )
  ;(report.receipts || []).forEach((r) =>
    rows.push(
      row([
        r.orderCode,
        dateTime(r.orderCreatedAt),
        timeOnly(r.paidAt),
        paymentMethodLabel(r.paymentMethod),
        paymentPurposeLabel(r.paymentPurpose),
        r.employeeName || '—',
        r.customerName || 'Khách lẻ',
        getOrderStatusLabel(r.orderStatus),
        r.amount || 0,
      ]),
    ),
  )

  return rows
}

/**
 * Sheet hàng hóa. Cột "Đơn vị" là bắt buộc và dòng tổng tách riêng theo từng đơn vị:
 * hàng tính theo gram và hàng tính theo cái không bao giờ cộng chung vào một ô số lượng.
 */
function productsRows(report, m) {
  const totals = report.productTotals || []

  const rows = [
    ...metaBlock(m),
    section('HÀNG HÓA ĐÃ BÁN'),
    head(
      [
        'Mã SKU',
        'Tên hàng',
        'Nhóm hàng',
        'Đơn vị',
        'SL bán',
        'SL trả',
        'Số đơn',
        'Giảm giá phân bổ',
        'Doanh thu thuần',
      ],
      { filter: true },
    ),
  ]
  ;(report.products || []).forEach((p) =>
    rows.push(
      row([
        p.skuCode,
        p.skuName,
        p.categoryName || '—',
        p.unitLabel || 'Không xác định',
        p.quantity || 0,
        p.returnedQuantity || 0,
        p.orderCount || 0,
        p.allocatedDiscount || 0,
        p.netRevenue || 0,
      ]),
    ),
  )

  rows.push(
    blank(),
    section('TỔNG THEO ĐƠN VỊ TÍNH'),
    head(['Đơn vị', 'SL bán', 'SL trả', 'Số dòng hàng', 'Doanh thu thuần']),
  )
  totals.forEach((t) =>
    rows.push(
      row([
        t.unitLabel || 'Không xác định',
        t.quantity || 0,
        t.returnedQuantity || 0,
        t.lineCount || 0,
        t.netRevenue || 0,
      ]),
    ),
  )

  rows.push(
    blank(),
    section('TỔNG KẾT'),
    head(['Chỉ tiêu', 'Giá trị']),
    row(['Tổng dòng hàng', report.totalLineCount || 0]),
    row(['Số sản phẩm phát sinh', report.distinctSkuCount || 0]),
    total(['Tổng doanh thu hàng hóa', totals.reduce((s, t) => s + (t.netRevenue || 0), 0)]),
    note('Ghi chú: số lượng cộng riêng theo từng đơn vị tính, không có ô tổng số lượng chung.'),
  )

  return rows
}

/**
 * Sheet Kho/Kệ lấy từ InventoryService. Nếu người dùng không có quyền xem tồn kho hoặc
 * lời gọi thất bại thì vẫn tạo sheet nhưng ghi rõ lý do, tránh để người đọc hiểu nhầm
 * là kho không phát sinh nghiệp vụ nào.
 */
function inventoryRows(inventory, m) {
  const rows = [...metaBlock(m), section('KHO VÀ KỆ HÀNG')]

  if (!inventory) {
    rows.push(
      warn('Không có số liệu Kho/Kệ trong file này.'),
      note('Lý do: không tải được dữ liệu từ InventoryService (thường do thiếu quyền xem tồn kho).'),
      note('Ô trống ở đây không có nghĩa là kho không phát sinh nghiệp vụ nào.'),
    )
    return rows
  }

  rows.push(
    head(['Tổng hợp nghiệp vụ', 'Số lượng']),
    row(['Phiếu điều chuyển hoàn tất (Kho → Kệ)', inventory.transfersCompleted || 0]),
    row(['Lệnh sản xuất hoàn tất', inventory.productionOrdersCompleted || 0]),
    row(['Phiếu nhập nhà cung cấp hoàn tất', inventory.supplierReceiptsCompleted || 0]),
    row(['Phiếu kiểm kê hoàn tất', inventory.stocktakesCompleted || 0]),
  )

  rows.push(
    blank(),
    section('BIẾN ĐỘNG THEO VỊ TRÍ'),
    head(['Vị trí', 'Bút toán', 'Đơn vị', 'Nhập', 'Xuất', 'Ròng']),
  )
  ;(inventory.ledgerTotalsByLocation || []).forEach((r) => {
    const units = r.byUnit || []
    if (units.length === 0) {
      rows.push(row([r.locationLabel || r.location, r.entryCount || 0, '—', 0, 0, 0]))
      return
    }
    units.forEach((u, i) =>
      rows.push(
        row([
          i === 0 ? r.locationLabel || r.location : '',
          i === 0 ? r.entryCount || 0 : '',
          u.unitLabel || u.unit,
          u.quantityIn || 0,
          u.quantityOut || 0,
          u.netQuantity || 0,
        ]),
      ),
    )
  })

  rows.push(
    blank(),
    section('BIẾN ĐỘNG THEO LOẠI NGHIỆP VỤ'),
    head(['Vị trí', 'Nghiệp vụ', 'Bút toán', 'Đơn vị', 'Nhập', 'Xuất']),
  )
  ;(inventory.ledgerByLocationAndType || []).forEach((r) => {
    const units = r.byUnit || []
    if (units.length === 0) {
      rows.push(row([r.locationLabel || r.location, r.transactionType, r.entryCount || 0, '—', 0, 0]))
      return
    }
    units.forEach((u, i) =>
      rows.push(
        row([
          i === 0 ? r.locationLabel || r.location : '',
          i === 0 ? r.transactionType : '',
          i === 0 ? r.entryCount || 0 : '',
          u.unitLabel || u.unit,
          u.quantityIn || 0,
          u.quantityOut || 0,
        ]),
      ),
    )
  })

  if ((inventory.transferQuantityByUnit || []).length > 0) {
    rows.push(
      blank(),
      section('SẢN LƯỢNG ĐIỀU CHUYỂN KHO → KỆ'),
      head(['Đơn vị', 'Số lượng', 'Số dòng hàng']),
    )
    inventory.transferQuantityByUnit.forEach((u) =>
      rows.push(row([u.unitLabel || u.unit, u.quantity || 0, u.lineCount || 0])),
    )
  }

  const stock = inventory.endingStock || {}
  rows.push(
    blank(),
    section('TỒN CUỐI KỲ'),
    head(['Chỉ tiêu', 'Giá trị']),
    row(['SKU đang theo dõi', stock.skuCount || 0]),
    row(['Tồn Kệ hàng', stock.shelfQuantityTotal || 0]),
    row(['Đã giữ chỗ tại Kệ', stock.shelfReservedTotal || 0]),
    total(['Còn bán được tại Kệ', stock.shelfAvailableTotal || 0]),
    row(['Tồn Kho', stock.warehouseQuantityTotal || 0]),
    row(['SKU dưới định mức tại Kệ', stock.shelfLowStockSkuCount || 0]),
    row(['SKU dưới định mức tại Kho', stock.warehouseLowStockSkuCount || 0]),
  )

  const queues = inventory.queues || {}
  rows.push(
    blank(),
    section('HÀNG ĐỢI TRỪ KHO'),
    head(['Trạng thái', 'Số lượng']),
    row(['Tạo trong kỳ', queues.createdInPeriod || 0]),
    row(['Đang chờ', queues.waiting || 0]),
    row(['Thiếu hàng', queues.insufficient || 0]),
    row(['Đã xác nhận', queues.confirmed || 0]),
    row(['Đã hủy', queues.cancelled || 0]),
  )

  pushDataGaps(rows, inventory.dataGaps)
  return rows
}

/**
 * Sheet ngoại lệ đọc thẳng payload `exceptions` của backend. Không tự lọc lại từ danh sách
 * đơn/khoản thu đang hiển thị, vì các danh sách đó đã phân trang phía server nên lọc ở
 * frontend sẽ báo thiếu ngoại lệ.
 */
function exceptionsRows(exceptions, m) {
  const e = exceptions || {}

  const rows = [
    ...metaBlock(m),
    section('TỔNG HỢP NGOẠI LỆ (TOÀN KỲ)'),
    head(['Chỉ tiêu', 'Giá trị']),
    row(['Đơn chưa thu đủ tiền', e.underpaidCount || 0]),
    row(['Tổng tiền còn thiếu', e.underpaidAmount || 0]),
    row(['Khoản thu trên đơn đã hủy', e.receiptsOnCancelledCount || 0]),
    row(['Tổng tiền thu trên đơn đã hủy', e.receiptsOnCancelledAmount || 0]),
    row(['Khoản thu thuộc đơn kỳ trước', e.priorPeriodReceiptCount || 0]),
    row(['Tổng tiền thu của đơn kỳ trước', e.priorPeriodReceiptAmount || 0]),
    row(['Đơn đã hủy', e.cancelledOrders || 0]),
    row(['Đơn có hoàn tiền', e.refundedOrders || 0]),
    row(['Đơn hủy sau khi đã đặt cọc', e.forfeitedDepositOrders || 0]),
    row(['Cọc bị giữ', e.forfeitedDepositIncome || 0]),

    blank(),
    section('ĐƠN CHƯA THU ĐỦ TIỀN'),
    head(
      [
        'Mã đơn',
        'Thời gian',
        'Khách hàng',
        'Nhân viên',
        'Trạng thái',
        'Đã thu bằng',
        'Thành tiền',
        'Đã thu',
        'Còn thiếu',
      ],
      { filter: true },
    ),
  ]
  ;(e.underpaid || []).forEach((o) =>
    rows.push(
      row([
        o.orderCode,
        dateTime(o.createdAt),
        o.customerName || 'Khách lẻ',
        o.employeeName || '—',
        getOrderStatusLabel(o.orderStatus),
        o.paymentMethods || 'Chưa thu lần nào',
        o.finalAmount || 0,
        o.paidAmount || 0,
        (o.finalAmount || 0) - (o.paidAmount || 0),
      ]),
    ),
  )

  rows.push(
    blank(),
    section('KHOẢN THU TRÊN ĐƠN ĐÃ HỦY'),
    head(['Mã đơn', 'Thời gian thu', 'Phương thức', 'Mục đích', 'Số tiền']),
  )
  ;(e.receiptsOnCancelled || []).forEach((r) =>
    rows.push(
      row([
        r.orderCode,
        timeOnly(r.paidAt),
        paymentMethodLabel(r.paymentMethod),
        paymentPurposeLabel(r.paymentPurpose),
        r.amount || 0,
      ]),
    ),
  )

  rows.push(
    blank(),
    section('KHOẢN THU THUỘC ĐƠN CỦA KỲ TRƯỚC'),
    head(['Mã đơn', 'Ngày tạo đơn', 'Thời gian thu', 'Phương thức', 'Mục đích', 'Số tiền']),
  )
  ;(e.priorPeriodReceipts || []).forEach((r) =>
    rows.push(
      row([
        r.orderCode,
        dateTime(r.orderCreatedAt),
        timeOnly(r.paidAt),
        paymentMethodLabel(r.paymentMethod),
        paymentPurposeLabel(r.paymentPurpose),
        r.amount || 0,
      ]),
    ),
  )

  rows.push(
    blank(),
    note('Ghi chú: các dòng chi tiết bên trên chỉ là trang đầu của danh sách ngoại lệ.'),
    note('Khối "Tổng hợp ngoại lệ" luôn tính trên toàn kỳ nên là con số dùng để chốt sổ.'),
  )
  pushDataGaps(rows, e.dataGaps)

  return rows
}

async function downloadWorkbook(wb, filename) {
  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${filename}.xlsx`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

/**
 * Xuất báo cáo cuối ngày ra 6 sheet Excel đã định dạng.
 * `inventory` là summary của InventoryService; có thể bỏ trống khi người dùng không có
 * quyền xem tồn kho — khi đó sheet Kho/Kệ vẫn tồn tại nhưng ghi rõ là thiếu dữ liệu.
 */
export async function exportEndOfDayExcel({ report, exceptions, inventory, meta: m, filename }) {
  // Nạp exceljs lúc bấm xuất chứ không lúc load trang: gói này chưa có trong volume
  // node_modules của container dev, nếu import tĩnh thì cả màn hình báo cáo không mở được.
  // Tên gói ghép từ biến để Vite không phân tích tĩnh và không chặn lúc build/dev.
  const pkg = ['exce', 'ljs'].join('')
  let ExcelJS
  try {
    ExcelJS = (await import(/* @vite-ignore */ pkg)).default
  } catch {
    throw new Error(
      'Chưa cài thư viện xuất Excel (exceljs) trong môi trường này. ' +
        'Bản in A4/K80 và PDF vẫn dùng được bình thường.',
    )
  }

  const wb = new ExcelJS.Workbook()
  wb.creator = 'Hương Vân Trà POS'
  wb.created = new Date()

  renderSheet(wb, '01_TongQuan', {
    columns: [40, 18, 60],
    rows: overviewRows(report, m),
    moneyColumns: [1],
  })

  renderSheet(wb, '02_DonHang', {
    columns: [22, 22, 24, 22, 14, 16, 16, 12, 16, 14, 16, 16, 14, 24],
    rows: ordersRows(report, m),
    // Cột tiền khác nhau giữa khối tổng hợp và khối chi tiết, gắn định dạng cho mọi cột
    // có thể chứa tiền.
    moneyColumns: [1, 2, 3, 8, 9, 10, 11, 12],
  })

  renderSheet(wb, '03_ThanhToan', {
    columns: [22, 22, 14, 18, 26, 22, 24, 16, 16],
    rows: paymentsRows(report, m),
    moneyColumns: [2, 3, 4, 8],
  })

  renderSheet(wb, '04_HangHoa', {
    columns: [22, 42, 24, 16, 12, 12, 10, 18, 18],
    rows: productsRows(report, m),
    moneyColumns: [1, 4, 7, 8],
  })

  renderSheet(wb, '05_KhoKe', {
    columns: [40, 30, 18, 16, 16, 16],
    rows: inventoryRows(inventory, m),
    moneyColumns: [],
  })

  renderSheet(wb, '06_NgoaiLe', {
    columns: [34, 22, 24, 22, 18, 22, 16, 16, 16],
    rows: exceptionsRows(exceptions, m),
    // Vị trí cột tiền khác nhau giữa các khối trong sheet; định dạng chỉ bám ô kiểu số
    // nên liệt kê gộp là an toàn.
    moneyColumns: [1, 4, 5, 6, 7, 8],
  })

  await downloadWorkbook(wb, filename)
}
