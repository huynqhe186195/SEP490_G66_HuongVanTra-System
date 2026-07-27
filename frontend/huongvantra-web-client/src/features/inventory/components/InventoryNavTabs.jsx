import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { loadAuthSession } from '../../auth/services/authSession.js'
import { getInventoryNavTabs, isInventoryNavTabActive } from '../utils/inventoryNavTabs.js'

/**
 * Menu kho dạng dropdown — gọn header.
 * @param {{ label?: string, onClick?: () => void, to?: string, icon?: string, disabled?: boolean }[]} [actions]
 */
export default function InventoryNavTabs({ actions = [] }) {
  const location = useLocation()
  const session = loadAuthSession()
  const tabs = getInventoryNavTabs(session)
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const onPointerDown = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  useEffect(() => {
    setOpen(false)
  }, [location.pathname])

  if (tabs.length === 0 && actions.length === 0) return null

  const activeTab = tabs.find((tab) => isInventoryNavTabActive(location.pathname, tab.to))

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className="material-symbols-outlined text-[18px]">menu</span>
        {activeTab?.label || 'Chức năng kho'}
        <span className="material-symbols-outlined text-[18px] text-slate-400">
          {open ? 'expand_less' : 'expand_more'}
        </span>
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-1 max-h-80 w-56 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
        >
          {tabs.map((tab) => {
            const active = isInventoryNavTabActive(location.pathname, tab.to)
            return (
              <Link
                key={tab.to}
                to={tab.to}
                role="menuitem"
                onClick={() => setOpen(false)}
                className={`flex items-center px-3.5 py-2 text-sm font-semibold ${
                  active
                    ? 'bg-[#538463]/10 text-[#356647]'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                {tab.label}
              </Link>
            )
          })}

          {actions.length > 0 ? (
            <>
              <div className="my-1 border-t border-slate-100" />
              {actions.map((action) => {
                const className =
                  'flex w-full items-center gap-2 px-3.5 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50'
                const content = (
                  <>
                    {action.icon ? (
                      <span className="material-symbols-outlined text-[18px] text-slate-500">{action.icon}</span>
                    ) : null}
                    {action.label}
                  </>
                )

                if (action.to) {
                  return (
                    <Link
                      key={action.label}
                      to={action.to}
                      role="menuitem"
                      onClick={() => setOpen(false)}
                      className={className}
                    >
                      {content}
                    </Link>
                  )
                }

                return (
                  <button
                    key={action.label}
                    type="button"
                    role="menuitem"
                    disabled={action.disabled}
                    onClick={() => {
                      setOpen(false)
                      action.onClick?.()
                    }}
                    className={className}
                  >
                    {content}
                  </button>
                )
              })}
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
