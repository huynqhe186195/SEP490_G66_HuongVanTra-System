import { formatVietnamDateTime } from '../../../utils/vietnamDateTime.js'

export function getOrderActivityTitle(activityType) {
  const key = String(activityType || '').trim()
  const map = {
    Created: 'Tạo đơn',
    Updated: 'Cập nhật đơn',
    PaymentPending: 'Chờ thanh toán',
    PaymentReceived: 'Thanh toán',
    CodVerified: 'Xác nhận COD',
    Shipped: 'Đang giao hàng',
    Completed: 'Hoàn tất',
    Cancelled: 'Hủy đơn',
    InventorySynced: 'Đồng bộ kho',
    Returned: 'Trả hàng',
  }
  return map[key] || key || 'Hoạt động'
}

export function getOrderActivityDotClass(activityType) {
  const key = String(activityType || '').trim()
  const map = {
    Created: 'bg-slate-500',
    Updated: 'bg-slate-400',
    PaymentPending: 'bg-amber-500',
    PaymentReceived: 'bg-emerald-600',
    CodVerified: 'bg-emerald-700',
    Shipped: 'bg-blue-600',
    Completed: 'bg-[#538463]',
    Cancelled: 'bg-red-600',
    InventorySynced: 'bg-violet-600',
    Returned: 'bg-orange-600',
  }
  return map[key] || 'bg-[#4a6242]'
}

export function formatOrderActivityActor(activity) {
  if (activity?.actorName) return activity.actorName
  if (activity?.actorId) return 'Nhân viên'
  return 'Hệ thống'
}

export function formatOrderActivitySubtitle(activity) {
  const parts = [formatOrderActivityActor(activity)]
  if (activity?.createdAt) parts.push(formatVietnamDateTime(activity.createdAt))
  return parts.join(' · ')
}
