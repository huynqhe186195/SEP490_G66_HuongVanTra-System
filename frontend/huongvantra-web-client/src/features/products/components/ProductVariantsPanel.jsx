import { formatProductPrice } from '../utils/productDisplay.js'

function StatusChip({ active }) {
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-bold ${
        active ? 'bg-[#e8f1eb] text-[#356647]' : 'bg-slate-100 text-slate-500'
      }`}
    >
      {active ? 'Hoạt động' : 'Ngừng'}
    </span>
  )
}

export default function ProductVariantsPanel({ variants = [], productName = '' }) {
  if (!variants.length) {
    return (
      <div>
        <h2 className="mb-2 text-lg font-bold text-slate-800">Biến thể &amp; giá</h2>
        <p className="text-sm text-slate-500">Sản phẩm này chưa có biến thể nào.</p>
      </div>
    )
  }

  return (
    <div>
      <h2 className="mb-1 text-lg font-bold text-slate-800">Biến thể &amp; giá</h2>
      <p className="mb-4 text-sm text-slate-500">
        Các biến thể được tự động sinh từ đơn vị tính khi tạo sản phẩm.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
              <th className="pb-2 pr-4">Sản Phẩm</th>
              <th className="pb-2 pr-4 text-right">Giá vốn</th>
              <th className="pb-2 pr-4 text-right">Giá bán</th>
              <th className="pb-2 pr-4">Đơn vị</th>
              <th className="pb-2">Trạng thái</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {variants.map((v) => (
              <tr key={v.id} className="group">
                <td className="py-2.5 pr-4">
                  <p className="font-medium text-slate-800">{v.variantName || '—'}</p>
                  <p className="font-mono text-xs text-slate-500">{v.skuCode || '—'}</p>
                </td>
                <td className="py-2.5 pr-4 text-right text-slate-600">{formatProductPrice(v.costPrice)}</td>
                <td className="py-2.5 pr-4 text-right font-semibold text-[#356647]">
                  {v.isSellable ? formatProductPrice(v.retailPrice) : <span className="text-slate-400">Không bán</span>}
                </td>
                <td className="py-2.5 pr-4">
                  {v.units?.length ? (
                    <span className="text-slate-600">{v.units.map((u) => u.unitName).join(', ')}</span>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
                <td className="py-2.5">
                  <StatusChip active={v.isActive} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
