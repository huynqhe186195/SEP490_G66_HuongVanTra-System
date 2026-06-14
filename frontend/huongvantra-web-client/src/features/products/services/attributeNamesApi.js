import { apiRequestAuth } from '../../../lib/apiClient.js'

export async function fetchAttributeNames() {
  const data = await apiRequestAuth('/api/v1/attribute-names', { method: 'GET' })
  return Array.isArray(data) ? data : (data?.items ?? [])
}

export async function createAttributeName(name) {
  return apiRequestAuth('/api/v1/attribute-names', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })
}
