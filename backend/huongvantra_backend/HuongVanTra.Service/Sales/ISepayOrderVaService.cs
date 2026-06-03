using HuongVanTra.Service.Sales.Models;

namespace HuongVanTra.Service.Sales {
    public interface ISepayOrderVaService {
        bool IsConfigured { get; }
        string PaymentMode { get; }
        Task<SepaySetupDiagnostics> GetSetupDiagnosticsAsync(CancellationToken cancellationToken = default);
        Task<SepayOrderVaResult> CreateOrderVaForTransferAsync(
            string orderCode,
            decimal amount,
            CancellationToken cancellationToken = default);
    }
}
