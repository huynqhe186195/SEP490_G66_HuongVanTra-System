import { apiRequestAuth } from '../../../lib/apiClient.js'

export const dashboardApi = {
  getSalesStatistics: async (params) => {
    // Gọi gateway route tới order-service
    // Ví dụ API gateway sẽ route request /api/reports/sales-statistics => order-service
    const query = params ? new URLSearchParams(params).toString() : ''
    const path = `/api/reports/sales-statistics${query ? `?${query}` : ''}`
    return await apiRequestAuth(path)
  },
  getTopProducts: async (params) => {
    const query = params ? new URLSearchParams(params).toString() : ''
    const path = `/api/reports/top-products${query ? `?${query}` : ''}`
    return await apiRequestAuth(path)
  },
  getSalesByCategory: async (params) => {
    const query = params ? new URLSearchParams(params).toString() : ''
    const path = `/api/reports/sales-by-category${query ? `?${query}` : ''}`
    return await apiRequestAuth(path)
  },
  getCustomerGrowth: async (params) => {
    const query = params ? new URLSearchParams(params).toString() : ''
    const path = `/api/reports/customer-growth${query ? `?${query}` : ''}`
    return await apiRequestAuth(path)
  },
  getRevenueGrowth: async (params) => {
    const query = params ? new URLSearchParams(params).toString() : ''
    const path = `/api/reports/revenue-growth${query ? `?${query}` : ''}`
    return await apiRequestAuth(path)
  },
  getSalesByChannel: async (params) => {
    const query = params ? new URLSearchParams(params).toString() : ''
    const path = `/api/reports/sales-by-channel${query ? `?${query}` : ''}`
    return await apiRequestAuth(path)
  },
  getOrderGrowth: async (params) => {
    const query = params ? new URLSearchParams(params).toString() : ''
    const path = `/api/reports/order-count-growth${query ? `?${query}` : ''}`
    return await apiRequestAuth(path)
  },
}
