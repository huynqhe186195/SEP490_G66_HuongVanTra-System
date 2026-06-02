using HuongVanTra.Service.Sales.Models;

namespace HuongVanTra.Service.Sales {
    public interface IOrderConfirmationService {
        Task<OrderConfirmationResult> ConfirmPaymentAsync(ConfirmPaymentCommand command, CancellationToken cancellationToken = default);
        Task<OrderConfirmationResult> ConfirmCodCompletedAsync(int orderId, int employeeId, CancellationToken cancellationToken = default);
    }
}
