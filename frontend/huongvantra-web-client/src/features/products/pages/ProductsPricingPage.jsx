import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import PageHeader from '../../../components/shared/PageHeader.jsx'
import PageShell from '../../../components/shared/PageShell.jsx'
import { showError } from '../../../app/toast.js'
import { fetchCategories } from '../services/categoriesApi.js'
import { getCategoryStatusMeta } from '../utils/productDisplay.js'

function ProductsPricingPage() {
  const [categories, setCategories] = useState([])
  const [searchInput, setSearchInput] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('active')

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true)
      const items = await fetchCategories()
      setCategories(items)
    } catch (error) {
      showError(error.message)
      setCategories([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const filteredCategories = useMemo(() => {
    const keyword = searchInput.trim().toLowerCase()
    return categories.filter((item) => {
      if (statusFilter === 'active' && item.isActive === false) return false
      if (statusFilter === 'inactive' && item.isActive !== false) return false
      if (!keyword) return true
      const name = String(item.name || '').toLowerCase()
      const description = String(item.description || '').toLowerCase()
      return name.includes(keyword) || description.includes(keyword)
    })
  }, [categories, searchInput, statusFilter])

  return (
    <PageShell>
      <PageHeader
        title="Danh mục sản phẩm"
        description="Xem danh mục để lọc sản phẩm khi cập nhật số lượng tại cửa hàng"
        searchPlaceholder="Tìm danh mục..."
        searchValue={searchInput}
        onSearchChange={setSearchInput}
        rightContent={
          <Link
            to="/products"
            className="inline-flex items-center gap-2 rounded-xl border border-[#356647]/30 bg-white px-4 py-2.5 text-sm font-semibold text-[#356647] hover:bg-[#356647]/5"
          >
            <span className="material-symbols-outlined text-[18px]">inventory_2</span>
            Danh sách sản phẩm
          </Link>
        }
      />

      <section className="rounded-[1rem] bg-white p-4 shadow-sm sm:p-6 lg:p-8">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-bold text-slate-800">Danh sách danh mục</h2>
          <select
            className="min-h-[40px] rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 outline-none focus:border-[#356647]"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="active">Đang hoạt động</option>
            <option value="inactive">Ngừng hoạt động</option>
          </select>
        </div>

        {isLoading ? (
          <p className="text-sm text-slate-500">Đang tải...</p>
        ) : filteredCategories.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
            Chưa có danh mục nào.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Tên</th>
                  <th className="px-4 py-3 font-semibold">Mô tả</th>
                  <th className="px-4 py-3 font-semibold">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCategories.map((category) => {
                  const status = getCategoryStatusMeta(category.isActive !== false)
                  return (
                    <tr key={category.id}>
                      <td className="px-4 py-3 font-semibold text-slate-900">{category.name}</td>
                      <td className="px-4 py-3 text-slate-600">{category.description || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${status.className}`}>
                          {status.label}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </PageShell>
  )
}

export default ProductsPricingPage
