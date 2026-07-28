import { createStocktakeRequest, submitStocktakeRequest } from '../../inventory/services/stocktakeApi.js'



export const SHELF_DAY_START_REASON = 'Kiểm kệ đầu ngày'

export const SHELF_DAY_END_REASON = 'Kiểm kệ cuối ngày'



/** Ngày theo giờ Việt Nam (yyyy-MM-dd). */

export function vietnamTodayDateInput() {

  return new Intl.DateTimeFormat('en-CA', {

    timeZone: 'Asia/Ho_Chi_Minh',

    year: 'numeric',

    month: '2-digit',

    day: '2-digit',

  }).format(new Date())

}



function reasonForLine(system, actual) {

  if (actual > system) return 'FOUND_STOCK'

  if (actual < system) return 'DATA_ENTRY_ERROR'

  return 'OTHER'

}



/**

 * Tạo + gửi duyệt phiếu kiểm kê kệ đầu ngày / cuối ngày.

 * @param {'dayStart' | 'dayEnd'} kind

 */

export async function submitDailyShelfStocktake({

  kind = 'dayStart',

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



  const isEnd = kind === 'dayEnd'

  const label = isEnd ? 'cuối ngày' : 'đầu ngày'

  const reason = isEnd ? SHELF_DAY_END_REASON : SHELF_DAY_START_REASON



  const payload = {

    location: 'Shelf',

    countDate: vietnamTodayDateInput(),

    reason,

    note: [

      isEnd ? 'Tự động tạo khi Sale kết thúc ngày POS.' : 'Tự động tạo khi Sale kiểm kệ đầu ngày POS.',

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

            ? `Khớp ${label}`

            : `${label}: hệ thống=${system}, thực tế=${actual}`,

      }

    }),

  }



  const created = await createStocktakeRequest(payload)

  const submitted = await submitStocktakeRequest(created.id)

  return submitted

}



/** @deprecated Dùng submitDailyShelfStocktake({ kind: 'dayStart' }) */

export async function submitShiftOpenShelfStocktake(args) {

  return submitDailyShelfStocktake({ ...args, kind: 'dayStart' })

}


