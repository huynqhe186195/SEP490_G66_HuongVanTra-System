import { useEffect, useState } from 'react'
import { getMeta } from '../../../lib/offlineDb.js'
import { syncOfflineCache } from '../../../lib/offlineCache.js'
import { loadAuthSession } from '../../auth/services/authSession.js'

export default function OfflineReadyBadge() {
  const [lastSync, setLastSync] = useState(null)
  const [isSyncing, setIsSyncing] = useState(false)

  useEffect(() => {
    getMeta('lastProductSync').then(ts => setLastSync(ts))
  }, [])

  async function handleSync() {
    setIsSyncing(true)
    const permissions = loadAuthSession()?.permissions ?? []
    try {
      await syncOfflineCache({ permissions })
      const ts = await getMeta('lastProductSync')
      setLastSync(ts)
    } finally {
      setIsSyncing(false)
    }
  }

  const timeLabel = lastSync
    ? new Date(lastSync).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <button
      onClick={handleSync}
      disabled={isSyncing}
      title="Chuẩn bị dữ liệu offline"
      className="flex items-center gap-1 rounded-full border border-[#c1c9c0] bg-white px-2 py-1 text-xs text-[#356647] hover:bg-[#e8f5e9] disabled:opacity-50"
    >
      <span className="material-symbols-outlined text-sm">
        {isSyncing ? 'sync' : 'cloud_done'}
      </span>
      {isSyncing ? 'Đang sync...' : timeLabel ? `Sync ${timeLabel}` : 'Chuẩn bị offline'}
    </button>
  )
}
