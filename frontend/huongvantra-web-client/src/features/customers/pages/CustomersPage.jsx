import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import PageHeader from '../../../components/shared/PageHeader.jsx'
import { showError } from '../../../app/toast.js'
import { fetchCustomers } from '../services/customersApi.js'
import {
  CUSTOMER_TYPE_BY_TAB,
  formatVnd,
  getInitials,
  getStatusDisplay,
  getTierClass,
} from '../utils/customerDisplay.js'

const corporateIcons = ['corporate_fare', 'business', 'domain', 'factory']
const corporateIconClasses = [
  'bg-[#ceebc1] text-[#354d2e]',
  'bg-[#baefc8] text-[#1f5033]',
  'bg-[#e4e3db] text-[#717971]',
  'bg-[#ceebc1] text-[#354d2e]',
]

const sectorBars = [
  { label: 'IT Services', value: 65, color: 'bg-[#9ed3ad] hover:bg-[#4e7f5e]' },
  { label: 'Retail', value: 40, color: 'bg-[#b3cea7] hover:bg-[#627b59]' },
  { label: 'Banking', value: 85, color: 'bg-[#f8bc56] hover:bg-[#fec25b]' },
  { label: 'Hospitality', value: 55, color: 'bg-[#9ed3ad] hover:bg-[#4e7f5e]' },
]

const growthBars = [
  { day: 'MON', outer: 24, inner: 'h-1/2' },
  { day: 'TUE', outer: 32, inner: 'h-2/3' },
  { day: 'WED', outer: 48, inner: 'h-3/4' },
  { day: 'THU', outer: 40, inner: 'h-1/2' },
  { day: 'FRI', outer: 56, inner: 'h-4/5' },
  { day: 'SAT', outer: 64, inner: 'h-full' },
  { day: 'SUN', outer: 44, inner: 'h-3/4' },
]

const activityFeed = [
  { title: 'New Contract Signed', sub: 'FPT Software • 2 mins ago', dot: 'bg-[#4a6242]' },
  { title: 'Debt Reminder Sent', sub: 'TG Di Dong • 1 hour ago', dot: 'bg-[#7e5700]' },
  { title: 'Account Rep Updated', sub: 'VinGroup JSC • 3 hours ago', dot: 'bg-[#356647]' },
  { title: 'Payment Confirmed', sub: 'Masan Group • Yesterday', dot: 'bg-[#4a6242]' },
]

