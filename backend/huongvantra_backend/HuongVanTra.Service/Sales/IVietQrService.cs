using HuongVanTra.Service.Sales.Models;

namespace HuongVanTra.Service.Sales {
    public interface IVietQrService {
        VietQrGenerateResult GenerateForOrder(string orderCode, decimal amount);
        Task<VietQrGenerateResult> GenerateForOrderAsync(string orderCode, decimal amount, CancellationToken cancellationToken = default);
        VietQrGenerateResult GenerateForAccount(string accountNumber, string orderCode, decimal amount);
    }
}
