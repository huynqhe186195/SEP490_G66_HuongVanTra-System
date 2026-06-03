import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import PageHeader from '../../../components/shared/PageHeader.jsx'
import TablePagination, { TABLE_PAGE_SIZE } from '../../../components/shared/TablePagination.jsx'
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
  { label: 'CNTT', value: 65, color: 'bg-[#9ed3ad] hover:bg-[#4e7f5e]' },
  { label: 'Bán lẻ', value: 40, color: 'bg-[#b3cea7] hover:bg-[#627b59]' },
  { label: 'Ngân hàng', value: 85, color: 'bg-[#f8bc56] hover:bg-[#fec25b]' },
  { label: 'Khách sạn & F&B', value: 55, color: 'bg-[#9ed3ad] hover:bg-[#4e7f5e]' },
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
  { title: 'Ký hợp đồng mới', sub: 'FPT Software • 2 phút trước', dot: 'bg-[#4a6242]' },
  { title: 'Đã gửi nhắc nợ', sub: 'TG Di Động • 1 giờ trước', dot: 'bg-[#7e5700]' },
  { title: 'Cập nhật NV phụ trách', sub: 'VinGroup JSC • 3 giờ trước', dot: 'bg-[#356647]' },
  { title: 'Xác nhận thanh toán', sub: 'Masan Group • Hôm qua', dot: 'bg-[#4a6242]' },
]

