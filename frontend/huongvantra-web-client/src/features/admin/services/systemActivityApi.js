import { apiRequestAuth, toPagedResult } from '../../../lib/apiClient.js'

function coalesce(item, ...keys) {
  for (const key of keys) {
    const value = item?.[key]
    if (value !== undefined && value !== null) return value
  }
  return null
}

function mapActivity(item) {
  if (!item || typeof item !== 'object') return null
  return {
    id: coalesce(item, 'id', 'Id'),
    eventId: coalesce(item, 'eventId', 'EventId'),
    occurredAtUtc: coalesce(item, 'occurredAtUtc', 'OccurredAtUtc'),
    actorId: coalesce(item, 'actorId', 'ActorId'),
    actorName: coalesce(item, 'actorName', 'ActorName'),
    actorRole: coalesce(item, 'actorRole', 'ActorRole'),
    serviceName: coalesce(item, 'serviceName', 'ServiceName'),
    module: coalesce(item, 'module', 'Module'),
    action: coalesce(item, 'action', 'Action'),
    entityType: coalesce(item, 'entityType', 'EntityType'),
    entityId: coalesce(item, 'entityId', 'EntityId'),
    entityCode: coalesce(item, 'entityCode', 'EntityCode'),
    description: coalesce(item, 'description', 'Description'),
    result: coalesce(item, 'result', 'Result'),
    reason: coalesce(item, 'reason', 'Reason'),
    beforeSnapshotJson: coalesce(item, 'beforeSnapshotJson', 'BeforeSnapshotJson'),
    afterSnapshotJson: coalesce(item, 'afterSnapshotJson', 'AfterSnapshotJson'),
    correlationId: coalesce(item, 'correlationId', 'CorrelationId'),
    requestPath: coalesce(item, 'requestPath', 'RequestPath'),
    httpMethod: coalesce(item, 'httpMethod', 'HttpMethod'),
    statusCode: Number(coalesce(item, 'statusCode', 'StatusCode') ?? 0),
    clientIp: coalesce(item, 'clientIp', 'ClientIp'),
    userAgent: coalesce(item, 'userAgent', 'UserAgent'),
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

export async function fetchSystemActivities(params = {}) {
  const query = appendQuery(params)
  const data = await apiRequestAuth(`/api/v1/audit/system-activities${query ? `?${query}` : ''}`, {
    method: 'GET',
  })
  const paged = toPagedResult(data)
  return {
    ...paged,
    items: paged.items.map(mapActivity).filter(Boolean),
  }
}

export async function fetchSystemActivityDetail(id) {
  const item = await apiRequestAuth(`/api/v1/audit/system-activities/${id}`, { method: 'GET' })
  return mapActivity(item)
}
