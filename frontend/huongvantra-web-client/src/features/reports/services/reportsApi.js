import { apiRequestAuth } from '../../../lib/apiClient'

const REPORTS_API = '/api/Reports'

function buildQueryString(params) {
  if (!params) return ''
  const searchParams = new URLSearchParams()
  for (const key in params) {
    if (params[key] !== undefined && params[key] !== null) {
      searchParams.append(key, params[key])
    }
  }
  const qs = searchParams.toString()
  return qs ? `?${qs}` : ''
}

export const reportsApi = {
  getSalesStatistics: async (params) => {
    return await apiRequestAuth(`${REPORTS_API}/sales-statistics${buildQueryString(params)}`)
  },

  getTopProducts: async (params) => {
    return await apiRequestAuth(`${REPORTS_API}/top-products${buildQueryString(params)}`)
  },

  getSalesByCategory: async (params) => {
    return await apiRequestAuth(`${REPORTS_API}/sales-by-category${buildQueryString(params)}`)
  },

  getCustomerGrowth: async (params) => {
    return await apiRequestAuth(`${REPORTS_API}/customer-growth${buildQueryString(params)}`)
  },

  getRevenueGrowth: async (params) => {
    return await apiRequestAuth(`${REPORTS_API}/revenue-growth${buildQueryString(params)}`)
  },

  getSalesByChannel: async (params) => {
    return await apiRequestAuth(`${REPORTS_API}/sales-by-channel${buildQueryString(params)}`)
  },

  getOrderCountGrowth: async (params) => {
    return await apiRequestAuth(`${REPORTS_API}/order-count-growth${buildQueryString(params)}`)
  },

  getDailyCashReconciliation: async (params) => {
    return await apiRequestAuth(`${REPORTS_API}/daily-cash-reconciliation${buildQueryString(params)}`)
  },
}
