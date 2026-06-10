function InventorySimulationBanner({ simulateWarehouse = true, warehouseView = false }) {
  if (!simulateWarehouse) return null

  return (
    <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <p className="font-semibold">Chế độ giả lập kho</p>
      <p className="mt-1 text-amber-800/90">
        {warehouseView ? (
          <>
            Màn Thủ kho chỉ hiển thị <strong>tồn kho tổng</strong>. Duyệt yêu cầu từ cửa hàng vẫn cộng tồn CH (giả
            lập) và tạo phiếu xuất — chưa trừ kho tổng thật.
          </>
        ) : (
          <>
            Module kho chưa vận hành đầy đủ. Tồn hiển thị là <strong>tồn cửa hàng</strong>. Gửi yêu cầu để Thủ kho
            duyệt.
          </>
        )}
      </p>
    </div>
  )
}

export default InventorySimulationBanner
