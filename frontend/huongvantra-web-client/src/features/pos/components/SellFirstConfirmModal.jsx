export default function SellFirstConfirmModal({ preview, onAccept, onDecline }) {
  const needsPackaging = preview.lines.some((line) => line.pendingBomQuantity > 0)
  const needsWarehousePickup = preview.lines.some((line) => line.warehouseDeductedQuantity > 0)
  const message = needsPackaging
    ? 'Sản phẩm hiện chưa sẵn trên Kệ, nhưng Kho còn đủ nguyên liệu và Bao bì. Nhân viên Kho có thể đóng gói trong thời gian sớm nhất.'
    : 'Sản phẩm hiện chưa sẵn trên Kệ nhưng vẫn còn tại Kho. Nhân viên sẽ mang hàng lên trong vài phút.'

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/45 p-4" onClick={onDecline}>
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl" onClick={(event) => event.stopPropagation()} role="alertdialog">
        <div className="flex items-start gap-3">
          <span className="material-symbols-outlined text-2xl text-[#7e5700]">schedule</span>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-[#717971]">Bán trước, xử lý Kho sau</p>
            <h2 className="mt-1 text-lg font-bold text-[#1b1c17]">Khách có thể chờ hàng không?</h2>
          </div>
        </div>
        <p className="mt-4 text-sm leading-6 text-slate-700">{message} Vui lòng xác nhận với khách trước khi thanh toán.</p>
        <div className="mt-4 rounded-xl bg-[#fbf9f1] p-3 text-sm text-slate-700">
          {preview.lines.filter((line) => line.warehouseDeductedQuantity > 0 || line.pendingBomQuantity > 0).map((line) => (
            <p key={line.skuId}>{line.skuName || line.skuCode}: {line.pendingBomQuantity > 0 ? `đóng gói ${line.pendingBomQuantity}` : `lấy từ Kho ${line.warehouseDeductedQuantity}`}</p>
          ))}
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onDecline} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600">Khách không đợi, hủy</button>
          <button onClick={onAccept} className="rounded-xl bg-[#538463] px-4 py-2 text-sm font-bold text-white hover:bg-[#457053]">Khách đồng ý, tiếp tục</button>
        </div>
      </div>
    </div>
  )
}
