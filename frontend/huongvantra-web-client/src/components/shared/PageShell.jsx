function PageShell({ children, className = '' }) {
  return (
    <div
      className={`flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-x-hidden overflow-y-auto bg-[#fbf9f1] sm:gap-6 ${className}`.trim()}
    >
      {children}
    </div>
  )
}

export default PageShell
