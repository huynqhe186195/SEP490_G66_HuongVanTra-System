import { useCallback, useEffect, useMemo, useState } from 'react'
import PageHeader from '../../../components/shared/PageHeader.jsx'
import PageShell from '../../../components/shared/PageShell.jsx'
import TablePagination, { TABLE_PAGE_SIZE } from '../../../components/shared/TablePagination.jsx'
import { showError, showSuccess } from '../../../app/toast.js'
import {
  fetchOutboxMessages,
  fetchOutboxMessageDetail,
  fetchOutboxStats,
  retryOutboxMessage,
} from '../services/outboxMonitoringApi.js'

const STATUS_META = {
  Pending: { label: 'Chờ gửi', cls: 'border-amber-200 bg-amber-50 text-amber-700' },
  Processing: { label: 'Đang gửi', cls: 'border-sky-200 bg-sky-50 text-sky-700' },
  Published: { label: 'Đã gửi', cls: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  Failed: { label: 'Thất bại', cls: 'border-rose-200 bg-rose-50 text-rose-700' },
}

function formatDateTime(value) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('vi-VN')
}

function display(value) {
  return value === undefined || value === null || value === '' ? '—' : value
}

function StatusBadge({ status }) {
  const meta = STATUS_META[status] || { label: status || '—', cls: 'border-slate-200 bg-slate-50 text-slate-600' }
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${meta.cls}`}>
      {meta.label}
    </span>
  )
}

function InventorySyncMonitorPage() {
  const [filters, setFilters] = useState({ status: '', eventType: '' })
  const [messages, setMessages] = useState([])
  const [stats, setStats] = useState({ pending: 0, processing: 0, published: 0, failed: 0 })
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: TABLE_PAGE_SIZE,
    totalCount: 0,
    totalPages: 1,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [isDetailLoading, setIsDetailLoading] = useState(false)
  const [retryingId, setRetryingId] = useState(null)

  const queryParams = useMemo(
    () => ({
      status: filters.status,
      eventType: filters.eventType.trim(),
      page: pagination.page,
      pageSize: pagination.pageSize,
    }),
    [filters, pagination.page, pagination.pageSize],
  )

  const loadStats = useCallback(async () => {
    try {
      setStats(await fetchOutboxStats())
    } catch (error) {
      showError(error.message)
    }
  }, [])

  const loadMessages = useCallback(async () => {
    setIsLoading(true)
    try {
      const result = await fetchOutboxMessages(queryParams)
      setMessages(result.items)
      setPagination((current) => ({
        ...current,
        page: result.page,
        pageSize: result.pageSize,
        totalCount: result.totalCount,
        totalPages: result.totalPages,
      }))
    } catch (error) {
      setMessages([])
      showError(error.message)
    } finally {
      setIsLoading(false)
    }
  }, [queryParams])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadMessages()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [loadMessages])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadStats()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [loadStats])

  function updateFilter(key, value) {
    setFilters((current) => ({ ...current, [key]: value }))
    setPagination((current) => ({ ...current, page: 1 }))
  }

  async function openDetail(message) {
    setIsDetailLoading(true)
    setSelected(message)
    try {
      const detail = await fetchOutboxMessageDetail(message.id)
      setSelected(detail || message)
    } catch (error) {
      showError(error.message)
    } finally {
      setIsDetailLoading(false)
    }
  }

  async function handleRetry(message) {
    setRetryingId(message.id)
    try {
      const result = await retryOutboxMessage(message.id)
      showSuccess(result.message || 'Đã yêu cầu gửi lại.')
      await Promise.all([loadMessages(), loadStats()])
    } catch (error) {
      showError(error.message)
    } finally {
      setRetryingId(null)
    }
  }

  return (
    <PageShell>
      <PageHeader
        title="Giám sát đồng bộ tồn kho"
        description="Theo dõi hàng đợi Outbox phát sự kiện đơn hàng sang kho và gửi lại thủ công khi thất bại."
        rightContent={
          <button
            type="button"
            onClick={() => Promise.all([loadMessages(), loadStats()])}
            disabled={isLoading}
            className="rounded-xl border border-[#538463] px-4 py-2 text-sm font-semibold text-[#356647] hover:bg-[#538463]/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Làm mới
          </button>
        }
      />

      <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Chờ gửi" value={stats.pending} cls="text-amber-700" />
        <StatCard label="Đang gửi" value={stats.processing} cls="text-sky-700" />
        <StatCard label="Đã gửi" value={stats.published} cls="text-emerald-700" />
        <StatCard label="Thất bại" value={stats.failed} cls="text-rose-700" />
      </section>

      <section className="mb-5 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-3">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Trạng thái
            <select
              value={filters.status}
              onChange={(event) => updateFilter('status', event.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm normal-case tracking-normal text-slate-700"
            >
              <option value="">Tất cả</option>
              <option value="Pending">Chờ gửi</option>
              <option value="Processing">Đang gửi</option>
              <option value="Published">Đã gửi</option>
              <option value="Failed">Thất bại</option>
            </select>
          </label>
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 md:col-span-2">
            Loại sự kiện
            <input
              type="text"
              value={filters.eventType}
              onChange={(event) => updateFilter('eventType', event.target.value)}
              placeholder="OrderPlacedEvent, OrderCancelledEvent..."
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm normal-case tracking-normal text-slate-700"
            />
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div className="custom-scrollbar overflow-x-auto">
          <table className="min-w-[1000px] w-full text-left text-sm">
            <thead className="bg-[#fbf9f1]/70 text-xs font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3">Loại sự kiện</th>
                <th className="px-4 py-3">Aggregate</th>
                <th className="px-4 py-3">Trạng thái</th>
                <th className="px-4 py-3">Số lần thử</th>
                <th className="px-4 py-3">Phát sinh</th>
                <th className="px-4 py-3">Lỗi gần nhất</th>
                <th className="px-4 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-slate-500">
                    Đang tải danh sách...
                  </td>
                </tr>
              ) : null}
              {!isLoading && messages.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-slate-500">
                    Không có message phù hợp bộ lọc.
                  </td>
                </tr>
              ) : null}
              {!isLoading
                ? messages.map((message) => (
                    <tr key={message.id} className="hover:bg-[#fbf9f1]/40">
                      <td className="px-4 py-4 font-semibold text-slate-800">{display(message.eventType)}</td>
                      <td className="px-4 py-4 font-mono text-xs text-slate-600">{display(message.aggregateId)}</td>
                      <td className="px-4 py-4">
                        <StatusBadge status={message.status} />
                      </td>
                      <td className="px-4 py-4 text-slate-700">{message.retryCount}</td>
                      <td className="px-4 py-4 text-slate-700">{formatDateTime(message.occurredAtUtc)}</td>
                      <td className="px-4 py-4 max-w-[240px] truncate text-xs text-rose-600" title={message.lastError || ''}>
                        {display(message.lastError)}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openDetail(message)}
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            Chi tiết
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRetry(message)}
                            disabled={message.status === 'Published' || retryingId === message.id}
                            className="rounded-lg border border-[#538463] px-3 py-1.5 text-xs font-semibold text-[#356647] hover:bg-[#538463]/10 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {retryingId === message.id ? 'Đang gửi...' : 'Gửi lại'}
                          </button>
                        </div>
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
          itemLabel="message"
        />
      </section>

      {selected ? (
        <MessageDetailModal message={selected} isLoading={isDetailLoading} onClose={() => setSelected(null)} />
      ) : null}
    </PageShell>
  )
}

function StatCard({ label, value, cls }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${cls}`}>{value}</div>
    </div>
  )
}

