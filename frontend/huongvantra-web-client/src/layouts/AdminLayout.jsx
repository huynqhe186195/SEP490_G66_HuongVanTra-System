import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import ModuleRouteGuard from '../app/ModuleRouteGuard.jsx'
import SaleWeeklyShiftGate from '../features/shifts/components/SaleWeeklyShiftGate.jsx'
import StockAdjustmentBatchBar from '../features/inventory/components/StockAdjustmentBatchBar.jsx'
import NotificationBell from '../features/products/components/NotificationBell.jsx'
import OfflineBanner from '../features/pos/components/OfflineBanner.jsx'
import SyncStatusBadge from '../features/pos/components/SyncStatusBadge.jsx'
import Sidebar from '../components/shared/Sidebar.jsx'
import { getNavigationItemsForSession } from '../app/navigation.js'
import { isWarehouseUserRole, checkAuthSessionActive, syncSessionFromServer } from '../features/auth/services/authApi.js'
import {
  clearAuthSession,
  isAuthLoggingOut,
  loadAuthSession,
  saveAuthSession,
} from '../features/auth/services/authSession.js'
import { showError } from '../app/toast.js'
import { useNetworkStatus } from '../hooks/useNetworkStatus.js'
import { syncOfflineCache } from '../lib/offlineCache.js'

const OFFLINE_SYNC_INTERVAL_MS = 30 * 60 * 1000
const SESSION_CHECK_INTERVAL_MS = 20 * 1000

const SIDEBAR_COLLAPSED_KEY = 'hvt-sidebar-collapsed'
const SIDEBAR_WIDTH_KEY = 'hvt-sidebar-width'
const SIDEBAR_DEFAULT_WIDTH = 256
const SIDEBAR_MIN_WIDTH = 180
const SIDEBAR_MAX_WIDTH = 400

function readSidebarCollapsed() {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1'
  } catch {
    return false
  }
}

function readSidebarWidth() {
  try {
    const v = localStorage.getItem(SIDEBAR_WIDTH_KEY)
    if (!v) return SIDEBAR_DEFAULT_WIDTH
    const n = Number(v)
    return Number.isFinite(n) ? Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, n)) : SIDEBAR_DEFAULT_WIDTH
  } catch {
    return SIDEBAR_DEFAULT_WIDTH
  }
}

