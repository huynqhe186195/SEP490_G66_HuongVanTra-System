import { useEffect, useState } from 'react'
import { formatVnd } from '../utils/customerDisplay.js'
import { fetchCustomerActivities } from '../services/customersApi.js'
import {
  formatActivityTime,
  getCustomerIntegrationActivities,
} from '../utils/customerActivity.js'

function activityPresentation(item) {
  if (item.tierUpgraded) {
    return {
      title: `Tự động lên hạng ${item.tierName || 'mới'}`,
      sub: `${item.customerName || 'Khách hàng'} • ${formatActivityTime(item.at)}`,
      dot: 'bg-[#356647]',
    }
  }

  if (item.description && item.createdAt) {
    return {
      title: item.description,
      sub: formatActivityTime(item.createdAt),
      dot: item.activityType?.toLowerCase().includes('debt')
        ? 'bg-[#7e5700]'
        : item.activityType?.toLowerCase().includes('tier')
          ? 'bg-[#356647]'
          : 'bg-[#4a6242]',
    }
  }

  const parts = []
  if (Number(item.totalAmount) > 0) parts.push(`+${formatVnd(item.totalAmount)} chi tiêu`)
  if (Number(item.debtAmount) > 0) parts.push(`+${formatVnd(item.debtAmount)} công nợ`)

  return {
    title: `Đơn ${item.orderCode || '—'} hoàn tất`,
    sub: `${item.customerName || 'Khách hàng'} • ${parts.join(' · ') || 'Cập nhật từ event'} • ${formatActivityTime(item.at)}`,
    dot: Number(item.debtAmount) > 0 ? 'bg-[#7e5700]' : 'bg-[#4a6242]',
  }
}

function CustomerActivityFeed({
  customerId,
  refreshKey = 0,
  emptyMessage = 'Chưa có hoạt động từ đơn hàng.',
  scrollable = true,
}) {
  const [items, setItems] = useState([])
  const [isLoading, setIsLoading] = useState(Boolean(customerId))

  useEffect(() => {
    let mounted = true

    async function load() {
      if (customerId) {
        try {
          setIsLoading(true)
          const activities = await fetchCustomerActivities(customerId)
          if (mounted) setItems(activities.slice(0, 12))
        } catch {
          if (mounted) setItems([])
        } finally {
          if (mounted) setIsLoading(false)
        }
        return
      }

      setItems(getCustomerIntegrationActivities(12))
      setIsLoading(false)
    }

    load()
    return () => {
      mounted = false
    }
  }, [customerId, refreshKey])

  if (isLoading) {
    return <p className="text-xs text-[#717971]">Đang tải hoạt động...</p>
  }

  if (!items.length) {
    return (
      <p className="text-xs leading-relaxed text-[#717971]">{emptyMessage}</p>
    )
  }

  return (
    <div
      className={`flex flex-col gap-4${scrollable ? ' custom-scrollbar max-h-64 overflow-y-auto' : ''}`}
    >
      {items.map((item) => {
        const view = activityPresentation(item)
        return (
          <div key={item.id} className="flex gap-3">
            <div className={`mt-2 h-2 w-2 shrink-0 rounded-full ${view.dot}`} />
            <div className="flex min-w-0 flex-col">
              <span className="text-xs font-bold text-[#1b1c17]">{view.title}</span>
              <span className="text-[10px] leading-relaxed text-[#717971]">{view.sub}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default CustomerActivityFeed
