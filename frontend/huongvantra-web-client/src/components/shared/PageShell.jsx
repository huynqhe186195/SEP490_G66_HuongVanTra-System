function PageShell({ children, className = '' }) {
  return (
    <div
      className={`flex min-w-0 flex-col gap-2 bg-[#fbf9f1] sm:gap-3 ${className}`.trim()}
    >
      {children}
    </div>
  )
}

export default PageShell
