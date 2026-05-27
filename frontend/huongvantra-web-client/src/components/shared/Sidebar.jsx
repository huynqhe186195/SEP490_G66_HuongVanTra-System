import { NavLink } from 'react-router-dom'

function Sidebar({ items }) {
  return (
    <aside className="m-4 flex w-64 shrink-0 flex-col rounded-3xl bg-[#538463] p-6 text-white shadow-[0_12px_40px_rgba(36,64,48,0.18)]">
      <div className="mb-10 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-yellow-50">
          <div className="h-8 w-8 rounded-lg bg-[#A7C49E]" />
        </div>
        <div>
          <h1 className="text-sm font-bold">Hương Vân Trà</h1>
          <p className="text-[10px] opacity-70">Admin System</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto pr-1">
        {items.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm transition-colors ${
                isActive ? 'bg-[#A7C49E] font-semibold text-[#538463] shadow-sm' : 'opacity-80 hover:bg-white/10'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span className={`h-1.5 w-1.5 rounded-full ${isActive ? 'bg-[#538463]' : 'bg-white/40'}`} />
                <span className="whitespace-nowrap">{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}

export default Sidebar