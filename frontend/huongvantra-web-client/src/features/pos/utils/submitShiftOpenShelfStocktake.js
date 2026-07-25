import { createStocktakeRequest, submitStocktakeRequest } from '../../inventory/services/stocktakeApi.js'

function reasonForLine(system, actual) {
  if (actual > system) return 'FOUND_STOCK'
  if (actual < system) return 'DATA_ENTRY_ERROR'
  return 'OTHER'
}

/**
 * Tạo + gửi duyệt phiếu kiểm kê kệ đầu ca từ các dòng đã điền số thực tế.
 * Lưu CreatedBy / SubmittedBy trên BE; Manager xem tại Kiểm kê tồn kho.
 */
export async function submitShiftOpenShelfStocktake({
  items = [],
  filledCount = 0,
  totalCount = 0,
  shelfNote = '',
  shiftLabel = '',
}) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error(
      'Vui lòng nhập số thực tế cho hàng trên kệ (hoặc bấm «Điền = Hệ thống» rồi chỉnh dòng lệch).',
    )
  }
  if (totalCount > 0 && filledCount < totalCount) {
    throw new Error(
      `Còn ${totalCount - filledCount} SKU chưa nhập số thực tế. Điền đủ hoặc dùng «Điền = Hệ thống».`,
    )
  }

  const payload = {
    location: 'Shelf',
    countDate: new Date().toISOString().slice(0, 10),
    reason: 'Kiểm kệ đầu ca POS',
    note: [
      'Tự động tạo khi Sale mở ca quỹ POS.',
      shiftLabel ? `Ca: ${shiftLabel}` : null,
      shelfNote?.trim() || null,
    ]
      .filter(Boolean)
      .join(' '),
    items: items.map((row) => {
      const system = Number(row.system) || 0
      const actual = Number(row.actual) || 0
      return {
        skuId: row.skuId,
        skuCode: row.skuCode || null,
        skuSnapshotName: row.productName || row.skuCode || null,
        actualQuantity: actual,
        reasonCode: reasonForLine(system, actual),
        note:
          actual === system
            ? 'Khớp đầu ca'
            : `Đầu ca: hệ thống=${system}, thực tế=${actual}`,
      }
    }),
  }

  const created = await createStocktakeRequest(payload)
  const submitted = await submitStocktakeRequest(created.id)
  return submitted
}
