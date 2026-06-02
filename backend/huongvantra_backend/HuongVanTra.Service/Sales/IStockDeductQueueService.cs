using HuongVanTra.Service.Sales.Models;

namespace HuongVanTra.Service.Sales {
    public interface IStockDeductQueueService {
        Task<IReadOnlyList<StockDeductQueueListItem>> GetWaitingAsync(CancellationToken cancellationToken = default);
        Task<ConfirmStockDeductResult> ConfirmAsync(int queueId, int confirmedByEmployeeId);
    }
}
