export default function ProductionCompleteConfirmModal({ order, availability, isChecking, onConfirm, onClose }) {
  const shortages = (availability?.items ?? []).filter((item) => item.shortageQuantity > 0)
  const canConfirm = !isChecking && Boolean(availability?.canComplete)

  return (
    <div className="inventory-modal fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={(event) => event.stopPropagation()}>
        <p className="text-sm text-slate-700">Hoàn thành lệnh sản xuất &quot;{order.productionCode}&quot;? Hệ thống sẽ xuất nguyên liệu/Bao bì và nhập thành phẩm theo nơi nhập đã chọn.</p>
        {isChecking ? <p className="mt-4 text-sm text-slate-500">Đang kiểm tra tồn Kho...</p> : null}
        {!isChecking && shortages.length > 0 ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            <p className="font-semibold">Chưa đủ nguyên liệu/Bao bì. Không thể xác nhận.</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
              {shortages.map((item) => <li key={item.materialSkuId}>{item.materialName || item.materialSkuCode}: cần {item.requiredQuantity}, còn {item.availableQuantity}, thiếu {item.shortageQuantity}</li>)}
            </ul>
          </div>
        ) : null}
        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Không</button>
          <button onClick={onConfirm} disabled={!canConfirm} className="rounded-xl bg-[#538463] px-4 py-2 text-sm font-bold text-white hover:bg-[#457053] disabled:cursor-not-allowed disabled:opacity-50">Xác nhận</button>
        </div>
      </div>
    </div>
  )
}