function CustomersPage() {
  const [activeTab, setActiveTab] = useState('general')
  const [customers, setCustomers] = useState([])
  const [searchValue, setSearchValue] = useState('')
  const [page, setPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)

  const tabs = useMemo(
    () => [
      { key: 'general', label: 'Phổ thông' },
      { key: 'vip', label: 'VIP' },
      { key: 'corporate', label: 'Doanh nghiệp' },
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

  useEffect(() => {
    setPage(1)
  }, [activeTab, searchValue])

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(customers.length / TABLE_PAGE_SIZE))
    if (page > totalPages) {
      setPage(totalPages)
    }
  }, [customers.length, page])

  const paginatedCustomers = useMemo(() => {
    const start = (page - 1) * TABLE_PAGE_SIZE
    return customers.slice(start, start + TABLE_PAGE_SIZE)
  }, [customers, page])

  const corporateStats = useMemo(() => {
    const activeCount = customers.filter((item) => item.status?.toUpperCase() === 'ACTIVE').length
    const totalSpend = customers.reduce((sum, item) => sum + Number(item.totalSpend || 0), 0)
    return [
      { label: 'Tổng KH doanh nghiệp', value: String(customers.length), note: 'từ hệ thống', noteClass: 'text-[#4a6242]' },
      { label: 'Đang hoạt động', value: String(activeCount), note: `${customers.length - activeCount} ngừng HĐ`, noteClass: 'text-[#717971]' },
      { label: 'Tổng chi tiêu', value: formatVnd(totalSpend).replace(' VND', ''), note: 'VND', noteClass: 'text-[#7e5700]' },
      { label: 'Tỷ lệ thu hồi', value: '—', note: 'trending_up', noteClass: 'text-[#4a6242]', isIconNote: true },
    ]
  }, [customers])

  const generalStats = useMemo(() => {
    const withTier = customers.filter((item) => item.tierCode).length
    const activeCount = customers.filter((item) => item.status?.toUpperCase() === 'ACTIVE').length
    return [
      {
        label: 'Khách phổ thông',
        value: String(customers.length),
        note: `${activeCount} đang hoạt động`,
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
        label: 'Tổng chi tiêu',
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
        note: `${activeCount} đang hoạt động`,
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
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 sm:gap-6 [font-family:'Manrope',sans-serif]">
      <PageHeader
        title="Khách hàng"
        description="Khách phổ thông (hạng Bronze/Silver/Gold), khách VIP và khách doanh nghiệp"
        rightContent={
          <input
            className="h-11 w-full max-w-full rounded-full border border-[#c1c9c0]/90 bg-white px-4 text-sm text-[#1b1c17] outline-none focus:border-[#538463] focus:ring-2 focus:ring-[#356647]/20 lg:max-w-[320px]"
            placeholder="Tìm khách hàng..."
            type="search"
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
          />
        }
      />

      <main className="flex flex-col gap-4">
        <section className="flex flex-col gap-4 rounded-[24px] border border-[#c1c9c0]/30 bg-white p-4 shadow-sm sm:p-6">
          <div className="flex items-center gap-2 text-xs text-[#717971]">
            <span>Khách hàng</span>
            <span className="material-symbols-outlined text-[14px]">chevron_right</span>
            <span className="font-semibold text-[#356647]">Quản lý</span>
          </div>

          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div className="inline-flex max-w-full gap-2 overflow-x-auto rounded-xl bg-[#f6f4ec] p-1 shadow-inner no-scrollbar">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  className={`shrink-0 rounded-lg px-4 py-2 text-sm transition-all sm:px-6 ${
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
                ? 'Thêm khách doanh nghiệp'
                : activeTab === 'vip'
                  ? 'Thêm khách VIP'
                  : 'Thêm khách hàng'}
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
                <h3 className="text-xl font-semibold text-[#1b1c17]">Danh sách khách doanh nghiệp</h3>
                <div className="flex items-center gap-3">
                  <button type="button" className="inline-flex items-center gap-1 rounded-lg border border-[#c1c9c0] px-3 py-1.5 text-xs text-[#717971] hover:bg-[#f6f4ec]">
                    <span className="material-symbols-outlined text-sm">filter_list</span>
                    Lọc
                  </button>
                  <button type="button" className="inline-flex items-center gap-1 rounded-lg border border-[#c1c9c0] px-3 py-1.5 text-xs text-[#717971] hover:bg-[#f6f4ec]">
                    <span className="material-symbols-outlined text-sm">download</span>
                    Xuất Excel
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="bg-[#f6f4ec] text-xs uppercase tracking-wider text-[#717971]">
                      <th className="px-6 py-4 font-semibold">Tên công ty</th>
                      <th className="px-6 py-4 font-semibold">NV phụ trách</th>
                      <th className="px-6 py-4 font-semibold">Mã KH</th>
                      <th className="px-6 py-4 font-semibold">Tổng chi tiêu</th>
                      <th className="px-6 py-4 font-semibold">Trạng thái</th>
                      <th className="px-6 py-4 font-semibold">Thao tác</th>
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
                      paginatedCustomers.map((row, index) => {
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

              <TablePagination
                page={page}
                totalCount={customers.length}
                itemLabel="khách hàng"
                onPageChange={setPage}
              />
            </section>

            <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <article className="rounded-2xl border border-[#f0eee6] bg-white p-5 shadow-[0px_4px_20px_rgba(0,0,0,0.04)] lg:col-span-2">
                <div className="mb-6 flex items-center justify-between">
                  <h4 className="font-bold text-[#1b1c17]">Doanh thu theo ngành</h4>
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
                <h4 className="font-bold text-[#1b1c17]">Hoạt động gần đây</h4>
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
                  Xem tất cả hoạt động
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
                    Lọc
                  </button>
                  <Link to="/customers/create?type=general" className="inline-flex items-center gap-2 rounded-lg bg-[#4a6242] px-4 py-2 text-sm text-white hover:opacity-90">
                    <span className="material-symbols-outlined text-[20px]">add</span>
                    Thêm khách hàng
                  </Link>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="text-xs uppercase tracking-wider text-[#717971]">
                      <th className="border-b border-[#f0eee6] px-6 py-4 font-semibold">Tên</th>
                      <th className="border-b border-[#f0eee6] px-6 py-4 font-semibold">Số điện thoại</th>
                      <th className="border-b border-[#f0eee6] px-6 py-4 font-semibold">Hạng</th>
                      <th className="border-b border-[#f0eee6] px-6 py-4 font-semibold">Mã KH</th>
                      <th className="border-b border-[#f0eee6] px-6 py-4 font-semibold">Tổng chi tiêu</th>
                      <th className="border-b border-[#f0eee6] px-6 py-4 text-right font-semibold">Thao tác</th>
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
                      paginatedCustomers.map((row) => (
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

              <TablePagination
                page={page}
                totalCount={customers.length}
                itemLabel="khách hàng"
                onPageChange={setPage}
              />
            </section>

            <section className="mt-2 grid grid-cols-1 gap-4 lg:grid-cols-12">
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
                    Lọc
                  </button>
                  <Link to="/customers/create?type=vip" className="inline-flex items-center gap-2 rounded-lg bg-[#7e5700] px-4 py-2 text-sm text-white hover:opacity-90">
                    <span className="material-symbols-outlined text-[20px]">add</span>
                    Thêm khách VIP
                  </Link>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="text-xs uppercase tracking-wider text-[#717971]">
                      <th className="border-b border-[#f0eee6] px-6 py-4 font-semibold">Tên</th>
                      <th className="border-b border-[#f0eee6] px-6 py-4 font-semibold">Số điện thoại</th>
                      <th className="border-b border-[#f0eee6] px-6 py-4 font-semibold">Mã KH</th>
                      <th className="border-b border-[#f0eee6] px-6 py-4 font-semibold">Tổng chi tiêu</th>
                      <th className="border-b border-[#f0eee6] px-6 py-4 font-semibold">Trạng thái</th>
                      <th className="border-b border-[#f0eee6] px-6 py-4 text-right font-semibold">Thao tác</th>
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
                      paginatedCustomers.map((row) => {
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

              <TablePagination
                page={page}
                totalCount={customers.length}
                itemLabel="khách hàng"
                onPageChange={setPage}
              />
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