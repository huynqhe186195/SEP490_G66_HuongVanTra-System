import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import PageHeader from '../../../components/shared/PageHeader.jsx'
import PageShell from '../../../components/shared/PageShell.jsx'
import TablePagination, { TABLE_PAGE_SIZE } from '../../../components/shared/TablePagination.jsx'
import { showError, showSuccess } from '../../../app/toast.js'
import { loadAuthSession } from '../../auth/services/authSession.js'
import { canEditCustomer } from '../../auth/utils/permissions.js'
import CustomerActivityFeed from '../components/CustomerActivityFeed.jsx'
import CustomersTableShell from '../components/CustomersTableShell.jsx'
import CustomersMobileCards from '../components/CustomersMobileCards.jsx'
import { useCustomersList } from '../hooks/useCustomersList.js'
import { fetchMembershipTiers, fetchCustomerStatistics, restoreCustomer } from '../services/customersApi.js'
import { TIER_READONLY_HINT } from '../utils/membershipTierUtils.js'
import {
  formatDebtVnd,
  formatVnd,
  getDebtClass,
  getInitials,
  getStatusDisplay,
  getTierClass,
  customerTypeLabelFromType,
  getMembershipTierLabel,
  CUSTOMER_LIST_TABS,
  CUSTOMER_CORPORATE_ENABLED,
} from '../utils/customerDisplay.js'

const corporateIcons = ['corporate_fare', 'business', 'domain', 'factory']
const corporateIconClasses = [
  'bg-[#ceebc1] text-[#354d2e]',
  'bg-[#baefc8] text-[#1f5033]',
  'bg-[#e4e3db] text-[#717971]',
  'bg-[#ceebc1] text-[#354d2e]',
]

const sectorBars = [
  { label: 'CNTT', value: 65, color: 'bg-[#9ed3ad] hover:bg-[#4e7f5e]' },
  { label: 'Bán lẻ', value: 40, color: 'bg-[#b3cea7] hover:bg-[#627b59]' },
  { label: 'Ngân hàng', value: 85, color: 'bg-[#f8bc56] hover:bg-[#fec25b]' },
  { label: 'Khách sạn & F&B', value: 55, color: 'bg-[#9ed3ad] hover:bg-[#4e7f5e]' },
]

const TABLE_HEAD = 'border-b border-[#f0eee6] px-3 py-3 text-[10px] font-semibold uppercase tracking-wide sm:px-6 sm:py-4 sm:text-xs sm:tracking-wider'
const TABLE_CELL = 'border-b border-[#f0eee6] px-3 py-3 sm:px-6 sm:py-4'
const TABLE_CELL_RIGHT = `${TABLE_CELL} text-right`
const TABLE_EMPTY = 'border-b border-[#f0eee6] px-4 py-8 text-center text-[#717971] sm:px-6'
const CORP_TABLE_HEAD = 'px-3 py-3 text-[10px] font-semibold uppercase tracking-wide sm:px-6 sm:py-4 sm:text-xs'
const CORP_TABLE_CELL = 'px-3 py-3 sm:px-6 sm:py-5'

const growthBars = [
  { day: 'MON', outer: 24, inner: 'h-1/2' },
  { day: 'TUE', outer: 32, inner: 'h-2/3' },
  { day: 'WED', outer: 48, inner: 'h-3/4' },
  { day: 'THU', outer: 40, inner: 'h-1/2' },
  { day: 'FRI', outer: 56, inner: 'h-4/5' },
  { day: 'SAT', outer: 64, inner: 'h-full' },
  { day: 'SUN', outer: 44, inner: 'h-3/4' },
]

