using HuongVanTra.Service.Sales.Models;

namespace HuongVanTra.Service.Sales {
    public interface IOnlineOrderService {
        Task<OnlineOrderResult> CreateVietQrOrderAsync(CreateOnlineOrderCommand command);
        Task<OnlineOrderResult> CreateCodOrderAsync(CreateOnlineOrderCommand command);
        Task<CodDeliveredResult> MarkCodDeliveredAndPaidAsync(int orderId, int employeeId);
        Task<VietQrPaidResult> MarkVietQrPaidAsync(int orderId, int employeeId);
        Task<List<OverdueCodOrderResult>> GetOverdueCodOrdersAsync();
        Task<CodRemindedResult> MarkCodRemindedAsync(int orderId, int employeeId);
    }
}
