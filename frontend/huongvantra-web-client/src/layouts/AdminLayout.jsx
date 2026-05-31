import { Navigate, Outlet } from 'react-router-dom'
import Sidebar from '../components/shared/Sidebar.jsx'
import { getNavigationItemsForRoles } from '../app/navigation.js'
import { loadAuthSession } from '../features/auth/services/authSession.js'

function AdminLayout() {
  const authSession = loadAuthSession()
  const sidebarItems = getNavigationItemsForRoles(authSession?.roles ?? [])

  if (!authSession) {
    return <Navigate to="/login" replace />
  }

  return (
    <div className="min-h-screen bg-[#F8FAF7] text-gray-800">
      <div className="flex h-screen overflow-hidden">
        <Sidebar items={sidebarItems} />

        <main className="relative flex flex-1 flex-col overflow-auto p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default AdminLayout