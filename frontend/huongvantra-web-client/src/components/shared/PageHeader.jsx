function PageHeader({
  title,
  description,
  searchPlaceholder,
  searchValue,
  onSearchChange,
  searchDropdown = null,
  rightContent = null,
}) {
  const hasTitle = Boolean(title)
  const hasSearch = Boolean(searchPlaceholder)

  const searchInput = hasSearch ? (
    <div className={`group relative w-full ${hasTitle ? 'min-w-0 lg:max-w-xl' : 'lg:max-w-xl'}`}>
      <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[20px] text-[#58635b]">search</span>
      <input
        type="text"
        placeholder={searchPlaceholder}
        value={searchValue ?? undefined}
        onChange={onSearchChange ? (e) => onSearchChange(e.target.value) : undefined}
        className="h-11 w-full rounded-full border border-[#c1c9c0]/90 bg-white pl-12 pr-4 text-sm text-[#1b1c17] shadow-[0_1px_0_rgba(255,255,255,0.8),0_8px_20px_rgba(0,0,0,0.03)] outline-none transition focus:border-[#538463] focus:ring-2 focus:ring-[#356647]/20"
      />

      {searchDropdown ? (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 hidden max-h-[60vh] overflow-y-auto rounded-2xl border border-[#c1c9c0] bg-white shadow-[0_20px_40px_rgba(27,28,23,0.12)] group-focus-within:block">
          {searchDropdown}
        </div>
      ) : null}
    </div>
  ) : null

  return (
    <header className="rounded-2xl border border-[#c1c9c0]/40 bg-[linear-gradient(180deg,#fdfcf6_0%,#fbf9f1_100%)] px-4 py-4 shadow-[0_10px_30px_rgba(27,28,23,0.04)] sm:rounded-[28px] sm:px-6 sm:py-6">
      <div className="flex flex-col gap-5">
        {hasTitle ? (
          <div className="min-w-0">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="h-10 w-1 rounded-full bg-[#538463]" aria-hidden="true" />
                <span className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#7b847c]">Trang quản trị</span>
              </div>
              <div>
                <h1 className="text-xl font-semibold leading-tight tracking-[-0.03em] text-[#1f241f] sm:text-[1.75rem] lg:text-[2rem]">{title}</h1>
                {description ? <p className="mt-2 max-w-3xl text-[0.95rem] leading-7 text-[#707a72]">{description}</p> : null}
              </div>
            </div>
          </div>
        ) : hasSearch ? (
          searchInput
        ) : null}

        {hasTitle ? (
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="w-full lg:max-w-xl">{searchInput}</div>

            {rightContent ? (
              <div className="flex flex-wrap items-center gap-3 text-[#356647] lg:justify-end">{rightContent}</div>
            ) : null}
          </div>
        ) : rightContent ? (
          <div className="flex flex-wrap items-center gap-3 text-[#356647]">{rightContent}</div>
        ) : null}
      </div>
    </header>
  )
}

export default PageHeader