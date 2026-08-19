/** Contextual reason chips for reject / cancel / dismiss flows (Vietnamese). */

export const REASON_SUGGESTIONS = {
  productCreationReject: [
    'Thiếu thông tin sản phẩm / ảnh',
    'Sai danh mục hoặc loại hàng',
    'Trùng tên hoặc mã SKU',
    'Giá / thuế chưa hợp lệ',
    'BOM chưa đủ hoặc sai định mức',
    'Cần bổ sung mô tả trước khi duyệt',
  ],
  productCreationCancel: [
    'Tạo yêu cầu nhầm',
    'Đổi sang file Excel khác',
    'Trùng yêu cầu đã gửi',
    'Tạm dừng, sẽ gửi lại sau',
  ],
  productHideSubmit: [
    'Ngừng kinh doanh',
    'Trùng mã / sản phẩm khác',
    'Sai phân loại hàng',
    'Không còn sử dụng',
    'Gộp vào sản phẩm khác',
  ],
  contractReject: [
    'Điều khoản chưa rõ',
    'Sai thông tin khách hàng',
    'Trùng hợp đồng đã có',
    'Thiếu giấy tờ kèm theo',
    'Cần thương lượng lại',
    'Hết hiệu lực dự kiến',
  ],
  productionReject: [
    'Thiếu nguyên liệu / bao bì',
    'Sai BOM hoặc định mức',
    'Sai số lượng sản xuất',
    'Sai nơi nhập thành phẩm',
    'Cần chỉnh lại trước khi duyệt',
  ],
  productionCancel: [
    'Không sản xuất nữa',
    'Đổi kế hoạch sản xuất',
    'Trùng lệnh đã tạo',
    'Hết nhu cầu kệ hàng',
  ],
  stockAdjustmentReject: [
    'Kho không đủ tồn',
    'SKU không còn dùng',
    'Số lượng yêu cầu quá cao',
    'Sai loại hàng / khu vực',
    'Trùng yêu cầu đã có',
  ],
  stockAdjustmentCancel: [
    'Tạo yêu cầu nhầm',
    'Đã đủ hàng trên kệ',
    'Sẽ gửi lại yêu cầu mới',
    'Không cần bổ sung nữa',
  ],
  stockAdjustmentCloseRemaining: [
    'Kho hết lô phù hợp',
    'Không nhập thêm trong kỳ',
    'Phần còn lại không cần cấp',
    'Chờ đợt nhập kho sau',
  ],
  stockDeductCancel: [
    'Đơn hàng đã hủy',
    'Sai số lượng trừ kho',
    'Đã xử lý thủ công',
    'Trùng queue trừ kho',
    'Tồn không khớp, chờ đối soát',
  ],
  shelfReplenishmentDismiss: [
    'Đã điều chuyển bằng phiếu khác',
    'Không cần bổ sung',
    'Tồn thực tế vẫn đủ',
    'SKU tạm ngừng bán',
    'Chờ nhập kho trước',
  ],
  supplierReceiptReject: [
    'Sai số lượng giao',
    'Sai giá / thành tiền',
    'Hàng hỏng / kém chất lượng',
    'Thiếu chứng từ',
    'Sai nhà cung cấp',
    'Lô / HSD không hợp lệ',
  ],
  supplierReceiptCancel: [
    'Nhập phiếu nhầm',
    'Trùng phiếu đã tạo',
    'NCC hủy giao hàng',
    'Tạo lại phiếu mới',
  ],
  inventoryReturnReject: [
    'Hàng vẫn bán được',
    'Thiếu chứng từ trả hàng',
    'Sai lô / số lượng không khớp',
    'Ngoài chính sách trả hàng',
  ],
  inventoryReturnCancel: [
    'Không trả nữa',
    'Chọn nhầm phiếu',
    'Đã xử lý bằng điều chỉnh khác',
  ],
  stockTransferCancel: [
    'Tạo phiếu nhầm',
    'Kho hết hàng',
    'Sai SKU hoặc số lượng',
    'Đã đủ hàng trên kệ',
    'Hủy để tạo phiếu mới',
  ],
  stocktakeReject: [
    'Sai số đếm kiểm kê',
    'Thiếu dòng SKU',
    'Sai khu vực Kho / Kệ',
    'Cần kiểm lại trước khi duyệt',
    'Dữ liệu chưa đủ đối soát',
  ],
  stocktakeReopenDay: [
    'Cần bán thêm trong ngày',
    'Đóng ngày nhầm',
    'Có đơn chưa ghi nhận',
  ],
  backorderCustomerCancel: [
    'Khách đổi ý, không mua nữa',
    'Khách không chờ được thời gian hẹn',
    'Khách đã mua ở nơi khác',
    'Khách đặt nhầm sản phẩm / số lượng',
    'Khách yêu cầu hủy qua điện thoại',
  ],
  backorderOverdueCancel: [
    'Khách không tới nhận quá 7 ngày',
    'Không liên lạc được với khách',
    'Khách hẹn lại nhiều lần nhưng không đến',
    'Khách từ chối nhận hàng',
    'Hàng đã quá hạn lưu giữ tại kệ',
  ],
  backorderRefundApprove: [
    'Đã xác minh lý do hủy hợp lệ',
    'Khách đã trả lại hàng giao ngay',
    'Đồng ý hoàn theo chính sách đặt cọc',
    'Đã đối soát số tiền cần hoàn',
  ],
  backorderRefundReject: [
    'Khách chưa trả lại hàng đã giao',
    'Thiếu bằng chứng hủy đơn',
    'Đơn đã xử lý sản xuất, chưa đủ điều kiện hủy',
    'Cần liên hệ khách trước khi quyết định',
  ],
  receiptReprint: [
    'Khách xin bản in thêm',
    'Máy in lỗi / giấy mờ',
    'In sai máy',
    'Phục vụ đối soát',
  ],
}

export function getReasonSuggestions(key) {
  return REASON_SUGGESTIONS[key] ?? []
}
