import { useEffect, useState } from 'react'
import { fetchOrderActivities } from '../services/ordersApi.js'
import {
  formatOrderActivitySubtitle,
  getOrderActivityDotClass,
  getOrderActivityTitle,
} from '../utils/orderActivity.js'

function OrderTimeline({ orderId, refreshKey = 0 }) {
  const [items, setItems] = useState([])
  const [isLoading, setIsLoading] = useState(Boolean(orderId))

  useEffect(() => {
    let mounted = true

    async function load() {
      if (!orderId) {
        setItems([])
        setIsLoading(false)
        return
      }

      try {
        setIsLoading(true)
        const activities = await fetchOrderActivities(orderId)
        if (mounted) setItems(activities)
      } catch {
        if (mounted) setItems([])
      } finally {
        if (mounted) setIsLoading(false)
      }
    }

    load()
    return () => {
      mounted = false
    }
  }, [orderId, refreshKey])

  if (isLoading) {
    return <p className="text-sm text-slate-500">Đang tải lịch sử xử lý...</p>
  }

  if (!items.length) {
    return (
      <p className="text-sm text-slate-500">
        Chưa có lịch sử thao tác. Các bước mới sẽ được ghi nhận từ bây giờ.
      </p>
    )
  }

  return (
    <div className="relative space-y-0">
      {items.map((item, index) => (
        <div key={item.id} className="relative flex gap-4 pb-6 last:pb-0">
          {index < items.length - 1 ? (
            <span
              aria-hidden
              className="absolute left-[7px] top-3 h-[calc(100%-4px)] w-px bg-slate-200"
            />
          ) : null}
          <span
            aria-hidden
            className={`relative z-10 mt-1.5 h-3.5 w-3.5 shrink-0 rounded-full ring-4 ring-white ${getOrderActivityDotClass(item.activityType)}`}
          />
          <div className="min-w-0 flex-1 pt-0.5">
            <p className="text-sm font-semibold text-slate-800">
              {getOrderActivityTitle(item.activityType)}
            </p>
            <p className="mt-0.5 text-sm text-slate-600">{item.description}</p>
            <p className="mt-1 text-xs text-slate-400">{formatOrderActivitySubtitle(item)}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

export default OrderTimeline