function CustomersPage() {
  const [activeTab, setActiveTab] = useState('general')
  const [customers, setCustomers] = useState([])
  const [searchValue, setSearchValue] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  const tabs = useMemo(
    () => [
      { key: 'general', label: 'Phổ thông' },
      { key: 'vip', label: 'VIP' },
      { key: 'corporate', label: 'Corporate' },
    ],
    [],
  )

  useEffect(() => {
    let mounted = true

    const timer = setTimeout(async () => {
      try {
        setIsLoading(true)
        const data = await fetchCustomers({
          keyword: searchValue.trim() || undefined,
          customerType: CUSTOMER_TYPE_BY_TAB[activeTab],
        })
        if (mounted) setCustomers(Array.isArray(data) ? data : [])
      } catch (error) {
        if (mounted) {
          setCustomers([])
          showError(error.message)
        }
      } finally {
        if (mounted) setIsLoading(false)
      }
    }, 250)

    return () => {
      mounted = false
      clearTimeout(timer)
    }
  }, [activeTab, searchValue])

  const corporateStats = useMemo(() => {
    const activeCount = customers.filter((item) => item.status?.toUpperCase() === 'ACTIVE').length
    const totalSpend = customers.reduce((sum, item) => sum + Number(item.totalSpend || 0), 0)
    return [
      { label: 'Total Corporate', value: String(customers.length), note: 'from API', noteClass: 'text-[#4a6242]' },
      { label: 'Active Accounts', value: String(activeCount), note: `${customers.length - activeCount} inactive`, noteClass: 'text-[#717971]' },
      { label: 'Total Spending', value: formatVnd(totalSpend).replace(' VND', ''), note: 'VND', noteClass: 'text-[#7e5700]' },
      { label: 'Collection Rate', value: '—', note: 'trending_up', noteClass: 'text-[#4a6242]', isIconNote: true },
    ]
  }, [customers])

  const generalStats = useMemo(() => {
    const withTier = customers.filter((item) => item.tierCode).length
    const activeCount = customers.filter((item) => item.status?.toUpperCase() === 'ACTIVE').length
    return [
      {
        label: 'Khách phổ thông',
        value: String(customers.length),
        note: `${activeCount} active`,
        noteIcon: 'trending_up',
        icon: 'group',
        toneClass: 'text-[#356647] bg-[#4e7f5e]/10',
        glow: 'bg-[#356647]/10',
      },
      {
        label: 'Đã gán hạng',
        value: String(withTier),
        note: 'Bronze / Silver / Gold',
        icon: 'workspace_premium',
        toneClass: 'text-[#7e5700] bg-[#fec25b]/10',
        glow: 'bg-[#7e5700]/10',
      },
      {
        label: 'Total Spending',
        value: formatVnd(customers.reduce((sum, item) => sum + Number(item.totalSpend || 0), 0)).replace(' VND', ''),
        note: 'VND',
        noteIcon: 'payments',
        icon: 'new_releases',
        toneClass: 'text-[#4a6242] bg-[#627b59]/10',
        glow: 'bg-[#4a6242]/10',
      },
    ]
  }, [customers])

  const vipStats = useMemo(() => {
    const activeCount = customers.filter((item) => item.status?.toUpperCase() === 'ACTIVE').length
    return [
      {
        label: 'Khách VIP',
        value: String(customers.length),
        note: `${activeCount} active`,
        noteIcon: 'trending_up',
        icon: 'stars',
        toneClass: 'text-[#356647] bg-[#4e7f5e]/10',
        glow: 'bg-[#356647]/10',
      },
      {
        label: 'Tổng chi tiêu',
        value: formatVnd(customers.reduce((sum, item) => sum + Number(item.totalSpend || 0), 0)).replace(' VND', ''),
        note: 'VND',
        icon: 'payments',
        toneClass: 'text-[#7e5700] bg-[#fec25b]/10',
        glow: 'bg-[#7e5700]/10',
      },
      {
        label: 'Active',
        value: String(activeCount),
        note: 'Không dùng hạng B/S/G',
        icon: 'verified',
        toneClass: 'text-[#356647] bg-[#baefc8]/30',
        glow: 'bg-[#356647]/10',
      },
    ]
  }, [customers])

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 [font-family:'Manrope',sans-serif]">
      <PageHeader
        title="Khách hàng"
        description="Khách phổ thông (hạng Bronze/Silver/Gold), khách VIP và khách doanh nghiệp"
        rightContent={
          <input
            className="h-11 w-full min-w-[240px] rounded-full border border-[#c1c9c0]/90 bg-white px-4 text-sm text-[#1b1c17] outline-none focus:border-[#538463] focus:ring-2 focus:ring-[#356647]/20 lg:min-w-[320px]"
            placeholder="Tìm khách hàng..."
            type="search"
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
          />
        }
      />

      <main className="flex flex-col gap-4">
        <section className="flex flex-col gap-4 rounded-[24px] border border-[#c1c9c0]/30 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2 text-xs text-[#717971]">
            <span>Customers</span>
            <span className="material-symbols-outlined text-[14px]">chevron_right</span>
            <span className="font-semibold text-[#356647]">Management</span>
          </div>

          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div className="inline-flex w-fit gap-2 rounded-xl bg-[#f6f4ec] p-1 shadow-inner">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  className={`rounded-lg px-6 py-2 text-sm transition-all ${
                    activeTab === tab.key ? 'bg-[#4a6242] font-bold text-white shadow-sm' : 'text-[#414942] hover:bg-[#e4e3db]'
                  }`}
                  onClick={() => setActiveTab(tab.key)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <Link
              to={`/customers/create?type=${activeTab}`}
              className={`inline-flex items-center gap-2 self-start rounded-full px-6 py-2.5 text-sm font-bold transition-all active:scale-95 ${
                activeTab === 'corporate' ? 'bg-[#7e5700] text-white hover:opacity-90' : 'bg-[#4a6242] text-white hover:opacity-90'
              }`}
            >
              <span className="material-symbols-outlined">add</span>
              {activeTab === 'corporate'
                ? 'New Corporate Account'
                : activeTab === 'vip'
                  ? 'Add VIP Customer'
                  : 'Add Customer'}
            </Link>
          </div>
        </section>

        {activeTab === 'corporate' ? (
          <>
            <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
              {corporateStats.map((stat) => (
                <article key={stat.label} className="flex flex-col gap-1 rounded-2xl border border-[#f0eee6] bg-white p-5 shadow-[0px_4px_20px_rgba(0,0,0,0.04)]">
                  <span className="text-xs uppercase tracking-wider text-[#717971]">{stat.label}</span>
                  <div className="flex items-baseline gap-2">
                    <span className={`text-2xl font-bold ${stat.label === 'Total Receivables' ? 'text-[#7e5700]' : 'text-[#356647]'}`}>{stat.value}</span>
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

            <section className="overflow-hidden rounded-2xl border border-[#f0eee6] bg-white shadow-[0px_4px_20px_rgba(0,0,0,0.04)]">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#f0eee6] p-6">
                <h3 className="text-xl font-semibold text-[#1b1c17]">Corporate Customer List</h3>
                <div className="flex items-center gap-3">
                  <button type="button" className="inline-flex items-center gap-1 rounded-lg border border-[#c1c9c0] px-3 py-1.5 text-xs text-[#717971] hover:bg-[#f6f4ec]">
                    <span className="material-symbols-outlined text-sm">filter_list</span>
                    Filter
                  </button>
                  <button type="button" className="inline-flex items-center gap-1 rounded-lg border border-[#c1c9c0] px-3 py-1.5 text-xs text-[#717971] hover:bg-[#f6f4ec]">
                    <span className="material-symbols-outlined text-sm">download</span>
                    Export
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="bg-[#f6f4ec] text-xs uppercase tracking-wider text-[#717971]">
                      <th className="px-6 py-4 font-semibold">Company Name</th>
                      <th className="px-6 py-4 font-semibold">NV phụ trách</th>
                      <th className="px-6 py-4 font-semibold">Mã KH</th>
                      <th className="px-6 py-4 font-semibold">Tổng chi tiêu</th>
                      <th className="px-6 py-4 font-semibold">Status</th>
                      <th className="px-6 py-4 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f0eee6] text-[#1b1c17]">
                    {isLoading ? (
                      <tr>
                        <td className="px-6 py-8 text-center text-[#717971]" colSpan={6}>
                          Đang tải danh sách khách hàng...
                        </td>
                      </tr>
                    ) : customers.length === 0 ? (
                      <tr>
                        <td className="px-6 py-8 text-center text-[#717971]" colSpan={6}>
                          Chưa có khách hàng doanh nghiệp.
                        </td>
                      </tr>
                    ) : (
                      customers.map((row, index) => {
                        const status = getStatusDisplay(row.status)
                        const debtTone = Number(row.totalSpend) > 0 ? 'text-[#7e5700]' : 'text-[#1b1c17]'
                        return (
                          <tr key={row.customerId} className="group transition-colors hover:bg-[#ffffff]">
                            <td className="px-6 py-5">
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
                            <td className="px-6 py-5">{row.assignedEmployeeName || '—'}</td>
                            <td className="px-6 py-5 font-mono text-xs">{row.customerCode}</td>
                            <td className="px-6 py-5">
                              <span className={`font-bold ${debtTone}`}>{formatVnd(row.totalSpend)}</span>
                            </td>
                            <td className="px-6 py-5">
                              <span className={`rounded-full px-2 py-1 text-[11px] font-bold uppercase ${status.className}`}>{status.label}</span>
                            </td>
                            <td className="px-6 py-5">
                              <div className="flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                                <Link to={`/customers/${row.customerId}/edit`} className="p-2 text-[#717971] hover:text-[#356647]">
                                  <span className="material-symbols-outlined text-sm">edit</span>
                                </Link>
                              </div>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 bg-[#f6f4ec] p-6">
                <span className="text-xs text-[#717971]">Hiển thị {customers.length} khách hàng doanh nghiệp</span>
                <div className="flex gap-1">
                  <button type="button" className="flex h-8 w-8 items-center justify-center rounded text-[#717971]" disabled>
                    <span className="material-symbols-outlined text-sm">chevron_left</span>
                  </button>
                  <button type="button" className="flex h-8 w-8 items-center justify-center rounded bg-[#356647] text-xs font-bold text-white">
                    1
                  </button>
                  <button type="button" className="flex h-8 w-8 items-center justify-center rounded text-xs text-[#414942] hover:bg-white">
                    2
                  </button>
                  <button type="button" className="flex h-8 w-8 items-center justify-center rounded text-xs text-[#414942] hover:bg-white">
                    3
                  </button>
                  <button type="button" className="flex h-8 w-8 items-center justify-center rounded text-[#717971] hover:bg-white">
                    <span className="material-symbols-outlined text-sm">chevron_right</span>
                  </button>
                </div>
              </div>
            </section>

            <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <article className="rounded-2xl border border-[#f0eee6] bg-white p-5 shadow-[0px_4px_20px_rgba(0,0,0,0.04)] lg:col-span-2">
                <div className="mb-6 flex items-center justify-between">
                  <h4 className="font-bold text-[#1b1c17]">Revenue by Corporate Sector</h4>
                  <span className="material-symbols-outlined cursor-pointer text-[#717971]">more_horiz</span>
                </div>

                <div className="flex h-48 items-end gap-6 px-4">
                  {sectorBars.map((bar) => (
                    <div key={bar.label} className={`group relative flex-1 rounded-t-lg transition-all ${bar.color}`} style={{ height: `${bar.value}%` }}>
                      <div className="absolute -top-8 left-1/2 -translate-x-1/2 rounded bg-[#30312c] px-2 py-1 text-xs font-bold text-[#f3f1e9] opacity-0 transition-opacity group-hover:opacity-100">
                        {bar.value}%
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex justify-between px-2 text-[10px] font-bold uppercase text-[#717971]">
                  {sectorBars.map((bar) => (
                    <span key={bar.label}>{bar.label}</span>
                  ))}
                </div>
              </article>

              <article className="flex flex-col gap-4 rounded-2xl bg-[#f0eee6] p-5">
                <h4 className="font-bold text-[#1b1c17]">Recent Activity</h4>
                <div className="custom-scrollbar flex max-h-64 flex-col gap-4 overflow-y-auto">
                  {activityFeed.map((item) => (
                    <div key={item.title} className="flex gap-3">
                      <div className={`mt-2 h-2 w-2 rounded-full ${item.dot}`} />
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-[#1b1c17]">{item.title}</span>
                        <span className="text-[10px] text-[#717971]">{item.sub}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <button type="button" className="mt-auto inline-flex items-center gap-1 text-xs font-bold text-[#356647] hover:underline">
                  View All Activities
                  <span className="material-symbols-outlined text-xs">arrow_forward</span>
                </button>
              </article>
            </section>
          </>
        ) : activeTab === 'general' ? (
          <>
            <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {generalStats.map((stat) => (
                <article key={stat.label} className="group relative overflow-hidden rounded-xl border border-[#eae8e0] bg-white p-5 shadow-[0px_4px_20px_rgba(0,0,0,0.04)] transition-all duration-300 hover:shadow-[0px_8px_24px_rgba(0,0,0,0.08)]">
                  <div className={`absolute -right-4 -top-4 h-24 w-24 rounded-full blur-2xl ${stat.glow}`} />
                  <div className="relative flex items-start justify-between">
                    <div>
                      <p className="mb-1 text-xs uppercase tracking-widest text-[#414942]">{stat.label}</p>
                      <h3 className="text-3xl font-bold text-[#1b1c17]">{stat.value}</h3>
                      <p className="mt-2 inline-flex items-center gap-1 text-sm font-bold text-[#356647]">
                        {stat.noteIcon ? <span className="material-symbols-outlined text-[18px]">{stat.noteIcon}</span> : null}
                        {stat.note}
                      </p>
                    </div>
                    <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${stat.toneClass}`}>
                      <span className="material-symbols-outlined text-[28px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                        {stat.icon}
                      </span>
                    </div>
                  </div>
                </article>
              ))}
            </section>

            <section className="flex flex-col overflow-hidden rounded-xl border border-[#eae8e0] bg-white shadow-[0px_4px_20px_rgba(0,0,0,0.04)]">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#f0eee6] bg-[#f6f4ec]/30 p-6">
                <div className="flex items-center gap-4">
                  <h4 className="text-2xl font-bold text-[#1b1c17]">Khách phổ thông</h4>
                  <span className="rounded-full bg-[#627b59]/20 px-3 py-1 text-xs text-[#4a6242]">Hạng Bronze / Silver / Gold</span>
                </div>

                <div className="flex gap-3">
                  <button type="button" className="inline-flex items-center gap-2 rounded-lg border border-[#c1c9c0] px-4 py-2 text-sm text-[#414942] hover:bg-[#eae8e0]">
                    <span className="material-symbols-outlined text-[20px]">filter_list</span>
                    Filter
                  </button>
                  <Link to="/customers/create?type=general" className="inline-flex items-center gap-2 rounded-lg bg-[#4a6242] px-4 py-2 text-sm text-white hover:opacity-90">
                    <span className="material-symbols-outlined text-[20px]">add</span>
                    Add Customer
                  </Link>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="text-xs uppercase tracking-wider text-[#717971]">
                      <th className="border-b border-[#f0eee6] px-6 py-4 font-semibold">Name</th>
                      <th className="border-b border-[#f0eee6] px-6 py-4 font-semibold">Phone</th>
                      <th className="border-b border-[#f0eee6] px-6 py-4 font-semibold">Tier</th>
                      <th className="border-b border-[#f0eee6] px-6 py-4 font-semibold">Mã KH</th>
                      <th className="border-b border-[#f0eee6] px-6 py-4 font-semibold">Total Spending</th>
                      <th className="border-b border-[#f0eee6] px-6 py-4 text-right font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {isLoading ? (
                      <tr>
                        <td className="border-b border-[#f0eee6] px-6 py-8 text-center text-[#717971]" colSpan={6}>
                          Đang tải danh sách khách hàng...
                        </td>
                      </tr>
                    ) : customers.length === 0 ? (
                      <tr>
                        <td className="border-b border-[#f0eee6] px-6 py-8 text-center text-[#717971]" colSpan={6}>
                          Chưa có khách phổ thông.
                        </td>
                      </tr>
                    ) : (
                      customers.map((row) => (
                        <tr key={row.customerId} className="transition-colors hover:bg-[#f6f4ec]">
                          <td className="border-b border-[#f0eee6] px-6 py-4">
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
                          <td className="border-b border-[#f0eee6] px-6 py-4 text-[#414942]">{row.phone || '—'}</td>
                          <td className="border-b border-[#f0eee6] px-6 py-4">
                            <span className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-tight ${getTierClass(row.tierCode)}`}>
                              {row.tierCode || 'Chưa có hạng'}
                            </span>
                          </td>
                          <td className="border-b border-[#f0eee6] px-6 py-4 font-bold text-[#1b1c17]">{row.customerCode}</td>
                          <td className="border-b border-[#f0eee6] px-6 py-4 text-lg font-bold text-[#356647]">{formatVnd(row.totalSpend)}</td>
                          <td className="border-b border-[#f0eee6] px-6 py-4 text-right">
                            <Link to={`/customers/${row.customerId}/edit`} className="rounded-full p-2 text-[#717971] transition-colors hover:bg-[#e4e3db]">
                              <span className="material-symbols-outlined">edit</span>
                            </Link>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 p-6 text-sm text-[#414942]">
                <p>Hiển thị {customers.length} khách phổ thông</p>
                <div className="flex gap-2">
                  <button type="button" className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#c1c9c0] opacity-30" disabled>
                    <span className="material-symbols-outlined">chevron_left</span>
                  </button>
                  <button type="button" className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#356647] font-bold text-white">
                    1
                  </button>
                  <button type="button" className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#c1c9c0] hover:bg-[#f6f4ec]">
                    2
                  </button>
                  <button type="button" className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#c1c9c0] hover:bg-[#f6f4ec]">
                    3
                  </button>
                  <span className="flex items-center px-2">...</span>
                  <button type="button" className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#c1c9c0] hover:bg-[#f6f4ec]">
                    12
                  </button>
                  <button type="button" className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#c1c9c0] hover:bg-[#f6f4ec]">
                    <span className="material-symbols-outlined">chevron_right</span>
                  </button>
                </div>
              </div>
            </section>

            <section className="mt-2 grid grid-cols-1 gap-4 lg:grid-cols-12">
              <article className="flex min-h-[300px] flex-col rounded-xl border border-[#eae8e0] bg-white p-5 shadow-[0px_4px_20px_rgba(0,0,0,0.04)] lg:col-span-8">
                <div className="mb-6 flex items-center justify-between">
                  <h5 className="text-xl font-semibold text-[#1b1c17]">Customer Growth &amp; Loyalty</h5>
                  <div className="flex items-center gap-2 text-xs text-[#414942]">
                    <span className="flex items-center gap-1">
                      <span className="h-3 w-3 rounded-full bg-[#356647]" />
                      New Members
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="h-3 w-3 rounded-full bg-[#7e5700]" />
                      VIP Conversions
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
                  <h5 className="mb-2 text-xl font-semibold">Exclusive VIP Tea Tasting</h5>
                  <p className="text-sm leading-relaxed text-white/90">
                    Schedule a private session for your Gold Tier customers this weekend. Strengthen brand loyalty through premium experience.
                  </p>
                </div>

                <div className="relative mt-6">
                  <button type="button" className="w-full rounded-lg bg-white py-3 font-bold text-[#356647] shadow-sm transition-colors hover:bg-[#f6f4ec]">
                    Create Event
                  </button>
                  <p className="mt-3 text-center text-[11px] text-white/70">Next Event: Sunday, Oct 24th</p>
                </div>
              </article>
            </section>
          </>
        ) : (
          <>
            <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {vipStats.map((stat) => (
                <article key={stat.label} className="group relative overflow-hidden rounded-xl border border-[#eae8e0] bg-white p-5 shadow-[0px_4px_20px_rgba(0,0,0,0.04)] transition-all duration-300 hover:shadow-[0px_8px_24px_rgba(0,0,0,0.08)]">
                  <div className={`absolute -right-4 -top-4 h-24 w-24 rounded-full blur-2xl ${stat.glow}`} />
                  <div className="relative flex items-start justify-between">
                    <div>
                      <p className="mb-1 text-xs uppercase tracking-widest text-[#414942]">{stat.label}</p>
                      <h3 className="text-3xl font-bold text-[#1b1c17]">{stat.value}</h3>
                      <p className="mt-2 inline-flex items-center gap-1 text-sm font-bold text-[#356647]">
                        {stat.noteIcon ? <span className="material-symbols-outlined text-[18px]">{stat.noteIcon}</span> : null}
                        {stat.note}
                      </p>
                    </div>
                    <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${stat.toneClass}`}>
                      <span className="material-symbols-outlined text-[28px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                        {stat.icon}
                      </span>
                    </div>
                  </div>
                </article>
              ))}
            </section>

            <section className="flex flex-col overflow-hidden rounded-xl border border-[#eae8e0] bg-white shadow-[0px_4px_20px_rgba(0,0,0,0.04)]">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#f0eee6] bg-[#f6f4ec]/30 p-6">
                <div className="flex items-center gap-4">
                  <h4 className="text-2xl font-bold text-[#1b1c17]">Khách VIP</h4>
                  <span className="rounded-full bg-[#7e5700]/15 px-3 py-1 text-xs text-[#7e5700]">Không gán hạng B/S/G</span>
                </div>

                <div className="flex gap-3">
                  <button type="button" className="inline-flex items-center gap-2 rounded-lg border border-[#c1c9c0] px-4 py-2 text-sm text-[#414942] hover:bg-[#eae8e0]">
                    <span className="material-symbols-outlined text-[20px]">filter_list</span>
                    Filter
                  </button>
                  <Link to="/customers/create?type=vip" className="inline-flex items-center gap-2 rounded-lg bg-[#7e5700] px-4 py-2 text-sm text-white hover:opacity-90">
                    <span className="material-symbols-outlined text-[20px]">add</span>
                    Add VIP Customer
                  </Link>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="text-xs uppercase tracking-wider text-[#717971]">
                      <th className="border-b border-[#f0eee6] px-6 py-4 font-semibold">Name</th>
                      <th className="border-b border-[#f0eee6] px-6 py-4 font-semibold">Phone</th>
                      <th className="border-b border-[#f0eee6] px-6 py-4 font-semibold">Mã KH</th>
                      <th className="border-b border-[#f0eee6] px-6 py-4 font-semibold">Total Spending</th>
                      <th className="border-b border-[#f0eee6] px-6 py-4 font-semibold">Status</th>
                      <th className="border-b border-[#f0eee6] px-6 py-4 text-right font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {isLoading ? (
                      <tr>
                        <td className="border-b border-[#f0eee6] px-6 py-8 text-center text-[#717971]" colSpan={6}>
                          Đang tải danh sách khách hàng...
                        </td>
                      </tr>
                    ) : customers.length === 0 ? (
                      <tr>
                        <td className="border-b border-[#f0eee6] px-6 py-8 text-center text-[#717971]" colSpan={6}>
                          Chưa có khách VIP.
                        </td>
                      </tr>
                    ) : (
                      customers.map((row) => {
                        const status = getStatusDisplay(row.status)
                        return (
                          <tr key={row.customerId} className="transition-colors hover:bg-[#f6f4ec]">
                            <td className="border-b border-[#f0eee6] px-6 py-4">
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
                            <td className="border-b border-[#f0eee6] px-6 py-4 text-[#414942]">{row.phone || '—'}</td>
                            <td className="border-b border-[#f0eee6] px-6 py-4 font-bold text-[#1b1c17]">{row.customerCode}</td>
                            <td className="border-b border-[#f0eee6] px-6 py-4 text-lg font-bold text-[#356647]">{formatVnd(row.totalSpend)}</td>
                            <td className="border-b border-[#f0eee6] px-6 py-4">
                              <span className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-tight ${status.className}`}>
                                {status.label}
                              </span>
                            </td>
                            <td className="border-b border-[#f0eee6] px-6 py-4 text-right">
                              <Link to={`/customers/${row.customerId}/edit`} className="rounded-full p-2 text-[#717971] transition-colors hover:bg-[#e4e3db]">
                                <span className="material-symbols-outlined">edit</span>
                              </Link>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 p-6 text-sm text-[#414942]">
                <p>Hiển thị {customers.length} khách VIP</p>
              </div>
            </section>
          </>
        )}
      </main>

      <button
        type="button"
        className="group fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#7e5700] text-white shadow-2xl transition-all hover:scale-105 active:scale-95"
      >
        <span className="material-symbols-outlined text-[32px]">support_agent</span>
        <span className="pointer-events-none absolute right-16 whitespace-nowrap rounded-lg bg-[#1b1c17] px-3 py-1 text-sm text-[#fbf9f1] opacity-0 shadow-md transition-opacity group-hover:opacity-100">
          Support Center
        </span>
      </button>
    </div>
  )
}

export default CustomersPage