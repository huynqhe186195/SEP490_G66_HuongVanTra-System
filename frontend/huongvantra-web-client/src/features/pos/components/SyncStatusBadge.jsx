import { useEffect, useState } from 'react'
import { getPendingCount } from '../../../lib/offlineDb.js'

export default function SyncStatusBadge() {
  const [pending, setPending] = useState(0)

  useEffect(() => {
    refresh()
    window.addEventListener('hvt-sync-queue-changed', refresh)
    return () => window.removeEventListener('hvt-sync-queue-changed', refresh)
  }, [])

  function refresh(e) {
    if (e?.detail?.remaining != null) {
      setPending(e.detail.remaining)
    } else {
      getPendingCount().then(setPending)
    }
  }

  if (pending === 0) return null

  return (
    <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
      <span className="material-symbols-outlined text-sm">schedule</span>
      {pending} đơn chờ đồng bộ
    </span>
  )
}
