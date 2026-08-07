import { useEffect, useState } from 'react'
import { formatVnd } from '../../../../utils/vietnamCurrency.js'
import { endOfDayOrderApi } from '../../services/endOfDayApi.js'
import { Card, DataTable, Pagination } from '../reportUi.jsx'

const PAGE_SIZE = 50

/**
 * Bảng hàng hóa. Cố ý KHÔNG có ô "tổng số lượng": hàng tính theo Gram và hàng tính
 * theo cái không cộng chung được, nên dùng số dòng hàng và số sản phẩm thay thế.
 * "Số sản phẩm phát sinh" đếm SkuId không trùng lặp, nên hai quy cách khác nhau của
 * cùng một mặt hàng vẫn được tính là hai.
 */
function ProductsTab({ report, params }) {
  const totals = report.productTotals || []

  const [page, setPage] = useState(1)
  const [pageItems, setPageItems] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    setPage(1)
    setPageItems(null)
  }, [params])

  useEffect(() => {
    if (page === 1) return
    const controller = new AbortController()
    const { signal } = controller
    setIsLoading(true)
    setError(null)
    endOfDayOrderApi
      .getProducts({ ...params, page, pageSize: PAGE_SIZE }, { signal })
      .then((res) => {
        if (!signal.aborted) setPageItems(res?.items || [])
      })
      .catch((err) => {
        if (signal.aborted || err.name === 'AbortError') return
        setError(err.statusCode === 403 ? 'Bạn không có quyền xem số liệu hàng hóa.' : err.message)
      })
      .finally(() => {
        if (!signal.aborted) setIsLoading(false)
      })
    return () => controller.abort()
  }, [params, page])

  const totalCount = report.productsTotalCount || 0
  const totalPages = Math.ceil(totalCount / PAGE_SIZE)
  const products = page === 1 ? (report.products || []).slice(0, PAGE_SIZE) : pageItems || []

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-[#c1c9c0]/40 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#717971]">Tổng dòng hàng</p>
          <p className="mt-1 text-xl font-bold text-[#1b1c17]">{report.totalLineCount || 0}</p>
        </div>
        <div className="rounded-2xl border border-[#c1c9c0]/40 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#717971]">Số sản phẩm phát sinh</p>
          <p className="mt-1 text-xl font-bold text-[#1b1c17]">{report.distinctSkuCount || 0}</p>
        </div>
        <div className="rounded-2xl border border-[#c1c9c0]/40 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#717971]">Giảm giá đã áp dụng</p>
          <p className="mt-1 text-xl font-bold text-[#7e5700]">{formatVnd(report.salesDiscount)}</p>
        </div>
      </div>

      {totals.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {totals.map((t) => (
            <div key={t.unit} className="rounded-2xl border border-[#c1c9c0]/40 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#717971]">
                Tổng theo đơn vị · {t.unitLabel}
              </p>
              <p className="mt-1 text-xl font-bold text-[#1b1c17]">
                {t.quantity} {t.unitLabel}
              </p>
              <p className="mt-0.5 text-[11px] text-[#717971]">
                {t.lineCount} dòng · trả {t.returnedQuantity} · {formatVnd(t.netRevenue)}
              </p>
            </div>
          ))}
        </div>
      )}

      <Card
        title="Hàng hóa đã bán trong kỳ"
        subtitle="Số lượng hiển thị theo đơn vị cơ sở của từng mặt hàng, không cộng gộp giữa các đơn vị khác nhau."
        icon="inventory_2"
      >
        {error && (
          <p className="mb-2 rounded-lg border border-[#b42318]/40 bg-[#b42318]/5 px-3 py-2 text-sm text-[#b42318]">
            {error}
          </p>
        )}
        <DataTable
          columns={[
            { key: 'sku', label: 'Mã SKU' },
            { key: 'name', label: 'Tên hàng' },
            { key: 'category', label: 'Danh mục' },
            { key: 'unit', label: 'Đơn vị', align: 'center' },
            { key: 'qty', label: 'SL bán', align: 'center' },
            { key: 'returned', label: 'SL trả', align: 'center' },
            { key: 'orders', label: 'Số đơn', align: 'center' },
            { key: 'discount', label: 'Giảm giá phân bổ', align: 'right' },
            { key: 'revenue', label: 'Doanh thu thuần', align: 'right' },
          ]}
          rows={products}
          renderRow={(p) => (
            <tr key={`${p.skuId}-${p.unit}`}>
              <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">{p.skuCode}</td>
              <td className="px-3 py-2 font-medium text-[#1b1c17]">{p.skuName}</td>
              <td className="px-3 py-2 text-[#717971]">{p.categoryName || '—'}</td>
              <td
                className={`px-3 py-2 text-center text-xs ${p.unit === 'Unknown' ? 'text-[#7e5700]' : 'text-[#717971]'}`}
              >
                {p.unitLabel}
              </td>
              <td className="px-3 py-2 text-center">{p.quantity}</td>
              <td className={`px-3 py-2 text-center ${p.returnedQuantity > 0 ? 'text-[#b42318]' : ''}`}>
                {p.returnedQuantity}
              </td>
              <td className="px-3 py-2 text-center">{p.orderCount}</td>
              <td className="whitespace-nowrap px-3 py-2 text-right text-[#7e5700]">
                {formatVnd(p.allocatedDiscount)}
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-right font-semibold">{formatVnd(p.netRevenue)}</td>
            </tr>
          )}
          footer={
            <tr>
              <td colSpan={8} className="px-3 py-2">
                Tổng doanh thu hàng hóa toàn kỳ
              </td>
              <td className="px-3 py-2 text-right text-[#356647]">
                {formatVnd(totals.reduce((s, t) => s + (t.netRevenue || 0), 0))}
              </td>
            </tr>
          }
        />

        <Pagination
          page={page}
          totalPages={totalPages}
          totalCount={totalCount}
          unitLabel="mặt hàng"
          isLoading={isLoading}
          onChange={setPage}
        />
      </Card>
    </div>
  )
}

export default ProductsTab
