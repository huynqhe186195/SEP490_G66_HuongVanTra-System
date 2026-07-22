import { useCallback, useEffect, useMemo, useState } from 'react'
import PageHeader from '../../../components/shared/PageHeader.jsx'
import PageShell from '../../../components/shared/PageShell.jsx'
import TablePagination, { TABLE_PAGE_SIZE } from '../../../components/shared/TablePagination.jsx'
import { showError, showSuccess } from '../../../app/toast.js'
import { fetchAllActiveSkus, fetchAllActiveStoreSkus } from '../../products/services/productSkusApi.js'
import { isWarehouseRole, isAccountantRole } from '../../auth/utils/permissions.js'
import { loadAuthSession } from '../../auth/services/authSession.js'

function formatMoney(value) {
  return Number(value || 0).toLocaleString('vi-VN', { maximumFractionDigits: 0 }) + ' đ'
}

function downloadCsv(filename, rows) {
  const escape = (cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`
  const csv = rows.map((row) => row.map(escape).join(',')).join('\r\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function CostProfitReportPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [rows, setRows] = useState([])
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const session = loadAuthSession()
      const useWarehouseSkus = isWarehouseRole(session) || isAccountantRole(session)
      const skus = useWarehouseSkus
        ? await fetchAllActiveSkus(200)
        : await fetchAllActiveStoreSkus(200)

      const mapped = (skus || []).map((sku) => {
        const cost = Number(sku.costPrice ?? 0)
        const retail = Number(sku.retailPrice ?? sku.basePrice ?? 0)
        return {
          skuId: sku.id,
          skuCode: sku.skuCode || '',
          name: [sku.productName, sku.variantName].filter(Boolean).join(' - ') || sku.skuCode || '',
          costPrice: cost,
          retailPrice: retail,
          margin: retail - cost,
        }
      })

      setRows(mapped)
    } catch (error) {
      showError(error.message)
      setRows([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return rows
    return rows.filter(
      (r) =>
        r.skuCode.toLowerCase().includes(term) ||
        r.name.toLowerCase().includes(term),
    )
  }, [rows, search])

  const pageItems = useMemo(() => {
    const start = (page - 1) * TABLE_PAGE_SIZE
    return filtered.slice(start, start + TABLE_PAGE_SIZE)
  }, [filtered, page])

  const handleExport = () => {
    downloadCsv(`bang-gia-von-gia-ban-${new Date().toISOString().slice(0, 10)}.csv`, [
      ['Mã hàng', 'Tên hàng', 'Giá vốn', 'Giá bán', 'Chênh lệch'],
      ...filtered.map((r) => [
        r.skuCode,
        r.name,
        r.costPrice,
        r.retailPrice,
        Math.round(r.margin),
      ]),
    ])
    showSuccess('Đã xuất CSV')
  }

  return (
    <PageShell>
      <PageHeader
        title="Bảng giá vốn & giá bán"
        description="Danh sách giá vốn và giá bán hiện tại của từng mã hàng. Có thể tìm kiếm và xuất file CSV."
        rightContent={
          <button
            type="button"
            onClick={handleExport}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#538463] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#457053]"
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
            Xuất Excel (CSV)
          </button>
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }}
          placeholder="Tìm mã hàng / tên hàng..."
          className="w-full max-w-sm rounded-xl border border-slate-200 px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={load}
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Làm mới
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Mã hàng</th>
                <th className="px-4 py-3">Tên hàng</th>
                <th className="px-4 py-3 text-right">Giá vốn</th>
                <th className="px-4 py-3 text-right">Giá bán</th>
                <th className="px-4 py-3 text-right">Chênh lệch</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    Đang tải...
                  </td>
                </tr>
              ) : pageItems.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    Không có dữ liệu
                  </td>
                </tr>
              ) : (
                pageItems.map((r) => (
                  <tr key={r.skuId} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-mono font-medium text-slate-800">{r.skuCode}</td>
                    <td className="px-4 py-3 text-slate-700">{r.name}</td>
                    <td className="px-4 py-3 text-right">{formatMoney(r.costPrice)}</td>
                    <td className="px-4 py-3 text-right">{formatMoney(r.retailPrice)}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${r.margin >= 0 ? 'text-[#356647]' : 'text-rose-600'}`}>
                      {formatMoney(r.margin)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <TablePagination
          page={page}
          pageSize={TABLE_PAGE_SIZE}
          totalCount={filtered.length}
          onPageChange={setPage}
          itemLabel="mã hàng"
        />
      </div>

      <div className="mt-3 space-y-1 rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-3 text-xs leading-relaxed text-slate-600">
        <p className="font-semibold text-slate-700">Ghi chú</p>
        <p><span className="font-medium text-slate-800">Giá vốn</span> — mức vốn đang ghi trên mã hàng (thường cập nhật sau nhập kho).</p>
        <p><span className="font-medium text-slate-800">Giá bán</span> — giá bán hiện tại đang áp dụng.</p>
        <p><span className="font-medium text-slate-800">Chênh lệch</span> — giá bán trừ giá vốn (tham khảo biên lãi trên một đơn vị).</p>
      </div>
    </PageShell>
  )
}
