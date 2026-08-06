import { formatVnd } from '../../../../utils/vietnamCurrency.js'
import { Card, DataTable } from '../reportUi.jsx'

/**
 * Bảng hàng hóa. Cố ý KHÔNG có ô "tổng số lượng": hàng tính theo Gram và hàng tính
 * theo cái không cộng chung được, nên dùng số dòng hàng và số sản phẩm thay thế.
 * "Số sản phẩm phát sinh" đếm SkuId không trùng lặp, nên hai quy cách khác nhau của
 * cùng một mặt hàng vẫn được tính là hai.
 */
function ProductsTab({ report }) {
  const products = report.products || []

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

      <Card
        title="Hàng hóa đã bán trong kỳ"
        subtitle="Số lượng hiển thị theo đơn vị cơ sở của từng mặt hàng, không cộng gộp giữa các đơn vị khác nhau."
        icon="inventory_2"
      >
        <DataTable
          columns={[
            { key: 'sku', label: 'Mã SKU' },
            { key: 'name', label: 'Tên hàng' },
            { key: 'category', label: 'Danh mục' },
            { key: 'qty', label: 'SL bán', align: 'center' },
            { key: 'returned', label: 'SL trả', align: 'center' },
            { key: 'orders', label: 'Số đơn', align: 'center' },
            { key: 'revenue', label: 'Doanh thu', align: 'right' },
          ]}
          rows={products}
          renderRow={(p) => (
            <tr key={p.skuId}>
              <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">{p.skuCode}</td>
              <td className="px-3 py-2 font-medium text-[#1b1c17]">{p.skuName}</td>
              <td className="px-3 py-2 text-[#717971]">{p.categoryName || '—'}</td>
              <td className="px-3 py-2 text-center">{p.quantity}</td>
              <td className={`px-3 py-2 text-center ${p.returnedQuantity > 0 ? 'text-[#b42318]' : ''}`}>
                {p.returnedQuantity}
              </td>
              <td className="px-3 py-2 text-center">{p.orderCount}</td>
              <td className="whitespace-nowrap px-3 py-2 text-right font-semibold">{formatVnd(p.revenue)}</td>
            </tr>
          )}
          footer={
            <tr>
              <td colSpan={6} className="px-3 py-2">
                Tổng doanh thu hàng hóa
              </td>
              <td className="px-3 py-2 text-right text-[#356647]">
                {formatVnd(products.reduce((s, p) => s + (p.revenue || 0), 0))}
              </td>
            </tr>
          }
        />
      </Card>
    </div>
  )
}

export default ProductsTab
