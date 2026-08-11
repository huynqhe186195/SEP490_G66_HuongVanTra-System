import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import OpsActionQueue from '../../../components/shared/OpsActionQueue.jsx'
import PageHeader from '../../../components/shared/PageHeader.jsx'
import PageShell from '../../../components/shared/PageShell.jsx'
import TablePagination from '../../../components/shared/TablePagination.jsx'
import { useTotalAwarePageSize } from '../../../utils/totalAwarePageSize.js'
import { showError, showSuccess } from '../../../app/toast.js'
import { formatVietnamDateTime } from '../../../utils/vietnamDateTime.js'
import { canAccessPath } from '../../../app/navigation.js'
import { canInspectReturn } from '../../auth/utils/permissions.js'
import { loadAuthSession } from '../../auth/services/authSession.js'
import {
  RETURN_DISPOSITIONS,
  fetchReturnInspections,
  getDispositionClass,
  getDispositionLabel,
  inspectReturn,
} from '../services/returnInspectionApi.js'

const TABS = [
  { key: 'pending', label: 'Chờ kiểm tra', disposition: 'Pending' },
  { key: 'restock', label: 'Duyệt nhập lại', disposition: 'RestockApproved' },
  { key: 'quarantined', label: 'Kiểm dịch', disposition: 'Quarantined' },
  { key: 'disposed', label: 'Tiêu hủy', disposition: 'Disposed' },
  { key: 'all', label: 'Tất cả', disposition: undefined },
]

const DISPOSITION_HINTS = {
  RestockApproved: 'Hàng đạt kiểm tra — tăng tồn Kệ Hàng để bán lại.',
  Quarantined: 'Nghi ngờ lỗi — tạo lô kiểm dịch, KHÔNG tính vào tồn bán.',
  Disposed: 'Không thể dùng — tiêu hủy, không thay đổi tồn.',
}

