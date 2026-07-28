import { useCallback, useEffect, useMemo, useState } from 'react'
import PageHeader from '../../../components/shared/PageHeader.jsx'
import PageShell from '../../../components/shared/PageShell.jsx'
import TablePagination, { TABLE_PAGE_SIZE } from '../../../components/shared/TablePagination.jsx'
import { showError, showSuccess } from '../../../app/toast.js'
import { fetchSystemActivities, fetchSystemActivityDetail } from '../services/systemActivityApi.js'

const EMPTY_FILTERS = {
  fromUtc: '',
  toUtc: '',
  actor: '',
  role: '',
  serviceName: '',
  module: '',
  action: '',
  result: 'all',
  entityCode: '',
  correlationId: '',
}

const RESULT_LABELS = {
  Success: 'Thành công',
  Failed: 'Thất bại',
}

function toUtcIso(value) {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString()
}

function formatDateTime(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('vi-VN')
}

function display(value) {
  return value === undefined || value === null || value === '' ? '—' : value
}

function formatResult(result) {
  return RESULT_LABELS[result] || result || '—'
}

function escapeCsv(value) {
  const text = String(value ?? '')
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text
  return `"${safe.replace(/"/g, '""')}"`
}

function buildCsvRows(items) {
  const headers = [
    'Thời gian',
    'Người thao tác',
    'Vai trò',
    'Service',
    'Module',
    'Action',
    'Đối tượng',
    'Kết quả',
    'HTTP',
    'CorrelationId',
  ]
  const rows = items.map((item) => [
    formatDateTime(item.occurredAtUtc),
    item.actorName || item.actorId || '',
    item.actorRole || '',
    item.serviceName || '',
    item.module || '',
    item.action || '',
    item.entityCode || item.entityId || item.entityType || '',
    formatResult(item.result),
    item.statusCode || '',
    item.correlationId || '',
  ])
  return [headers, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\n')
}

function SystemActivityLogPage() {
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [activities, setActivities] = useState([])
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: TABLE_PAGE_SIZE,
    totalCount: 0,
    totalPages: 1,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [selectedActivity, setSelectedActivity] = useState(null)
  const [isDetailLoading, setIsDetailLoading] = useState(false)

  const queryParams = useMemo(
    () => ({
      ...filters,
      fromUtc: toUtcIso(filters.fromUtc),
      toUtc: toUtcIso(filters.toUtc),
      result: filters.result === 'all' ? '' : filters.result,
      page: pagination.page,
      pageSize: pagination.pageSize,
    }),
    [filters, pagination.page, pagination.pageSize],
  )

  const loadActivities = useCallback(async () => {
    setIsLoading(true)
    try {
      const result = await fetchSystemActivities(queryParams)
      setActivities(result.items)
      setPagination((current) => ({
        ...current,
        page: result.page,
        pageSize: result.pageSize,
        totalCount: result.totalCount,
        totalPages: result.totalPages,
      }))
    } catch (error) {
      setActivities([])
      showError(error.message)
    } finally {
      setIsLoading(false)
    }
  }, [queryParams])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadActivities()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [loadActivities])

  function updateFilter(key, value) {
    setFilters((current) => ({ ...current, [key]: value }))
    setPagination((current) => ({ ...current, page: 1 }))
  }

  function clearFilters() {
    setFilters(EMPTY_FILTERS)
    setPagination((current) => ({ ...current, page: 1 }))
  }

  async function openDetail(activity) {
    setIsDetailLoading(true)
    setSelectedActivity(activity)
    try {
      const detail = await fetchSystemActivityDetail(activity.id)
      setSelectedActivity(detail || activity)
    } catch (error) {
      showError(error.message)
    } finally {
      setIsDetailLoading(false)
    }
  }

  function exportCsv() {
    const csv = buildCsvRows(activities)
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'system-activity-log.csv'
    link.click()
    URL.revokeObjectURL(url)
    showSuccess('Đã xuất CSV nhật ký hệ thống.')
  }

  return (
    <PageShell>
      <PageHeader
        title="Nhật ký hoạt động hệ thống"
        titleInfo="Theo dõi các thao tác ghi dữ liệu từ Product, Inventory, Order, User, Customer và Document."
        rightContent={
          <button
            type="button"
            onClick={exportCsv}
            disabled={isLoading || activities.length === 0}
            className="rounded-xl border border-[#538463] px-4 py-2 text-sm font-semibold text-[#356647] hover:bg-[#538463]/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Xuất CSV
          </button>
        }
      />

      <section className="mb-5 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Từ thời điểm
            <input
              type="datetime-local"
              value={filters.fromUtc}
              onChange={(event) => updateFilter('fromUtc', event.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm normal-case tracking-normal text-slate-700"
            />
          </label>
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Đến thời điểm
            <input
              type="datetime-local"
              value={filters.toUtc}
              onChange={(event) => updateFilter('toUtc', event.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm normal-case tracking-normal text-slate-700"
            />
          </label>
          <FilterInput label="Người thao tác" value={filters.actor} onChange={(value) => updateFilter('actor', value)} />
          <FilterInput label="Vai trò" value={filters.role} onChange={(value) => updateFilter('role', value)} />
          <FilterInput label="Service" value={filters.serviceName} onChange={(value) => updateFilter('serviceName', value)} />
          <FilterInput label="Module" value={filters.module} onChange={(value) => updateFilter('module', value)} />
          <FilterInput label="Action" value={filters.action} onChange={(value) => updateFilter('action', value)} />
          <FilterInput label="Mã đối tượng" value={filters.entityCode} onChange={(value) => updateFilter('entityCode', value)} />
          <FilterInput
            label="CorrelationId"
            value={filters.correlationId}
            onChange={(value) => updateFilter('correlationId', value)}
          />
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Kết quả
            <select
              value={filters.result}
              onChange={(event) => updateFilter('result', event.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm normal-case tracking-normal text-slate-700"
            >
              <option value="all">Tất cả</option>
              <option value="Success">Thành công</option>
              <option value="Failed">Thất bại</option>
            </select>
          </label>
        </div>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={clearFilters}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            Xóa lọc
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div className="custom-scrollbar overflow-x-auto">
          <table className="min-w-[1120px] w-full text-left text-sm">
            <thead className="bg-[#fbf9f1]/70 text-xs font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3">Thời gian</th>
                <th className="px-4 py-3">Người thao tác</th>
                <th className="px-4 py-3">Service</th>
                <th className="px-4 py-3">Module</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Đối tượng</th>
                <th className="px-4 py-3">Kết quả</th>
                <th className="px-4 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-slate-500">
                    Đang tải nhật ký...
                  </td>
                </tr>
              ) : null}
              {!isLoading && activities.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-slate-500">
                    Chưa có hoạt động phù hợp bộ lọc.
                  </td>
                </tr>
              ) : null}
              {!isLoading
                ? activities.map((activity) => (
                    <tr key={activity.id} className="hover:bg-[#fbf9f1]/40">
                      <td className="px-4 py-4 text-slate-700">{formatDateTime(activity.occurredAtUtc)}</td>
                      <td className="px-4 py-4">
                        <div className="font-semibold text-slate-800">{display(activity.actorName || activity.actorId)}</div>
                        <div className="text-xs text-slate-500">{display(activity.actorRole)}</div>
                      </td>
                      <td className="px-4 py-4 text-slate-700">{display(activity.serviceName)}</td>
                      <td className="px-4 py-4 text-slate-700">{display(activity.module)}</td>
                      <td className="px-4 py-4 text-slate-700">{display(activity.action)}</td>
                      <td className="px-4 py-4">
                        <div className="font-semibold text-slate-800">{display(activity.entityCode || activity.entityId)}</div>
                        <div className="text-xs text-slate-500">{display(activity.entityType)}</div>
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${
                            activity.result === 'Success'
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                              : 'border-rose-200 bg-rose-50 text-rose-700'
                          }`}
                        >
                          {formatResult(activity.result)}
                        </span>
                        <div className="mt-1 text-xs text-slate-500">HTTP {display(activity.statusCode)}</div>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => openDetail(activity)}
                          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Chi tiết
                        </button>
                      </td>
                    </tr>
                  ))
                : null}
            </tbody>
          </table>
        </div>
        <TablePagination
          page={pagination.page}
          pageSize={pagination.pageSize}
          totalCount={pagination.totalCount}
          onPageChange={(page) => setPagination((current) => ({ ...current, page }))}
          onPageSizeChange={(pageSize) => setPagination((current) => ({ ...current, page: 1, pageSize }))}
          disabled={isLoading}
          itemLabel="hoạt động"
        />
      </section>

      {selectedActivity ? (
        <ActivityDetailModal
          activity={selectedActivity}
          isLoading={isDetailLoading}
          onClose={() => setSelectedActivity(null)}
        />
      ) : null}
    </PageShell>
  )
}

function FilterInput({ label, value, onChange }) {
  return (
    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
      {label}
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm normal-case tracking-normal text-slate-700"
      />
    </label>
  )
}

function ActivityDetailModal({ activity, isLoading, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Chi tiết hoạt động</h2>
            <p className="text-sm text-slate-500">{display(activity.correlationId)}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            Đóng
          </button>
        </div>
        <div className="custom-scrollbar max-h-[calc(90vh-88px)] overflow-y-auto p-6">
          {isLoading ? <p className="mb-4 text-sm text-slate-500">Đang tải chi tiết...</p> : null}
          <dl className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <DetailItem label="Thời gian" value={formatDateTime(activity.occurredAtUtc)} />
            <DetailItem label="Người thao tác" value={activity.actorName || activity.actorId} />
            <DetailItem label="Vai trò" value={activity.actorRole} />
            <DetailItem label="Service" value={activity.serviceName} />
            <DetailItem label="Module" value={activity.module} />
            <DetailItem label="Action" value={activity.action} />
            <DetailItem label="EntityType" value={activity.entityType} />
            <DetailItem label="EntityId" value={activity.entityId} />
            <DetailItem label="EntityCode" value={activity.entityCode} />
            <DetailItem label="Kết quả" value={formatResult(activity.result)} />
            <DetailItem label="HTTP" value={activity.statusCode} />
            <DetailItem label="ClientIp" value={activity.clientIp} />
            <DetailItem label="RequestPath" value={activity.requestPath} wide />
            <DetailItem label="CorrelationId" value={activity.correlationId} wide />
            <DetailItem label="UserAgent" value={activity.userAgent} wide />
            <DetailItem label="Mô tả" value={activity.description} wide />
            <DetailItem label="Lý do lỗi" value={activity.reason} wide />
          </dl>
          <SnapshotBlock title="BeforeSnapshotJson" value={activity.beforeSnapshotJson} />
          <SnapshotBlock title="AfterSnapshotJson" value={activity.afterSnapshotJson} />
        </div>
      </div>
    </div>
  )
}

function DetailItem({ label, value, wide = false }) {
  return (
    <div className={wide ? 'md:col-span-2 xl:col-span-3' : ''}>
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-1 break-words text-sm font-medium text-slate-800">{display(value)}</dd>
    </div>
  )
}

function SnapshotBlock({ title, value }) {
  return (
    <section className="mt-6">
      <h3 className="text-sm font-bold text-slate-800">{title}</h3>
      <pre className="mt-2 max-h-64 overflow-auto rounded-xl border border-slate-100 bg-slate-50 p-4 text-xs text-slate-700">
        {display(value)}
      </pre>
    </section>
  )
}

export default SystemActivityLogPage
