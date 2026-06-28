import { useEffect, useState } from 'react'
import { drainSyncQueue } from '../lib/syncQueue.js'

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  useEffect(() => {
    // Drain bất kỳ đơn nào còn tồn đọng ngay khi mount (nếu đang online)
    if (navigator.onLine) drainSyncQueue()

    const handleOnline = () => {
      setIsOnline(true)
      drainSyncQueue()
    }
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return isOnline
}
