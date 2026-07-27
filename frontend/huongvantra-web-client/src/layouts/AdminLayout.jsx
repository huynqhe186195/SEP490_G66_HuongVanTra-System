import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import ModuleRouteGuard from '../app/ModuleRouteGuard.jsx'
import SaleWeeklyShiftGate from '../features/shifts/components/SaleWeeklyShiftGate.jsx'
import StockAdjustmentBatchBar from '../features/inventory/components/StockAdjustmentBatchBar.jsx'
import LowStockBadge from '../features/inventory/components/LowStockBadge.jsx'
import OfflineBanner from '../features/pos/components/OfflineBanner.jsx'
import SyncStatusBadge from '../features/pos/components/SyncStatusBadge.jsx'
import Sidebar from '../components/shared/Sidebar.jsx'
import { getNavigationItemsForSession } from '../app/navigation.js'
import { isWarehouseUserRole } from '../features/auth/services/authApi.js'
import { syncSessionFromServer } from '../features/auth/services/authApi.js'
import { loadAuthSession, saveAuthSession } from '../features/auth/services/authSession.js'
import { useNetworkStatus } from '../hooks/useNetworkStatus.js'
import { syncOfflineCache } from '../lib/offlineCache.js'
import { canAccessModule } from '../app/navigation.js'

const OFFLINE_SYNC_INTERVAL_MS = 30 * 60 * 1000

const SIDEBAR_COLLAPSED_KEY = 'hvt-sidebar-collapsed'

function readSidebarCollapsed() {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1'
  } catch {
    return false
  }
}

function AdminLayout() {
  const [authSession, setAuthSession] = useState(() => loadAuthSession())
  const [sidebarItems, setSidebarItems] = useState(() => getNavigationItemsForSession(loadAuthSession()))
  const [isLoadingAccess, setIsLoadingAccess] = useState(() => !loadAuthSession()?.modules?.length)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(readSidebarCollapsed)
  const [shiftLockMode, setShiftLockMode] = useState(null)
  const location = useLocation()
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
  }, [isOnline])

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

  useEffect(() => {
    setMobileNavOpen(false)
  }, [location.pathname])

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
            {isWarehouseUserRole(authSession?.roles ?? []) && <LowStockBadge />}
          </header>

          {(isWarehouseUserRole(authSession?.roles ?? []) || isPosPage) && (
            <div className="hidden lg:flex shrink-0 items-center justify-end gap-2 border-b border-[#c1c9c0]/50 bg-[#fbf9f1] px-4 py-2">
              {isPosPage && <SyncStatusBadge />}
              {isWarehouseUserRole(authSession?.roles ?? []) && <LowStockBadge />}
            </div>
          )}

          <main
            className={`relative flex min-h-0 min-w-0 flex-1 flex-col p-3 sm:p-4 lg:p-6 xl:p-8 ${
              isViewportLocked
                ? 'overflow-hidden'
                : 'custom-scrollbar overflow-y-auto overscroll-contain'
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