function InspectModal({ inspection, onClose, onDone }) {
  const [disposition, setDisposition] = useState('RestockApproved')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      await inspectReturn(inspection.id, { disposition, note })
      showSuccess(`Đã ghi nhận quyết định: ${getDispositionLabel(disposition)}.`)
      onDone()
    } catch (error) {
      showError(error.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-xl">
        <h3 className="text-lg font-bold text-slate-800">Kiểm tra hàng trả</h3>
        <p className="mt-1 text-sm text-slate-500">
          {inspection.returnCode} · {inspection.skuCode || inspection.skuSnapshotName} · SL{' '}
          {inspection.quantity}
        </p>

        <div className="mt-5 space-y-3">
          {RETURN_DISPOSITIONS.map((option) => (
            <label
              key={option}
              className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-3 ${
                disposition === option ? 'border-[#538463] bg-[#538463]/5' : 'border-slate-200'
              }`}
            >
              <input
                type="radio"
                name="disposition"
                className="mt-1"
                checked={disposition === option}
                onChange={() => setDisposition(option)}
              />
              <span>
                <span className="block text-sm font-semibold text-slate-700">
                  {getDispositionLabel(option)}
                </span>
                <span className="block text-xs text-slate-500">{DISPOSITION_HINTS[option]}</span>
              </span>
            </label>
          ))}
        </div>

        <label className="mt-4 block text-sm font-medium text-slate-600">
          Ghi chú kiểm tra
          <textarea
            className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm"
            rows={3}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Lý do quyết định (không bắt buộc)..."
          />
        </label>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            Đóng
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="rounded-xl bg-[#538463] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#457053] disabled:opacity-50"
          >
            {submitting ? 'Đang lưu...' : 'Xác nhận quyết định'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ReturnInspectionsPage() {
  const session = loadAuthSession()
  const canInspect = canInspectReturn(session)
  const canOpenOrders = canAccessPath(session, '/orders')
  const [activeTab, setActiveTab] = useState('pending')
  const [searchValue, setSearchValue] = useState('')
  const [rows, setRows] = useState([])
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const { pageSize, setPageSize, pageSizeOptions } = useTotalAwarePageSize(totalCount)

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil((totalCount || 0) / pageSize) || 1)
    if (page > totalPages) setPage(totalPages)
  }, [totalCount, pageSize, page])
  const [isLoading, setIsLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [snapshotCounts, setSnapshotCounts] = useState({
    pending: 0,
    restock: 0,
    quarantined: 0,
    all: 0,
  })

  const loadSnapshotCounts = useCallback(async () => {
    try {
      const [pending, restock, quarantined, all] = await Promise.all([
        fetchReturnInspections({ disposition: 'Pending', page: 1, pageSize: 1 }),
        fetchReturnInspections({ disposition: 'RestockApproved', page: 1, pageSize: 1 }),
        fetchReturnInspections({ disposition: 'Quarantined', page: 1, pageSize: 1 }),
        fetchReturnInspections({ page: 1, pageSize: 1 }),
      ])
      setSnapshotCounts({
        pending: pending.totalCount,
        restock: restock.totalCount,
        quarantined: quarantined.totalCount,
        all: all.totalCount,
      })
    } catch {
      setSnapshotCounts({ pending: 0, restock: 0, quarantined: 0, all: 0 })
    }
  }, [])

  useEffect(() => {
    loadSnapshotCounts()
  }, [loadSnapshotCounts])

  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const tab = TABS.find((t) => t.key === activeTab)
      const result = await fetchReturnInspections({
        disposition: tab?.disposition,
        search: searchValue.trim() || undefined,
        page,
        pageSize,
      })
      setRows(result.items)
      setTotalCount(result.totalCount)
    } catch (error) {
      setRows([])
      setTotalCount(0)
      showError(error.message)
    } finally {
      setIsLoading(false)
    }
  }, [activeTab, searchValue, page, pageSize])

  useEffect(() => {
    const timer = setTimeout(loadData, 250)
    return () => clearTimeout(timer)
  }, [loadData])

  const pendingCount = useMemo(
    () => rows.filter((r) => String(r.disposition).toLowerCase() === 'pending').length,
    [rows],
  )

  const selectTab = (key) => {
    setActiveTab(key)
    setPage(1)
  }

  const actionItems = useMemo(
    () => [
      canInspect && {
        id: 'inspect-pending',
        title: 'Kiểm tra hàng trả chờ xử lý',
        hint: 'Quyết định nhập lại / kiểm dịch / tiêu hủy',
        icon: 'fact_check',
        iconBg: 'bg-amber-50',
        iconColor: 'text-amber-700',
        count: snapshotCounts.pending,
        onClick: () => selectTab('pending'),
      },
      {
        id: 'view-returns',
        title: 'Xem trang trả hàng',
        hint: 'Danh sách yêu cầu trả / đổi hàng của khách',
        icon: 'undo',
        alwaysShow: true,
        to: '/inventory/returns',
      },
    ].filter(Boolean),
    [canInspect, snapshotCounts.pending],
  )

  return (
    <PageShell>
      <PageHeader
        compact
        title="Kiểm tra hàng trả"
        titleInfo={
          canInspect
            ? 'Hàng trả KHÔNG tự tăng tồn bán. Kiểm tra rồi quyết định: nhập lại / kiểm dịch / tiêu hủy.'
            : 'Theo dõi trạng thái kiểm tra hàng trả.'
        }
        searchPlaceholder="Tìm mã trả / mã đơn / SKU..."
        searchValue={searchValue}
        onSearchChange={(value) => {
          setSearchValue(value)
          setPage(1)
        }}
      />

      <OpsActionQueue items={actionItems} className="mb-3" />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => selectTab(tab.key)}
            className={`rounded-xl px-5 py-2.5 text-sm font-semibold transition-colors ${
              activeTab === tab.key
                ? 'bg-[#538463] text-white shadow-md shadow-[#538463]/20'
                : 'bg-white text-slate-600 hover:bg-slate-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
        {activeTab === 'pending' && pendingCount > 0 ? (
          <span className="ml-auto rounded-full bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-700">
            {pendingCount} mục đang chờ kiểm tra
          </span>
        ) : null}
      </div>

      <section className="rounded-3xl border border-slate-100 bg-white shadow-sm">
        <div className="custom-scrollbar overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-[#fbf9f1]/50 text-xs font-bold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-8 py-4">Mã trả / Đơn</th>
                <th className="px-4 py-4">Sản Phẩm</th>
                <th className="px-4 py-4 text-right">SL</th>
                <th className="px-4 py-4">Quyết định</th>
                <th className="px-4 py-4">Người kiểm tra</th>
                <th className="px-4 py-4">Thời điểm</th>
                <th className="px-4 py-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {isLoading ? (
                <tr>
                  <td className="px-8 py-10 text-center text-slate-500" colSpan={7}>
                    <span className="inline-flex items-center gap-2 text-sm font-semibold">
                      <span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>
                      Đang tải mục kiểm tra...
                    </span>
                  </td>
                </tr>
              ) : null}
              {!isLoading && rows.length === 0 ? (
                <tr>
                  <td className="px-8 py-12 text-center" colSpan={7}>
                    <p className="font-semibold text-slate-800">
                      {searchValue.trim() || activeTab !== 'pending'
                        ? 'Không có mục kiểm tra trong bộ lọc này'
                        : 'Chưa có hàng trả chờ kiểm tra'}
                    </p>
                    <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
                      {searchValue.trim() || activeTab !== 'pending'
                        ? 'Thử đổi tab hoặc xóa từ khóa.'
                        : 'Khi có hàng trả từ khách, kiểm tra rồi chọn: nhập lại / kiểm dịch / tiêu hủy. Hàng trả không tự tăng tồn bán.'}
                    </p>
                    <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                      {searchValue.trim() || activeTab !== 'pending' ? (
                        <button
                          type="button"
                          onClick={() => {
                            setSearchValue('')
                            selectTab('pending')
                          }}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
                        >
                          <span className="material-symbols-outlined text-[18px]">filter_alt_off</span>
                          Về mục chờ kiểm tra
                        </button>
                      ) : null}
                      <Link
                        to="/inventory/returns"
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
                      >
                        <span className="material-symbols-outlined text-[18px]">undo</span>
                        Xem trang trả hàng
                      </Link>
                    </div>
                  </td>
                </tr>
              ) : null}
              {!isLoading
                ? rows.map((row) => {
                    const isPending = String(row.disposition).toLowerCase() === 'pending'
                    return (
                      <tr key={row.id} className="transition-colors hover:bg-[#fbf9f1]/30">
                        <td className="px-8 py-5">
                          <p className="font-bold text-slate-700">{row.returnCode || '—'}</p>
                          {row.orderId && canOpenOrders ? (
                            <Link
                              className="text-xs text-slate-500 hover:text-[#538463] hover:underline"
                              to={`/orders/${row.orderId}`}
                            >
                              {row.orderCode || row.orderId}
                            </Link>
                          ) : (
                            <span className="text-xs text-slate-400">{row.orderCode || '—'}</span>
                          )}
                        </td>
                        <td className="px-4 py-5 text-sm text-slate-600">
                          <p className="font-semibold text-slate-900">{row.skuSnapshotName || '—'}</p>
                          <p className="font-mono text-xs text-slate-400">{row.skuCode}</p>
                        </td>
                        <td className="px-4 py-5 text-right font-semibold text-slate-700">
                          {row.quantity}
                        </td>
                        <td className="px-4 py-5">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${getDispositionClass(row.disposition)}`}
                          >
                            {getDispositionLabel(row.disposition)}
                          </span>
                        </td>
                        <td className="px-4 py-5 text-sm text-slate-600">
                          {row.inspectedBy ? (
                            <span className="font-mono text-xs">{row.inspectedBy}</span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                          {row.inspectionNote ? (
                            <p className="mt-1 text-xs text-slate-400">{row.inspectionNote}</p>
                          ) : null}
                        </td>
                        <td className="px-4 py-5 text-sm text-slate-500">
                          {formatVietnamDateTime(row.inspectedAt ?? row.createdAt)}
                        </td>
                        <td className="px-4 py-5 text-right">
                          {isPending && canInspect ? (
                            <button
                              type="button"
                              onClick={() => setSelected(row)}
                              className="rounded-lg bg-[#538463] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#457053]"
                            >
                              Kiểm tra
                            </button>
                          ) : (
                            <span className="text-xs text-slate-400">
                              {isPending ? 'Chờ kiểm tra' : 'Đã xử lý'}
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })
                : null}
            </tbody>
          </table>
        </div>
        <TablePagination
          page={page}
          pageSize={pageSize}
          pageSizeOptions={pageSizeOptions}
          totalCount={totalCount}
          itemLabel="mục kiểm tra hàng trả"
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size)
            setPage(1)
          }}
        />
      </section>

      {selected ? (
        <InspectModal
          inspection={selected}
          onClose={() => setSelected(null)}
          onDone={() => {
            setSelected(null)
            loadData()
            loadSnapshotCounts()
          }}
        />
      ) : null}
    </PageShell>
  )
}

export default ReturnInspectionsPage
