function PageHeader({
  title,
  description,
  searchPlaceholder,
  userLabel = 'Admin',
  isSyncingAuth = false,
  rightContent = null,
}) {
  const hasTitle = Boolean(title)
  const hasSearch = Boolean(searchPlaceholder)

  return (
    <header className="rounded-[24px] border border-[#c1c9c0]/40 bg-[#fbf9f1] px-6 py-5 shadow-sm">
      <div className={`flex flex-col gap-4 ${hasTitle ? 'xl:flex-row xl:items-start xl:justify-between' : 'lg:flex-row lg:items-center lg:justify-between'}`}>
        <div className="min-w-0">
          {hasTitle ? (
            <div>
              <div className="border-b-2 border-[#538463] pb-1">
                <span className="text-sm font-medium text-[#538463]">{title}</span>
              </div>
              {description ? <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#717971]">{description}</p> : null}
            </div>
          ) : hasSearch ? (
            <div className="relative w-full lg:max-w-md">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[#414942]">search</span>
              <input
                type="text"
                placeholder={searchPlaceholder}
                className="h-10 w-full rounded-full border border-[#c1c9c0] bg-[#f0eee6] pl-12 pr-4 text-sm text-[#1b1c17] outline-none focus:ring-2 focus:ring-[#356647]/30"
              />
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-3 text-[#356647]">
          {hasTitle && hasSearch ? (
            <div className="relative w-full min-w-[240px] sm:w-80">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[#414942]">search</span>
              <input
                type="text"
                placeholder={searchPlaceholder}
                className="h-10 w-full rounded-full border border-[#c1c9c0] bg-[#f0eee6] pl-12 pr-4 text-sm text-[#1b1c17] outline-none focus:ring-2 focus:ring-[#356647]/30"
              />
            </div>
          ) : null}

          <div className="hidden text-right sm:block">
            <p className="text-[11px] uppercase tracking-[0.18em] text-[#717971]">Dang nhap</p>
            <p className="text-sm font-semibold text-[#1b1c17]">{isSyncingAuth ? 'Dang dong bo...' : userLabel}</p>
          </div>

          {rightContent}
        </div>
      </div>
    </header>
  )
}

export default PageHeader