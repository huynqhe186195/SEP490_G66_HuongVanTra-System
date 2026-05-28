import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import AppTopHeader from '../../../components/shared/AppTopHeader.jsx'

const corporateStats = [
  { label: 'Total Corporate', value: '128', note: '+5% this month', noteClass: 'text-[#4a6242]' },
  { label: 'Active Contracts', value: '94', note: '8 Pending', noteClass: 'text-[#717971]' },
  { label: 'Total Receivables', value: '482M', note: 'VND', noteClass: 'text-[#7e5700]' },
  { label: 'Collection Rate', value: '92.4%', note: 'trending_up', noteClass: 'text-[#4a6242]', isIconNote: true },
]

const corporateRows = [
  {
    id: 'C-CORP-001',
    company: 'VinGroup JSC',
    email: 'vincorp@vin.com.vn',
    representative: 'Pham Nhat V.',
    taxId: '0101234567',
    debt: '125,000,000 VND',
    debtTone: 'text-[#7e5700]',
    status: 'Active',
    statusClass: 'bg-[#627b59] text-[#f8ffef]',
    icon: 'corporate_fare',
    iconClass: 'bg-[#ceebc1] text-[#354d2e]',
  },
  {
    id: 'C-CORP-002',
    company: 'FPT Software',
    email: 'contact@fsoft.fpt.vn',
    representative: 'Truong Gia B.',
    taxId: '0315987654',
    debt: '0 VND',
    debtTone: 'text-[#1b1c17]',
    status: 'Active',
    statusClass: 'bg-[#627b59] text-[#f8ffef]',
    icon: 'business',
    iconClass: 'bg-[#baefc8] text-[#1f5033]',
  },
  {
    id: 'C-CORP-003',
    company: 'The Gioi Di Dong',
    email: 'admin@tgdd.vn',
    representative: 'Nguyen Duc T.',
    taxId: '0109988776',
    debt: '45,200,000 VND',
    debtTone: 'text-[#ba1a1a]',
    status: 'Overdue',
    statusClass: 'bg-[#ffdad6] text-[#93000a]',
    icon: 'domain',
    iconClass: 'bg-[#e4e3db] text-[#717971]',
  },
  {
    id: 'C-CORP-004',
    company: 'Masan Group',
    email: 'supply@masan.com',
    representative: 'Nguyen Dang Q.',
    taxId: '0303322114',
    debt: '312,800,000 VND',
    debtTone: 'text-[#7e5700]',
    status: 'Active',
    statusClass: 'bg-[#627b59] text-[#f8ffef]',
    icon: 'factory',
    iconClass: 'bg-[#ceebc1] text-[#354d2e]',
  },
]

const vipStats = [
  {
    label: 'Total Customers',
    value: '1,284',
    note: '+12% from last month',
    noteIcon: 'trending_up',
    icon: 'group',
    toneClass: 'text-[#356647] bg-[#4e7f5e]/10',
    glow: 'bg-[#356647]/10',
  },
  {
    label: 'VIP Members',
    value: '342',
    note: 'Active Gold & Silver tiers',
    icon: 'workspace_premium',
    toneClass: 'text-[#7e5700] bg-[#fec25b]/10',
    glow: 'bg-[#7e5700]/10',
  },
  {
    label: 'New This Month',
    value: '87',
    note: 'Targeted goal: 100',
    noteIcon: 'person_add',
    icon: 'new_releases',
    toneClass: 'text-[#4a6242] bg-[#627b59]/10',
    glow: 'bg-[#4a6242]/10',
  },
]

