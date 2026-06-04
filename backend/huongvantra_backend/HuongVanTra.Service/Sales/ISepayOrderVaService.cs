using HuongVanTra.Service.Sales.Models;

namespace HuongVanTra.Service.Sales {
    public interface ISepayOrderVaService {
        bool IsConfigured { get; }
        string PaymentMode { get; }
        Task<SepaySetupDiagnostics> GetSetupDiagnosticsAsync(CancellationToken cancellationToken = default);
        Task<SepayOrderVaResult> CreateOrderVaForTransferAsync(
            string orderCode,
            decimal amount,
            int? vaDurationSeconds = null,
            CancellationToken cancellationToken = default);

        /// <summary>Dùng lại VA đã cấp — không gọi API tạo order mới trên SePay.</summary>
        SepayOrderVaResult ResolveQrForExistingVa(
            string orderCode,
            string vaNumber,
            decimal amount,
            string? sepayOrderId = null);
    }
}
