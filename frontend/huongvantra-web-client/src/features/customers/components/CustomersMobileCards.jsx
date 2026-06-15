import { Link } from 'react-router-dom'
import {
  customerTypeLabelFromType,
  formatDebtVnd,
  formatVnd,
  getDebtClass,
  getInitials,
  getMembershipTierLabel,
  getStatusDisplay,
  getTierClass,
  isCorporateCustomerType,
} from '../utils/customerDisplay.js'

function MobileField({ label, children, className = '' }) {
  return (
    <div className={`min-w-0 ${className}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[#717971]">{label}</p>
      <div className="mt-0.5 text-sm text-[#1b1c17]">{children}</div>
    </div>
  )
}

function CustomersMobileCards({
  variant = 'general',
  rows = [],
  isLoading = false,
  emptyMessage = 'Không có dữ liệu.',
  membershipTiers = [],
  renderRowActions,
  onRestore,
  restoringId,
  canEditCustomer = true,
  canEditRow,
}) {
  const resolveCanEdit = (row) =>
    typeof canEditRow === 'function' ? canEditRow(row) : canEditCustomer
  if (isLoading) {
    return (
      <p className="border-t border-[#f0eee6] px-4 py-10 text-center text-sm text-[#717971] lg:hidden">
        Đang tải danh sách...
      </p>
    )
  }

  if (!rows.length) {
    return (
      <p className="border-t border-[#f0eee6] px-4 py-10 text-center text-sm text-[#717971] lg:hidden">
        {emptyMessage}
      </p>
    )
  }

  return (
    <ul className="divide-y divide-[#f0eee6] lg:hidden">
      {rows.map((row) => {
        const status = getStatusDisplay(row.status)
        const tierLabel = getMembershipTierLabel(row)
        const rowCanEdit = resolveCanEdit(row)

        return (
          <li key={row.customerId} className="space-y-3 p-4">
            <div className="flex items-start gap-3">
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                  variant === 'inactive'
                    ? 'bg-[#ffdad6]/50 text-[#93000a]'
                    : variant === 'vip'
                      ? 'bg-[#fec25b]/30 text-[#744f00]'
                      : 'bg-[#ffdead] text-[#281900]'
                }`}
              >
                {getInitials(row.fullName)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="break-words font-bold leading-snug text-[#1b1c17]">{row.fullName}</p>
                {row.email ? <p className="truncate text-xs text-[#717971]">{row.email}</p> : null}
                {row.customerCode ? (
                  <p className="mt-1 font-mono text-[11px] font-semibold text-[#356647]">{row.customerCode}</p>
                ) : null}
              </div>
              {variant !== 'inactive' ? (
                <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold uppercase ${status.className}`}>
                  {status.label}
                </span>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-3">
              <MobileField label="Số điện thoại">{row.phone || '—'}</MobileField>

              {variant === 'general' ? (
                <MobileField label="Hạng">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ${getTierClass(tierLabel)}`}>
                    {tierLabel}
                  </span>
                </MobileField>
              ) : null}

              {variant === 'corporate' ? (
                <>
                  <MobileField label="NV phụ trách">{row.assignedEmployeeName || '—'}</MobileField>
                  <MobileField label="Loại">{customerTypeLabelFromType(row.customerType)}</MobileField>
                </>
              ) : null}

              {variant === 'inactive' ? (
                <MobileField label="Loại">{customerTypeLabelFromType(row.customerType)}</MobileField>
              ) : null}

              <MobileField label="Tổng chi tiêu">
                <span className="font-bold text-[#356647]">{formatVnd(row.totalSpend)}</span>
              </MobileField>

              <MobileField label="Công nợ">
                <span className={getDebtClass(row.currentDebt)}>{formatDebtVnd(row.currentDebt)}</span>
              </MobileField>

              {variant === 'general' && membershipTiers.length > 0 && row.tierId ? (
                <MobileField label="Ngưỡng hạng" className="col-span-2 sm:col-span-1">
                  {membershipTiers.find((t) => t.id === row.tierId)?.minTotalSpend?.toLocaleString('vi-VN') ?? '—'} đ
                </MobileField>
              ) : null}
            </div>

            {variant === 'inactive' ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${status.className}`}>
                  {status.label}
                </span>
                <button
                  type="button"
                  className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl bg-[#356647] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60 sm:flex-none"
                  disabled={restoringId === row.customerId || !rowCanEdit}
                  onClick={() => rowCanEdit && onRestore?.(row.customerId)}
                >
                  <span className="material-symbols-outlined text-[18px]">restore</span>
                  {restoringId === row.customerId ? 'Đang khôi phục...' : 'Khôi phục'}
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-1 border-t border-[#f0eee6] pt-3">
                {renderRowActions?.(row)}
                <Link
                  to={`/customers/${row.customerId}/edit`}
                  className="inline-flex items-center gap-1 rounded-lg bg-[#4a6242] px-3 py-2 text-xs font-semibold text-white hover:opacity-90"
                >
                  <span className="material-symbols-outlined text-[16px]">{rowCanEdit ? 'edit' : 'visibility'}</span>
                  {rowCanEdit ? 'Sửa' : 'Xem'}
                </Link>
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}

export default CustomersMobileCards