const vipRows = [
  {
    id: 'C-VIP-001',
    name: 'Pham Thanh Tam',
    email: 'tam.pham@gmail.com',
    phone: '090 123 4567',
    tier: 'VIP GOLD',
    tierClass: 'bg-[#fec25b] text-[#744f00]',
    points: '12,450',
    spending: '45,200,000 VND',
    initials: 'PT',
    initialsClass: 'bg-[#ffdead] text-[#281900]',
  },
  {
    id: 'C-VIP-002',
    name: 'Nguyen Hong Hanh',
    email: 'hanh.ng@hotmail.com',
    phone: '098 765 4321',
    tier: 'VIP SILVER',
    tierClass: 'bg-[#e4e3db] text-[#414942] border border-[#c1c9c0]',
    points: '4,200',
    spending: '18,750,000 VND',
    initials: 'NH',
    initialsClass: 'bg-[#c1c9c0] text-[#1b1c17]',
  },
  {
    id: 'C-VIP-003',
    name: 'Le Van Quan',
    email: 'quanle88@outlook.com',
    phone: '091 234 5678',
    tier: 'VIP GOLD',
    tierClass: 'bg-[#fec25b] text-[#744f00]',
    points: '8,900',
    spending: '32,100,000 VND',
    initials: 'LV',
    initialsClass: 'bg-[#baefc8] text-[#00210f]',
  },
  {
    id: 'C-VIP-004',
    name: 'Tran Thu Ha',
    email: 'ha.tran@vmail.vn',
    phone: '097 555 1234',
    tier: 'VIP SILVER',
    tierClass: 'bg-[#e4e3db] text-[#414942] border border-[#c1c9c0]',
    points: '3,150',
    spending: '12,400,000 VND',
    initials: 'TH',
    initialsClass: 'bg-[#ceebc1] text-[#0a2007]',
  },
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
  const [activeTab, setActiveTab] = useState('corporate')

  const tabs = useMemo(
    () => [
      { key: 'vip', label: 'VIP' },
      { key: 'corporate', label: 'Corporate' },
    ],
    [],
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 [font-family:'Manrope',sans-serif]">
      <AppTopHeader searchPlaceholder="Search customers..." />

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
              {activeTab === 'corporate' ? 'New Corporate Account' : 'Add Customer'}
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
                      <th className="px-6 py-4 font-semibold">Representative</th>
                      <th className="px-6 py-4 font-semibold">Tax ID</th>
                      <th className="px-6 py-4 font-semibold">Debt (A/R)</th>
                      <th className="px-6 py-4 font-semibold">Status</th>
                      <th className="px-6 py-4 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f0eee6] text-[#1b1c17]">
                    {corporateRows.map((row) => (
                      <tr key={row.company} className="group transition-colors hover:bg-[#ffffff]">
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-3">
                            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${row.iconClass}`}>
                              <span className="material-symbols-outlined">{row.icon}</span>
                            </div>
                            <div className="flex flex-col">
                              <span className="font-bold">{row.company}</span>
                              <span className="text-xs text-[#717971]">{row.email}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-5">{row.representative}</td>
                        <td className="px-6 py-5 font-mono text-xs">{row.taxId}</td>
                        <td className="px-6 py-5">
                          <span className={`font-bold ${row.debtTone}`}>{row.debt}</span>
                        </td>
                        <td className="px-6 py-5">
                          <span className={`rounded-full px-2 py-1 text-[11px] font-bold uppercase ${row.statusClass}`}>{row.status}</span>
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                            <Link to={`/customers/${row.id}/edit`} className="p-2 text-[#717971] hover:text-[#356647]">
                              <span className="material-symbols-outlined text-sm">edit</span>
                            </Link>
                            <button type="button" className="p-2 text-[#717971] hover:text-[#356647]">
                              <span className="material-symbols-outlined text-sm">visibility</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 bg-[#f6f4ec] p-6">
                <span className="text-xs text-[#717971]">Showing 4 of 128 corporate customers</span>
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
                  <h4 className="text-2xl font-bold text-[#1b1c17]">VIP Customers</h4>
                  <span className="rounded-full bg-[#627b59]/20 px-3 py-1 text-xs text-[#4a6242]">Filter: VIP Active</span>
                </div>

                <div className="flex gap-3">
                  <button type="button" className="inline-flex items-center gap-2 rounded-lg border border-[#c1c9c0] px-4 py-2 text-sm text-[#414942] hover:bg-[#eae8e0]">
                    <span className="material-symbols-outlined text-[20px]">filter_list</span>
                    Filter
                  </button>
                  <Link to="/customers/create?type=vip" className="inline-flex items-center gap-2 rounded-lg bg-[#4a6242] px-4 py-2 text-sm text-white hover:opacity-90">
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
                      <th className="border-b border-[#f0eee6] px-6 py-4 font-semibold">Points</th>
                      <th className="border-b border-[#f0eee6] px-6 py-4 font-semibold">Total Spending</th>
                      <th className="border-b border-[#f0eee6] px-6 py-4 text-right font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {vipRows.map((row) => (
                      <tr key={row.email} className="transition-colors hover:bg-[#f6f4ec]">
                        <td className="border-b border-[#f0eee6] px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold ${row.initialsClass}`}>{row.initials}</div>
                            <div>
                              <p className="font-bold text-[#1b1c17]">{row.name}</p>
                              <p className="text-xs text-[#717971]">{row.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="border-b border-[#f0eee6] px-6 py-4 text-[#414942]">{row.phone}</td>
                        <td className="border-b border-[#f0eee6] px-6 py-4">
                          <span className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-tight ${row.tierClass}`}>{row.tier}</span>
                        </td>
                        <td className="border-b border-[#f0eee6] px-6 py-4 font-bold text-[#1b1c17]">{row.points}</td>
                        <td className="border-b border-[#f0eee6] px-6 py-4 text-lg font-bold text-[#356647]">{row.spending}</td>
                        <td className="border-b border-[#f0eee6] px-6 py-4 text-right">
                          <Link to={`/customers/${row.id}/edit`} className="rounded-full p-2 text-[#717971] transition-colors hover:bg-[#e4e3db]">
                            <span className="material-symbols-outlined">edit</span>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 p-6 text-sm text-[#414942]">
                <p>Showing 4 of 342 VIP members</p>
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