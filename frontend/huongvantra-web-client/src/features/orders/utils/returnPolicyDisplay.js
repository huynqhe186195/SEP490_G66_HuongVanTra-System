export function buildReturnOverridePolicyOnly(context, { canManagerOverride = false } = {}) {
  if (!context?.policy) {
    return {
      title: 'Chính sách trả ngoại lệ',
      bullets: ['Chưa tải được chính sách trả hàng. Vui lòng thử tải lại trang.'],
    }
  }

  const {
    policy,
    softWarnings = [],
    isWithinReturnWindow,
    customReturnBlocked,
    channelAllowed,
  } = context
  const minImages = Number(policy.minEvidenceImages) || 0
  const checklist = policy.checklist || []
  const requiredChecks = checklist.filter((item) => item.required)

  const bullets = [
    'Trả ngoại lệ dùng khi đơn chưa đủ điều kiện trả theo chính sách chuẩn nhưng vẫn cần nhận trả hàng.',
    'Các trường hợp thường gặp: quá hạn trả, thiếu checklist bắt buộc, thiếu ảnh minh chứng, kênh không áp dụng, hoặc đơn không thuộc phạm vi trả.',
    canManagerOverride
      ? 'Bạn có quyền bật «Cho phép trả ngoại lệ» khi tạo phiếu trả.'
      : 'Chỉ Quản lý hoặc Kế toán được bật «Cho phép trả ngoại lệ».',
    'Khi bật ngoại lệ: phải ghi chú lý do rõ ràng, tối thiểu 10 ký tự.',
    'Nhân viên bán hàng liên hệ Quản lý nếu cần xử lý ngoại lệ.',
  ]

  const orderIssues = []
  if (isWithinReturnWindow === false) orderIssues.push('Đơn này đã quá hạn trả.')
  if (channelAllowed === false) orderIssues.push('Kênh bán của đơn không được trả theo chính sách.')
  if (customReturnBlocked) orderIssues.push('Đơn thuộc nhóm không áp dụng trả hàng (ví dụ chỉ sản phẩm cá nhân).')
  if (requiredChecks.length > 0) {
    orderIssues.push(`Checklist bắt buộc: ${requiredChecks.map((item) => item.label).join(', ')}.`)
  }
  if (minImages > 0) orderIssues.push(`Cần tối thiểu ${minImages} ảnh minh chứng.`)

  if (orderIssues.length > 0) {
    bullets.push('Đơn hiện tại:', ...orderIssues.map((item) => `· ${item}`))
  }

  if (softWarnings.length > 0) {
    bullets.push('Cảnh báo thêm:', ...softWarnings.map((item) => `· ${item}`))
  }

  bullets.push(
    policy.autoAcceptOnPolicyPass
      ? 'Sau khi tạo phiếu với ngoại lệ hợp lệ, hệ thống vẫn xử lý hoàn tiền theo quy trình đã cấu hình.'
      : 'Sau khi tạo phiếu với ngoại lệ hợp lệ, phiếu vẫn có thể cần Quản lý xác nhận trước khi hoàn tiền.',
  )

  return {
    title: 'Chính sách trả ngoại lệ',
    bullets,
  }
}
