function CustomersTableShell({ children, minWidthClass = 'min-w-[720px] xl:min-w-[840px]' }) {
  return (
    <div className={`relative hidden lg:block ${minWidthClass}`}>
      {children}
    </div>
  )
}

export default CustomersTableShell