function MessageDetailModal({ message, isLoading, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Chi tiết message</h2>
            <p className="font-mono text-xs text-slate-500">{display(message.id)}</p>
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
          <dl className="grid gap-4 md:grid-cols-2">
            <DetailItem label="Loại sự kiện" value={message.eventType} />
            <DetailItem label="Trạng thái" value={STATUS_META[message.status]?.label || message.status} />
            <DetailItem label="Aggregate" value={message.aggregateId} />
            <DetailItem label="Số lần thử" value={message.retryCount} />
            <DetailItem label="Phát sinh" value={formatDateTime(message.occurredAtUtc)} />
            <DetailItem label="Thử gần nhất" value={formatDateTime(message.lastAttemptAtUtc)} />
            <DetailItem label="Lần thử kế" value={formatDateTime(message.nextAttemptAtUtc)} />
            <DetailItem label="Đã gửi lúc" value={formatDateTime(message.publishedAtUtc)} />
            <DetailItem label="Đang khóa bởi" value={message.lockedBy} />
            <DetailItem label="Khóa đến" value={formatDateTime(message.lockedUntilUtc)} />
            <DetailItem label="Lỗi gần nhất" value={message.lastError} wide />
          </dl>
          {message.payload ? (
            <section className="mt-6">
              <h3 className="text-sm font-bold text-slate-800">Payload</h3>
              <pre className="mt-2 max-h-72 overflow-auto rounded-xl border border-slate-100 bg-slate-50 p-4 text-xs text-slate-700">
                {message.payload}
              </pre>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function DetailItem({ label, value, wide = false }) {
  return (
    <div className={wide ? 'md:col-span-2' : ''}>
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-1 break-words text-sm font-medium text-slate-800">{display(value)}</dd>
    </div>
  )
}

export default InventorySyncMonitorPage
