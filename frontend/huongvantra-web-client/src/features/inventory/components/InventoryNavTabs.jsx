import { Link, useLocation } from 'react-router-dom'
import { loadAuthSession } from '../../auth/services/authSession.js'
import { getInventoryNavTabs, isInventoryNavTabActive } from '../utils/inventoryNavTabs.js'

export default function InventoryNavTabs() {
  const location = useLocation()
  const session = loadAuthSession()
  const tabs = getInventoryNavTabs(session)

  if (tabs.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-2">
      {tabs.map((tab) => {
        const active = isInventoryNavTabActive(location.pathname, tab.to)
        return (
          <Link
            key={tab.to}
            to={tab.to}
            className={`rounded-xl px-4 py-2 text-sm font-semibold ${
              active
                ? 'bg-[#538463] text-white'
                : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            {tab.label}
          </Link>
        )
      })}
    </div>
  )
}