function CustomersPage() {
  const session = useMemo(() => loadAuthSession(), [])
  const canManageCustomers = canEditCustomer(session)
  const [activeTab, setActiveTab] = useState('general')
  const [searchValue, setSearchValue] = useState('')
  const [tierFilter, setTierFilter] = useState('')
  const [debtFilter, setDebtFilter] = useState('')
  const [sortBy, setSortBy] = useState('')
  const [filterOpen, setFilterOpen] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(TABLE_PAGE_SIZE)
  const [membershipTiers, setMembershipTiers] = useState([])
  const [statistics, setStatistics] = useState(null)
  const [activityRefreshKey, setActivityRefreshKey] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [restoringId, setRestoringId] = useState(null)

  const { customers, isLoading, reload } = useCustomersList({
    activeTab,
    searchValue,
    tierFilter,
    debtFilter,
    sortBy,
    pollIntervalMs: 30000,
  })

  const hasActiveFilters = Boolean(tierFilter || debtFilter || sortBy)

  function handleFilterChange(setter) {
    return (event) => {
      setPage(1)
      setter(event.target.value)
    }
  }

  function clearFilters() {
    setPage(1)
    setTierFilter('')
    setDebtFilter('')
    setSortBy('')
  }

  const tabs = useMemo(() => CUSTOMER_LIST_TABS, [])

  useEffect(() => {
    if (!CUSTOMER_CORPORATE_ENABLED && activeTab === 'corporate') {
      setActiveTab('general')
    }
  }, [activeTab])

  useEffect(() => {
    let mounted = true
    Promise.all([fetchMembershipTiers(), loadStatistics()])
      .then(([tiers]) => {
        if (!mounted) return
        setMembershipTiers(Array.isArray(tiers) ? tiers : [])
      })
      .catch(() => {
        if (mounted) {
          setMembershipTiers([])
        }
      })
    return () => {
      mounted = false
    }
  }, [])

  async function loadStatistics() {
    try {
      const stats = await fetchCustomerStatistics()
      setStatistics(stats)
      return stats
    } catch {
      setStatistics(null)
      return null
    }
  }

  useEffect(() => {
    setPage(1)
  }, [activeTab, searchValue, tierFilter, debtFilter, sortBy])

  useEffect(() => {
    setTierFilter('')
    setDebtFilter('')
    setSortBy('')
    setFilterOpen(false)
  }, [activeTab])

  async function handleManualRefresh() {
    try {
      setIsRefreshing(true)
      await Promise.all([reload(), loadStatistics()])
    } catch (error) {
      showError(error.message)
    } finally {
      setIsRefreshing(false)
    }
  }

  async function handleRestore(customerId) {
    if (!window.confirm('Khôi phục khách hàng này? Khách sẽ xuất hiện lại trong danh sách đang hoạt động.')) return
    try {
      setRestoringId(customerId)
      await restoreCustomer(customerId)
      showSuccess('Đã khôi phục khách hàng.')
      await reload()
    } catch (error) {
      showError(error.message)
    } finally {
      setRestoringId(null)
    }
  }

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(customers.length / pageSize))
    if (page > totalPages) {
      setPage(totalPages)
    }
  }, [customers.length, page, pageSize])

  const paginatedCustomers = useMemo(() => {
    const start = (page - 1) * pageSize
    return customers.slice(start, start + pageSize)
  }, [customers, page, pageSize])

  const corporateStats = useMemo(() => {
    const activeCount = customers.filter((item) => item.status?.toUpperCase() === 'ACTIVE').length
    const totalSpend = customers.reduce((sum, item) => sum + Number(item.totalSpend || 0), 0)
    const totalDebt = customers.reduce((sum, item) => sum + Number(item.currentDebt || 0), 0)
    const withDebt = customers.filter((item) => Number(item.currentDebt) > 0).length
    return [
      { label: 'Tổng KH doanh nghiệp', value: String(customers.length), note: 'từ hệ thống', noteClass: 'text-[#4a6242]' },
      { label: 'Đang hoạt động', value: String(activeCount), note: `${customers.length - activeCount} ngừng hoạt động`, noteClass: 'text-[#717971]' },
      { label: 'Tổng công nợ', value: formatDebtVnd(totalDebt).replace(' VND', ''), note: `${withDebt} KH đang nợ`, noteClass: 'text-[#7e5700]', highlight: true },
      { label: 'Tổng chi tiêu', value: formatVnd(totalSpend).replace(' VND', ''), note: 'VND', noteClass: 'text-[#356647]' },
    ]
  }, [customers])

  const generalStats = useMemo(() => {
    const withTier = customers.filter((item) => item.tierCode).length
    const activeCount = customers.filter((item) => item.status?.toUpperCase() === 'ACTIVE').length
    const tierSummary = statistics?.customersByTier?.length
      ? statistics.customersByTier.map((t) => `${t.tierName}: ${t.count}`).join(' · ')
      : 'Member / Silver / Gold / Diamond'
    return [
      {
        label: 'Khách phổ thông',
        value: String(customers.length),
        note: statistics ? `${statistics.newCustomersThisMonth} mới tháng này (toàn hệ thống)` : `${activeCount} đang hoạt động`,
        noteIcon: 'trending_up',
        icon: 'group',
        toneClass: 'text-[#356647] bg-[#4e7f5e]/10',
        glow: 'bg-[#356647]/10',
      },
      {
        label: 'Đã gán hạng',
        value: String(withTier),
        note: tierSummary,
        icon: 'workspace_premium',
        toneClass: 'text-[#7e5700] bg-[#fec25b]/10',
        glow: 'bg-[#7e5700]/10',
      },
      {
        label: 'Tổng công nợ',
        value: formatDebtVnd(customers.reduce((sum, item) => sum + Number(item.currentDebt || 0), 0)).replace(' VND', ''),
        note: `${customers.filter((item) => Number(item.currentDebt) > 0).length} khách còn nợ`,
        noteIcon: 'account_balance_wallet',
        icon: 'payments',
        toneClass: 'text-[#7e5700] bg-[#fec25b]/10',
        glow: 'bg-[#7e5700]/10',
      },
    ]
  }, [customers, statistics])

  const vipStats = useMemo(() => {
    const activeCount = customers.filter((item) => item.status?.toUpperCase() === 'ACTIVE').length
    return [
      {
        label: 'Khách VIP',
        value: String(customers.length),
        note: `${activeCount} đang hoạt động`,
        noteIcon: 'trending_up',
        icon: 'stars',
        toneClass: 'text-[#356647] bg-[#4e7f5e]/10',
        glow: 'bg-[#356647]/10',
      },
      {
        label: 'Tổng công nợ',
        value: formatDebtVnd(customers.reduce((sum, item) => sum + Number(item.currentDebt || 0), 0)).replace(' VND', ''),
        note: 'đơn chưa thu đủ',
        icon: 'account_balance_wallet',
        toneClass: 'text-[#7e5700] bg-[#fec25b]/10',
        glow: 'bg-[#7e5700]/10',
      },
      {
        label: 'Đang hoạt động',
        value: String(activeCount),
        note: 'Không dùng hạng B/S/G',
        icon: 'verified',
        toneClass: 'text-[#356647] bg-[#baefc8]/30',
        glow: 'bg-[#356647]/10',
      },
    ]
  }, [customers])

  return (
    <PageShell className="min-w-0 [font-family:'Manrope',sans-serif]">
      <PageHeader
        title="Khách hàng"
        description="Khách phổ thông và VIP"
        descriptionClassName="hidden sm:block"
        searchPlaceholder="Tìm theo tên, SĐT"
        searchWide
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        rightContent={
          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-row">
            <Link
              to="/customers/addresses"
              className="inline-flex h-11 items-center justify-center gap-1 rounded-full border border-[#356647]/30 bg-white px-3 text-xs font-semibold text-[#356647] hover:bg-[#356647]/5 sm:h-12 sm:px-5 sm:text-sm"
            >
              <span className="material-symbols-outlined text-[18px] sm:text-[20px]">location_on</span>
              <span className="truncate sm:hidden">Địa chỉ</span>
              <span className="hidden truncate sm:inline">Địa chỉ giao hàng</span>
            </Link>
            <button
              type="button"
              title="Làm mới danh sách (đồng bộ sau integration event)"
              className="inline-flex h-11 items-center justify-center gap-1 rounded-full border border-[#356647]/30 bg-white px-3 text-xs font-semibold text-[#356647] hover:bg-[#356647]/5 disabled:opacity-60 sm:h-12 sm:px-5 sm:text-sm"
              disabled={isRefreshing || isLoading}
              onClick={handleManualRefresh}
            >
              <span className={`material-symbols-outlined text-[18px] sm:text-[20px] ${isRefreshing ? 'animate-spin' : ''}`}>sync</span>
              Làm mới
            </button>
          </div>
        }
      />

      <div className="flex w-full min-w-0 flex-col gap-3 pb-6 sm:gap-4 sm:pb-8">
        <section className="flex min-w-0 flex-col gap-3 rounded-2xl border border-[#c1c9c0]/30 bg-white p-3 shadow-sm sm:gap-4 sm:rounded-[24px] sm:p-4 lg:p-6">
          <div className="flex items-center gap-2 text-xs text-[#717971]">
            <span>Khách hàng</span>
            <span className="material-symbols-outlined text-[14px]">chevron_right</span>
            <span className="font-semibold text-[#356647]">Quản lý</span>
          </div>

          <div className={`grid grid-cols-1 gap-2 min-[420px]:grid-cols-2 ${tabs.length >= 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  className={`min-h-[44px] rounded-lg px-3 py-2.5 text-left text-xs leading-snug transition-all sm:px-4 sm:text-sm lg:text-center ${
                    activeTab === tab.key ? 'bg-[#4a6242] font-bold text-white shadow-sm' : 'bg-[#f6f4ec] text-[#414942] hover:bg-[#e4e3db]'
                  }`}
                  onClick={() => setActiveTab(tab.key)}
                >
                  <span className="sm:hidden">{tab.shortLabel}</span>
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              ))}
          </div>

          {activeTab !== 'inactive' ? (
            <div className="flex flex-col gap-3 border-t border-[#eae8e0] pt-4">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm transition-colors ${
                    filterOpen || hasActiveFilters
                      ? 'border-[#356647] bg-[#356647]/10 text-[#356647]'
                      : 'border-[#c1c9c0] text-[#414942] hover:bg-[#eae8e0]'
                  }`}
                  onClick={() => setFilterOpen((open) => !open)}
                >
                  <span className="material-symbols-outlined text-[20px]">filter_list</span>
                  Lọc
                  {hasActiveFilters ? (
                    <span className="rounded-full bg-[#356647] px-2 py-0.5 text-[10px] font-bold text-white">Đang lọc</span>
                  ) : null}
                </button>

                {hasActiveFilters ? (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-[#717971] hover:bg-[#eae8e0]"
                    onClick={clearFilters}
                  >
                    <span className="material-symbols-outlined text-[18px]">close</span>
                    Xóa lọc
                  </button>
                ) : null}
              </div>

              {filterOpen ? (
                <div className="flex flex-col gap-3 rounded-xl border border-[#c1c9c0]/40 bg-[#f6f4ec]/50 p-3 sm:flex-row sm:flex-wrap sm:items-center sm:p-4">
                  {activeTab === 'general' ? (
                    <select
                      className="w-full rounded-lg border border-[#c1c9c0] bg-white px-4 py-2.5 text-sm text-[#414942] outline-none focus:border-[#356647] sm:min-w-[180px] sm:flex-1"
                      value={tierFilter}
                      onChange={handleFilterChange(setTierFilter)}
                    >
                      <option value="">Tất cả hạng</option>
                      {membershipTiers.map((tier) => (
                        <option key={tier.id} value={tier.tierCode}>
                          {tier.tierCode}
                        </option>
                      ))}
                    </select>
                  ) : null}

                  <select
                    className="w-full rounded-lg border border-[#c1c9c0] bg-white px-4 py-2.5 text-sm text-[#414942] outline-none focus:border-[#356647] sm:min-w-[180px] sm:flex-1"
                    value={debtFilter}
                    onChange={handleFilterChange(setDebtFilter)}
                  >
                    <option value="">Tất cả công nợ</option>
                    <option value="with_debt">Còn công nợ</option>
                    <option value="no_debt">Không nợ</option>
                  </select>

                  <select
                    className="w-full rounded-lg border border-[#c1c9c0] bg-white px-4 py-2.5 text-sm text-[#414942] outline-none focus:border-[#356647] sm:min-w-[180px] sm:flex-1"
                    value={sortBy}
                    onChange={handleFilterChange(setSortBy)}
                  >
                    <option value="">Sắp xếp mặc định</option>
                    <option value="name">Theo tên A → Z</option>
                    <option value="spend">Chi tiêu cao → thấp</option>
                    <option value="debt">Công nợ cao → thấp</option>
                  </select>
                </div>
              ) : null}
            </div>
          ) : null}
        </section>

        {activeTab === 'inactive' ? (
          <section className="flex flex-col rounded-xl border border-[#eae8e0] bg-white shadow-[0px_4px_20px_rgba(0,0,0,0.04)]">
            <div className="flex flex-col gap-2 border-b border-[#f0eee6] bg-[#fff5f5] p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:p-6">
              <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
                <h4 className="text-lg font-bold text-[#1b1c17] sm:text-xl lg:text-2xl">Khách đã ngừng hoạt động</h4>
                <span className="w-fit rounded-full bg-[#93000a]/10 px-2.5 py-1 text-[10px] text-[#93000a] sm:px-3 sm:text-xs">Xóa mềm — có thể khôi phục</span>
              </div>
            </div>

            <CustomersMobileCards
              variant="inactive"
              rows={paginatedCustomers}
              isLoading={isLoading}
              emptyMessage="Không có khách hàng đã ngừng hoạt động."
              onRestore={canManageCustomers ? handleRestore : undefined}
              restoringId={restoringId}
              canEditCustomer={canManageCustomers}
            />

            <CustomersTableShell minWidthClass="min-w-[960px]">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="text-xs uppercase tracking-wider text-[#717971]">
                    <th className={`${TABLE_HEAD} font-semibold`}>Mã KH</th>
                    <th className={`${TABLE_HEAD} font-semibold`}>Tên</th>
                    <th className={`${TABLE_HEAD} font-semibold`}>Loại</th>
                    <th className={`${TABLE_HEAD} font-semibold`}>Số điện thoại</th>
                    <th className={`${TABLE_HEAD} font-semibold`}>Tổng chi tiêu</th>
                    <th className={`${TABLE_HEAD} font-semibold`}>Công nợ</th>
                    <th className={`${TABLE_HEAD} font-semibold`}>Trạng thái</th>
                    <th className={`${TABLE_HEAD} text-right font-semibold`}>Thao tác</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {isLoading ? (
                    <tr>
                      <td className={TABLE_EMPTY} colSpan={8}>
                        Đang tải danh sách...
                      </td>
                    </tr>
                  ) : customers.length === 0 ? (
                    <tr>
                      <td className={TABLE_EMPTY} colSpan={8}>
                        Không có khách hàng đã ngừng hoạt động.
                      </td>
                    </tr>
                  ) : (
                    paginatedCustomers.map((row) => {
                      const status = getStatusDisplay(row.status)
                      return (
                        <tr key={row.customerId} className="transition-colors hover:bg-[#fffafa]">
                          <td className={`${TABLE_CELL} font-mono text-xs font-bold text-[#356647]`}>
                            {row.customerCode || '—'}
                          </td>
                          <td className={TABLE_CELL}>
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#ffdad6]/50 text-sm font-bold text-[#93000a]">
                                {getInitials(row.fullName)}
                              </div>
                              <div>
                                <p className="font-bold text-[#1b1c17]">{row.fullName}</p>
                                <p className="text-xs text-[#717971]">{row.email || '—'}</p>
                              </div>
                            </div>
                          </td>
                          <td className={`${TABLE_CELL} text-[#414942]`}>
                            {customerTypeLabelFromType(row.customerType)}
                          </td>
                          <td className={`${TABLE_CELL} text-[#414942]`}>{row.phone || '—'}</td>
                          <td className={`${TABLE_CELL} font-bold text-[#356647]`}>{formatVnd(row.totalSpend)}</td>
                          <td className={TABLE_CELL}>
                            <span className={getDebtClass(row.currentDebt)}>{formatDebtVnd(row.currentDebt)}</span>
                          </td>
                          <td className={TABLE_CELL}>
                            <span className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-tight ${status.className}`}>
                              {status.label}
                            </span>
                          </td>
                          <td className={TABLE_CELL_RIGHT}>
                            {canManageCustomers ? (
                              <button
                                type="button"
                                className="inline-flex items-center gap-1 rounded-full bg-[#356647] px-4 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60"
                                disabled={restoringId === row.customerId}
                                onClick={() => handleRestore(row.customerId)}
                              >
                                <span className="material-symbols-outlined text-[16px]">restore</span>
                                {restoringId === row.customerId ? 'Đang khôi phục...' : 'Khôi phục'}
                              </button>
                            ) : (
                              <span className="text-xs text-[#717971]">—</span>
                            )}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </CustomersTableShell>

            <TablePagination
              page={page}
              pageSize={pageSize}
              totalCount={customers.length}
              itemLabel="khách hàng"
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </section>
        ) : activeTab === 'corporate' && CUSTOMER_CORPORATE_ENABLED ? (
          <>
            <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 md:grid-cols-4">
              {corporateStats.map((stat) => (
                <article key={stat.label} className="flex min-w-0 flex-col gap-1 rounded-2xl border border-[#f0eee6] bg-white p-4 shadow-[0px_4px_20px_rgba(0,0,0,0.04)] sm:p-5">
                  <span className="text-[10px] uppercase tracking-wider text-[#717971] sm:text-xs">{stat.label}</span>
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <span className={`text-xl font-bold sm:text-2xl ${stat.highlight ? 'text-[#7e5700]' : 'text-[#356647]'}`}>{stat.value}</span>
                    {stat.isIconNote ? (
                      <span className={`inline-flex items-center gap-1 text-xs font-bold ${stat.noteClass}`}>
                        <span className="material-symbols-outlined text-[16px]">{stat.note}</span>
                      </span>
                    ) : (
                      <span className={`text-xs font-bold ${stat.noteClass}`}>{stat.note}</span>
                    )}
                  </div>
                </article>
              ))}
            </section>

            <section className="rounded-2xl border border-[#f0eee6] bg-white shadow-[0px_4px_20px_rgba(0,0,0,0.04)]">
              <div className="flex flex-col gap-3 border-b border-[#f0eee6] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                <h3 className="text-lg font-semibold text-[#1b1c17] sm:text-xl">Danh sách khách doanh nghiệp</h3>
                <div className="flex items-center gap-3">
                  <button type="button" className="inline-flex items-center gap-1 rounded-lg border border-[#c1c9c0] px-3 py-1.5 text-xs text-[#717971] hover:bg-[#f6f4ec]">
                    <span className="material-symbols-outlined text-sm">download</span>
                    Xuất Excel
                  </button>
                </div>
              </div>

              <CustomersMobileCards
                variant="corporate"
                rows={paginatedCustomers}
                isLoading={isLoading}
                emptyMessage="Chưa có khách hàng doanh nghiệp."
                canEditCustomer={canManageCustomers}
              />

              <CustomersTableShell minWidthClass="min-w-[900px]">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="bg-[#f6f4ec] text-xs uppercase tracking-wider text-[#717971]">
                      <th className={`${CORP_TABLE_HEAD} font-semibold`}>Tên công ty</th>
                      <th className={`${CORP_TABLE_HEAD} font-semibold`}>NV phụ trách</th>
                      <th className={`${CORP_TABLE_HEAD} font-semibold`}>Mã KH</th>
                      <th className={`${CORP_TABLE_HEAD} font-semibold`}>Tổng chi tiêu</th>
                      <th className={`${CORP_TABLE_HEAD} font-semibold`}>Công nợ</th>
                      <th className={`${CORP_TABLE_HEAD} font-semibold`}>Trạng thái</th>
                      <th className={`${CORP_TABLE_HEAD} font-semibold`}>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f0eee6] text-[#1b1c17]">
                    {isLoading ? (
                      <tr>
                        <td className={`${TABLE_EMPTY} border-0`} colSpan={7}>
                          Đang tải danh sách khách hàng...
                        </td>
                      </tr>
                    ) : customers.length === 0 ? (
                      <tr>
                        <td className={`${TABLE_EMPTY} border-0`} colSpan={7}>
                          Chưa có khách hàng doanh nghiệp.
                        </td>
                      </tr>
                    ) : (
                      paginatedCustomers.map((row, index) => {
                        const status = getStatusDisplay(row.status)
                        return (
                          <tr key={row.customerId} className="group transition-colors hover:bg-[#ffffff]">
                            <td className={CORP_TABLE_CELL}>
                              <div className="flex items-center gap-3">
                                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${corporateIconClasses[index % corporateIconClasses.length]}`}>
                                  <span className="material-symbols-outlined">{corporateIcons[index % corporateIcons.length]}</span>
                                </div>
                                <div className="flex flex-col">
                                  <span className="font-bold">{row.fullName}</span>
                                  <span className="text-xs text-[#717971]">{row.email || '—'}</span>
                                </div>
                              </div>
                            </td>
                            <td className={CORP_TABLE_CELL}>{row.assignedEmployeeName || '—'}</td>
                            <td className={`${CORP_TABLE_CELL} font-mono text-xs`}>{row.customerCode}</td>
                            <td className={`${CORP_TABLE_CELL} font-bold text-[#356647]`}>{formatVnd(row.totalSpend)}</td>
                            <td className={CORP_TABLE_CELL}>
                              <span className={getDebtClass(row.currentDebt)}>{formatDebtVnd(row.currentDebt)}</span>
                            </td>
                            <td className={CORP_TABLE_CELL}>
                              <span className={`rounded-full px-2 py-1 text-[11px] font-bold uppercase ${status.className}`}>{status.label}</span>
                            </td>
                            <td className={CORP_TABLE_CELL}>
                              <div className="flex items-center gap-1 sm:gap-2">
                                <Link to={`/customers/${row.customerId}/edit`} className="p-2 text-[#717971] hover:text-[#356647]" title={canManageCustomers ? 'Sửa' : 'Xem'}>
                                  <span className="material-symbols-outlined text-sm">{canManageCustomers ? 'edit' : 'visibility'}</span>
                                </Link>
                              </div>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </CustomersTableShell>

            <TablePagination
              page={page}
              pageSize={pageSize}
              totalCount={customers.length}
                itemLabel="khách hàng"
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
            </section>

            <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <article className="rounded-2xl border border-[#f0eee6] bg-white p-5 shadow-[0px_4px_20px_rgba(0,0,0,0.04)] lg:col-span-2">
                <div className="mb-6 flex items-center justify-between">
                  <h4 className="font-bold text-[#1b1c17]">Doanh thu theo ngành</h4>
                  <span className="material-symbols-outlined cursor-pointer text-[#717971]">more_horiz</span>
                </div>

                <div className="custom-scrollbar overflow-x-auto pb-1">
                  <div className="flex h-40 min-w-[280px] items-end gap-2 px-1 sm:h-48 sm:gap-4 sm:px-4">
                  {sectorBars.map((bar) => (
                    <div key={bar.label} className={`group relative min-w-[44px] flex-1 rounded-t-lg transition-all ${bar.color}`} style={{ height: `${bar.value}%` }}>
                      <div className="absolute -top-8 left-1/2 -translate-x-1/2 rounded bg-[#30312c] px-2 py-1 text-xs font-bold text-[#f3f1e9] opacity-0 transition-opacity group-hover:opacity-100">
                        {bar.value}%
                      </div>
                    </div>
                  ))}
                  </div>
                </div>

                <div className="mt-4 flex min-w-[280px] justify-between gap-1 px-1 text-[9px] font-bold uppercase text-[#717971] sm:px-2 sm:text-[10px]">
                  {sectorBars.map((bar) => (
                    <span key={bar.label}>{bar.label}</span>
                  ))}
                </div>
              </article>

              <article className="flex flex-col gap-4 rounded-2xl bg-[#f0eee6] p-5">
                <h4 className="font-bold text-[#1b1c17]">Hoạt động từ đơn hàng (event)</h4>
                <CustomerActivityFeed
                  refreshKey={activityRefreshKey}
                  emptyMessage="Chưa có hoạt động từ đơn hàng hoàn tất."
                  scrollable={false}
                />
              </article>
            </section>
          </>
        ) : activeTab === 'general' ? (
          <>
            <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
              {generalStats.map((stat) => (
                <article key={stat.label} className="group relative min-w-0 overflow-hidden rounded-xl border border-[#eae8e0] bg-white p-4 shadow-[0px_4px_20px_rgba(0,0,0,0.04)] sm:p-5 transition-all duration-300 hover:shadow-[0px_8px_24px_rgba(0,0,0,0.08)]">
                  <div className={`absolute -right-4 -top-4 h-24 w-24 rounded-full blur-2xl ${stat.glow}`} />
                  <div className="relative flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="mb-1 text-[10px] uppercase tracking-widest text-[#414942] sm:text-xs">{stat.label}</p>
                      <h3 className="text-2xl font-bold text-[#1b1c17] sm:text-3xl">{stat.value}</h3>
                      <p className="mt-2 line-clamp-3 text-xs font-bold text-[#356647] sm:text-sm">
                        {stat.noteIcon ? <span className="material-symbols-outlined align-middle text-[16px] sm:text-[18px]">{stat.noteIcon}</span> : null}{' '}
                        {stat.note}
                      </p>
                    </div>
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg sm:h-12 sm:w-12 ${stat.toneClass}`}>
                      <span className="material-symbols-outlined text-[24px] sm:text-[28px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                        {stat.icon}
                      </span>
                    </div>
                  </div>
                </article>
              ))}
            </section>

            {statistics ? (
              <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <article className="rounded-xl border border-[#eae8e0] bg-white p-4 shadow-sm sm:p-5">
                  <div className="mb-4 flex items-center justify-between gap-2">
                    <h4 className="font-bold text-[#1b1c17]">Top chi tiêu cao</h4>
                    <span className="text-xs text-[#717971]">Toàn hệ thống · {statistics.totalCustomers} khách</span>
                  </div>
                  {statistics.topSpenders?.length ? (
                    <ul className="space-y-2">
                      {statistics.topSpenders.map((item, index) => (
                        <li key={item.customerId} className="flex items-center justify-between gap-3 rounded-lg bg-[#f6f4ec]/70 px-3 py-2">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#356647]/15 text-xs font-bold text-[#356647]">
                              {index + 1}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-[#1b1c17]">{item.fullName}</p>
                              <p className="text-[11px] text-[#717971]">{item.customerCode || '—'}</p>
                            </div>
                          </div>
                          <span className="shrink-0 text-sm font-bold text-[#356647]">{formatVnd(item.totalSpend)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-[#717971]">Chưa có dữ liệu chi tiêu.</p>
                  )}
                </article>

                <article className="rounded-xl border border-[#eae8e0] bg-white p-4 shadow-sm sm:p-5">
                  <div className="mb-4 flex items-center justify-between gap-2">
                    <h4 className="font-bold text-[#1b1c17]">Khách nợ nhiều nhất</h4>
                    <span className="text-xs text-[#717971]">{statistics.newCustomersThisMonth} khách mới tháng này</span>
                  </div>
                  {statistics.topDebtors?.length ? (
                    <ul className="space-y-2">
                      {statistics.topDebtors.map((item, index) => (
                        <li key={item.customerId} className="flex items-center justify-between gap-3 rounded-lg bg-[#f6f4ec]/70 px-3 py-2">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#7e5700]/15 text-xs font-bold text-[#7e5700]">
                              {index + 1}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-[#1b1c17]">{item.fullName}</p>
                              <p className="text-[11px] text-[#717971]">{item.phone || '—'}</p>
                            </div>
                          </div>
                          <span className={`shrink-0 text-sm font-bold ${getDebtClass(item.currentDebt)}`}>
                            {formatDebtVnd(item.currentDebt)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-[#717971]">Không có khách đang nợ.</p>
                  )}
                </article>
              </section>
            ) : null}

            <section className="flex flex-col rounded-xl border border-[#eae8e0] bg-white shadow-[0px_4px_20px_rgba(0,0,0,0.04)]">
              <div className="flex flex-col gap-3 border-b border-[#f0eee6] bg-[#f6f4ec]/30 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center lg:gap-4">
                  <h4 className="text-lg font-bold text-[#1b1c17] sm:text-xl lg:text-2xl">Khách phổ thông</h4>
                  <span className="w-fit rounded-full bg-[#627b59]/20 px-2.5 py-1 text-[10px] text-[#4a6242] sm:px-3 sm:text-xs">
                    Hạng Member / Silver / Gold / Diamond
                  </span>
                  <span className="hidden max-w-md text-xs text-[#717971] xl:inline" title={TIER_READONLY_HINT}>
                    Hạng do hệ thống quản lý
                  </span>
                </div>

                {canManageCustomers ? (
                  <div className="flex w-full sm:w-auto">
                    <Link to="/customers/create?type=general" className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#4a6242] px-4 py-2.5 text-sm text-white hover:opacity-90 sm:w-auto">
                      <span className="material-symbols-outlined text-[20px]">add</span>
                      Thêm khách hàng
                    </Link>
                  </div>
                ) : null}
              </div>

              <CustomersMobileCards
                variant="general"
                rows={paginatedCustomers}
                isLoading={isLoading}
                emptyMessage="Chưa có khách phổ thông."
                membershipTiers={membershipTiers}
                canEditCustomer={canManageCustomers}
              />

              <CustomersTableShell>
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="text-xs uppercase tracking-wider text-[#717971]">
                      <th className={`${TABLE_HEAD} font-semibold`}>Tên</th>
                      <th className={`${TABLE_HEAD} font-semibold`}>Số điện thoại</th>
                      <th className={`${TABLE_HEAD} font-semibold`}>Hạng</th>
                      <th className={`${TABLE_HEAD} font-semibold`}>Mã KH</th>
                      <th className={`${TABLE_HEAD} font-semibold`}>Tổng chi tiêu</th>
                      <th className={`${TABLE_HEAD} font-semibold`}>Công nợ</th>
                      <th className={`${TABLE_HEAD} text-right font-semibold`}>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {isLoading ? (
                      <tr>
                        <td className={TABLE_EMPTY} colSpan={7}>
                          Đang tải danh sách khách hàng...
                        </td>
                      </tr>
                    ) : customers.length === 0 ? (
                      <tr>
                        <td className={TABLE_EMPTY} colSpan={7}>
                          Chưa có khách phổ thông.
                        </td>
                      </tr>
                    ) : (
                      paginatedCustomers.map((row) => (
                        <tr key={row.customerId} className="transition-colors hover:bg-[#f6f4ec]">
                          <td className={TABLE_CELL}>
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#ffdead] text-sm font-bold text-[#281900]">
                                {getInitials(row.fullName)}
                              </div>
                              <div>
                                <p className="font-bold text-[#1b1c17]">{row.fullName}</p>
                                <p className="text-xs text-[#717971]">{row.email || '—'}</p>
                              </div>
                            </div>
                          </td>
                          <td className={`${TABLE_CELL} text-[#414942]`}>{row.phone || '—'}</td>
                          <td className={TABLE_CELL}>
                            <span className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-tight ${getTierClass(getMembershipTierLabel(row))}`}>
                              {getMembershipTierLabel(row)}
                            </span>
                            {row.tierDiscountPercent > 0 ? (
                              <p className="mt-1 text-xs text-[#356647]">Chiết khấu {row.tierDiscountPercent}%</p>
                            ) : null}
                            {membershipTiers.length > 0 && row.tierId ? (
                              <p className="mt-0.5 text-[10px] text-[#717971]">
                                Ngưỡng{' '}
                                {membershipTiers.find((t) => t.id === row.tierId)?.minTotalSpend?.toLocaleString('vi-VN') ??
                                  '—'}{' '}
                                đ
                              </p>
                            ) : null}
                          </td>
                          <td className={`${TABLE_CELL} font-bold text-[#1b1c17]`}>{row.customerCode}</td>
                          <td className={`${TABLE_CELL} text-base font-bold text-[#356647] sm:text-lg`}>{formatVnd(row.totalSpend)}</td>
                          <td className={TABLE_CELL}>
                            <span className={getDebtClass(row.currentDebt)}>{formatDebtVnd(row.currentDebt)}</span>
                          </td>
                          <td className={TABLE_CELL_RIGHT}>
                            <div className="inline-flex items-center justify-end gap-1">
                              <Link to={`/customers/${row.customerId}/edit`} className="rounded-full p-2 text-[#717971] transition-colors hover:bg-[#e4e3db]" title={canManageCustomers ? 'Sửa' : 'Xem'}>
                                <span className="material-symbols-outlined">{canManageCustomers ? 'edit' : 'visibility'}</span>
                              </Link>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </CustomersTableShell>

            <TablePagination
              page={page}
              pageSize={pageSize}
              totalCount={customers.length}
                itemLabel="khách hàng"
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />

              <div className="border-t border-[#f0eee6] bg-[#f6f4ec]/40 p-3 sm:p-6">
                <h5 className="mb-3 text-sm font-bold text-[#1b1c17]">Hoạt động từ đơn hàng (integration event)</h5>
                <CustomerActivityFeed
                  refreshKey={activityRefreshKey}
                  emptyMessage="Chưa có hoạt động từ đơn hàng hoàn tất."
                  scrollable={false}
                />
              </div>
            </section>

            {/* <section className="mt-2 grid grid-cols-1 gap-4 lg:grid-cols-12">
              <article className="flex min-h-[300px] flex-col rounded-xl border border-[#eae8e0] bg-white p-5 shadow-[0px_4px_20px_rgba(0,0,0,0.04)] lg:col-span-8">
                <div className="mb-6 flex items-center justify-between">
                  <h5 className="text-xl font-semibold text-[#1b1c17]">Tăng trưởng &amp; gắn kết khách hàng</h5>
                  <div className="flex items-center gap-2 text-xs text-[#414942]">
                    <span className="flex items-center gap-1">
                      <span className="h-3 w-3 rounded-full bg-[#356647]" />
                      Thành viên mới
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="h-3 w-3 rounded-full bg-[#7e5700]" />
                      Chuyển VIP
                    </span>
                  </div>
                </div>

                <div className="flex flex-1 items-end justify-between gap-4 px-2">
                  {growthBars.map((bar) => (
                    <div key={bar.day} className="flex flex-1 flex-col items-center">
                      <div className="group relative w-full rounded-t-lg bg-[#356647]/10" style={{ height: `${bar.outer * 4}px` }}>
                        <div className={`absolute bottom-0 left-0 w-full rounded-t-lg bg-[#356647]/40 transition-all group-hover:bg-[#356647] ${bar.inner}`} />
                      </div>
                      <span className="mt-2 text-[10px] text-[#717971]">{bar.day}</span>
                    </div>
                  ))}
                </div>
              </article>

              <article className="relative flex flex-col justify-between overflow-hidden rounded-xl bg-[#356647] p-5 text-white shadow-lg lg:col-span-4">
                <div className="absolute -bottom-10 -right-10 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
                <div className="relative">
                  <h5 className="mb-2 text-xl font-semibold">Thử trà VIP riêng tư</h5>
                  <p className="text-sm leading-relaxed text-white/90">
                    Đặt buổi trải nghiệm cho khách hạng Gold cuối tuần này — tăng gắn kết thương hiệu qua trải nghiệm cao cấp.
                  </p>
                </div>

                <div className="relative mt-6">
                  <button type="button" className="w-full rounded-lg bg-white py-3 font-bold text-[#356647] shadow-sm transition-colors hover:bg-[#f6f4ec]">
                    Tạo sự kiện
                  </button>
                  <p className="mt-3 text-center text-[11px] text-white/70">Sự kiện tiếp: Chủ nhật, 24/10</p>
                </div>
              </article>
            </section> */}
          </>
        ) : (
          <>
            <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
              {vipStats.map((stat) => (
                <article key={stat.label} className="group relative min-w-0 overflow-hidden rounded-xl border border-[#eae8e0] bg-white p-4 shadow-[0px_4px_20px_rgba(0,0,0,0.04)] sm:p-5 transition-all duration-300 hover:shadow-[0px_8px_24px_rgba(0,0,0,0.08)]">
                  <div className={`absolute -right-4 -top-4 h-24 w-24 rounded-full blur-2xl ${stat.glow}`} />
                  <div className="relative flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="mb-1 text-[10px] uppercase tracking-widest text-[#414942] sm:text-xs">{stat.label}</p>
                      <h3 className="text-2xl font-bold text-[#1b1c17] sm:text-3xl">{stat.value}</h3>
                      <p className="mt-2 line-clamp-2 text-xs font-bold text-[#356647] sm:text-sm">
                        {stat.noteIcon ? <span className="material-symbols-outlined align-middle text-[16px] sm:text-[18px]">{stat.noteIcon}</span> : null}{' '}
                        {stat.note}
                      </p>
                    </div>
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg sm:h-12 sm:w-12 ${stat.toneClass}`}>
                      <span className="material-symbols-outlined text-[24px] sm:text-[28px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                        {stat.icon}
                      </span>
                    </div>
                  </div>
                </article>
              ))}
            </section>

            <section className="flex flex-col rounded-xl border border-[#eae8e0] bg-white shadow-[0px_4px_20px_rgba(0,0,0,0.04)]">
              <div className="flex flex-col gap-3 border-b border-[#f0eee6] bg-[#f6f4ec]/30 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
                  <h4 className="text-lg font-bold text-[#1b1c17] sm:text-xl lg:text-2xl">Khách VIP</h4>
                  <span className="w-fit rounded-full bg-[#7e5700]/15 px-2.5 py-1 text-[10px] leading-snug text-[#7e5700] sm:px-3 sm:text-xs">
                    Không hạng B/S/G · không chiết khấu hạng
                  </span>
                </div>

                {canManageCustomers ? (
                  <div className="flex w-full sm:w-auto">
                    <Link to="/customers/create?type=vip" className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#7e5700] px-4 py-2.5 text-sm text-white hover:opacity-90 sm:w-auto">
                      <span className="material-symbols-outlined text-[20px]">add</span>
                      Thêm khách VIP
                    </Link>
                  </div>
                ) : null}
              </div>

              <CustomersMobileCards
                variant="vip"
                rows={paginatedCustomers}
                isLoading={isLoading}
                emptyMessage="Chưa có khách VIP."
                canEditCustomer={canManageCustomers}
              />

              <CustomersTableShell>
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="text-xs uppercase tracking-wider text-[#717971]">
                      <th className={`${TABLE_HEAD} font-semibold`}>Tên</th>
                      <th className={`${TABLE_HEAD} font-semibold`}>Số điện thoại</th>
                      <th className={`${TABLE_HEAD} font-semibold`}>Mã KH</th>
                      <th className={`${TABLE_HEAD} font-semibold`}>Tổng chi tiêu</th>
                      <th className={`${TABLE_HEAD} font-semibold`}>Công nợ</th>
                      <th className={`${TABLE_HEAD} font-semibold`}>Trạng thái</th>
                      <th className={`${TABLE_HEAD} text-right font-semibold`}>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {isLoading ? (
                      <tr>
                        <td className={TABLE_EMPTY} colSpan={7}>
                          Đang tải danh sách khách hàng...
                        </td>
                      </tr>
                    ) : customers.length === 0 ? (
                      <tr>
                        <td className={TABLE_EMPTY} colSpan={7}>
                          Chưa có khách VIP.
                        </td>
                      </tr>
                    ) : (
                      paginatedCustomers.map((row) => {
                        const status = getStatusDisplay(row.status)
                        return (
                          <tr key={row.customerId} className="transition-colors hover:bg-[#f6f4ec]">
                            <td className={TABLE_CELL}>
                              <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#fec25b]/30 text-sm font-bold text-[#744f00]">
                                  {getInitials(row.fullName)}
                                </div>
                                <div>
                                  <p className="font-bold text-[#1b1c17]">{row.fullName}</p>
                                  <p className="text-xs text-[#717971]">{row.email || '—'}</p>
                                </div>
                              </div>
                            </td>
                            <td className={`${TABLE_CELL} text-[#414942]`}>{row.phone || '—'}</td>
                            <td className={`${TABLE_CELL} font-bold text-[#1b1c17]`}>{row.customerCode}</td>
                            <td className={`${TABLE_CELL} text-base font-bold text-[#356647] sm:text-lg`}>{formatVnd(row.totalSpend)}</td>
                            <td className={TABLE_CELL}>
                              <span className={getDebtClass(row.currentDebt)}>{formatDebtVnd(row.currentDebt)}</span>
                            </td>
                            <td className={TABLE_CELL}>
                              <span className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-tight ${status.className}`}>
                                {status.label}
                              </span>
                            </td>
                            <td className={TABLE_CELL_RIGHT}>
                              <div className="inline-flex items-center justify-end gap-1">
                                <Link to={`/customers/${row.customerId}/edit`} className="rounded-full p-2 text-[#717971] transition-colors hover:bg-[#e4e3db]" title={canManageCustomers ? 'Sửa' : 'Xem'}>
                                  <span className="material-symbols-outlined">{canManageCustomers ? 'edit' : 'visibility'}</span>
                                </Link>
                              </div>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </CustomersTableShell>

            <TablePagination
              page={page}
              pageSize={pageSize}
              totalCount={customers.length}
                itemLabel="khách hàng"
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
            </section>
          </>
        )}
      </div>

      <button
        type="button"
        className="group fixed bottom-4 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-[#7e5700] text-white shadow-2xl transition-all hover:scale-105 active:scale-95 sm:bottom-6 sm:right-6 sm:h-14 sm:w-14"
      >
        <span className="material-symbols-outlined text-[28px] sm:text-[32px]">support_agent</span>
        <span className="pointer-events-none absolute right-16 whitespace-nowrap rounded-lg bg-[#1b1c17] px-3 py-1 text-sm text-[#fbf9f1] opacity-0 shadow-md transition-opacity group-hover:opacity-100">
          Support Center
        </span>
      </button>
    </PageShell>
  )
}

export default CustomersPage
