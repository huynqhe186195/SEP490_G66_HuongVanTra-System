function PageShell({ children, className = '' }) {
  return (
    <div
      className={`flex min-w-0 flex-col gap-4 bg-[#fbf9f1] sm:gap-6 ${className}`.trim()}
    >
      {children}
    </div>
  )
}

export default PageShell
