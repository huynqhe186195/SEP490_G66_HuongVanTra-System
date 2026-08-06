import * as XLSX from 'xlsx'
import { formatVietnamDateTime } from '../../../utils/vietnamDateTime.js'
import { paymentMethodLabel, paymentPurposeLabel } from './cashReportLabels.js'
import { getOrderStatusLabel } from '../../orders/utils/orderDisplay.js'

const MONEY_FORMAT = '#,##0'

function timeOnly(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function dateTime(iso) {
  if (!iso) return '—'
  return formatVietnamDateTime(iso)
}

/**
 * Tạo một sheet từ mảng dòng. Ô tiền giữ nguyên kiểu số và chỉ gắn định dạng hiển thị,
 * để người dùng còn cộng trừ được trong Excel thay vì nhận chuỗi có chữ "đ".
 */
function makeSheet(rows, { cols, moneyColumns = [] }) {
  const ws = XLSX.utils.aoa_to_sheet(rows)
  if (cols) ws['!cols'] = cols

  const moneySet = new Set(moneyColumns)
  const range = XLSX.utils.decode_range(ws['!ref'])
  for (let r = range.s.r; r <= range.e.r; r += 1) {
    for (let c = range.s.c; c <= range.e.c; c += 1) {
      if (!moneySet.has(c)) continue
      const cell = ws[XLSX.utils.encode_cell({ r, c })]
      if (cell && cell.t === 'n') cell.z = MONEY_FORMAT
    }
  }
  return ws
}

function metaRows({ periodLabel, creatorName, agencyName, employeeName }) {
  return [
    ['BÁO CÁO CUỐI NGÀY'],
    ['Hệ thống Quản lý Hương Vân Trà'],
    [`Kỳ báo cáo: ${periodLabel}`],
    [`Thời gian tạo: ${dateTime(new Date().toISOString())}`, `Người tạo: ${creatorName}`],
    [`Chi nhánh: ${agencyName}`, `Nhân viên: ${employeeName}`],
    [],
  ]
}

function buildOverviewSheet(report, meta) {
  const b = report.bridge || {}
  const cashMethods = (report.byPaymentMethod || []).filter((m) => m.isCash)
  const tillCash = cashMethods.reduce((s, m) => s + (m.net || 0), 0)

  const rows = [
    ...metaRows(meta),
    ['BA CHỈ SỐ CỐT LÕI', 'Giá trị', 'Ý nghĩa'],
    [
      'Doanh thu ghi nhận',
      report.netRecognizedRevenue || 0,
      'Giá trị hàng đã bán trong kỳ, không phụ thuộc lúc nào thu tiền',
    ],
    ['Tổng tiền thu vào', report.totalCashIn || 0, 'Toàn bộ tiền thực nhận, gồm cả tiền mặt và chuyển khoản'],
    ['Tiền mặt tại két', tillCash, 'Chỉ phần tiền mặt vật lý; VietQR và chuyển khoản không tính vào đây'],
    [],
    ['CHỈ SỐ BÁN HÀNG', 'Giá trị'],
    ['Doanh thu đơn hoàn tất', report.salesRevenue || 0],
    ['Giảm giá', report.salesDiscount || 0],
    ['Trừ hàng trả', report.returnedRevenue || 0],
    ['Doanh thu ghi nhận thuần', report.netRecognizedRevenue || 0],
    ['Đơn hoàn tất', report.completedOrders || 0],
    ['Tổng dòng hàng', report.totalLineCount || 0],
    ['Số SKU phát sinh', report.distinctSkuCount || 0],
    [],
    ['DÒNG TIỀN', 'Giá trị'],
    ['Tổng thu vào', report.totalCashIn || 0],
    ['Tổng chi ra', report.totalCashOut || 0],
    ['Chênh lệch ròng', report.netCashFlow || 0],
    ['Cọc bị giữ do hủy đơn', report.forfeitedDepositIncome || 0],
    [],
    ['CẦU NỐI DOANH THU VÀ DÒNG TIỀN', 'Giá trị'],
    ['Doanh thu ghi nhận', b.recognizedRevenue || 0],
    ['(-) Doanh thu chưa thu tiền', b.unpaidRevenue || 0],
    ['(+) Tiền thu của đơn kỳ trước', b.priorPeriodCollections || 0],
    ['(+) Tiền thu trước của đơn chưa hoàn tất', b.advanceOnOpenOrders || 0],
    ['(+) Cọc bị giữ do hủy đơn', b.forfeitedDeposit || 0],
    ['(-) Hoàn tiền trả hàng', b.refunds || 0],
    ['= Tổng tiền thu vào', b.totalCashIn || 0],
  ]

  return makeSheet(rows, { cols: [{ wch: 40 }, { wch: 18 }, { wch: 60 }], moneyColumns: [1] })
}

function buildSalesSheet(report, meta) {
  const rows = [
    ...metaRows(meta),
    ['THEO NHÂN VIÊN BÁN HÀNG'],
    ['Nhân viên', 'Số đơn', 'Giảm giá', 'Doanh thu'],
  ]
  ;(report.byEmployee || []).forEach((e) =>
    rows.push([e.employeeName || '—', e.orderCount || 0, e.discount || 0, e.revenue || 0]),
  )

  rows.push([], ['THEO KÊNH BÁN'], ['Kênh', 'Số đơn', 'Doanh thu'])
  ;(report.byChannel || []).forEach((c) => rows.push([c.label || c.channel, c.orderCount || 0, c.revenue || 0]))

  rows.push([], ['THEO PHƯƠNG THỨC BÁN HÀNG'], ['Phương thức', 'Số đơn', 'Số dòng hàng', 'Doanh thu'])
  ;(report.bySalesMode || []).forEach((s) =>
    rows.push([s.label || s.salesMode, s.orderCount || 0, s.quantity || 0, s.revenue || 0]),
  )

  rows.push([], ['DOANH THU THEO GIỜ'], ['Khung giờ', 'Số đơn', 'Doanh thu'])
  ;(report.hourlyRevenue || []).forEach((h) =>
    rows.push([h.label || `${String(h.hour).padStart(2, '0')}:00`, h.orderCount || 0, h.revenue || 0]),
  )

  return makeSheet(rows, {
    cols: [{ wch: 34 }, { wch: 12 }, { wch: 16 }, { wch: 18 }],
    moneyColumns: [1, 2, 3],
  })
}

function buildPaymentsSheet(report, meta) {
  const rows = [...metaRows(meta), ['TIỀN THU VÀO'], ['Loại thu', 'Số lượt', 'Số tiền']]
  ;(report.cashIn || []).forEach((l) => rows.push([l.label, l.count || 0, l.amount || 0]))
  rows.push(['Tổng thu vào', null, report.totalCashIn || 0])

  rows.push([], ['TIỀN CHI RA (HOÀN TRẢ HÀNG)'], ['Phương thức hoàn', 'Số lượt', 'Số tiền'])
  ;(report.cashOut || []).forEach((l) => rows.push([l.label, l.count || 0, l.amount || 0]))
  rows.push(['Tổng chi ra', null, report.totalCashOut || 0])

  rows.push(
    [],
    ['TỔNG HỢP DÒNG TIỀN THEO PHƯƠNG THỨC THANH TOÁN'],
    ['Phương thức', 'Loại', 'Thu vào', 'Chi ra', 'Còn lại'],
  )
  ;(report.byPaymentMethod || []).forEach((l) =>
    rows.push([l.label, l.isCash ? 'Tiền két' : 'Tài khoản', l.amountIn || 0, l.amountOut || 0, l.net || 0]),
  )

  rows.push([], ['CHI TIẾT CÁC KHOẢN THU'], [
    'Mã đơn',
    'Ngày tạo đơn',
    'Thời gian thu',
    'Phương thức',
    'Mục đích',
    'Nhân viên',
    'Khách hàng',
    'Trạng thái đơn',
    'Số tiền',
  ])
  ;(report.receipts || []).forEach((r) =>
    rows.push([
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
  )

  return makeSheet(rows, {
    cols: [
      { wch: 20 },
      { wch: 22 },
      { wch: 14 },
      { wch: 18 },
      { wch: 26 },
      { wch: 22 },
      { wch: 24 },
      { wch: 16 },
      { wch: 16 },
    ],
    // Cột tiền khác nhau giữa các khối, gắn định dạng cho mọi cột có thể chứa tiền.
    moneyColumns: [2, 3, 4, 8],
  })
}

function buildProductsSheet(report, meta) {
  const rows = [
    ...metaRows(meta),
    ['HÀNG HÓA ĐÃ BÁN'],
    ['Mã SKU', 'Tên hàng', 'Nhóm hàng', 'SL bán', 'SL trả', 'Doanh thu'],
  ]
  ;(report.products || []).forEach((p) =>
    rows.push([
      p.skuCode,
      p.skuName,
      p.categoryName || '—',
      p.quantity || 0,
      p.returnedQuantity || 0,
      p.revenue || 0,
    ]),
  )
  rows.push(
    [],
    ['Tổng dòng hàng', report.totalLineCount || 0],
    ['Số SKU phát sinh', report.distinctSkuCount || 0],
    [],
    ['Ghi chú: số lượng không cộng gộp giữa các đơn vị tính khác nhau nên không có dòng tổng số lượng.'],
  )

  return makeSheet(rows, {
    cols: [{ wch: 20 }, { wch: 42 }, { wch: 24 }, { wch: 12 }, { wch: 12 }, { wch: 18 }],
    moneyColumns: [5],
  })
}

function buildOrdersSheet(report, meta) {
  const rows = [
    ...metaRows(meta),
    ['CHI TIẾT TỪNG ĐƠN'],
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
  ]
  ;(report.orders || []).forEach((o) =>
    rows.push([
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
  )

  return makeSheet(rows, {
    cols: [
      { wch: 20 },
      { wch: 22 },
      { wch: 24 },
      { wch: 22 },
      { wch: 14 },
      { wch: 16 },
      { wch: 16 },
      { wch: 12 },
      { wch: 16 },
      { wch: 14 },
      { wch: 16 },
      { wch: 16 },
      { wch: 14 },
      { wch: 24 },
    ],
    moneyColumns: [8, 9, 10, 11, 12],
  })
}

function buildExceptionsSheet(report, meta, periodStartUtc) {
  const orders = report.orders || []
  const receipts = report.receipts || []
  const underpaid = orders.filter((o) => (o.paidAmount || 0) < (o.finalAmount || 0))
  const onCancelled = receipts.filter((r) => r.orderStatus === 'Cancelled')
  const periodStart = periodStartUtc ? new Date(periodStartUtc).getTime() : null
  const priorPeriod = periodStart
    ? receipts.filter((r) => r.orderCreatedAt && new Date(r.orderCreatedAt).getTime() < periodStart)
    : []

  const rows = [
    ...metaRows(meta),
    ['TỔNG HỢP NGOẠI LỆ', 'Giá trị'],
    ['Đơn chưa thu đủ tiền', underpaid.length],
    ['Tổng tiền còn thiếu', underpaid.reduce((s, o) => s + ((o.finalAmount || 0) - (o.paidAmount || 0)), 0)],
    ['Đơn đã hủy', report.cancelledOrders || 0],
    ['Đơn có hoàn tiền', report.refundedOrders || 0],
    ['Đơn hủy sau khi đã đặt cọc', report.forfeitedDepositOrders || 0],
    ['Cọc bị giữ', report.forfeitedDepositIncome || 0],
    [],
    ['ĐƠN CHƯA THU ĐỦ TIỀN'],
    ['Mã đơn', 'Thời gian', 'Khách hàng', 'Nhân viên', 'Trạng thái', 'Thành tiền', 'Đã thu', 'Còn thiếu'],
  ]
  underpaid.forEach((o) =>
    rows.push([
      o.orderCode,
      dateTime(o.createdAt),
      o.customerName || 'Khách lẻ',
      o.employeeName || '—',
      getOrderStatusLabel(o.orderStatus),
      o.finalAmount || 0,
      o.paidAmount || 0,
      (o.finalAmount || 0) - (o.paidAmount || 0),
    ]),
  )

  rows.push([], ['KHOẢN THU TRÊN ĐƠN ĐÃ HỦY'], ['Mã đơn', 'Thời gian thu', 'Phương thức', 'Mục đích', 'Số tiền'])
  onCancelled.forEach((r) =>
    rows.push([
      r.orderCode,
      timeOnly(r.paidAt),
      paymentMethodLabel(r.paymentMethod),
      paymentPurposeLabel(r.paymentPurpose),
      r.amount || 0,
    ]),
  )

  rows.push(
    [],
    ['KHOẢN THU THUỘC ĐƠN CỦA KỲ TRƯỚC'],
    ['Mã đơn', 'Ngày tạo đơn', 'Thời gian thu', 'Phương thức', 'Mục đích', 'Số tiền'],
  )
  priorPeriod.forEach((r) =>
    rows.push([
      r.orderCode,
      dateTime(r.orderCreatedAt),
      timeOnly(r.paidAt),
      paymentMethodLabel(r.paymentMethod),
      paymentPurposeLabel(r.paymentPurpose),
      r.amount || 0,
    ]),
  )

  return makeSheet(rows, {
    cols: [{ wch: 20 }, { wch: 22 }, { wch: 24 }, { wch: 22 }, { wch: 18 }, { wch: 16 }, { wch: 16 }, { wch: 16 }],
    moneyColumns: [1, 4, 5, 6, 7],
  })
}

/**
 * Xuất báo cáo cuối ngày ra 6 sheet Excel.
 * Không có sheet Kho/Kệ vì dữ liệu đó thuộc InventoryService và chỉ tải khi mở tab tương ứng.
 */
export function exportEndOfDayExcel({ report, meta, periodStartUtc, filename }) {
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, buildOverviewSheet(report, meta), '01_TongQuan')
  XLSX.utils.book_append_sheet(wb, buildSalesSheet(report, meta), '02_BanHang')
  XLSX.utils.book_append_sheet(wb, buildPaymentsSheet(report, meta), '03_ThanhToan')
  XLSX.utils.book_append_sheet(wb, buildProductsSheet(report, meta), '04_HangHoa')
  XLSX.utils.book_append_sheet(wb, buildOrdersSheet(report, meta), '05_ChiTietDon')
  XLSX.utils.book_append_sheet(wb, buildExceptionsSheet(report, meta, periodStartUtc), '06_NgoaiLe')
  XLSX.writeFile(wb, `${filename}.xlsx`)
}
