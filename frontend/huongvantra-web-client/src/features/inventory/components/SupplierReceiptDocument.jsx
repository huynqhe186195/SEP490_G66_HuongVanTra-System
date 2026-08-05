import { formatVietnamDateTime } from '../../../utils/vietnamDateTime.js'
import { formatVnd } from '../../../utils/vietnamCurrency.js'

function formatQuantity(value) {
  return Number(value || 0).toLocaleString('vi-VN', { maximumFractionDigits: 3 })
}

function statusLabel(status) {
  const normalized = String(status || '').toLowerCase()
  if (normalized === 'draft') return 'Nháp'
  if (normalized === 'pendingapproval') return 'Chờ duyệt'
  if (normalized === 'completed') return 'Đã duyệt / Đã nhận'
  if (normalized === 'rejected') return 'Từ chối'
  if (normalized === 'cancelled') return 'Đã hủy'
  return status || '—'
}

export default function SupplierReceiptDocument({ receipt }) {
  const totalAmount = Number(receipt.totalAmount ?? receipt.items.reduce(
    (sum, item) => sum + Number(item.lineAmount || 0),
    0,
  ))
  const totalActualQuantity = receipt.items.reduce(
    (sum, item) => sum + Number(item.actualQuantity ?? item.submittedQuantity ?? 0),
    0,
  )

  return (
    <article className="inventory-slip-print rounded-xl border border-slate-200 bg-white p-5 text-slate-800">
      <header className="border-b border-slate-200 pb-4 text-center">
        <h2 className="text-2xl font-black tracking-wide">PHIẾU NHẬP KHO</h2>
        <p className="mt-1 font-mono text-sm font-semibold text-[#356647]">{receipt.receiptCode}</p>
        <p className="mt-1 text-xs text-slate-500">Kho nhập: {receipt.warehouseLocation === 'Shelf' ? 'Kệ hàng' : 'Kho'}</p>
      </header>

      <section className="grid grid-cols-1 gap-x-6 gap-y-3 border-b border-slate-100 py-4 text-sm md:grid-cols-3">
        <p><span className="text-slate-500">Trạng thái:</span> <strong>{statusLabel(receipt.status)}</strong></p>
        <p><span className="text-slate-500">Ngày phiếu:</span> <strong>{receipt.receivedDate ? formatVietnamDateTime(receipt.receivedDate) : '—'}</strong></p>
        <p><span className="text-slate-500">Nhà cung cấp:</span> <strong>{receipt.supplierName || '—'}</strong></p>
        <p><span className="text-slate-500">Mã Nhà Cung Cấp:</span> <strong>{receipt.supplierCodeSnapshot || '—'}</strong></p>
        <p><span className="text-slate-500">Người giao hàng:</span> <strong>{receipt.deliveredByName || '—'}</strong></p>
        <p><span className="text-slate-500">Số chứng từ NCC:</span> <strong>{receipt.supplierDocumentNumber || '—'}</strong></p>
        <p><span className="text-slate-500">Ngày chứng từ NCC:</span> <strong>{receipt.supplierDocumentDate ? formatVietnamDateTime(receipt.supplierDocumentDate) : '—'}</strong></p>
        <p><span className="text-slate-500">Theo hợp đồng/tham chiếu:</span> <strong>{receipt.supplierReference || '—'}</strong></p>
        <p className="md:col-span-2"><span className="text-slate-500">Chứng từ gốc/kèm theo:</span> <strong>{receipt.originalDocumentReference || '—'}</strong></p>
        <p className="md:col-span-3"><span className="text-slate-500">Ghi chú:</span> <strong>{receipt.note || '—'}</strong></p>
      </section>

      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-100">
        <table className="min-w-[1450px] text-left text-sm">
          <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-3 text-center">STT</th>
              <th className="px-3 py-3">Hàng hóa</th>
              <th className="px-3 py-3">Mã số</th>
              <th className="px-3 py-3">ĐVT</th>
              <th className="px-3 py-3 text-right">SL chứng từ</th>
              <th className="px-3 py-3 text-right">SL thực nhập</th>
              <th className="px-3 py-3 text-right">Đơn giá</th>
              <th className="px-3 py-3 text-right">Thành tiền</th>
              <th className="px-3 py-3">Mã lô NCC</th>
              <th className="px-3 py-3">Mã lô nội bộ</th>
              <th className="px-3 py-3">Ngày SX</th>
              <th className="px-3 py-3">Hạn dùng</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {receipt.items.map((item, index) => (
              <tr key={item.id || `${item.skuId}-${index}`}>
                <td className="px-3 py-3 text-center">{index + 1}</td>
                <td className="px-3 py-3">
                  <p>{item.skuNameSnapshot || '—'}</p>
                  {Number(item.documentQuantity) !== Number(item.actualQuantity ?? item.submittedQuantity) ? (
                    <p className="mt-1 max-w-xs rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-700">
                      {Number(item.actualQuantity ?? item.submittedQuantity) < Number(item.documentQuantity)
                        ? `Cảnh báo: Số lượng thực nhập thiếu ${Number(item.documentQuantity) - Number(item.actualQuantity ?? item.submittedQuantity)} so với chứng từ.`
                        : `Cảnh báo: Số lượng thực nhập vượt ${Number(item.actualQuantity ?? item.submittedQuantity) - Number(item.documentQuantity)} so với chứng từ.`}
                    </p>
                  ) : null}
                </td>
                <td className="px-3 py-3 font-mono font-semibold text-[#356647]">{item.skuCode}</td>
                <td className="px-3 py-3">{item.inventoryUnitSnapshot || item.submittedUnit || '—'}</td>
                <td className="px-3 py-3 text-right">{formatQuantity(item.documentQuantity)}</td>
                <td className="px-3 py-3 text-right">{formatQuantity(item.actualQuantity ?? item.submittedQuantity)}</td>
                <td className="px-3 py-3 text-right">{formatVnd(item.unitCost)}</td>
                <td className="px-3 py-3 text-right font-semibold">{formatVnd(item.lineAmount)}</td>
                <td className="px-3 py-3 font-mono">{item.lotCode || '—'}</td>
                <td className="px-3 py-3 font-mono">{item.warehouseBatchLotCode || '—'}</td>
                <td className="px-3 py-3">{item.manufacturedAt ? formatVietnamDateTime(item.manufacturedAt) : '—'}</td>
                <td className="px-3 py-3">{item.expiresAt ? formatVietnamDateTime(item.expiresAt) : '—'}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-slate-200 bg-slate-50 font-bold">
            <tr>
              <td colSpan={5} className="px-3 py-3 text-right">Tổng cộng</td>
              <td className="px-3 py-3 text-right">{formatQuantity(totalActualQuantity)}</td>
              <td />
              <td className="px-3 py-3 text-right text-[#356647]">{formatVnd(totalAmount)}</td>
              <td colSpan={4} />
            </tr>
          </tfoot>
        </table>
      </div>

      <section className="mt-5 grid grid-cols-1 gap-3 rounded-xl bg-slate-50 p-4 text-sm md:grid-cols-3">
        <div>
          <p className="text-xs uppercase text-slate-500">Người lập phiếu</p>
          <p className="mt-1 font-semibold">{receipt.createdByName || '—'}</p>
          <p className="text-xs text-slate-500">{receipt.createdAt ? formatVietnamDateTime(receipt.createdAt) : '—'}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-slate-500">Warehouse submit</p>
          <p className="mt-1 font-semibold">{receipt.submittedAt ? receipt.createdByName || receipt.submittedBy : '—'}</p>
          <p className="text-xs text-slate-500">{receipt.submittedAt ? formatVietnamDateTime(receipt.submittedAt) : '—'}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-slate-500">Manager approve/reject</p>
          <p className="mt-1 font-semibold">{receipt.reviewedByName || '—'}</p>
          <p className="text-xs text-slate-500">{receipt.reviewedAt ? formatVietnamDateTime(receipt.reviewedAt) : '—'}</p>
        </div>
        {receipt.reviewNote ? <p className="md:col-span-3"><span className="text-slate-500">Ý kiến duyệt:</span> {receipt.reviewNote}</p> : null}
      </section>
    </article>
  )
}
