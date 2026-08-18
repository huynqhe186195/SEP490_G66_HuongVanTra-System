import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import PageHeader from '../../../components/shared/PageHeader.jsx'
import PageShell from '../../../components/shared/PageShell.jsx'
import TablePagination from '../../../components/shared/TablePagination.jsx'
import { useTotalAwarePageSize } from '../../../utils/totalAwarePageSize.js'
import { showError } from '../../../app/toast.js'
import { HubSegment, StatusPill } from '../components/IntegrationUi.jsx'
import { fetchOutboxMessages } from '../services/outboxMonitoringApi.js'
import { HUB_CHANNELS, buildHubRows, isVietnamToday } from '../utils/outboxPayload.js'

function IntegrationsPage() {
  const navigate = useNavigate()
  const [searchValue, setSearchValue] = useState('')
  const [scope, setScope] = useState('all')
  const [channelFilter, setChannelFilter] = useState('')
  const [rows, setRows] = useState(() => buildHubRows([]))
  const [page, setPage] = useState(1)
  const [failedCount, setFailedCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const [result, failed, pending] = await Promise.all([
        fetchOutboxMessages({ page: 1, pageSize: 100 }),
        fetchOutboxMessages({ status: 'Failed', page: 1, pageSize: 100 }),
        fetchOutboxMessages({ status: 'Pending', page: 1, pageSize: 100 }),
      ])
      const byId = new Map()
      for (const item of [...result.items, ...failed.items, ...pending.items]) {
        if (item.orderChannel === 'POS' || item.orderChannel === 'COD') byId.set(item.id, item)
      }
      const items = [...byId.values()]
      setRows(buildHubRows(items))
      setFailedCount(items.filter((item) => item.status === 'Failed').length)
    } catch (error) {
      setRows(buildHubRows([]))
      setFailedCount(0)
      showError(error.message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const visible = useMemo(() => {
    const needle = searchValue.trim().toLowerCase()
    return rows.filter((row) => {
      if (needle && !`${row.label} ${row.connectionType}`.toLowerCase().includes(needle)) return false
      if (channelFilter && row.id !== channelFilter) return false
      if (scope === 'today' && !isVietnamToday(row.lastSyncAt)) return false
      return true
    })
  }, [rows, searchValue, scope, channelFilter])

  const { pageSize, setPageSize, pageSizeOptions } = useTotalAwarePageSize(visible.length)

  useEffect(() => {
    const timer = window.setTimeout(() => setPage(1), 0)
    return () => window.clearTimeout(timer)
  }, [searchValue, scope, channelFilter])

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil((visible.length || 0) / pageSize) || 1)
    if (page <= totalPages) return undefined
    const timer = window.setTimeout(() => setPage(totalPages), 0)
    return () => window.clearTimeout(timer)
  }, [visible.length, page, pageSize])

  const pagedRows = useMemo(() => {
    const start = (page - 1) * pageSize
    return visible.slice(start, start + pageSize)
  }, [visible, page, pageSize])

  return (
    <PageShell>
      <PageHeader
        compact
        title="Tích hợp"
        titleInfo="Theo dõi POS và COD đã báo sang kho chưa. Không phải danh sách đơn hàng."
        searchPlaceholder="Tìm kênh POS, COD..."
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        rightContent={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Link
              to="/admin/inventory-sync"
              className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              {failedCount > 0 ? `Hàng đợi đồng bộ (${failedCount} lỗi)` : 'Hàng đợi đồng bộ'}
            </Link>
            <Link
              to="/orders/cod"
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#538463] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#457053]"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              Tạo mới
            </Link>
          </div>
        }
      />

      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <HubSegment
          label="Thời gian"
          value={scope}
          onChange={setScope}
          options={[
            { id: 'all', label: 'Tất cả' },
            { id: 'today', label: 'Hôm nay' },
          ]}
        />
        <HubSegment
          label="Kênh"
          value={channelFilter}
          onChange={setChannelFilter}
          options={[
            { id: '', label: 'Tất cả' },
            ...HUB_CHANNELS.map((channel) => ({ id: channel.id, label: channel.label })),
          ]}
        />
      </div>

      <section className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
        <div className="p-5 sm:p-6">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-slate-800">Danh sách kênh</h2>
          </div>
          <div className="custom-scrollbar overflow-x-auto">
            <table className="w-full min-w-[720px] text-left">
              <thead className="text-xs font-bold uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-4 py-3">Kênh</th>
                  <th className="px-4 py-3">Kiểu kết nối</th>
                  <th className="px-4 py-3">Lần đồng bộ</th>
                  <th className="px-4 py-3">Trạng thái</th>
                  <th className="px-4 py-3 text-right">Lỗi chờ xử lý</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {isLoading ? (
                  <tr>
                    <td className="px-4 py-10 text-center text-sm text-slate-500" colSpan={5}>
                      Đang tải...
                    </td>
                  </tr>
                ) : null}
                {!isLoading && visible.length === 0 ? (
                  <tr>
                    <td className="px-4 py-10 text-center text-sm text-slate-500" colSpan={5}>
                      Không có kênh trong bộ lọc này
                    </td>
                  </tr>
                ) : null}
                {!isLoading
                  ? pagedRows.map((row) => (
                      <tr
                        key={row.id}
                        className="cursor-pointer hover:bg-[#fbf9f1]/60"
                        onClick={() =>
                          navigate(
                            row.pendingErrors > 0
                              ? `/admin/inventory-sync?channel=${row.id}`
                              : '/admin/inventory-sync',
                          )
                        }
                      >
                        <td className="px-4 py-4 font-bold text-slate-800">{row.label}</td>
                        <td className="px-4 py-4 text-sm text-slate-600">{row.connectionType}</td>
                        <td className="px-4 py-4 text-sm text-slate-600">{row.lastSyncLabel}</td>
                        <td className="px-4 py-4">
                          <StatusPill status={row.status} />
                        </td>
                        <td className="px-4 py-4 text-right text-sm font-semibold text-slate-700">
                          {row.pendingErrors}
                        </td>
                      </tr>
                    ))
                  : null}
              </tbody>
            </table>
          </div>
        </div>
        <TablePagination
          page={page}
          pageSize={pageSize}
          pageSizeOptions={pageSizeOptions}
          totalCount={visible.length}
          itemLabel="kênh"
          disabled={isLoading}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size)
            setPage(1)
          }}
        />
      </section>
    </PageShell>
  )
}

export default IntegrationsPage
