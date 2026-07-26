import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import PageHeader from '../../../components/shared/PageHeader.jsx'
import PageShell from '../../../components/shared/PageShell.jsx'
import TablePagination, { TABLE_PAGE_SIZE } from '../../../components/shared/TablePagination.jsx'
import { showError } from '../../../app/toast.js'
import { AUTH_SESSION_CHANGED_EVENT, loadAuthSession } from '../../auth/services/authSession.js'
import { getStaffManagementScopeLabel } from '../../auth/utils/permissions.js'
import { fetchRoleOptions, fetchStaffAccounts } from '../services/staffApi.js'

function StaffPage() {
  const [authSession, setAuthSession] = useState(() => loadAuthSession())
  const [staffRows, setStaffRows] = useState([])
  const [roleOptions, setRoleOptions] = useState([])
  const [searchValue, setSearchValue] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(TABLE_PAGE_SIZE)
  const [totalCount, setTotalCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const refreshSession = () => setAuthSession(loadAuthSession())
    window.addEventListener(AUTH_SESSION_CHANGED_EVENT, refreshSession)
    return () => window.removeEventListener(AUTH_SESSION_CHANGED_EVENT, refreshSession)
  }, [])

  const scopeLabel = getStaffManagementScopeLabel(authSession)

  useEffect(() => {
    let mounted = true

    const timer = setTimeout(async () => {
      try {
        setIsLoading(true)
        const [roles, data] = await Promise.all([
          fetchRoleOptions(),
          fetchStaffAccounts({
            search: searchValue.trim() || undefined,
            role: roleFilter || undefined,
            isActive: statusFilter === '' ? undefined : statusFilter === 'active',
            page,
            pageSize,
          }),
        ])

        if (!mounted) return
        setRoleOptions(roles || [])
        setStaffRows(data.items || [])
        setTotalCount(data.totalCount || 0)
      } catch (error) {
        if (mounted) showError(error.message)
      } finally {
        if (mounted) setIsLoading(false)
      }
    }, 250)

    return () => {
      mounted = false
      clearTimeout(timer)
    }
  }, [searchValue, roleFilter, statusFilter, page, pageSize])

  const stats = useMemo(() => {
    const active = staffRows.filter((item) => item.isActive).length
    const locked = staffRows.filter((item) => !item.isActive).length
    return [
      { label: 'Tổng nhân sự', value: String(totalCount), icon: 'groups', tone: 'bg-[#4e7f5e]/20 text-[#356647]' },
      { label: 'Đang hoạt động', value: String(active), icon: 'check_circle', tone: 'bg-[#627b59]/20 text-[#4a6242]' },
      { label: 'Tài khoản khóa', value: String(locked), icon: 'lock', tone: 'bg-[#ffdad6] text-[#ba1a1a]' },
    ]
  }, [staffRows, totalCount])

  const handleFilterChange = (setter) => (event) => {
    setPage(1)
    setter(event.target.value)
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))

  return (
    <PageShell className="[font-family:'Manrope',sans-serif]">
      <PageHeader
        title="Nhân viên"
        titleInfo={scopeLabel}
      />

      <section className="rounded-[24px] border border-[#c1c9c0]/30 bg-white p-6 shadow-sm">
        <div className="mb-8">
          <div className="mb-2 flex items-center gap-2 text-sm text-[#414942]">
            <span>Hệ thống</span>
            <span>/</span>
            <span className="font-semibold text-[#356647]">Nhân viên</span>
          </div>
          <h1 className="text-2xl font-bold text-[#356647] sm:text-3xl">Quản lý nhân sự</h1>
          <p className="mt-2 text-sm text-[#414942]">{scopeLabel}</p>
        </div>

        <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
          {stats.map((stat) => (
            <article key={stat.label} className="flex items-center gap-4 rounded-xl border border-[#c1c9c0]/30 bg-[#fff] p-5 shadow-[0px_4px_20px_rgba(0,0,0,0.04)]">
              <div className={`flex h-12 w-12 items-center justify-center rounded-full ${stat.tone}`}>
                <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
                  {stat.icon}
                </span>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[#414942]">{stat.label}</p>
                <p className="text-2xl font-bold text-[#1b1c17]">{stat.value}</p>
              </div>
            </article>
          ))}
        </div>

        <div className="rounded-xl border border-[#c1c9c0]/30 shadow-[0px_8px_24px_rgba(0,0,0,0.06)]">
          <div className="flex flex-wrap items-center gap-3 border-b border-[#c1c9c0]/30 bg-[#f6f4ec]/70 p-3 sm:p-4">
            <div className="relative w-full min-w-0 sm:max-w-[240px] sm:flex-1">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#414942] text-[20px]">search</span>
              <input
                className="w-full rounded-lg border border-[#c1c9c0] bg-white py-2.5 pl-10 pr-4 text-sm text-[#1b1c17] outline-none focus:border-[#356647] focus:ring-1 focus:ring-[#356647]"
                placeholder="Tên hoặc SĐT..."
                type="text"
                value={searchValue}
                onChange={handleFilterChange(setSearchValue)}
              />
            </div>

            <select
              className="w-full min-w-0 rounded-lg border border-[#c1c9c0] bg-white px-4 py-2.5 text-sm text-[#414942] outline-none focus:border-[#356647] sm:min-w-[180px] sm:max-w-[220px] sm:flex-1"
              value={roleFilter}
              onChange={handleFilterChange(setRoleFilter)}
            >
              <option value="">Tất cả vai trò</option>
              {roleOptions.map((role) => (
                <option key={role.id ?? role.name} value={role.name}>{role.name}</option>
              ))}
            </select>

            <select
              className="w-full min-w-0 rounded-lg border border-[#c1c9c0] bg-white px-4 py-2.5 text-sm text-[#414942] outline-none focus:border-[#356647] sm:min-w-[180px] sm:max-w-[220px] sm:flex-1"
              value={statusFilter}
              onChange={handleFilterChange(setStatusFilter)}
            >
              <option value="">Trạng thái</option>
              <option value="active">Hoạt động</option>
              <option value="locked">Bị khóa</option>
            </select>

            <button type="button" className="rounded-lg p-2.5 text-[#414942] transition-colors hover:bg-[#eae8e0]">
              <span className="material-symbols-outlined">filter_list</span>
            </button>
          </div>

          <div className="custom-scrollbar max-h-[min(70vh,780px)] overflow-auto overscroll-contain">
            <table className="w-full min-w-[720px] border-collapse text-left">
              <thead>
                <tr className="bg-[#f0eee6] text-xs uppercase tracking-wider text-[#414942]">
                  <th className="px-6 py-4 font-semibold">Nhân viên và vai trò</th>
                  <th className="px-6 py-4 font-semibold">Tài khoản</th>
                  <th className="px-6 py-4 font-semibold">Số điện thoại</th>
                  <th className="px-6 py-4 text-center font-semibold">Trạng thái</th>
                  <th className="px-6 py-4 text-right font-semibold">Thao tác</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-[#c1c9c0]/20">
                {isLoading ? (
                  <tr>
                    <td className="px-6 py-6 text-sm text-[#414942]" colSpan={5}>Đang tải dữ liệu...</td>
                  </tr>
                ) : staffRows.length === 0 ? (
                  <tr>
                    <td className="px-6 py-6 text-sm text-[#414942]" colSpan={5}>Không có dữ liệu nhân viên.</td>
                  </tr>
                ) : staffRows.map((staff) => (
                  <tr key={staff.employeeId ?? staff.userGuid ?? staff.username} className="group transition-colors hover:bg-[#356647]/5">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-full bg-[#e7ece4] text-[#356647] ${staff.isActive ? 'ring-2 ring-[#4e7f5e]/20' : 'opacity-60'}`}>
                          <span className="material-symbols-outlined text-[18px]">person</span>
                        </div>
                        <div>
                          <p className={`text-sm font-semibold text-[#1b1c17] ${staff.isActive ? '' : 'opacity-60'}`}>{staff.fullName}</p>
                          <p className={`text-xs text-[#356647] ${staff.isActive ? '' : 'opacity-70'}`}>{(staff.roles || []).join(', ') || 'Chưa gán vai trò'}</p>
                        </div>
                      </div>
                    </td>

                    <td className={`px-6 py-4 text-sm text-[#414942] ${staff.isActive ? '' : 'opacity-60'}`}>{staff.username}</td>
                    <td className={`px-6 py-4 text-sm text-[#414942] ${staff.isActive ? '' : 'opacity-60'}`}>{staff.phone || '-'}</td>

                    <td className="px-6 py-4 text-center">
                      {staff.isActive ? (
                        <span className="inline-flex items-center rounded-full bg-[#baefc8] px-3 py-1 text-xs font-semibold text-[#00210f]">
                          <span className="mr-2 h-1.5 w-1.5 rounded-full bg-[#356647]" />
                          Đang hoạt động
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-[#ffdad6] px-3 py-1 text-xs font-semibold text-[#93000a]">
                          <span className="mr-2 h-1.5 w-1.5 rounded-full bg-[#ba1a1a]" />
                          Đã khóa
                        </span>
                      )}
                    </td>

                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-1 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100">
                        <Link to={`/staff/${staff.userId}`} className="rounded-full p-2 text-[#356647] transition-colors hover:bg-[#eae8e0]" title="Chỉnh sửa">
                          <span className="material-symbols-outlined">edit</span>
                        </Link>
                        <button type="button" className="rounded-full p-2 text-[#414942] transition-colors hover:bg-[#eae8e0]" title="Lịch sử">
                          <span className="material-symbols-outlined">history</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <TablePagination
            page={page}
            pageSize={pageSize}
            totalCount={totalCount}
            itemLabel="nhân viên"
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />

          <div className="hidden flex-wrap items-center justify-between gap-3 border-t border-[#c1c9c0]/30 bg-[#f6f4ec]/50 px-6 py-4">
            <p className="text-sm text-[#414942]">Hiển thị trang {page}/{totalPages} · tổng {totalCount} nhân viên</p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[#414942] hover:bg-[#eae8e0] disabled:opacity-40"
              >
                <span className="material-symbols-outlined">chevron_left</span>
              </button>
              <button type="button" className="flex h-8 min-w-8 items-center justify-center rounded-lg bg-[#356647] px-2 text-white">
                {page}
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[#414942] hover:bg-[#eae8e0] disabled:opacity-40"
              >
                <span className="material-symbols-outlined">chevron_right</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      <footer className="pb-2 text-center text-xs text-[#414942]/60">© 2024 Hương Vân Trà — Hệ thống quản lý</footer>
    </PageShell>
  )
}

export default StaffPage
