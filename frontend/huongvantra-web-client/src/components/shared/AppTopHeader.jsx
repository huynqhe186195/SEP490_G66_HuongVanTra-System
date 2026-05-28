function AppTopHeader({ searchPlaceholder = 'Tim kiem...', rightContent = null }) {
  return (
    <header className="rounded-[24px] border border-[#c1c9c0]/40 bg-[#fbf9f1] px-6 py-5 shadow-sm">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div className="relative w-full lg:max-w-md">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[#414942]">search</span>
          <input
            type="text"
            placeholder={searchPlaceholder}
            className="h-10 w-full rounded-full border border-[#c1c9c0] bg-[#f0eee6] pl-12 pr-4 text-sm text-[#1b1c17] outline-none focus:ring-2 focus:ring-[#356647]/30"
          />
        </div>

        {rightContent || (
          <div className="flex items-center gap-3 text-[#356647]">
            <button type="button" className="rounded-full p-2 hover:bg-[#eae8e0]">
              <span className="material-symbols-outlined">call</span>
            </button>
            <button type="button" className="relative rounded-full p-2 hover:bg-[#eae8e0]">
              <span className="material-symbols-outlined">notifications</span>
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#ba1a1a]" />
            </button>
            <button type="button" className="inline-flex items-center gap-2 rounded-full px-2 py-1 hover:bg-[#eae8e0]">
              <span className="material-symbols-outlined">account_circle</span>
              <span className="text-sm">Admin</span>
            </button>
          </div>
        )}
      </div>
    </header>
  )
}

export default AppTopHeader
