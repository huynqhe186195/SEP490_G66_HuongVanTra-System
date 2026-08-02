import CustomScrollArea from '../../../components/shared/CustomScrollArea.jsx'
import { formatStockQuantity } from '../../products/utils/productDisplay.js'
import { STOCK_FLOW_TERMS } from '../utils/stockFlowLabels.js'

function SummaryRow({ label, value, tone = 'default' }) {
  return (
    <div className="flex items-center justify-between gap-3 text-[#717971]">
      <span>{label}</span>
      <span className={tone === 'total' ? 'text-lg font-bold text-[#356647]' : 'font-semibold text-[#1b1c17]'}>
        {value}
      </span>
    </div>
  )
}

/** Gom các phiếu đang treo theo từng sản phẩm để cảnh báo gọn hơn. */
function groupDuplicatesBySku(duplicates) {
  const bySku = new Map()
  for (const row of duplicates) {
    const entry = bySku.get(row.skuId) ?? { name: row.skuSnapshotName, codes: [], remaining: 0 }
    entry.codes.push(row.requestCode)
    entry.remaining += row.remainingQuantity
    bySku.set(row.skuId, entry)
  }
  return [...bySku.values()]
}

export default function StockAdjustmentRequestConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  isSubmitting = false,
  lines = [],
  reason = '',
  duplicateWarning = null,
}) {
  if (!isOpen) return null

  const note = reason?.trim()
  const totalQuantity = lines.reduce((sum, line) => sum + Number(line.quantity), 0)
  const shortLines = lines.filter((line) => Number(line.quantity) > line.warehouseQuantityOnHand)
  const warnedSkus = duplicateWarning ? groupDuplicatesBySku(duplicateWarning.duplicates) : []

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-3 sm:p-5">
      <div className="flex max-h-[calc(100vh-32px)] min-h-0 w-full max-w-[1020px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl sm:max-h-[90vh]">
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-[#f0eee6] px-5 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[#717971]">
              Xác nhận trước khi gửi
            </p>
            <h2 className="mt-1 text-xl font-bold text-[#1b1c17]">
              Gửi {STOCK_FLOW_TERMS.request}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-full p-2 text-[#717971] hover:bg-[#f6f4ec] disabled:opacity-50"
            aria-label="Đóng"
          >
            <span className="material-symbols-outlined text-[22px]">close</span>
          </button>
        </header>

        <CustomScrollArea className="min-h-0 flex-1" contentClassName="min-h-0 px-5 py-4">
          <div className="grid min-h-0 gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
            <section className="flex min-h-0 flex-col rounded-xl border border-[#f0eee6]">
              <div className="flex shrink-0 items-center justify-between border-b border-[#f0eee6] px-4 py-3">
                <h3 className="text-sm font-bold text-[#1b1c17]">Sản phẩm cần bổ sung</h3>
                <span className="text-xs text-[#717971]">{lines.length} mặt hàng</span>
              </div>
              <CustomScrollArea
                className="min-h-0 max-h-[min(42vh,360px)]"
                contentClassName="max-h-[min(42vh,360px)] pr-3"
                allowHorizontalScroll
              >
                <table className="w-full table-fixed text-left text-sm">
                  <colgroup>
                    <col className="w-auto" />
                    <col className="w-[92px]" />
                    <col className="w-[96px]" />
                    <col className="w-[96px]" />
                  </colgroup>
                  <thead className="sticky top-0 bg-[#fbf9f1] text-xs uppercase tracking-wide text-[#717971]">
                    <tr>
                      <th className="px-3 py-2">Sản phẩm</th>
                      <th className="whitespace-nowrap px-1.5 py-2 text-right">Yêu cầu</th>
                      <th className="whitespace-nowrap px-1.5 py-2 text-right">
                        Tồn {STOCK_FLOW_TERMS.warehouse}
                      </th>
                      <th className="whitespace-nowrap px-2 py-2 text-right">
                        Tồn {STOCK_FLOW_TERMS.shelf}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f0eee6]">
                    {lines.map((line) => {
                      const quantity = Number(line.quantity)
                      const isShort = quantity > line.warehouseQuantityOnHand
                      return (
                        <tr key={line.skuId}>
                          <td className="min-w-0 px-3 py-3">
                            <p className="line-clamp-2 font-semibold leading-snug text-[#1b1c17]" title={line.skuSnapshotName}>
                              {line.skuSnapshotName}
                            </p>
                            <p className="mt-0.5 font-mono text-xs text-[#717971]">{line.skuCode}</p>
                            {isShort ? (
                              <p className="mt-1 text-xs font-semibold text-[#7e5700]">
                                Tồn {STOCK_FLOW_TERMS.warehouse} chưa đủ, Thủ kho có thể xử lý một phần.
                              </p>
                            ) : null}
                          </td>
                          <td className="whitespace-nowrap px-1.5 py-3 text-right font-semibold tabular-nums text-[#1b1c17]">
                            {quantity} {line.unitName || ''}
                          </td>
                          <td
                            className={`whitespace-nowrap px-1.5 py-3 text-right tabular-nums ${
                              isShort ? 'font-semibold text-[#7e5700]' : 'text-[#717971]'
                            }`}
                          >
                            {formatStockQuantity(line.warehouseQuantityOnHand)}
                          </td>
                          <td className="whitespace-nowrap px-2 py-3 text-right tabular-nums text-[#717971]">
                            {formatStockQuantity(line.shelfQuantityOnHand)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </CustomScrollArea>
            </section>

            <aside className="flex min-h-0 flex-col gap-4">
              <section className="shrink-0 rounded-xl border border-[#f0eee6] p-4">
                <div className="space-y-2 text-sm">
                  <SummaryRow label="Số sản phẩm" value={lines.length} />
                  {shortLines.length > 0 ? (
                    <SummaryRow label={`Tồn ${STOCK_FLOW_TERMS.warehouse} chưa đủ`} value={shortLines.length} />
                  ) : null}
                  <div className="border-t border-[#f0eee6] pt-3">
                    <SummaryRow label="Tổng số lượng" value={totalQuantity} tone="total" />
                  </div>
                </div>
              </section>

              {warnedSkus.length > 0 ? (
                <section className="shrink-0 rounded-xl border border-[#7e5700]/25 bg-[#7e5700]/5 p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-[#7e5700]">
                    Đang có ở yêu cầu khác
                  </p>
                  <ul className="mt-2 space-y-2 text-xs text-[#414942]">
                    {warnedSkus.map((sku) => (
                      <li key={sku.name}>
                        <span className="font-semibold text-[#1b1c17]">{sku.name}</span>
                        <span className="block text-[#717971]">
                          Còn thiếu {sku.remaining} · {sku.codes.slice(0, 3).join(', ')}
                          {sku.codes.length > 3 ? ` và ${sku.codes.length - 3} phiếu khác` : ''}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              <section className="flex min-h-[120px] flex-1 flex-col rounded-xl border border-[#f0eee6] p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-[#717971]">Lý do / Ghi chú</p>
                <p className="mt-1 min-h-0 flex-1 overflow-y-auto whitespace-pre-wrap text-sm text-[#1b1c17]">
                  {note || 'Không có'}
                </p>
              </section>
            </aside>
          </div>
        </CustomScrollArea>

        <footer className="flex shrink-0 flex-col-reverse gap-2 border-t border-[#f0eee6] bg-[#fbf9f1] px-5 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-xl border border-[#c1c9c0] bg-white px-5 py-2.5 text-sm font-bold text-[#414942] hover:bg-[#f6f4ec] disabled:opacity-50"
          >
            Quay lại chỉnh sửa
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            className="rounded-xl bg-[#356647] px-5 py-2.5 text-sm font-bold text-white shadow-md hover:brightness-110 disabled:opacity-50"
          >
            {isSubmitting ? 'Đang gửi...' : 'Gửi yêu cầu'}
          </button>
        </footer>
      </div>
    </div>
  )
}