function AdminLayout() {
  const [authSession, setAuthSession] = useState(() => loadAuthSession())
  const [sidebarItems, setSidebarItems] = useState(() => getNavigationItemsForSession(loadAuthSession()))
  const [isLoadingAccess, setIsLoadingAccess] = useState(() => !loadAuthSession()?.modules?.length)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(readSidebarCollapsed)
  const [sidebarWidth, setSidebarWidth] = useState(readSidebarWidth)
  const [shiftLockMode, setShiftLockMode] = useState(null)
  const location = useLocation()
  const [lastNavPath, setLastNavPath] = useState(location.pathname)
  const isOnline = useNetworkStatus()
  const isPosPage = location.pathname === '/pos'

  // Background sync mỗi 30 phút khi online, và khi tab được focus lại
  useEffect(() => {
    if (!isOnline) return
    const permissions = authSession?.permissions ?? []
    syncOfflineCache({ permissions }).catch(() => {})
    const interval = setInterval(() => {
      if (navigator.onLine) syncOfflineCache({ permissions }).catch(() => {})
    }, OFFLINE_SYNC_INTERVAL_MS)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        syncOfflineCache({ permissions }).catch(() => {})
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [isOnline, authSession?.permissions])

  // Single-session: nếu tài khoản đăng nhập ở thiết bị khác → logout client này.
  useEffect(() => {
    if (!authSession?.accessToken) return undefined

    let cancelled = false
    const kickIfSuperseded = async () => {
      if (cancelled || document.visibilityState === 'hidden' || isAuthLoggingOut()) return
      const active = await checkAuthSessionActive()
      if (cancelled || active || isAuthLoggingOut()) return
      showError('Tài khoản đã đăng nhập ở thiết bị khác. Bạn đã bị đăng xuất.')
      clearAuthSession()
      window.location.href = '/login'
    }

    void kickIfSuperseded()
    const interval = window.setInterval(() => {
      void kickIfSuperseded()
    }, SESSION_CHECK_INTERVAL_MS)

    const onVisible = () => {
      if (document.visibilityState === 'visible') void kickIfSuperseded()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      cancelled = true
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [authSession?.accessToken])

  const toggleSidebarCollapsed = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? '1' : '0')
      } catch {
        // ignore storage errors
      }
      return next
    })
  }

  const handleSidebarWidthChange = (w) => {
    const clamped = Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, w))
    setSidebarWidth(clamped)
    try {
      localStorage.setItem(SIDEBAR_WIDTH_KEY, String(clamped))
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    let isMounted = true

    const syncAccess = async () => {
      const session = loadAuthSession()
      if (!session) {
        return
      }

      if (isMounted) {
        setIsLoadingAccess(true)
      }

      try {
        const enrichedSession = await syncSessionFromServer(session)
        saveAuthSession(enrichedSession)

        if (isMounted) {
          setAuthSession(enrichedSession)
          setSidebarItems(getNavigationItemsForSession(enrichedSession))
        }
      } catch {
        if (isMounted) {
          setSidebarItems(getNavigationItemsForSession(session))
        }
      } finally {
        if (isMounted) {
          setIsLoadingAccess(false)
        }
      }
    }

    void syncAccess()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (!mobileNavOpen) {
      return undefined
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [mobileNavOpen])

  // Đóng menu mobile khi đổi route. Điều chỉnh state ngay trong render thay vì
  // trong effect để tránh một frame trung gian còn hiển thị menu cũ.
  if (lastNavPath !== location.pathname) {
    setLastNavPath(location.pathname)
    setMobileNavOpen(false)
  }

  if (!authSession) {
    return <Navigate to="/login" replace />
  }

  const isStoreProductsPage =
    location.pathname === '/inventory/products' && !isWarehouseUserRole(authSession?.roles ?? [])
  const isViewportLocked = location.pathname === '/pos' || isStoreProductsPage

  const visibleSidebarItems =
    shiftLockMode === 'hard_block' || shiftLockMode === 'checking' || shiftLockMode === 'day_end'
      ? []
      : shiftLockMode === 'register_only' || shiftLockMode === 'off_duty'
        ? sidebarItems.filter((item) => item.path === '/my-shifts' || item.module === 'my_shifts')
        : sidebarItems

  return (
    <div className="min-h-screen bg-[#F8FAF7] text-gray-800">
      <OfflineBanner isOnline={isOnline} />
      <SaleWeeklyShiftGate session={authSession} onLockChange={setShiftLockMode}>
      <div className={`flex h-[100dvh] overflow-hidden${!isOnline ? ' pt-9' : ''}`}>
        {mobileNavOpen ? (
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/40 lg:hidden"
            aria-label="Đóng menu"
            onClick={() => setMobileNavOpen(false)}
          />
        ) : null}

        <Sidebar
          items={visibleSidebarItems}
          isLoading={isLoadingAccess}
          mobileOpen={mobileNavOpen}
          collapsed={sidebarCollapsed}
          onToggleCollapsed={toggleSidebarCollapsed}
          onNavigate={() => setMobileNavOpen(false)}
          width={sidebarCollapsed ? null : sidebarWidth}
          onWidthChange={sidebarCollapsed ? null : handleSidebarWidthChange}
        />

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <header className="flex shrink-0 items-center gap-3 border-b border-[#c1c9c0]/50 bg-[#fbf9f1] px-3 py-3 lg:hidden">
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#c1c9c0]/80 bg-white text-[#356647] shadow-sm"
              aria-label="Mở menu"
              onClick={() => setMobileNavOpen(true)}
            >
              <span className="material-symbols-outlined text-[22px]">menu</span>
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-[#1b1c17]">Hương Vân Trà</p>
              <p className="truncate text-xs text-[#717971]">Quản trị hệ thống</p>
            </div>
            {isPosPage && <SyncStatusBadge />}
            <NotificationBell />
          </header>

          <div className="hidden lg:flex shrink-0 items-center justify-end gap-2 border-b border-[#c1c9c0]/50 bg-[#fbf9f1] px-4 py-2">
            {isPosPage && <SyncStatusBadge />}
            <NotificationBell />
          </div>

          <main
            className={`relative flex min-h-0 min-w-0 flex-1 flex-col ${
              isViewportLocked
                ? 'overflow-hidden p-2 sm:p-3 lg:p-3'
                : 'custom-scrollbar overflow-y-auto overscroll-contain p-3 sm:p-4 lg:p-6 xl:p-8'
            }`}
          >
            <ModuleRouteGuard session={authSession} isLoadingAccess={isLoadingAccess}>
              <div
                className={
                  isViewportLocked
                    ? 'flex min-h-0 min-w-0 flex-1 flex-col'
                    : 'flex min-w-0 flex-col'
                }
              >
                <Outlet />
              </div>
            </ModuleRouteGuard>
          </main>
          <StockAdjustmentBatchBar />
        </div>
      </div>
      </SaleWeeklyShiftGate>
    </div>
  )
}

export default AdminLayout
