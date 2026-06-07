function CustomersTableShell({ children, minWidthClass = 'min-w-[720px] xl:min-w-[840px]' }) {
  return (
    <div className="relative hidden lg:block">
      <div className="custom-scrollbar max-h-[min(58vh,640px)] overflow-auto overscroll-contain xl:max-h-[min(68vh,760px)]">
        <div className={minWidthClass}>{children}</div>
      </div>
    </div>
  )
}

export default CustomersTableShell
