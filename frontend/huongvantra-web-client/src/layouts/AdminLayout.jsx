import { Outlet } from 'react-router-dom'
import Sidebar from '../components/shared/Sidebar.jsx'
import { navigationItems } from '../app/navigation.js'

function AdminLayout() {
  return (
    <div className="min-h-screen bg-[#F8FAF7] text-gray-800">
      <div className="flex h-screen overflow-hidden">
        <Sidebar items={navigationItems} />

        <main className="relative flex flex-1 flex-col overflow-auto p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default AdminLayout