function LoadingIndicator({
  label = 'Đang tải dữ liệu...',
  className = '',
  iconClassName = '',
}) {
  return (
    <div className={`flex min-h-[160px] flex-col items-center justify-center gap-3 text-center ${className}`}>
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f6f4ec] shadow-inner">
        <img
          src="/favicon.webp"
          alt=""
          className={`h-10 w-10 animate-pulse rounded-xl object-contain ${iconClassName}`}
          aria-hidden="true"
        />
      </div>
      {label ? <p className="text-sm font-semibold text-[#717971]">{label}</p> : null}
    </div>
  )
}

export default LoadingIndicator
