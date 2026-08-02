import { apiRequestAuth, toPagedResult } from '../../../lib/apiClient.js'

export function mapNotification(item) {
  if (!item || typeof item !== 'object') return null
  return {
    id: item.id ?? item.Id,
    type: item.type ?? item.Type ?? '',
    title: item.title ?? item.Title ?? '',
    body: item.body ?? item.Body ?? '',
    link: item.link ?? item.Link ?? null,
    referenceId: item.referenceId ?? item.ReferenceId ?? null,
    referenceType: item.referenceType ?? item.ReferenceType ?? '',
    isRead: Boolean(item.isRead ?? item.IsRead ?? false),
    readAt: item.readAt ?? item.ReadAt ?? null,
    createdAt: item.createdAt ?? item.CreatedAt ?? null,
  }
}

export async function fetchNotifications(params = {}) {
  const search = new URLSearchParams()
  if (params.unreadOnly) search.set('unreadOnly', 'true')
  search.set('page', String(params.page ?? 1))
  search.set('pageSize', String(Math.min(100, Math.max(1, params.pageSize ?? 20))))
  const data = await apiRequestAuth(`/api/v1/notifications?${search.toString()}`, { method: 'GET' })
  const paged = toPagedResult(data)
  return { ...paged, items: paged.items.map(mapNotification).filter(Boolean) }
}

export async function fetchNotificationSummary() {
  const data = await apiRequestAuth('/api/v1/notifications/summary', { method: 'GET' })
  return Number(data?.unreadCount ?? data?.UnreadCount ?? 0)
}

export async function markNotificationRead(id) {
  const data = await apiRequestAuth(`/api/v1/notifications/${id}/read`, { method: 'POST' })
  return mapNotification(data)
}

export async function markAllNotificationsRead() {
  const data = await apiRequestAuth('/api/v1/notifications/read-all', { method: 'POST' })
  return Number(data?.unreadCount ?? data?.UnreadCount ?? 0)
}

/**
 * Gửi thông báo theo vai trò (vd. báo cáo cuối ngày kho → Manager + Admin).
 */
export async function broadcastNotification(payload) {
  const data = await apiRequestAuth('/api/v1/notifications/broadcast', {
    method: 'POST',
    body: JSON.stringify({
      type: payload.type,
      title: payload.title,
      body: payload.body,
      link: payload.link ?? null,
      recipientRoleNames: payload.recipientRoleNames ?? [],
      referenceId: payload.referenceId ?? null,
      referenceType: payload.referenceType ?? null,
    }),
  })
  return {
    createdCount: Number(data?.createdCount ?? data?.CreatedCount ?? 0),
    items: Array.isArray(data?.items ?? data?.Items)
      ? (data.items ?? data.Items).map(mapNotification).filter(Boolean)
      : [],
  }
}
