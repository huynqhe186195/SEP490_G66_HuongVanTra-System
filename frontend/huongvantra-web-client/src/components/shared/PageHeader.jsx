export function TitleInfoButton({ text }) {
  if (!text) return null

  return (
    <span className="group relative inline-flex shrink-0">
      <button
        type="button"
        aria-label="Thông tin"
        className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[#7b847c] transition hover:bg-[#538463]/10 hover:text-[#356647]"
      >
        <span className="material-symbols-outlined text-[20px]">info</span>
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full z-40 mt-2 hidden w-64 -translate-x-1/2 rounded-xl border border-[#c1c9c0]/70 bg-white px-3 py-2 text-left text-xs leading-5 text-[#4a524c] shadow-[0_12px_28px_rgba(27,28,23,0.12)] group-hover:block group-focus-within:block sm:w-72"
      >
        {text}
      </span>
    </span>
  )
}

function PageHeader({
  title,
  description,
  descriptionClassName = '',
  titleInfo,
  searchPlaceholder,
  searchValue,
  onSearchChange,
  searchWide = false,
  searchCompact = false,
  searchDropdown = null,
  rightContent = null,
  inlineContent = null,
  /** Đưa tiêu đề vào vị trí nhãn đầu header, vẫn giữ nguyên kiểu chữ của tiêu đề. */
  titleAtEyebrow = false,
  /** Gọn hơn cho trang danh sách — thêm chỗ cho bảng. */
  compact = false,
  /** Giảm nhẹ chiều cao header nhưng vẫn giữ nguyên kiểu chữ và nội dung. */
  reducedVerticalPadding = false,
}) {
  const hasTitle = Boolean(title)
  const hasSearch = Boolean(searchPlaceholder)
  const hasRightContent = Boolean(rightContent)
  const hasInlineContent = Boolean(inlineContent)
  const showActionRow = hasSearch || hasRightContent
  const searchWidthClass = searchWide
    ? 'min-w-0 w-full lg:flex-1 lg:max-w-none'
    : searchCompact
      ? 'min-w-0 w-full lg:max-w-md'
      : 'min-w-0 w-full lg:max-w-xl'

  const searchInput = hasSearch ? (
    <div className={`group relative ${searchWidthClass}`}>
      <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[22px] text-[#58635b]">search</span>
      <input
        type="text"
        placeholder={searchPlaceholder}
        value={searchValue ?? undefined}
        onChange={onSearchChange ? (e) => onSearchChange(e.target.value) : undefined}
        className={`w-full rounded-full border border-[#c1c9c0]/90 bg-white pl-12 pr-5 text-[#1b1c17] shadow-[0_1px_0_rgba(255,255,255,0.8),0_8px_20px_rgba(0,0,0,0.03)] outline-none transition focus:border-[#538463] focus:ring-2 focus:ring-[#356647]/20 ${
          searchWide ? 'h-12 text-base sm:pl-14' : compact ? 'h-10 text-sm' : 'h-11 text-sm'
        }`}
      />

      {searchDropdown ? (
        <div className="custom-scrollbar absolute left-0 right-0 top-full z-50 mt-2 hidden max-h-[60vh] overflow-y-auto rounded-2xl border border-[#c1c9c0] bg-white shadow-[0_20px_40px_rgba(27,28,23,0.12)] group-focus-within:block">
          {searchDropdown}
        </div>
      ) : null}
    </div>
  ) : null

  return (
    <header
      className={
        compact
          ? 'rounded-2xl border border-[#c1c9c0]/40 bg-[linear-gradient(180deg,#fdfcf6_0%,#fbf9f1_100%)] px-4 py-3 shadow-[0_10px_30px_rgba(27,28,23,0.04)] sm:px-5'
          : `rounded-2xl border border-[#c1c9c0]/40 bg-[linear-gradient(180deg,#fdfcf6_0%,#fbf9f1_100%)] px-4 ${reducedVerticalPadding ? 'py-3 sm:px-5 sm:py-4' : 'py-4 sm:px-6 sm:py-6'} shadow-[0_10px_30px_rgba(27,28,23,0.04)] sm:rounded-[28px]`
      }
    >
      <div className={`flex flex-col ${compact ? (showActionRow ? 'gap-3' : 'gap-0') : 'gap-5'}`}>
        {hasTitle ? (
          <div className="min-w-0">
            <div className={compact ? 'space-y-1' : 'space-y-3'}>
              {compact ? null : titleAtEyebrow ? (
                <div className="flex items-center gap-3">
                  <span className="h-10 w-1 shrink-0 rounded-full bg-[#538463]" aria-hidden="true" />
                  <div className="flex min-w-0 items-center gap-2">
                    <h1 className="text-xl font-semibold leading-tight tracking-[-0.03em] text-[#1f241f] sm:text-[1.75rem] lg:text-[2rem]">
                      {title}
                    </h1>
                    <TitleInfoButton text={titleInfo} />
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <span className="h-10 w-1 rounded-full bg-[#538463]" aria-hidden="true" />
                  <span className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#7b847c]">Trang quản trị</span>
                </div>
              )}
              <div>
                {!titleAtEyebrow ? (
                  <div className="flex items-center gap-2">
                    {compact ? <span className="h-6 w-1 shrink-0 rounded-full bg-[#538463]" aria-hidden="true" /> : null}
                    <h1
                      className={
                        compact
                          ? 'text-lg font-semibold leading-tight tracking-[-0.03em] text-[#1f241f] sm:text-xl'
                          : 'text-xl font-semibold leading-tight tracking-[-0.03em] text-[#1f241f] sm:text-[1.75rem] lg:text-[2rem]'
                      }
                    >
                      {title}
                    </h1>
                    <TitleInfoButton text={titleInfo} />
                  </div>
                ) : null}
                {description ? (
                  <p className={`mt-2 max-w-3xl text-[0.95rem] leading-7 text-[#707a72] ${descriptionClassName}`.trim()}>
                    {description}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        ) : hasSearch ? (
          searchInput
        ) : null}

        {hasTitle && showActionRow ? (
          <div className={`flex flex-col gap-3 lg:flex-row lg:items-center ${hasInlineContent ? 'lg:justify-start' : 'lg:justify-between'}`}>
            {hasSearch ? (
              <div className={searchWide ? 'w-full lg:flex-1' : searchCompact ? 'w-full lg:max-w-md' : 'w-full lg:max-w-xl'}>{searchInput}</div>
            ) : (
              <div className="hidden lg:block lg:flex-1" />
            )}

            {hasInlineContent ? (
              <div className={`flex flex-wrap items-center ${compact ? 'gap-2' : 'gap-3'}`}>
                {inlineContent}
              </div>
            ) : null}

            {hasRightContent ? (
              <div className={`flex flex-wrap items-center text-[#356647] lg:justify-end ${hasInlineContent ? 'lg:ml-auto' : ''} ${compact ? 'gap-2' : 'gap-3'}`}>
                {rightContent}
              </div>
            ) : null}
          </div>
        ) : !hasTitle && hasRightContent ? (
          <div className={`flex flex-wrap items-center text-[#356647] ${compact ? 'gap-2' : 'gap-3'}`}>{rightContent}</div>
        ) : null}

      </div>
    </header>
  )
}

export default PageHeader
