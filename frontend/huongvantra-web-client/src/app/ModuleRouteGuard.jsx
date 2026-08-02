import { Navigate, useLocation } from 'react-router-dom'
import { useEffect, useRef } from 'react'
import { showError } from './toast.js'
import { canAccessPath, getAccessDeniedMessage, resolveHomeRoute } from './navigation.js'

function ModuleRouteGuard({ session, isLoadingAccess, children }) {
  const location = useLocation()
  const lastDeniedPathRef = useRef(null)

  useEffect(() => {
    if (isLoadingAccess) {
      return
    }

    if (canAccessPath(session, location.pathname, location.search)) {
      lastDeniedPathRef.current = null
      return
    }

    if (lastDeniedPathRef.current === location.pathname) {
      return
    }

    lastDeniedPathRef.current = location.pathname
    showError(getAccessDeniedMessage(location.pathname))
  }, [isLoadingAccess, session, location.pathname, location.search])

  if (isLoadingAccess) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-[#707a72]">
        Đang kiểm tra quyền truy cập...
      </div>
    )
  }

  if (!canAccessPath(session, location.pathname, location.search)) {
    return <Navigate to={resolveHomeRoute(session)} replace />
  }

  return children
}

export default ModuleRouteGuard
