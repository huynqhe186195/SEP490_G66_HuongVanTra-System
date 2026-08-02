import { formatStockQuantity } from '../../products/utils/productDisplay.js'

export const SUPPLIER_RETURN_FLOW_DESCRIPTION =
  'Trả hàng lỗi/hỏng từ Kho về nhà cung cấp. Phiếu chốt ngay và trừ tồn Kho khi tạo.'

export function InfoTile({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-800">{value}</p>
    </div>
  )
}

export default function SupplierReturnConfirmModal({ draft, isSaving, onCancel, onConfirm }) {
  if (!draft) return null

  return (
    <div className="inventory-modal fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4">
      <div className="flex max-h-[90dvh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="text-lg font-bold text-slate-800">Xác nhận trả hàng nhập</h2>
          <p className="mt-1 text-sm text-rose-600">
            Phiếu chốt ngay khi xác nhận và trừ tồn Kho, không thể hoàn tác.
          </p>
        </div>

        <div className="custom-scrollbar flex-1 overflow-y-auto px-6 py-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <InfoTile label="Phiếu nhập NCC" value={draft.supplierReceiptCode || '—'} />
            <InfoTile label="Nhà cung cấp" value={draft.supplierName || '—'} />
            <InfoTile label="Lý do lỗi" value={draft.defectReasonLabel || '—'} />
            <InfoTile label="Tổng số lượng trả" value={formatStockQuantity(draft.totalQuantity)} />
          </div>

          <div className="mt-4 rounded-xl border border-slate-100">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Sản Phẩm</th>
                  <th className="px-4 py-3">Lô nguồn</th>
                  <th className="px-4 py-3 text-right">Số lượng</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {draft.lines.map((line) => (
                  <tr key={line.key}>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-800">{line.skuSnapshotName}</p>
                      <p className="font-mono text-xs text-slate-500">{line.skuCode}</p>
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-700">{line.lotCode}</td>
                    <td className="px-4 py-3 text-right font-semibold">{formatStockQuantity(line.quantity)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <InfoTile label="Mô tả chi tiết" value={draft.reason || '—'} />
            <InfoTile label="Ghi chú" value={draft.note || '—'} />
          </div>

          <div className="mt-4 rounded-xl border border-slate-100 p-4">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
              Ảnh hàng lỗi ({draft.evidenceImageUrls.length})
            </p>
            <div className="mt-2 flex flex-wrap gap-3">
              {draft.evidenceImageUrls.map((url) => (
                <img
                  key={url}
                  src={url}
                  alt="Ảnh hàng lỗi"
                  className="h-28 w-28 rounded-xl border border-slate-200 object-cover"
                />
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
          >
            Quay lại
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSaving}
            className="rounded-xl bg-[#538463] px-4 py-2 text-sm font-semibold text-white hover:bg-[#457053] disabled:opacity-60"
          >
            {isSaving ? 'Đang xử lý...' : 'Xác nhận và trừ tồn'}
          </button>
        </div>
      </div>
    </div>
  )
}
