import { Navigate, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { canAccessPath, resolveHomeRoute } from './navigation.js'

function ModuleRouteGuard({ session, isLoadingAccess, children }) {
  const location = useLocation()

  useEffect(() => {
    if (isLoadingAccess) return

    if (!canAccessPath(session, location.pathname)) {
      try {
        window.alert('Bạn không có quyền truy cập trang này.')
      } catch {}
    }
  }, [isLoadingAccess, session, location.pathname])

  if (isLoadingAccess) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-[#707a72]">
        Dang kiem tra quyen truy cap...
      </div>
    )
  }

  if (!canAccessPath(session, location.pathname)) {
    return <Navigate to={resolveHomeRoute(session)} replace />
  }

  return children
}

export default ModuleRouteGuard
