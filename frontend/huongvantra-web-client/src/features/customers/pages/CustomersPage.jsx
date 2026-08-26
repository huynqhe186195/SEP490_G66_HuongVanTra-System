import { useEffect, useMemo, useState } from 'react'
import { useAuthSession } from '../../auth/hooks/useAuthSession.js'
import { Link, useSearchParams } from 'react-router-dom'
import PageHeader from '../../../components/shared/PageHeader.jsx'
import PageShell from '../../../components/shared/PageShell.jsx'
import TablePagination from '../../../components/shared/TablePagination.jsx'
import { useTotalAwarePageSize } from '../../../utils/totalAwarePageSize.js'
import { confirmDialog } from '../../../app/dialog.js'
import { showError, showSuccess } from '../../../app/toast.js'
import { getCustomerSectionFromSearch, getCustomerSectionLabel, buildCustomerPath } from '../../../app/customerSections.js'
import { canCreateCustomer, canDeleteCustomer, canEditCustomer, canManageCorporateCustomers, canViewAllCustomers, isReadOnlyCustomerViewer } from '../../auth/utils/permissions.js'
import CustomerActivityFeed from '../components/CustomerActivityFeed.jsx'
import CustomerDebtDetailModal from '../components/CustomerDebtDetailModal.jsx'
import CustomersTableShell from '../components/CustomersTableShell.jsx'
import CustomersMobileCards from '../components/CustomersMobileCards.jsx'
import { useCustomersList } from '../hooks/useCustomersList.js'
import {
  downloadCustomerImportTemplate,
  exportCustomersToExcel,
  fetchMembershipTiers,
  fetchCustomerStatistics,
  importCustomersFromExcel,
  restoreCustomer,
} from '../services/customersApi.js'
import {
  TIER_READONLY_HINT,
  formatMembershipTiersBadge,
  formatNonMembershipTierNotice,
} from '../utils/membershipTierUtils.js'
import {
  formatDebtVnd,
  formatVnd,
  getDebtClass,
  getInitials,
  getStatusDisplay,
  getTierClass,
  customerTypeLabelFromType,
  getMembershipTierLabel,
  CUSTOMER_CORPORATE_ENABLED,
  CUSTOMER_TYPE_BY_TAB,
  isCorporateCustomerType,
} from '../utils/customerDisplay.js'

const VALID_CUSTOMER_SECTIONS = new Set(['general', 'vip', 'corporate', 'debts', 'inactive'])

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

const IMPORT_ROW_PREVIEW_LIMIT = 30

function CustomerRowActions({ customerId, canEdit }) {
  return (
    <div className="inline-flex items-center justify-end gap-1">
      <Link
        to={`/customers/${customerId}/edit?mode=view`}
        className="rounded-full p-2 text-[#717971] transition-colors hover:bg-[#e4e3db] hover:text-[#356647]"
        title="Xem chi tiết"
      >
        <span className="material-symbols-outlined text-[20px]">visibility</span>
      </Link>
      {canEdit ? (
        <Link
          to={`/customers/${customerId}/edit`}
          className="rounded-full p-2 text-[#717971] transition-colors hover:bg-[#e4e3db] hover:text-[#356647]"
          title="Sửa thông tin phụ"
        >
          <span className="material-symbols-outlined text-[20px]">edit</span>
        </Link>
      ) : null}
    </div>
  )
}

function DebtAmountCell({ row, onDebtClick }) {
  const debt = Number(row.currentDebt || 0)
  if (debt > 0 && onDebtClick) {
    return (
      <button
        type="button"
        className={`${getDebtClass(row.currentDebt)} font-bold underline decoration-dotted underline-offset-2 hover:opacity-80`}
        onClick={() => onDebtClick(row)}
        title="Xem / thu công nợ"
      >
        {formatDebtVnd(row.currentDebt)}
      </button>
    )
  }
  return <span className={getDebtClass(row.currentDebt)}>{formatDebtVnd(row.currentDebt)}</span>
}

function normalizeImportMessage(message) {
  return String(message || '').replace(/\s+/g, ' ').trim()
}

function isImportErrorStatus(status) {
  const normalized = String(status || '').toUpperCase()
  return normalized === 'ERROR' || normalized === 'FAILED' || normalized.includes('ERROR')
}

function isImportWarningStatus(status) {
  const normalized = String(status || '').toUpperCase()
  return normalized === 'WARNING' || normalized.includes('WARNING')
}

function isImportWarningMessage(message) {
  const text = normalizeImportMessage(message).toLowerCase()
  return (
    text.includes('đã bỏ qua') ||
    text.includes('đã mặc định') ||
    text.includes('không được lưu') ||
    text.includes('chưa có trường') ||
    text.includes('dùng địa chỉ mặc định') ||
    text.includes('quá ngắn') ||
    text.includes('dài hơn') ||
    text.includes('được cắt ngắn')
  )
}

