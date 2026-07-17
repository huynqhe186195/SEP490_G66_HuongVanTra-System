function InventorySimulationBanner({ simulateWarehouse = true, warehouseView = false }) {
  if (!simulateWarehouse) return null

  return (
    <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <p className="font-semibold">Chế độ giả lập kho</p>
      <p className="mt-1 text-amber-800/90">
        {warehouseView ? (
          <>
            Màn Thủ kho hiển thị <strong>Kho</strong>. Duyệt yêu cầu sẽ chuyển tồn sang{' '}
            <strong>Kệ Hàng</strong> và tạo phiếu xuất.
          </>
        ) : (
          <>
            Tồn hiển thị là <strong>Kệ Hàng</strong>. Gửi yêu cầu để Thủ kho Kho duyệt bổ sung.
          </>
        )}
      </p>
    </div>
  )
}

export default InventorySimulationBanner
