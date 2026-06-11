import { apiRequestAuth } from '../../../lib/apiClient.js'

export const dashboardApi = {
  getSalesStatistics: async (params) => {
    // Gọi gateway route tới order-service
    // Ví dụ API gateway sẽ route request /api/reports/sales-statistics => order-service
    const query = params ? new URLSearchParams(params).toString() : ''
    const path = `/api/reports/sales-statistics${query ? `?${query}` : ''}`
    return await apiRequestAuth(path)
  },
}
