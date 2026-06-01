using HuongVanTra.Service.Sales.Models;

namespace HuongVanTra.Service.Sales {
    public interface IStockDeductQueueService {
        Task<ConfirmStockDeductResult> ConfirmAsync(int queueId, int confirmedByEmployeeId);
    }
}
