import { isVipCustomerType } from '../../customers/utils/customerDisplay.js'

function Icon({ children, className = '' }) {
  return <span className={`material-symbols-outlined ${className}`}>{children}</span>
}

export default function PosHeaderSearch({
  searchValue,
  onSearchChange,
  selectedCustomer,
  customerSearchValue,
  onCustomerSearchChange,
  customerSearchResults,
  isCustomerSearchLoading,
  showCustomerDropdown,
  showCustomerSearchEmpty,
  onSelectCustomer,
  onOpenAddCustomer,
  onOpenCustomerDetail,
  onClearCustomer,
  formatMoney,
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 lg:max-w-[min(100%,520px)]">
      <div className="relative min-w-[140px] flex-1">
        <Icon className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[18px] text-[#717971]">search</Icon>
        <input
          className="w-full rounded-lg border border-[#c1c9c0] bg-white py-2 pl-9 pr-8 text-sm outline-none focus:border-[#356647] focus:ring-1 focus:ring-[#356647]/20"
          placeholder="Tìm SP, SKU..."
          type="text"
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
        />
        <Icon className="absolute right-2 top-1/2 -translate-y-1/2 text-[18px] text-[#717971]">barcode_scanner</Icon>
      </div>

      <div className="relative min-w-[160px] flex-1">
        {selectedCustomer ? (
          <div className="flex items-center gap-1.5 rounded-lg border border-[#356647]/30 bg-[#356647]/5 px-2 py-1.5">
            <button
              type="button"
              onClick={onOpenCustomerDetail}
              className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
              title={`${selectedCustomer.fullName} · ${selectedCustomer.phone || '—'}`}
            >
              <Icon className="shrink-0 text-[18px] text-[#356647]">person</Icon>
              <span className="truncate text-sm font-semibold text-[#1b1c17]">{selectedCustomer.fullName}</span>
              {isVipCustomerType(selectedCustomer.customerType) ? (
                <span className="hidden shrink-0 rounded-full bg-[#fec25b] px-1.5 py-0.5 text-[9px] font-bold uppercase text-[#744f00] sm:inline">
                  VIP
                </span>
              ) : null}
            </button>
            <button
              type="button"
              onClick={onClearCustomer}
              className="shrink-0 rounded p-0.5 text-[#717971] hover:bg-black/5"
              aria-label="Đổi khách"
            >
              <Icon className="text-[16px]">close</Icon>
            </button>
          </div>
        ) : (
          <div className="flex gap-1">
            <div className="relative min-w-0 flex-1">
              <Icon className="absolute left-2 top-1/2 -translate-y-1/2 text-[16px] text-[#717971]">person</Icon>
              <input
                className="w-full rounded-lg border border-[#c1c9c0] bg-white py-2 pl-8 pr-2 text-sm outline-none focus:border-[#356647] focus:ring-1 focus:ring-[#356647]/20"
                placeholder="Tìm khách..."
                value={customerSearchValue}
                onChange={(event) => onCustomerSearchChange(event.target.value)}
              />
            </div>
            <button
              type="button"
              onClick={onOpenAddCustomer}
              className="shrink-0 rounded-lg bg-[#356647] px-2.5 py-2 text-xs font-bold text-white hover:bg-[#4e7f5e]"
              title="Thêm khách hàng"
            >
              <Icon className="text-[18px]">person_add</Icon>
            </button>
          </div>
        )}

        {!selectedCustomer && isCustomerSearchLoading ? (
          <p className="absolute left-0 top-full z-40 mt-0.5 text-[10px] text-[#717971]">Đang tìm...</p>
        ) : null}
        {showCustomerDropdown ? (
          <div className="custom-scrollbar absolute left-0 right-0 top-full z-50 mt-1 max-h-48 overflow-y-auto rounded-xl border border-[#c1c9c0] bg-white shadow-xl">
            {customerSearchResults.map((customer) => (
              <button
                key={customer.customerId}
                type="button"
                onClick={() => onSelectCustomer(customer)}
                className="flex w-full flex-col border-b border-[#f0eee6] px-3 py-2 text-left last:border-b-0 hover:bg-[#f6f4ec]"
              >
                <span className="text-sm font-semibold text-[#1b1c17]">{customer.fullName}</span>
                <span className="text-xs text-[#717971]">
                  {customer.phone || '—'} · {customer.customerCode}
                  {Number(customer.currentDebt) > 0 ? ` · Nợ ${formatMoney(customer.currentDebt)} đ` : ''}
                </span>
              </button>
            ))}
          </div>
        ) : null}
        {showCustomerSearchEmpty ? (
          <p className="absolute left-0 top-full z-40 mt-0.5 text-[10px] text-[#717971]">Không tìm thấy khách.</p>
        ) : null}
      </div>
    </div>
  )
}
