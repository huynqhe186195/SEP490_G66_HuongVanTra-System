using System.Net.Http.Json;
using System.Text.Json.Serialization;
using HuongVanTra.Service.Sales.Models;
using Microsoft.Extensions.Options;

namespace HuongVanTra.Service.Sales {
    public class VietQrService : IVietQrService {
        private readonly HttpClient _httpClient;
        private readonly VietQrTransferSettings _settings;

        public VietQrService(HttpClient httpClient, IOptions<VietQrTransferSettings> options) {
            _httpClient = httpClient;
            _settings = options.Value;
        }

        public VietQrGenerateResult GenerateForOrder(string orderCode, decimal amount) {
            ValidateSettings();
            var transferContent = NormalizeTransferContent(orderCode);
            var imageUrl = BuildQuickLinkImageUrl(amount, transferContent);
            return new VietQrGenerateResult {
                QrImageUrl = imageUrl,
                TransferContent = transferContent,
            };
        }

        public async Task<VietQrGenerateResult> GenerateForOrderAsync(
            string orderCode,
            decimal amount,
            CancellationToken cancellationToken = default) {
            ValidateSettings();
            var transferContent = NormalizeTransferContent(orderCode);

            if (HasApiCredentials()) {
                var fromApi = await TryGenerateViaApiAsync(amount, transferContent, cancellationToken);
                if (fromApi is not null) {
                    return fromApi;
                }
            }

            return new VietQrGenerateResult {
                QrImageUrl = BuildQuickLinkImageUrl(amount, transferContent),
                TransferContent = transferContent,
            };
        }

        private void ValidateSettings() {
            if (string.IsNullOrWhiteSpace(ResolveQuickLinkBankCode())) {
                throw new InvalidOperationException("PosTransferPayment:BankCode (or BankBin) is required for VietQR.");
            }

            if (string.IsNullOrWhiteSpace(_settings.AccountNumber)) {
                throw new InvalidOperationException("PosTransferPayment:AccountNumber is required for VietQR.");
            }
        }

        private string ResolveQuickLinkBankCode() {
            if (!string.IsNullOrWhiteSpace(_settings.BankCode)) {
                return _settings.BankCode.Trim();
            }

            return _settings.BankBin.Trim();
        }

        private bool HasApiCredentials() {
            return !string.IsNullOrWhiteSpace(_settings.ClientId) &&
                !string.IsNullOrWhiteSpace(_settings.ApiKey);
        }

        private string BuildQuickLinkImageUrl(decimal amount, string transferContent) {
            var bankCode = ResolveQuickLinkBankCode();
            var account = _settings.AccountNumber.Trim();
            var template = string.IsNullOrWhiteSpace(_settings.Template) ? "compact2" : _settings.Template.Trim();

            var query = new List<string>();
            if (amount > 0) {
                query.Add($"amount={(long)Math.Round(amount, MidpointRounding.AwayFromZero)}");
            }

            if (!string.IsNullOrWhiteSpace(transferContent)) {
                query.Add($"addInfo={Uri.EscapeDataString(transferContent)}");
            }

            if (!string.IsNullOrWhiteSpace(_settings.AccountHolder)) {
                query.Add($"accountName={Uri.EscapeDataString(_settings.AccountHolder.Trim())}");
            }

            var queryString = query.Count > 0 ? $"?{string.Join("&", query)}" : string.Empty;
            return $"https://img.vietqr.io/image/{bankCode}-{account}-{template}.png{queryString}";
        }

        private async Task<VietQrGenerateResult?> TryGenerateViaApiAsync(
            decimal amount,
            string transferContent,
            CancellationToken cancellationToken) {
            using var request = new HttpRequestMessage(HttpMethod.Post, "https://api.vietqr.io/v2/generate");
            request.Headers.Add("x-client-id", _settings.ClientId!.Trim());
            request.Headers.Add("x-api-key", _settings.ApiKey!.Trim());
            request.Content = JsonContent.Create(new {
                accountNo = _settings.AccountNumber.Trim(),
                accountName = _settings.AccountHolder.Trim(),
                acqId = _settings.BankBin.Trim(),
                amount = (long)Math.Round(amount, MidpointRounding.AwayFromZero),
                addInfo = transferContent,
                format = "text",
                template = string.IsNullOrWhiteSpace(_settings.Template) ? "compact2" : _settings.Template.Trim(),
            });

            HttpResponseMessage response;
            try {
                response = await _httpClient.SendAsync(request, cancellationToken);
            }
            catch {
                return null;
            }

            if (!response.IsSuccessStatusCode) {
                return null;
            }

            var body = await response.Content.ReadFromJsonAsync<VietQrApiResponse>(cancellationToken: cancellationToken);
            if (body?.Data is null) {
                return null;
            }

            var imageUrl = body.Data.QrImageUrl ?? body.Data.QrLink;
            if (string.IsNullOrWhiteSpace(imageUrl) && string.IsNullOrWhiteSpace(body.Data.QrCode)) {
                return null;
            }

            return new VietQrGenerateResult {
                QrImageUrl = !string.IsNullOrWhiteSpace(imageUrl)
                    ? imageUrl
                    : BuildQuickLinkImageUrl(amount, transferContent),
                QrPayload = body.Data.QrCode,
                TransferContent = transferContent,
            };
        }

        private static string NormalizeTransferContent(string orderCode) {
            // VietQR addInfo tối đa ~25 ký tự — dùng trực tiếp mã đơn (đã có tiền tố POS-).
            var cleaned = orderCode.Trim().ToUpperInvariant();
            cleaned = new string(cleaned.Where(ch => char.IsLetterOrDigit(ch) || ch == '-').ToArray());
            return cleaned.Length <= 25 ? cleaned : cleaned[..25];
        }

        private sealed class VietQrApiResponse {
            [JsonPropertyName("data")]
            public VietQrApiData? Data { get; set; }
        }

        private sealed class VietQrApiData {
            [JsonPropertyName("qrCode")]
            public string? QrCode { get; set; }

            [JsonPropertyName("qrImageURL")]
            public string? QrImageUrl { get; set; }

            [JsonPropertyName("qrLink")]
            public string? QrLink { get; set; }
        }
    }
}