function addImportMessageGroup(groups, message, rowNumber) {
  const text = normalizeImportMessage(message)
  if (!text || !rowNumber) return

  const existing = groups.get(text)
  if (existing) {
    existing.rows.add(rowNumber)
    return
  }

  groups.set(text, {
    message: text,
    rows: new Set([rowNumber]),
  })
}

function buildImportResultGroups(rows = []) {
  const errorGroups = new Map()
  const warningGroups = new Map()

  rows.forEach((row) => {
    const rowNumber = Number(row?.rowNumber || 0)
    const messages = Array.isArray(row?.messages) ? row.messages : []
    const cleanedMessages = messages.map(normalizeImportMessage).filter(Boolean)
    if (!rowNumber || cleanedMessages.length === 0) return

    if (isImportWarningStatus(row.status)) {
      cleanedMessages.forEach((message) => addImportMessageGroup(warningGroups, message, rowNumber))
      return
    }

    if (isImportErrorStatus(row.status)) {
      cleanedMessages.forEach((message) => {
        if (isImportWarningMessage(message)) {
          addImportMessageGroup(warningGroups, message, rowNumber)
        } else {
          addImportMessageGroup(errorGroups, message, rowNumber)
        }
      })
    }
  })

  const mapToList = (groups) =>
    Array.from(groups.values())
      .map((group) => ({
        message: group.message,
        rows: Array.from(group.rows).sort((a, b) => a - b),
      }))
      .sort((a, b) => b.rows.length - a.rows.length || a.message.localeCompare(b.message, 'vi'))

  return {
    errors: mapToList(errorGroups),
    warnings: mapToList(warningGroups),
  }
}

function formatImportGroupRows(rows) {
  const visibleRows = rows.slice(0, IMPORT_ROW_PREVIEW_LIMIT)
  const hiddenCount = Math.max(0, rows.length - visibleRows.length)
  return hiddenCount > 0
    ? `Dòng: ${visibleRows.join(', ')} và ${hiddenCount} dòng khác`
    : `Dòng: ${visibleRows.join(', ')}`
}

