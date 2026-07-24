import { apiRequestAuth, toPagedResult } from '../../../lib/apiClient.js'

function coalesce(item, ...keys) {
  for (const key of keys) {
    const value = item?.[key]
    if (value !== undefined && value !== null) return value
  }
  return null
}

function mapMessage(item) {
  if (!item || typeof item !== 'object') return null
  return {
    id: coalesce(item, 'id', 'Id'),
    eventType: coalesce(item, 'eventType', 'EventType') ?? '',
    aggregateId: coalesce(item, 'aggregateId', 'AggregateId'),
    status: String(coalesce(item, 'status', 'Status') ?? ''),
    retryCount: Number(coalesce(item, 'retryCount', 'RetryCount') ?? 0),
    occurredAtUtc: coalesce(item, 'occurredAtUtc', 'OccurredAtUtc'),
    lastAttemptAtUtc: coalesce(item, 'lastAttemptAtUtc', 'LastAttemptAtUtc'),
    nextAttemptAtUtc: coalesce(item, 'nextAttemptAtUtc', 'NextAttemptAtUtc'),
    publishedAtUtc: coalesce(item, 'publishedAtUtc', 'PublishedAtUtc'),
    lastError: coalesce(item, 'lastError', 'LastError'),
    lockedBy: coalesce(item, 'lockedBy', 'LockedBy'),
    lockedUntilUtc: coalesce(item, 'lockedUntilUtc', 'LockedUntilUtc'),
    payload: coalesce(item, 'payload', 'Payload'),
  }
}

function appendQuery(params) {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    query.set(key, String(value))
  })
  return query.toString()
}

export async function fetchOutboxMessages({ status, eventType, page = 1, pageSize = 20 } = {}) {
  const query = appendQuery({ status, eventType, page, pageSize })
  const data = await apiRequestAuth(`/api/outbox-messages${query ? `?${query}` : ''}`, { method: 'GET' })
  const paged = toPagedResult(data)
  return { ...paged, items: paged.items.map(mapMessage).filter(Boolean) }
}

export async function fetchOutboxMessageDetail(id) {
  const item = await apiRequestAuth(`/api/outbox-messages/${id}`, { method: 'GET' })
  return mapMessage(item)
}

export async function fetchOutboxStats() {
  const data = await apiRequestAuth('/api/outbox-messages/stats', { method: 'GET' })
  return {
    pending: Number(coalesce(data, 'pending', 'Pending') ?? 0),
    processing: Number(coalesce(data, 'processing', 'Processing') ?? 0),
    published: Number(coalesce(data, 'published', 'Published') ?? 0),
    failed: Number(coalesce(data, 'failed', 'Failed') ?? 0),
  }
}

export async function retryOutboxMessage(id) {
  const data = await apiRequestAuth(`/api/outbox-messages/${id}/retry`, {
    method: 'POST',
    body: JSON.stringify({}),
  })
  return {
    id: coalesce(data, 'id', 'Id'),
    status: String(coalesce(data, 'status', 'Status') ?? ''),
    message: coalesce(data, 'message', 'Message') ?? '',
  }
}
