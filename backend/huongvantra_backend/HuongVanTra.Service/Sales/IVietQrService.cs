using HuongVanTra.Service.Sales.Models;

namespace HuongVanTra.Service.Sales {
    public interface IVietQrService {
        VietQrGenerateResult GenerateForOrder(string orderCode, decimal amount);
        Task<VietQrGenerateResult> GenerateForOrderAsync(string orderCode, decimal amount, CancellationToken cancellationToken = default);
    }
}