function ImportGroupedResultSection({ title, emptyText, groups, tone = 'error' }) {
  const toneClasses = tone === 'warning'
    ? {
        badge: 'bg-[#fec25b]/25 text-[#7e5700]',
        card: 'border-[#fec25b]/40 bg-[#fff8e6]',
        icon: 'text-[#7e5700]',
      }
    : {
        badge: 'bg-[#ffdad6] text-[#93000a]',
        card: 'border-[#ffdad6] bg-[#fff7f5]',
        icon: 'text-[#93000a]',
      }

  return (
    <section className="rounded-xl border border-[#eae8e0] bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold text-[#1b1c17]">{title}</h3>
        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${toneClasses.badge}`}>
          {groups.length} nhóm
        </span>
      </div>

      {groups.length > 0 ? (
        <div className="custom-scrollbar max-h-[300px] space-y-3 overflow-y-auto pr-1">
          {groups.map((group) => (
            <article key={group.message} className={`rounded-xl border p-3 ${toneClasses.card}`}>
              <div className="flex items-start gap-2">
                <span className={`material-symbols-outlined mt-0.5 text-[18px] ${toneClasses.icon}`}>
                  {tone === 'warning' ? 'warning' : 'error'}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="min-w-0 text-sm font-semibold text-[#1b1c17]">{group.message}</p>
                  <p className="mt-2 text-xs font-medium text-[#717971]">
                    {group.rows.length} dòng · {formatImportGroupRows(group.rows)}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-[#c1c9c0] bg-[#f6f4ec]/60 px-4 py-6 text-sm font-medium text-[#717971]">
          {emptyText}
        </div>
      )}
    </section>
  )
}

function CustomersPage() {
  const session = useAuthSession()
  const [searchParams] = useSearchParams()
  const activeTab = useMemo(() => {
    const section = getCustomerSectionFromSearch(`?${searchParams.toString()}`)
    return VALID_CUSTOMER_SECTIONS.has(section) ? section : 'general'
  }, [searchParams])
  const sectionLabel = getCustomerSectionLabel(activeTab)
  const canManageCustomers = canEditCustomer(session)
  const canCreateCustomers = canCreateCustomer(session)
  const canRemoveCustomers = canDeleteCustomer(session)
  const canManageCorporate = canManageCorporateCustomers(session)
  const canExportCustomers = canViewAllCustomers(session)
  const isReadOnlyViewer = isReadOnlyCustomerViewer(session)
  const canEditCustomerRow = (row) =>
    isCorporateCustomerType(row?.customerType) ? canManageCorporate : canManageCustomers
  const [searchValue, setSearchValue] = useState('')
  const [tierFilter, setTierFilter] = useState('')
  const [debtFilter, setDebtFilter] = useState('')
  const [sortBy, setSortBy] = useState('')
  const [filterOpen, setFilterOpen] = useState(false)
  const [page, setPage] = useState(1)
  const [membershipTiers, setMembershipTiers] = useState([])
  const [statistics, setStatistics] = useState(null)
  const [activityRefreshKey, setActivityRefreshKey] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [restoringId, setRestoringId] = useState(null)
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [importFile, setImportFile] = useState(null)
  const [importResult, setImportResult] = useState(null)
  const [isImporting, setIsImporting] = useState(false)
  const [isTemplateDownloading, setIsTemplateDownloading] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [debtCustomer, setDebtCustomer] = useState(null)

  const { customers, isLoading, reload } = useCustomersList({
    activeTab,
    searchValue,
    tierFilter,
    debtFilter,
    sortBy,
    pollIntervalMs: 30000,
  })

  const { pageSize, setPageSize, pageSizeOptions } = useTotalAwarePageSize(customers.length)

  const hasActiveFilters = Boolean(tierFilter || debtFilter || sortBy)
  const importResultGroups = useMemo(
    () => buildImportResultGroups(importResult?.rows ?? []),
    [importResult],
  )

  function handleFilterChange(setter) {
    return (event) => {
      setPage(1)
      setter(event.target.value)
    }
  }

  function clearFilters() {
    setPage(1)
    setTierFilter('')
    setDebtFilter(activeTab === 'debts' ? 'with_debt' : '')
    setSortBy(activeTab === 'debts' ? 'debt' : '')
  }

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
    setDebtFilter(activeTab === 'debts' ? 'with_debt' : '')
    setSortBy(activeTab === 'debts' ? 'debt' : '')
    setFilterOpen(activeTab === 'debts')
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

  async function handleDownloadImportTemplate() {
    try {
      setIsTemplateDownloading(true)
      await downloadCustomerImportTemplate()
    } catch (error) {
      showError(error.message || 'Không tải được file mẫu import khách hàng.')
    } finally {
      setIsTemplateDownloading(false)
    }
  }

  function handleOpenImportModal() {
    setImportFile(null)
    setImportResult(null)
    setIsImportModalOpen(true)
  }

  function handleCloseImportModal() {
    if (isImporting) return
    setIsImportModalOpen(false)
  }

  async function handleImportCustomers() {
    if (isImporting) return
    if (!importFile) {
      showError('Vui lòng chọn file Excel cần import.')
      return
    }

    if (!importFile.name.toLowerCase().endsWith('.xlsx')) {
      showError('Chỉ hỗ trợ nhập file Excel định dạng .xlsx.')
      return
    }

    try {
      setIsImporting(true)
      const result = await importCustomersFromExcel(importFile)
      setImportResult(result)
      if (result.successCount > 0) {
        setPage(1)
        await Promise.all([reload(), loadStatistics()])
      }
      showSuccess(`Nhập file hoàn tất: ${result.successCount} thành công, ${result.failedCount} lỗi.`)
    } catch (error) {
      showError(error.message || 'Nhập file khách hàng thất bại.')
    } finally {
      setIsImporting(false)
    }
  }

  async function handleExportCustomers() {
    if (isExporting) return

    try {
      setIsExporting(true)
      await exportCustomersToExcel({
        activeTab,
        keyword: searchValue.trim() || undefined,
        customerType:
          activeTab === 'inactive' || activeTab === 'debts'
            ? undefined
            : CUSTOMER_TYPE_BY_TAB[activeTab],
        tierCode: activeTab === 'general' ? tierFilter || undefined : undefined,
        debtFilter:
          activeTab === 'inactive'
            ? undefined
            : debtFilter || (activeTab === 'debts' ? 'with_debt' : undefined),
        sortBy:
          activeTab === 'inactive'
            ? undefined
            : sortBy || (activeTab === 'debts' ? 'debt' : undefined),
      })
      showSuccess('Đã tải file xuất khách hàng.')
    } catch (error) {
      showError(error.message || 'Xuất file khách hàng thất bại.')
    } finally {
      setIsExporting(false)
    }
  }

  async function handleRestore(customerId) {
    if (!(await confirmDialog({
      title: 'Khôi phục',
      message: 'Khôi phục khách hàng này? Khách sẽ xuất hiện lại trong danh sách đang hoạt động.',
      tone: 'primary',
    }))) return
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
    const totalPages = Math.max(1, Math.ceil((customers.length || 0) / pageSize) || 1)
    if (page > totalPages) {
      setPage(totalPages)
    }
  }, [customers.length, page, pageSize])

  const paginatedCustomers = useMemo(() => {
    const start = (page - 1) * pageSize
    return customers.slice(start, start + pageSize)
  }, [customers, page, pageSize])

  const insightGridClass = 'grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4'

  function buildTabInsightStats({ countLabel, countIcon, countNote, customers: rows }) {
    const activeCount = rows.filter((item) => item.status?.toUpperCase() === 'ACTIVE').length
    const inactiveCount = Math.max(0, rows.length - activeCount)
    const withDebt = rows.filter((item) => Number(item.currentDebt) > 0).length
    const totalDebt = rows.reduce((sum, item) => sum + Number(item.currentDebt || 0), 0)
    const totalSpend = rows.reduce((sum, item) => sum + Number(item.totalSpend || 0), 0)
    return [
      {
        label: countLabel,
        value: String(rows.length),
        note: countNote || `${activeCount} đang hoạt động`,
        noteIcon: 'trending_up',
        icon: countIcon,
        toneClass: 'text-[#356647] bg-[#4e7f5e]/10',
        glow: 'bg-[#356647]/10',
      },
      {
        label: 'Tổng công nợ',
        value: formatDebtVnd(totalDebt).replace(' VND', ''),
        note: `${withDebt} khách còn nợ · bấm để quản lý`,
        noteIcon: 'account_balance_wallet',
        icon: 'payments',
        toneClass: 'text-[#7e5700] bg-[#fec25b]/10',
        glow: 'bg-[#7e5700]/10',
        href: buildCustomerPath('debts'),
      },
      {
        label: 'Đang hoạt động',
        value: String(activeCount),
        note: `${inactiveCount} ngừng hoạt động`,
        noteIcon: 'verified',
        icon: 'verified',
        toneClass: 'text-[#356647] bg-[#baefc8]/30',
        glow: 'bg-[#356647]/10',
      },
      {
        label: 'Tổng chi tiêu',
        value: formatVnd(totalSpend).replace(' VND', ''),
        note: 'VND',
        noteIcon: 'payments',
        icon: 'payments',
        toneClass: 'text-[#356647] bg-[#4e7f5e]/10',
        glow: 'bg-[#356647]/10',
      },
    ]
  }

  const corporateStats = useMemo(
    () =>
      buildTabInsightStats({
        countLabel: 'Khách doanh nghiệp',
        countIcon: 'apartment',
        customers,
      }),
    [customers],
  )

  const generalStats = useMemo(
    () =>
      buildTabInsightStats({
        countLabel: 'Khách phổ thông',
        countIcon: 'group',
        countNote: statistics
          ? `${statistics.newCustomersThisMonth} mới tháng này (toàn hệ thống)`
          : undefined,
        customers,
      }),
    [customers, statistics],
  )

  const debtsStats = useMemo(() => {
    const totalDebt = customers.reduce((sum, item) => sum + Number(item.currentDebt || 0), 0)
    const withDebt = customers.filter((item) => Number(item.currentDebt) > 0).length
    return [
      {
        label: 'Khách còn nợ',
        value: String(withDebt || customers.length),
        note: 'lọc theo công nợ',
        noteIcon: 'group',
        icon: 'account_balance_wallet',
        toneClass: 'text-[#7e5700] bg-[#fec25b]/10',
        glow: 'bg-[#7e5700]/10',
      },
      {
        label: 'Tổng công nợ',
        value: formatDebtVnd(totalDebt).replace(' VND', ''),
        note: 'bấm số tiền trên bảng để xem chi tiết',
        noteIcon: 'payments',
        icon: 'payments',
        toneClass: 'text-[#7e5700] bg-[#fec25b]/10',
        glow: 'bg-[#7e5700]/10',
      },
    ]
  }, [customers])

  const vipStats = useMemo(
    () =>
      buildTabInsightStats({
        countLabel: 'Khách VIP',
        countIcon: 'stars',
        customers,
      }),
    [customers],
  )

  const nonMembershipNotice = useMemo(
    () => formatNonMembershipTierNotice(membershipTiers),
    [membershipTiers],
  )

  function renderInsightStatCards(stats, gridClassName = insightGridClass) {
    return (
      <section className={gridClassName}>
        {stats.map((stat) => {
          const content = (
            <>
              <div className={`absolute -right-4 -top-4 h-24 w-24 rounded-full blur-2xl ${stat.glow}`} />
              <div className="relative flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="mb-1 text-[10px] uppercase tracking-widest text-[#414942] sm:text-xs">{stat.label}</p>
                  <h3 className="text-2xl font-bold text-[#1b1c17] sm:text-3xl">{stat.value}</h3>
                  <p className="mt-2 line-clamp-3 text-xs font-bold text-[#356647] sm:text-sm">
                    {stat.noteIcon ? (
                      <span className="material-symbols-outlined align-middle text-[16px] sm:text-[18px]">{stat.noteIcon}</span>
                    ) : null}{' '}
                    {stat.note}
                  </p>
                </div>
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg sm:h-12 sm:w-12 ${stat.toneClass}`}>
                  <span className="material-symbols-outlined text-[24px] sm:text-[28px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                    {stat.icon}
                  </span>
                </div>
              </div>
            </>
          )
          const cardClass =
            'group relative min-w-0 overflow-hidden rounded-xl border border-[#eae8e0] bg-white p-4 shadow-[0px_4px_20px_rgba(0,0,0,0.04)] transition-all duration-300 hover:shadow-[0px_8px_24px_rgba(0,0,0,0.08)] sm:p-5'
          return stat.href ? (
            <Link key={stat.label} to={stat.href} className={cardClass}>
              {content}
            </Link>
          ) : (
            <article key={stat.label} className={cardClass}>
              {content}
            </article>
          )
        })}
      </section>
    )
  }

  function renderCustomerListHeader({ title, badge, badgeClassName, hint, createTo, createLabel, createClassName, showCreate }) {
    return (
      <div className="flex flex-col gap-3 border-b border-[#f0eee6] bg-[#f6f4ec]/30 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
          <h4 className="text-lg font-bold text-[#1b1c17] sm:text-xl lg:text-2xl">{title}</h4>
          {badge ? (
            <span className={`w-fit rounded-full px-2.5 py-1 text-[10px] leading-snug sm:px-3 sm:text-xs ${badgeClassName}`}>
              {badge}
            </span>
          ) : null}
          {hint ? (
            <span className="hidden max-w-md text-xs text-[#717971] xl:inline" title={hint}>
              {hint}
            </span>
          ) : null}
        </div>
        {showCreate && createTo ? (
          <div className="flex w-full sm:w-auto">
            <Link
              to={createTo}
              className={`inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm text-white hover:opacity-90 sm:w-auto ${createClassName}`}
            >
              <span className="material-symbols-outlined text-[20px]">add</span>
              {createLabel}
            </Link>
          </div>
        ) : null}
      </div>
    )
  }
  return (
    <PageShell className="min-w-0 [font-family:'Manrope',sans-serif]">
      <PageHeader
        compact
        title="Khách hàng"
        titleInfo={`${sectionLabel} — quản lý hồ sơ, công nợ và hoạt động khách hàng.`}
        searchPlaceholder="Tìm theo tên, SĐT"
        searchWide
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        rightContent={
          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-row">
            {canCreateCustomers ? (
              <>
                <button
                  type="button"
                  className="inline-flex h-11 items-center justify-center gap-1 rounded-full border border-[#356647]/30 bg-white px-3 text-xs font-semibold text-[#356647] hover:bg-[#356647]/5 disabled:opacity-60 sm:h-12 sm:px-5 sm:text-sm"
                  disabled={isTemplateDownloading}
                  onClick={handleDownloadImportTemplate}
                >
                  <span className={`material-symbols-outlined text-[18px] sm:text-[20px] ${isTemplateDownloading ? 'animate-spin' : ''}`}>download</span>
                  <span className="truncate">Tải file mẫu</span>
                </button>
                <button
                  type="button"
                  className="inline-flex h-11 items-center justify-center gap-1 rounded-full bg-[#356647] px-3 text-xs font-semibold text-white hover:bg-[#4e7f5e] sm:h-12 sm:px-5 sm:text-sm"
                  onClick={handleOpenImportModal}
                >
                  <span className="material-symbols-outlined text-[18px] sm:text-[20px]">upload_file</span>
                  <span className="truncate">Import Excel</span>
                </button>
              </>
            ) : null}
            {canExportCustomers ? (
              <button
                type="button"
                className="inline-flex h-11 items-center justify-center gap-1 rounded-full border border-[#356647]/30 bg-white px-3 text-xs font-semibold text-[#356647] hover:bg-[#356647]/5 disabled:opacity-60 sm:h-12 sm:px-5 sm:text-sm"
                disabled={isExporting || isLoading}
                onClick={handleExportCustomers}
              >
                <span className={`material-symbols-outlined text-[18px] sm:text-[20px] ${isExporting ? 'animate-spin' : ''}`}>ios_share</span>
                <span className="truncate">Export Excel</span>
              </button>
            ) : null}
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
            <span className="font-semibold text-[#356647]">{sectionLabel}</span>
          </div>

          {isReadOnlyViewer ? (
            <p className="text-xs leading-relaxed text-[#717971]">
              Bạn xem được toàn bộ khách hàng của cửa hàng (Phổ thông &amp; VIP) và được thêm khách hàng mới. Sửa hồ sơ khách hàng do Quản lý/Admin thực hiện.
            </p>
          ) : null}

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
                  Lọc / Sắp xếp
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
                    {activeTab === 'debts' ? 'Đặt lại lọc công nợ' : 'Xóa lọc'}
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
              <h4 className="text-lg font-bold text-[#1b1c17] sm:text-xl lg:text-2xl">Khách đã ngừng hoạt động</h4>
            </div>

            <CustomersMobileCards
              variant="inactive"
              rows={paginatedCustomers}
              isLoading={isLoading}
              emptyMessage="Không có khách hàng đã ngừng hoạt động."
              onRestore={canRemoveCustomers || canManageCorporate ? handleRestore : undefined}
              restoringId={restoringId}
              canEditCustomer={canManageCustomers}
              canEditRow={canEditCustomerRow}
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
                            {canEditCustomerRow(row) ? (
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
              pageSizeOptions={pageSizeOptions}
              totalCount={customers.length}
              itemLabel="khách hàng"
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size)
                setPage(1)
              }}
            />
          </section>
        ) : activeTab === 'corporate' && CUSTOMER_CORPORATE_ENABLED ? (
          <>
            {renderInsightStatCards(corporateStats)}

            <section className="flex flex-col rounded-xl border border-[#eae8e0] bg-white shadow-[0px_4px_20px_rgba(0,0,0,0.04)]">
              {renderCustomerListHeader({
                title: 'Khách doanh nghiệp',
                badge: nonMembershipNotice,
                badgeClassName: 'bg-[#7e5700]/15 text-[#7e5700]',
                createTo: '/customers/create?type=corporate',
                createLabel: 'Thêm doanh nghiệp',
                createClassName: 'bg-[#7e5700]',
                showCreate: canManageCorporate,
              })}

              <CustomersMobileCards
                variant="corporate"
                rows={paginatedCustomers}
                isLoading={isLoading}
                emptyMessage="Chưa có khách hàng doanh nghiệp."
                canEditCustomer={canManageCorporate}
                onDebtClick={setDebtCustomer}
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
                              <DebtAmountCell row={row} onDebtClick={setDebtCustomer} />
                            </td>
                            <td className={CORP_TABLE_CELL}>
                              <span className={`rounded-full px-2 py-1 text-[11px] font-bold uppercase ${status.className}`}>{status.label}</span>
                            </td>
                            <td className={CORP_TABLE_CELL}>
                              <CustomerRowActions customerId={row.customerId} canEdit={canManageCorporate} />
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
              pageSizeOptions={pageSizeOptions}
              totalCount={customers.length}
                itemLabel="khách hàng"
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size)
                setPage(1)
              }}
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
        ) : activeTab === 'debts' ? (
          <>
            <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {debtsStats.map((stat) => (
                <article key={stat.label} className="group relative min-w-0 overflow-hidden rounded-xl border border-[#eae8e0] bg-white p-4 shadow-[0px_4px_20px_rgba(0,0,0,0.04)] sm:p-5">
                  <div className={`absolute -right-4 -top-4 h-24 w-24 rounded-full blur-2xl ${stat.glow}`} />
                  <div className="relative flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="mb-1 text-[10px] uppercase tracking-widest text-[#414942] sm:text-xs">{stat.label}</p>
                      <h3 className="text-2xl font-bold text-[#1b1c17] sm:text-3xl">{stat.value}</h3>
                      <p className="mt-2 line-clamp-3 text-xs font-bold text-[#7e5700] sm:text-sm">
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
              <div className="flex flex-col gap-2 border-b border-[#f0eee6] bg-[#fff8e8]/60 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                <h4 className="text-lg font-bold text-[#1b1c17] sm:text-xl">Quản lý công nợ</h4>
              </div>

              <CustomersMobileCards
                variant="debts"
                rows={paginatedCustomers}
                isLoading={isLoading}
                emptyMessage="Không có khách còn công nợ theo bộ lọc hiện tại."
                canEditRow={canEditCustomerRow}
                onDebtClick={setDebtCustomer}
              />

              <CustomersTableShell minWidthClass="min-w-[900px]">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="text-xs uppercase tracking-wider text-[#717971]">
                      <th className={`${TABLE_HEAD} font-semibold`}>Khách hàng</th>
                      <th className={`${TABLE_HEAD} font-semibold`}>Loại</th>
                      <th className={`${TABLE_HEAD} font-semibold`}>Số điện thoại</th>
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
                          Đang tải danh sách công nợ...
                        </td>
                      </tr>
                    ) : customers.length === 0 ? (
                      <tr>
                        <td className={TABLE_EMPTY} colSpan={7}>
                          Không có khách còn công nợ theo bộ lọc hiện tại.
                        </td>
                      </tr>
                    ) : (
                      paginatedCustomers.map((row) => (
                        <tr key={row.customerId} className="transition-colors hover:bg-[#fff8e8]/50">
                          <td className={TABLE_CELL}>
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#fff8e8] text-sm font-bold text-[#7e5700]">
                                {getInitials(row.fullName)}
                              </div>
                              <div>
                                <p className="font-bold text-[#1b1c17]">{row.fullName}</p>
                                <p className="text-xs text-[#717971]">{row.email || '—'}</p>
                              </div>
                            </div>
                          </td>
                          <td className={`${TABLE_CELL} text-[#414942]`}>{customerTypeLabelFromType(row.customerType)}</td>
                          <td className={`${TABLE_CELL} text-[#414942]`}>{row.phone || '—'}</td>
                          <td className={`${TABLE_CELL} font-bold text-[#1b1c17]`}>{row.customerCode}</td>
                          <td className={`${TABLE_CELL} font-bold text-[#356647]`}>{formatVnd(row.totalSpend)}</td>
                          <td className={TABLE_CELL}>
                            <DebtAmountCell row={row} onDebtClick={setDebtCustomer} />
                          </td>
                          <td className={TABLE_CELL_RIGHT}>
                            <CustomerRowActions customerId={row.customerId} canEdit={canEditCustomerRow(row)} />
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
                pageSizeOptions={pageSizeOptions}
                totalCount={customers.length}
                itemLabel="khách hàng"
                onPageChange={setPage}
                onPageSizeChange={(size) => {
                  setPageSize(size)
                  setPage(1)
                }}
              />
            </section>
          </>
        ) : activeTab === 'general' ? (
          <>
            {renderInsightStatCards(generalStats)}

            <section className="flex flex-col rounded-xl border border-[#eae8e0] bg-white shadow-[0px_4px_20px_rgba(0,0,0,0.04)]">
              {renderCustomerListHeader({
                title: 'Khách phổ thông',
                badge: formatMembershipTiersBadge(membershipTiers),
                badgeClassName: 'bg-[#627b59]/20 text-[#4a6242]',
                hint: TIER_READONLY_HINT,
                createTo: '/customers/create?type=general',
                createLabel: 'Thêm khách hàng',
                createClassName: 'bg-[#4a6242]',
                showCreate: canCreateCustomers,
              })}

              <CustomersMobileCards
                variant="general"
                rows={paginatedCustomers}
                isLoading={isLoading}
                emptyMessage="Chưa có khách phổ thông."
                membershipTiers={membershipTiers}
                canEditCustomer={canManageCustomers}
                onDebtClick={setDebtCustomer}
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
                            <DebtAmountCell row={row} onDebtClick={setDebtCustomer} />
                          </td>
                          <td className={TABLE_CELL_RIGHT}>
                            <CustomerRowActions customerId={row.customerId} canEdit={canManageCustomers} />
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
              pageSizeOptions={pageSizeOptions}
              totalCount={customers.length}
                itemLabel="khách hàng"
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size)
                setPage(1)
              }}
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
                        <li key={item.customerId}>
                          <button
                            type="button"
                            className="flex w-full items-center justify-between gap-3 rounded-lg bg-[#f6f4ec]/70 px-3 py-2 text-left hover:bg-[#fff8e8]"
                            onClick={() => setDebtCustomer(item)}
                          >
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
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-[#717971]">Không có khách đang nợ.</p>
                  )}
                </article>
              </section>
            ) : null}

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
            {renderInsightStatCards(vipStats)}

            <section className="flex flex-col rounded-xl border border-[#eae8e0] bg-white shadow-[0px_4px_20px_rgba(0,0,0,0.04)]">
              {renderCustomerListHeader({
                title: 'Khách VIP',
                badge: nonMembershipNotice,
                badgeClassName: 'bg-[#7e5700]/15 text-[#7e5700]',
                createTo: '/customers/create?type=vip',
                createLabel: 'Thêm khách VIP',
                createClassName: 'bg-[#7e5700]',
                showCreate: canCreateCustomers,
              })}

              <CustomersMobileCards
                variant="vip"
                rows={paginatedCustomers}
                isLoading={isLoading}
                emptyMessage="Chưa có khách VIP."
                canEditCustomer={canManageCustomers}
                onDebtClick={setDebtCustomer}
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
                              <DebtAmountCell row={row} onDebtClick={setDebtCustomer} />
                            </td>
                            <td className={TABLE_CELL}>
                              <span className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-tight ${status.className}`}>
                                {status.label}
                              </span>
                            </td>
                            <td className={TABLE_CELL_RIGHT}>
                              <CustomerRowActions customerId={row.customerId} canEdit={canManageCustomers} />
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
              pageSizeOptions={pageSizeOptions}
              totalCount={customers.length}
                itemLabel="khách hàng"
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size)
                setPage(1)
              }}
            />
            </section>
          </>
        )}
      </div>

      {isImportModalOpen ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm"
          onClick={handleCloseImportModal}
          role="presentation"
        >
          <div
            className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-[#c1c9c0]/60 bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="customer-import-title"
          >
            <div className="flex flex-col gap-3 border-b border-[#f0eee6] p-5 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 id="customer-import-title" className="text-lg font-bold text-[#1b1c17]">
                  Import khách hàng từ Excel
                </h2>
                <p className="mt-1 text-sm text-[#717971]">
                  Chọn file `.xlsx` theo mẫu. Một file có thể import khách Phổ Thông, VIP và Doanh Nghiệp; hệ thống sẽ bỏ qua dòng lỗi và nhóm lỗi/cảnh báo theo nội dung.
                </p>
              </div>
              <button
                type="button"
                className="self-end rounded-full p-2 text-[#717971] hover:bg-[#f6f4ec] sm:self-start"
                onClick={handleCloseImportModal}
                disabled={isImporting}
                aria-label="Đóng"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="custom-scrollbar flex-1 overflow-y-auto p-5">
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                <label className="space-y-2">
                  <span className="text-sm font-semibold text-[#414942]">File Excel (.xlsx)</span>
                  <input
                    type="file"
                    accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    className="w-full rounded-xl border border-[#c1c9c0] bg-[#f6f4ec] px-4 py-3 text-sm text-[#414942] file:mr-4 file:rounded-lg file:border-0 file:bg-[#356647] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
                    disabled={isImporting}
                    onChange={(event) => {
                      setImportFile(event.target.files?.[0] ?? null)
                      setImportResult(null)
                    }}
                  />
                  <p className="text-xs text-[#717971]">
                    Cột bắt buộc: Họ và Tên, Số Điện Thoại. Số điện thoại đã tồn tại sẽ bị bỏ qua. Email sai định dạng sẽ được bỏ qua và ghi cảnh báo; Điểm Tích Lũy không import thủ công.
                  </p>
                </label>

                <div className="flex flex-col gap-2 sm:flex-row lg:justify-end">
                  <button
                    type="button"
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#356647]/30 bg-white px-4 py-2.5 text-sm font-semibold text-[#356647] hover:bg-[#356647]/5 disabled:opacity-60"
                    disabled={isTemplateDownloading || isImporting}
                    onClick={handleDownloadImportTemplate}
                  >
                    <span className={`material-symbols-outlined text-[18px] ${isTemplateDownloading ? 'animate-spin' : ''}`}>download</span>
                    Tải file mẫu
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#356647] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#4e7f5e] disabled:opacity-60"
                    disabled={isImporting || !importFile}
                    onClick={handleImportCustomers}
                  >
                    <span className={`material-symbols-outlined text-[18px] ${isImporting ? 'animate-spin' : ''}`}>upload_file</span>
                    {isImporting ? 'Đang nhập...' : 'Nhập Excel'}
                  </button>
                </div>
              </div>

              {importResult ? (
                <div className="mt-6 space-y-4">
                  <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    <div className="rounded-xl border border-[#eae8e0] bg-[#f6f4ec]/60 p-4">
                      <p className="text-xs text-[#717971]">Tổng số dòng</p>
                      <p className="mt-1 text-2xl font-bold text-[#1b1c17]">{importResult.totalRows}</p>
                    </div>
                    <div className="rounded-xl border border-[#627b59]/20 bg-[#627b59]/10 p-4">
                      <p className="text-xs text-[#356647]">Thành công</p>
                      <p className="mt-1 text-2xl font-bold text-[#356647]">{importResult.successCount}</p>
                    </div>
                    <div className="rounded-xl border border-[#93000a]/20 bg-[#ffdad6]/40 p-4">
                      <p className="text-xs text-[#93000a]">Lỗi</p>
                      <p className="mt-1 text-2xl font-bold text-[#93000a]">{importResult.failedCount}</p>
                    </div>
                    <div className="rounded-xl border border-[#7e5700]/20 bg-[#fec25b]/20 p-4">
                      <p className="text-xs text-[#7e5700]">Cảnh báo</p>
                      <p className="mt-1 text-2xl font-bold text-[#7e5700]">{importResult.warningCount}</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <ImportGroupedResultSection
                      title="Lỗi cần sửa"
                      emptyText="Không có lỗi cần sửa."
                      groups={importResultGroups.errors}
                      tone="error"
                    />
                    <ImportGroupedResultSection
                      title="Cảnh báo đã xử lý"
                      emptyText="Không có cảnh báo."
                      groups={importResultGroups.warnings}
                      tone="warning"
                    />
                  </div>
                </div>
              ) : null}
            </div>

            <div className="flex justify-end gap-3 border-t border-[#f0eee6] bg-[#f6f4ec]/40 p-4">
              <button
                type="button"
                className="rounded-lg border border-[#c1c9c0] bg-white px-5 py-2.5 text-sm font-semibold text-[#414942] hover:bg-[#f6f4ec]"
                onClick={handleCloseImportModal}
                disabled={isImporting}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {debtCustomer ? (
        <CustomerDebtDetailModal
          customer={debtCustomer}
          onClose={() => setDebtCustomer(null)}
          onUpdated={async () => {
            await Promise.all([reload(), loadStatistics()])
            setActivityRefreshKey((key) => key + 1)
          }}
        />
      ) : null}

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
