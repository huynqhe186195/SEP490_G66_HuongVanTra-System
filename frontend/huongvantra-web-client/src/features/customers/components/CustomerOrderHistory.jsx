import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { showError } from '../../../app/toast.js'
import { fetchOrders } from '../../orders/services/ordersApi.js'
import { formatVnd } from '../utils/customerDisplay.js'

function formatOrderStatus(status) {
  const normalized = String(status || '').toLowerCase()
  if (normalized.includes('completed')) return 'Hoàn tất'
  if (normalized.includes('cancelled')) return 'Đã hủy'
  if (normalized.includes('pending')) return 'Chờ xử lý'
  return status || '—'
}

function CustomerOrderHistory({ customerId }) {
  const [orders, setOrders] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!customerId) return undefined

    let mounted = true

    async function loadOrders() {
      try {
        setIsLoading(true)
        const data = await fetchOrders({ customerId, page: 1, pageSize: 50 })
        if (mounted) setOrders(Array.isArray(data.items) ? data.items : [])
      } catch (error) {
        if (mounted) {
          setOrders([])
          showError(error.message)
        }
      } finally {
        if (mounted) setIsLoading(false)
      }
    }

    loadOrders()
    return () => {
      mounted = false
    }
  }, [customerId])

  if (isLoading) {
    return <p className="text-sm text-[#717971]">Đang tải lịch sử đơn hàng...</p>
  }

  return (
    <section className="space-y-4 rounded-[24px] border border-[#c1c9c0]/30 bg-white p-4 shadow-sm sm:p-6">
      <h3 className="text-lg font-semibold text-[#356647]">Lịch sử đơn hàng</h3>

      {orders.length === 0 ? (
        <p className="text-sm text-[#717971]">Chưa có đơn hàng nào cho khách này.</p>
      ) : (
        <div className="custom-scrollbar max-h-72 overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-[#717971]">
                <th className="pb-2 font-semibold">Mã đơn</th>
                <th className="pb-2 font-semibold">Kênh</th>
                <th className="pb-2 font-semibold">Trạng thái</th>
                <th className="pb-2 font-semibold">Thành tiền</th>
                <th className="pb-2 font-semibold">Ngày tạo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0eee6]">
              {orders.map((order) => (
                <tr key={order.id}>
                  <td className="py-2 pr-2">
                    <Link
                      to={`/orders/${order.id}`}
                      className="font-semibold text-[#356647] hover:underline"
                    >
                      {order.orderCode}
                    </Link>
                  </td>
                  <td className="py-2 pr-2">{order.orderChannel || '—'}</td>
                  <td className="py-2 pr-2">{formatOrderStatus(order.orderStatus)}</td>
                  <td className="py-2 pr-2 font-semibold">{formatVnd(order.finalAmount)}</td>
                  <td className="py-2 text-[#717971]">
                    {order.createdAt ? new Date(order.createdAt).toLocaleDateString('vi-VN') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

export default CustomerOrderHistory
