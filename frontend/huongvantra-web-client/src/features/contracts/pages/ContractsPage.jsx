import { useEffect, useMemo, useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import PageHeader from '../../../components/shared/PageHeader.jsx'
import PageShell from '../../../components/shared/PageShell.jsx'
import TablePagination, { TABLE_PAGE_SIZE } from '../../../components/shared/TablePagination.jsx'
import { confirmDialog } from '../../../app/dialog.js'
import { showError, showSuccess } from '../../../app/toast.js'
import { loadAuthSession } from '../../auth/services/authSession.js'
import { canCreateContracts } from '../../auth/utils/permissions.js'
import { fetchContracts, deleteContract } from '../services/contractsApi.js'

const STATUS_TABS = [
  { key: '', label: 'Tất cả' },
  { key: 'Draft', label: 'Nháp' },
  { key: 'PendingApproval', label: 'Chờ duyệt' },
  { key: 'Active', label: 'Hiệu lực' },
  { key: 'Rejected', label: 'Từ chối' },
  { key: 'Expired', label: 'Hết hạn' },
]

const CONTRACT_TYPE_LABELS = {
  DaiLy: 'Đại lý',
  CungCap: 'Cung cấp',
  KhungHopTac: 'Khung hợp tác',
  Khac: 'Khác',
}

const STATUS_BADGES = {
  Draft: { label: 'Nháp', cls: 'bg-[#f2f0e8] text-[#717971]' },
  PendingApproval: { label: 'Chờ duyệt', cls: 'bg-[#fef3c7] text-[#92400e]' },
  Active: { label: 'Hiệu lực', cls: 'bg-[#dcfce7] text-[#166534]' },
  Rejected: { label: 'Từ chối', cls: 'bg-[#fee2e2] text-[#991b1b]' },
  Expired: { label: 'Hết hạn', cls: 'bg-[#e2e8f0] text-[#475569]' },
}

function StatusBadge({ status }) {
  const badge = STATUS_BADGES[status] ?? { label: status, cls: 'bg-[#f2f0e8] text-[#717971]' }
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${badge.cls}`}>
      {badge.label}
    </span>
  )
}

function formatDate(value) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('vi-VN')
}

const TH = 'border-b border-[#f0eee6] px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-wide text-[#717971] sm:px-6 sm:py-4 sm:text-xs'
const TD = 'border-b border-[#f0eee6] px-3 py-3 text-sm sm:px-6 sm:py-4'

function ContractsPage() {
  const navigate = useNavigate()
  const session = useMemo(() => loadAuthSession(), [])
  const canCreate = canCreateContracts(session)
  const currentUserId = session?.userId

  const [statusTab, setStatusTab] = useState('')
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(TABLE_PAGE_SIZE)
  const [contracts, setContracts] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [deletingId, setDeletingId] = useState(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const result = await fetchContracts({ search, status: statusTab || undefined, page, pageSize })
      setContracts(result.items)
      setTotalCount(result.totalCount)
    } catch {
      showError('Không thể tải danh sách hợp đồng.')
    } finally {
      setIsLoading(false)
    }
  }, [search, statusTab, page, pageSize])

  useEffect(() => {
    load()
  }, [load])

  function handleSearchSubmit(e) {
    e.preventDefault()
    setSearch(searchInput)
    setPage(1)
  }

  function handleTabChange(key) {
    setStatusTab(key)
    setPage(1)
  }

  async function handleDelete(contract) {
    if (!(await confirmDialog({
      title: 'Xác nhận',
      message: `Xóa hợp đồng "${contract.contractCode} — ${contract.title}"?`,
      tone: 'danger',
    }))) return
    setDeletingId(contract.id)
    try {
      await deleteContract(contract.id)
      showSuccess('Đã xóa hợp đồng.')
      load()
    } catch {
      showError('Không thể xóa hợp đồng.')
    } finally {
      setDeletingId(null)
    }
  }

  const totalPages = Math.ceil(totalCount / pageSize)

  return (
    <PageShell>
      <PageHeader
        title="Hợp đồng"
        titleInfo="Quản lý hợp đồng với khách doanh nghiệp"
        rightContent={
          canCreate && (
            <Link
              to="/contracts/new"
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#1a1a1a] px-4 py-2 text-sm font-medium text-white hover:bg-[#333]"
            >
              <span className="material-symbols-outlined text-base">add</span>
              Tạo hợp đồng
            </Link>
          )
        }
      />

      {/* Status tabs */}
      <div className="mb-4 flex gap-1 border-b border-[#f0eee6]">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => handleTabChange(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors ${
              statusTab === tab.key
                ? 'border-b-2 border-[#1a1a1a] text-[#1a1a1a]'
                : 'text-[#717971] hover:text-[#1a1a1a]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <form onSubmit={handleSearchSubmit} className="mb-4 flex gap-2">
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Tìm theo mã, tiêu đề, khách hàng..."
          className="flex-1 rounded-lg border border-[#e8e5de] bg-white px-3 py-2 text-sm outline-none focus:border-[#1a1a1a]"
        />
        <button
          type="submit"
          className="rounded-lg border border-[#e8e5de] bg-white px-3 py-2 text-sm font-medium text-[#717971] hover:bg-[#f9f7f2]"
        >
          Tìm
        </button>
      </form>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-[#f0eee6] bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead className="bg-[#f9f7f2]">
              <tr>
                <th className={TH}>Mã HĐ</th>
                <th className={TH}>Khách hàng</th>
                <th className={TH}>Loại</th>
                <th className={TH}>Tiêu đề</th>
                <th className={TH}>Ngày hiệu lực</th>
                <th className={TH}>Ngày hết hạn</th>
                <th className={TH}>Trạng thái</th>
                <th className={TH}></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-10 text-center text-sm text-[#717971]">
                    Đang tải...
                  </td>
                </tr>
              ) : contracts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-10 text-center text-sm text-[#717971]">
                    Không có hợp đồng nào.
                  </td>
                </tr>
              ) : (
                contracts.map((c) => {
                  const isOwner = c.createdByUserId === currentUserId
                  const isEditable = c.status === 'Draft' || c.status === 'Rejected'
                  const canEdit = isOwner && isEditable
                  const canDel = isOwner && isEditable
                  return (
                    <tr key={c.id} className="hover:bg-[#fafaf8]">
                      <td className={TD}>
                        <Link to={`/contracts/${c.id}`} className="font-mono text-xs text-[#1a6ba0] hover:underline">
                          {c.contractCode}
                        </Link>
                      </td>
                      <td className={TD}>
                        <p className="font-medium text-[#1a1a1a]">{c.customerName}</p>
                        <p className="text-xs text-[#717971]">{c.customerCode}</p>
                      </td>
                      <td className={TD}>
                        <span className="text-sm text-[#717971]">
                          {CONTRACT_TYPE_LABELS[c.contractType] ?? c.contractType}
                        </span>
                      </td>
                      <td className={TD}>
                        <span className="line-clamp-2 max-w-[220px] text-sm">{c.title}</span>
                      </td>
                      <td className={TD}>
                        <span className="text-sm text-[#717971]">{formatDate(c.effectiveDate)}</span>
                      </td>
                      <td className={TD}>
                        <span className="text-sm text-[#717971]">{formatDate(c.expiryDate)}</span>
                      </td>
                      <td className={TD}>
                        <StatusBadge status={c.status} />
                      </td>
                      <td className={`${TD} text-right`}>
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            to={`/contracts/${c.id}`}
                            className="rounded px-2 py-1 text-xs text-[#717971] hover:bg-[#f2f0e8] hover:text-[#1a1a1a]"
                          >
                            Xem
                          </Link>
                          {canEdit && (
                            <Link
                              to={`/contracts/${c.id}/edit`}
                              className="rounded px-2 py-1 text-xs text-[#717971] hover:bg-[#f2f0e8] hover:text-[#1a1a1a]"
                            >
                              Sửa
                            </Link>
                          )}
                          {canDel && (
                            <button
                              onClick={() => handleDelete(c)}
                              disabled={deletingId === c.id}
                              className="rounded px-2 py-1 text-xs text-[#b42318] hover:bg-[#fee2e2] disabled:opacity-50"
                            >
                              Xóa
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <TablePagination
          page={page}
          pageSize={pageSize}
          totalCount={totalCount}
          totalPages={totalPages}
          onPageChange={setPage}
          onPageSizeChange={(s) => { setPageSize(s); setPage(1) }}
        />
      )}
    </PageShell>
  )
}

export default ContractsPage
