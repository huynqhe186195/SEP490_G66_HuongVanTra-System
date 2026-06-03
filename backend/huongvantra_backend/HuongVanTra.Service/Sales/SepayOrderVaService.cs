using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using HuongVanTra.Service.Sales.Models;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace HuongVanTra.Service.Sales {
    public class SepayOrderVaService : ISepayOrderVaService {
        private readonly HttpClient _httpClient;
        private readonly SepaySettings _settings;
        private readonly ILogger<SepayOrderVaService> _logger;
        private string? _resolvedBankAccountUuid;

        public SepayOrderVaService(
            HttpClient httpClient,
            IOptions<SepaySettings> options,
            ILogger<SepayOrderVaService> logger) {
            _httpClient = httpClient;
            _settings = options.Value;
            _logger = logger;
        }

        public bool IsConfigured =>
            _settings.HasStaticVa
            || (!string.IsNullOrWhiteSpace(_settings.ApiToken)
                && (!string.IsNullOrWhiteSpace(_settings.BankAccountUuid) || _settings.AutoResolveBankAccountUuid));

        public string PaymentMode {
            get {
                if (_settings.HasStaticVa) {
                    return "sepay_static_va";
                }

                if (!string.IsNullOrWhiteSpace(_settings.ApiToken)) {
                    return "sepay_order_va";
                }

                return _settings.RequireSepayVaForTransfer ? "sepay_not_configured" : "vietqr_main";
            }
        }

        public async Task<SepaySetupDiagnostics> GetSetupDiagnosticsAsync(CancellationToken cancellationToken = default) {
            var diagnostics = new SepaySetupDiagnostics {
                RequireSepayVa = _settings.RequireSepayVaForTransfer,
                ApiTokenConfigured = !string.IsNullOrWhiteSpace(_settings.ApiToken),
                BankAccountUuidConfigured = !string.IsNullOrWhiteSpace(_settings.BankAccountUuid),
                StaticVaConfigured = _settings.HasStaticVa,
                PaymentMode = PaymentMode,
            };

            if (diagnostics.ApiTokenConfigured) {
                diagnostics.BankAccounts = await ListBankAccountsAsync(cancellationToken);
                if (!diagnostics.BankAccountUuidConfigured && diagnostics.BankAccounts.Count > 0) {
                    diagnostics.BankAccountUuidConfigured = true;
                }
            }

            diagnostics.CanCreateTransferQr =
                diagnostics.StaticVaConfigured
                || (diagnostics.ApiTokenConfigured
                    && (diagnostics.BankAccountUuidConfigured || _settings.AutoResolveBankAccountUuid));

            if (!diagnostics.CanCreateTransferQr && _settings.RequireSepayVaForTransfer) {
                diagnostics.SetupMessage =
                    "Cấu hình Sepay: điền Sepay:ApiToken (+ BankAccountUuid hoặc bật AutoResolveBankAccountUuid) "
                    + "hoặc Sepay:StaticVaNumber (số VA trên dashboard SePay). "
                    + "BIDV không ghi nhận CK vào TK chính 5101917359.";
            }

            diagnostics.PaymentMode = ResolveEffectivePaymentMode(diagnostics);
            return diagnostics;
        }

        public async Task<SepayOrderVaResult> CreateOrderVaForTransferAsync(
            string orderCode,
            decimal amount,
            CancellationToken cancellationToken = default) {
            if (_settings.HasStaticVa) {
                return BuildStaticVaResult(orderCode, amount);
            }

            if (!string.IsNullOrWhiteSpace(_settings.ApiToken)) {
                var created = await TryCreateOrderVaViaApiAsync(orderCode, amount, cancellationToken);
                if (created is not null) {
                    return created;
                }

                throw new SepayVaSetupException(
                    "Không tạo được VA trên SePay. Kiểm tra ApiToken, BankAccountUuid (ba_xid), "
                    + "tài khoản BIDV doanh nghiệp đã liên kết và đang Hoạt động trên dashboard SePay.");
            }

            if (_settings.RequireSepayVaForTransfer) {
                throw new SepayVaSetupException(BuildSetupRequiredMessage());
            }

            throw new SepayVaSetupException("Chưa cấu hình SePay VA và không cho phép QR tài khoản chính.");
        }

        private SepayOrderVaResult BuildStaticVaResult(string orderCode, decimal amount) {
            var va = _settings.StaticVaNumber.Trim();
            return new SepayOrderVaResult {
                OrderCode = orderCode,
                VaNumber = va,
                Amount = amount,
                BankName = "BIDV",
                PaymentMode = "sepay_static_va",
            };
        }

        private async Task<SepayOrderVaResult?> TryCreateOrderVaViaApiAsync(
            string orderCode,
            decimal amount,
            CancellationToken cancellationToken) {
            var bankAccountUuid = await ResolveBankAccountUuidAsync(cancellationToken);
            if (string.IsNullOrWhiteSpace(bankAccountUuid)) {
                _logger.LogWarning("SePay: không tìm thấy bank account UUID.");
                return null;
            }

            var sepayOrderCode = ToSepayOrderCode(orderCode);
            var url = $"{_settings.ApiBaseUrl.TrimEnd('/')}/bank-accounts/{bankAccountUuid}/orders";

            using var request = new HttpRequestMessage(HttpMethod.Post, url);
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _settings.ApiToken.Trim());
            request.Content = JsonContent.Create(new {
                order_code = sepayOrderCode,
                amount = (long)Math.Round(amount, MidpointRounding.AwayFromZero),
                duration = _settings.VaDurationSeconds > 0 ? _settings.VaDurationSeconds : 86400,
                with_qrcode = "1",
                qrcode_template = "compact",
            });

            HttpResponseMessage response;
            try {
                response = await _httpClient.SendAsync(request, cancellationToken);
            }
            catch (Exception ex) {
                _logger.LogWarning(ex, "SePay create order VA failed (network).");
                return null;
            }

            var body = await response.Content.ReadAsStringAsync(cancellationToken);
            if (!response.IsSuccessStatusCode) {
                _logger.LogWarning(
                    "SePay create order VA HTTP {Status}: {Body}",
                    (int)response.StatusCode,
                    body);
                return null;
            }

            var parsed = System.Text.Json.JsonSerializer.Deserialize<SepayCreateOrderResponse>(
                body,
                new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true });

            if (parsed?.Data is null || string.IsNullOrWhiteSpace(parsed.Data.VaNumber)) {
                _logger.LogWarning("SePay create order VA: empty VA in response.");
                return null;
            }

            var qrUrl = parsed.Data.QrCodeUrl;
            if (string.IsNullOrWhiteSpace(qrUrl) && !string.IsNullOrWhiteSpace(parsed.Data.QrCode)
                && parsed.Data.QrCode.StartsWith("http", StringComparison.OrdinalIgnoreCase)) {
                qrUrl = parsed.Data.QrCode;
            }

            return new SepayOrderVaResult {
                SepayOrderId = parsed.Data.Id ?? "",
                OrderCode = parsed.Data.OrderCode ?? sepayOrderCode,
                VaNumber = parsed.Data.VaNumber.Trim(),
                QrImageUrl = qrUrl,
                QrPayload = parsed.Data.QrCode,
                Amount = parsed.Data.Amount ?? amount,
                BankName = parsed.Data.BankName,
                PaymentMode = "sepay_order_va",
            };
        }

        private async Task<string?> ResolveBankAccountUuidAsync(CancellationToken cancellationToken) {
            if (!string.IsNullOrWhiteSpace(_settings.BankAccountUuid)) {
                return _settings.BankAccountUuid.Trim();
            }

            if (_resolvedBankAccountUuid is not null) {
                return _resolvedBankAccountUuid;
            }

            if (!_settings.AutoResolveBankAccountUuid || string.IsNullOrWhiteSpace(_settings.ApiToken)) {
                return null;
            }

            var accounts = await ListBankAccountsAsync(cancellationToken);
            var match = PickBankAccount(accounts);
            _resolvedBankAccountUuid = match?.Id;
            return _resolvedBankAccountUuid;
        }

        private async Task<List<SepayBankAccountItem>> ListBankAccountsAsync(CancellationToken cancellationToken) {
            if (string.IsNullOrWhiteSpace(_settings.ApiToken)) {
                return new List<SepayBankAccountItem>();
            }

            var url = $"{_settings.ApiBaseUrl.TrimEnd('/')}/bank-accounts?per_page=50";
            using var request = new HttpRequestMessage(HttpMethod.Get, url);
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _settings.ApiToken.Trim());

            try {
                var response = await _httpClient.SendAsync(request, cancellationToken);
                var body = await response.Content.ReadAsStringAsync(cancellationToken);
                if (!response.IsSuccessStatusCode) {
                    _logger.LogWarning("SePay list bank accounts HTTP {Status}: {Body}", (int)response.StatusCode, body);
                    return new List<SepayBankAccountItem>();
                }

                var parsed = System.Text.Json.JsonSerializer.Deserialize<SepayBankAccountListResponse>(
                    body,
                    new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true });

                return parsed?.Data?
                    .Where(a => !string.IsNullOrWhiteSpace(a.Id))
                    .Select(a => new SepayBankAccountItem {
                        Id = a.Id!.Trim(),
                        BankName = a.BankName,
                        AccountNumber = a.AccountNumber,
                        AccountHolderName = a.AccountHolderName,
                        Status = a.Status,
                    })
                    .ToList() ?? new List<SepayBankAccountItem>();
            }
            catch (Exception ex) {
                _logger.LogWarning(ex, "SePay list bank accounts failed.");
                return new List<SepayBankAccountItem>();
            }
        }

        private SepayBankAccountItem? PickBankAccount(List<SepayBankAccountItem> accounts) {
            if (accounts.Count == 0) {
                return null;
            }

            static string Digits(string? s) => new string((s ?? "").Where(char.IsDigit).ToArray());

            var target = Digits(_settings.AccountNumber);
            var active = accounts.Where(a =>
                string.IsNullOrWhiteSpace(a.Status)
                || a.Status.Contains("active", StringComparison.OrdinalIgnoreCase)
                || a.Status.Contains("hoat", StringComparison.OrdinalIgnoreCase)).ToList();

            var pool = active.Count > 0 ? active : accounts;

            if (target.Length > 0) {
                var byNumber = pool.FirstOrDefault(a => Digits(a.AccountNumber) == target);
                if (byNumber is not null) {
                    return byNumber;
                }
            }

            var bidv = pool.FirstOrDefault(a =>
                (a.BankName ?? "").Contains("BIDV", StringComparison.OrdinalIgnoreCase));
            return bidv ?? pool[0];
        }

        private string ResolveEffectivePaymentMode(SepaySetupDiagnostics d) {
            if (d.StaticVaConfigured) {
                return "sepay_static_va";
            }

            if (d.ApiTokenConfigured && d.CanCreateTransferQr) {
                return "sepay_order_va";
            }

            if (_settings.RequireSepayVaForTransfer && !d.CanCreateTransferQr) {
                return "sepay_not_configured";
            }

            return "vietqr_main";
        }

        private string BuildSetupRequiredMessage() {
            return "Chưa cấu hình SePay VA. Thêm vào appsettings hoặc User Secrets: "
                + "Sepay:ApiToken (bắt buộc), Sepay:BankAccountUuid (hoặc AutoResolveBankAccountUuid=true), "
                + "hoặc Sepay:StaticVaNumber (số VA từ dashboard SePay). "
                + "QR tài khoản chính BIDV không được SePay ghi nhận giao dịch.";
        }

        private static string ToSepayOrderCode(string orderCode) {
            var cleaned = orderCode.Trim().ToUpperInvariant();
            cleaned = Regex.Replace(cleaned, @"[^A-Z0-9]", "");
            if (cleaned.Length < 6) {
                cleaned = (cleaned + Guid.NewGuid().ToString("N")).ToUpperInvariant();
            }

            return cleaned.Length <= 50 ? cleaned : cleaned[..50];
        }

        private sealed class SepayCreateOrderResponse {
            [JsonPropertyName("data")]
            public SepayCreateOrderData? Data { get; set; }
        }

        private sealed class SepayCreateOrderData {
            [JsonPropertyName("id")]
            public string? Id { get; set; }

            [JsonPropertyName("order_code")]
            public string? OrderCode { get; set; }

            [JsonPropertyName("va_number")]
            public string? VaNumber { get; set; }

            [JsonPropertyName("amount")]
            public decimal? Amount { get; set; }

            [JsonPropertyName("bank_name")]
            public string? BankName { get; set; }

            [JsonPropertyName("qr_code")]
            public string? QrCode { get; set; }

            [JsonPropertyName("qr_code_url")]
            public string? QrCodeUrl { get; set; }
        }

        private sealed class SepayBankAccountListResponse {
            [JsonPropertyName("data")]
            public List<SepayBankAccountListItem>? Data { get; set; }
        }

        private sealed class SepayBankAccountListItem {
            [JsonPropertyName("id")]
            public string? Id { get; set; }

            [JsonPropertyName("bank_name")]
            public string? BankName { get; set; }

            [JsonPropertyName("account_number")]
            public string? AccountNumber { get; set; }

            [JsonPropertyName("account_holder_name")]
            public string? AccountHolderName { get; set; }

            [JsonPropertyName("status")]
            public string? Status { get; set; }
        }
    }
}
