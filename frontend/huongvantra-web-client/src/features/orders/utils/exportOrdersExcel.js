import { exportFormattedListExcel } from '../../../utils/exportListExcel.js'
import {
  getExchangeChannelShortLabel,
  getInventorySyncLabel,
  getOrderChannelLabel,
  getOrderKindLabel,
  getOrderStatusLabel,
} from './orderDisplay.js'

const MAX_EXPORT_ROWS = 10_000
const EXPORT_PAGE_SIZE = 100

const ORDER_HEADERS = [
  'Mã đơn',
  'Ngày tạo',
  'Trạng thái',
  'Khách hàng',
  'Kênh bán',
  'Loại đơn',
  'Người bán',
  'SL sản phẩm',
  'Tổng tiền',
  'Giảm giá',
  'Thành tiền',
  'Đồng bộ kho',
  'Ghi chú',
]

const RETURN_HEADERS = [
  'Mã phiếu trả',
  'Đơn gốc',
  'Kênh',
  'Khách hàng',
  'Giá trị trả',
  'Hoàn tiền',
  'Giá trị đổi',
  'Mã đơn đổi',
  'Trạng thái',
  'Ngày tạo',
  'Ghi chú',
]

function formatReturnAcceptance(status) {
  const normalized = String(status || '').trim()
  if (normalized === 'Pending') return 'Chờ duyệt'
  if (normalized === 'Accepted') return 'Đã chấp nhận'
  if (normalized === 'Rejected') return 'Đã từ chối'
  return normalized || '—'
}

async function fetchAllPaged(fetchPage, mapItem = (item) => item) {
  const items = []
  let page = 1
  let totalCount = Infinity

  while (items.length < MAX_EXPORT_ROWS && items.length < totalCount) {
    const data = await fetchPage(page, EXPORT_PAGE_SIZE)
    totalCount = Number(data.totalCount ?? items.length)
    const batch = (data.items ?? []).map(mapItem).filter(Boolean)
    if (!batch.length) break
    items.push(...batch)
    if (batch.length < EXPORT_PAGE_SIZE) break
    page += 1
  }

  return items.slice(0, MAX_EXPORT_ROWS)
}

export function mapOrderToExportRow(order) {
  return [
    order.orderCode || '',
    order.createdAt ? new Date(order.createdAt) : '',
    getOrderStatusLabel(order.orderStatus),
    order.customerSnapshotName || 'Khách lẻ',
    getOrderChannelLabel(order.orderChannel),
    getOrderKindLabel(order.orderKind),
    order.sellerName || '—',
    Number(order.totalQuantity) || 0,
    Number(order.totalAmount) || 0,
    Number(order.discountAmount) || 0,
    Number(order.finalAmount) || 0,
    getInventorySyncLabel(order.inventorySyncStatus),
    order.note || '',
  ]
}

export function mapReturnSlipToExportRow(item) {
  return [
    item.returnCode || '',
    item.sourceOrderCode || '',
    getExchangeChannelShortLabel(item.sourceOrderChannel),
    item.customerSnapshotName || 'Khách lẻ',
    Number(item.returnAmount) || 0,
    Number(item.refundAmount) || 0,
    Number(item.exchangeAmount) || 0,
    item.exchangeOrderCode || '—',
    formatReturnAcceptance(item.acceptanceStatus),
    item.createdAt ? new Date(item.createdAt) : '',
    item.note || '',
  ]
}

export async function exportOrdersExcelClient(fetchPage, filePrefix = 'Don_Hang') {
  const orders = await fetchAllPaged(fetchPage)
  const rows = orders.map(mapOrderToExportRow)
  await exportFormattedListExcel({
    sheetName: 'Danh sách đơn hàng',
    title: 'Danh sách đơn hàng',
    headers: ORDER_HEADERS,
    rows,
    columnWidths: [16, 18, 18, 24, 18, 14, 18, 12, 14, 14, 14, 22, 28],
    moneyColumns: [8, 9, 10],
    integerColumns: [7],
    dateColumns: [1],
    filename: filePrefix,
  })
  return rows.length
}

export async function exportReturnSlipsExcelClient(fetchPage, filePrefix = 'Phieu_Tra_Hang') {
  const slips = await fetchAllPaged(fetchPage)
  const rows = slips.map(mapReturnSlipToExportRow)
  await exportFormattedListExcel({
    sheetName: 'Phiếu trả hàng',
    title: 'Danh sách phiếu trả hàng',
    headers: RETURN_HEADERS,
    rows,
    columnWidths: [16, 16, 12, 24, 14, 14, 14, 16, 16, 18, 28],
    moneyColumns: [4, 5, 6],
    dateColumns: [9],
    filename: filePrefix,
  })
  return rows.length
}
