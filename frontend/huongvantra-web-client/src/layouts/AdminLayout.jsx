import { useEffect, useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import ModuleRouteGuard from '../app/ModuleRouteGuard.jsx'
import Sidebar from '../components/shared/Sidebar.jsx'
import { getNavigationItemsForSession } from '../app/navigation.js'
import { enrichSessionWithAccess } from '../features/auth/services/authApi.js'
import { loadAuthSession, saveAuthSession } from '../features/auth/services/authSession.js'

function AdminLayout() {
  const [authSession, setAuthSession] = useState(() => loadAuthSession())
  const [sidebarItems, setSidebarItems] = useState(() => getNavigationItemsForSession(loadAuthSession()))
  const [isLoadingAccess, setIsLoadingAccess] = useState(() => !loadAuthSession()?.modules?.length)

  useEffect(() => {
    let isMounted = true

    const syncAccess = async () => {
      const session = loadAuthSession()
      if (!session) {
        return
      }

      if (session.modules?.length) {
        if (isMounted) {
          setSidebarItems(getNavigationItemsForSession(session))
          setIsLoadingAccess(false)
        }
        return
      }

      if (isMounted) {
        setIsLoadingAccess(true)
      }

      try {
        const enrichedSession = await enrichSessionWithAccess(session)
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

  if (!authSession) {
    return <Navigate to="/login" replace />
  }

  return (
    <div className="min-h-screen bg-[#F8FAF7] text-gray-800">
      <div className="flex h-screen overflow-hidden">
        <Sidebar items={sidebarItems} isLoading={isLoadingAccess} />

        <main className="relative flex flex-1 flex-col overflow-auto p-8">
          <ModuleRouteGuard session={authSession} isLoadingAccess={isLoadingAccess}>
            <Outlet />
          </ModuleRouteGuard>
        </main>
      </div>
    </div>
  )
}

export default AdminLayout
