import { useEffect, useState } from 'react'
import { getMeta } from '../../../lib/offlineDb.js'

export default function OfflineBanner({ isOnline }) {
  const [lastSync, setLastSync] = useState(null)

  useEffect(() => {
    if (isOnline) return
    getMeta('lastProductSync').then(ts => setLastSync(ts))

    const handler = () => getMeta('lastProductSync').then(ts => setLastSync(ts))
    window.addEventListener('hvt-offline-cache-updated', handler)
    return () => window.removeEventListener('hvt-offline-cache-updated', handler)
  }, [isOnline])

  if (isOnline) return null

  const timeLabel = lastSync
    ? new Date(lastSync).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-2 bg-amber-400 px-4 py-2 text-sm font-medium text-amber-900">
      <span className="material-symbols-outlined text-base">wifi_off</span>
      Đang offline —
      {timeLabel
        ? ` Dữ liệu cập nhật lúc ${timeLabel}. Chỉ nhận tiền mặt.`
        : ' Chưa có dữ liệu offline. Chỉ nhận tiền mặt.'}
      {' '}Đơn sẽ được đồng bộ khi có mạng.
    </div>
  )
}
