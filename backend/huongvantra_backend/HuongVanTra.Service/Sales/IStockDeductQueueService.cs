using HuongVanTra.Service.Sales.Models;

namespace HuongVanTra.Service.Sales {
    public interface IStockDeductQueueService {
        Task<IReadOnlyList<StockDeductQueueListItem>> GetWaitingAsync(CancellationToken cancellationToken = default);
        Task<PreviewStockDeductResult> PreviewAsync(int queueId, CancellationToken cancellationToken = default);
        Task<ConfirmStockDeductResult> ConfirmAsync(int queueId, int confirmedByEmployeeId);
        Task<CancelStockDeductResult> CancelAsync(int queueId, int cancelledByEmployeeId, string? reason);

        /// <summary>
        /// Sau khi đơn CK/VietQR đã thanh toán: tự trừ kho từ hàng đợi waiting (nếu còn pending_deduct).
        /// </summary>
        Task TryAutoDeductForOrderAsync(int orderId, int confirmedByEmployeeId, CancellationToken cancellationToken = default);
    }
}
