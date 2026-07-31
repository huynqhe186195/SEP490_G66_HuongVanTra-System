import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  fetchNotificationSummary,
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../services/notificationsApi.js'
import { formatDateTimeVN } from '../../../utils/vietnamDateTime.js'

const POLL_INTERVAL_MS = 60_000

export default function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0)
  const [items, setItems] = useState([])
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const dropdownRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    let mounted = true
    const load = async () => {
      try {
        const count = await fetchNotificationSummary()
        if (mounted) setUnreadCount(count)
      } catch {
        /* im lặng — badge không được phá header */
      }
    }
    void load()
    const timer = setInterval(load, POLL_INTERVAL_MS)
    return () => {
      mounted = false
      clearInterval(timer)
    }
  }, [])

  useEffect(() => {
    if (!open) return undefined
    const handler = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const loadItems = useCallback(async () => {
    setIsLoading(true)
    try {
      const result = await fetchNotifications({ page: 1, pageSize: 20 })
      setItems(result.items)
      const count = await fetchNotificationSummary()
      setUnreadCount(count)
    } catch {
      setItems([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  function toggleOpen() {
    const next = !open
    setOpen(next)
    if (next) void loadItems()
  }

  async function handleItemClick(notification) {
    setOpen(false)
    if (!notification.isRead) {
      try {
        await markNotificationRead(notification.id)
        setUnreadCount((prev) => Math.max(0, prev - 1))
      } catch {
        /* vẫn điều hướng dù đánh dấu đọc thất bại */
      }
    }
    if (notification.link) navigate(notification.link)
  }

  async function handleMarkAllRead() {
    try {
      const remaining = await markAllNotificationsRead()
      setUnreadCount(remaining)
      setItems((prev) => prev.map((item) => ({ ...item, isRead: true })))
    } catch {
      /* im lặng */
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-[#356647] transition-colors hover:bg-[#356647]/10"
        onClick={toggleOpen}
        aria-label="Thông báo"
      >
        <span className="material-symbols-outlined text-[22px]">notifications</span>
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold leading-none text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-80 rounded-xl border border-[#c1c9c0]/50 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-[#c1c9c0]/30 px-4 py-3">
            <p className="text-sm font-bold text-[#1b1c17]">Thông báo</p>
            {unreadCount > 0 && (
              <button
                type="button"
                className="text-xs font-medium text-[#356647] hover:underline"
                onClick={handleMarkAllRead}
              >
                Đánh dấu đã đọc hết
              </button>
            )}
          </div>

          <ul className="max-h-72 divide-y divide-[#c1c9c0]/20 overflow-y-auto">
            {isLoading ? (
              <li className="px-4 py-6 text-center text-xs text-[#717971]">Đang tải...</li>
            ) : items.length === 0 ? (
              <li className="px-4 py-6 text-center text-xs text-[#717971]">Chưa có thông báo nào.</li>
            ) : (
              items.map((notification) => (
                <li key={notification.id}>
                  <button
                    type="button"
                    className={`w-full px-4 py-3 text-left transition-colors hover:bg-[#f3f7f4] ${
                      notification.isRead ? '' : 'bg-[#e8f0e9]/60'
                    }`}
                    onClick={() => handleItemClick(notification)}
                  >
                    <p className="truncate text-sm font-semibold text-[#1b1c17]">{notification.title}</p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-[#414942]">{notification.body}</p>
                    <p className="mt-1 text-[11px] text-[#717971]">{formatDateTimeVN(notification.createdAt)}</p>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
