import { apiRequestAuth } from '../../../lib/apiClient.js'

export async function fetchBrands() {
  const data = await apiRequestAuth('/api/v1/brands', { method: 'GET' })
  return Array.isArray(data) ? data : (data?.items ?? [])
}

export async function createBrand(name) {
  return apiRequestAuth('/api/v1/brands', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })
}
