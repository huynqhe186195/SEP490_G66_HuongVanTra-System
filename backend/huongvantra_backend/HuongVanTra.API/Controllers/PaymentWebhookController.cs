using System.Text.Json;
using HuongVanTra.API.Models.Sales;
using HuongVanTra.Service.Sales;
using HuongVanTra.Service.Sales.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;

namespace HuongVanTra.API.Controllers {
    [ApiController]
    [AllowAnonymous]
    [Route("api/webhooks/payment")]
    public class PaymentWebhookController : ControllerBase {
        private static readonly JsonSerializerOptions JsonOptions = new() {
            PropertyNameCaseInsensitive = true,
        };

        private readonly IPaymentWebhookService _webhookService;
        private readonly SepaySettings _settings;
        private readonly ILogger<PaymentWebhookController> _logger;

        public PaymentWebhookController(
            IPaymentWebhookService webhookService,
            IOptions<SepaySettings> options,
            ILogger<PaymentWebhookController> logger) {
            _webhookService = webhookService;
            _settings = options.Value;
            _logger = logger;
        }

        [HttpGet("sepay/health")]
        public IActionResult Health() {
            return Ok(new {
                ok = true,
                webhookEnabled = _settings.EnableWebhook,
                accountNumber = _settings.AccountNumber,
            });
        }

        /// <summary>SePay webhook — public, không JWT.</summary>
        [HttpPost("sepay")]
        public async Task<IActionResult> SepayWebhook(CancellationToken cancellationToken) {
            if (!_settings.EnableWebhook) {
                _logger.LogWarning("Sepay webhook disabled in config.");
                return Ok(new { message = "Webhook disabled." });
            }

            if (!string.IsNullOrWhiteSpace(_settings.WebhookSecret)) {
                var authHeader = Request.Headers.Authorization.FirstOrDefault();
                var token = authHeader?.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase) == true
                    ? authHeader["Bearer ".Length..].Trim()
                    : authHeader?.Trim();

                if (string.IsNullOrWhiteSpace(token)
                    || !string.Equals(token, _settings.WebhookSecret, StringComparison.Ordinal)) {
                    _logger.LogWarning("Invalid Sepay webhook token.");
                    return Unauthorized(new { message = "Invalid token." });
                }
            }

            var payload = await ReadPayloadAsync(cancellationToken);
            if (payload is null) {
                _logger.LogWarning("SePay webhook: empty or invalid JSON body.");
                return BadRequest(new { message = "Invalid JSON body." });
            }

            var command = new SepayWebhookCommand {
                TransactionId = payload.Id,
                Gateway = payload.Gateway,
                AccountNumber = payload.AccountNumber,
                SubAccount = payload.SubAccount,
                TransferType = payload.TransferType,
                TransferAmount = payload.TransferAmount,
                Content = payload.Content,
                Code = payload.Code,
                ReferenceCode = payload.ReferenceCode,
                TransactionDate = payload.TransactionDate,
            };

            _logger.LogInformation(
                "SePay webhook in: id={Id}, type={Type}, amount={Amount}, content={Content}, code={Code}",
                command.TransactionId,
                command.TransferType,
                command.TransferAmount,
                command.Content,
                command.Code);

            try {
                var result = await _webhookService.ProcessSepayWebhookAsync(command, cancellationToken);

                if (result.Skipped) {
                    _logger.LogWarning(
                        "SePay webhook skipped: {Message}, orderCode={OrderCode}",
                        result.Message,
                        result.OrderCode);
                }
                else if (result.Success) {
                    _logger.LogInformation(
                        "SePay webhook OK: OrderId={OrderId}, Invoice={InvoiceCode}",
                        result.OrderId,
                        result.InvoiceCode);
                }

                return Ok(result);
            }
            catch (Exception ex) {
                _logger.LogError(ex, "SePay webhook error for transaction {TransactionId}", payload.Id);
                return StatusCode(500, new { message = "Internal server error." });
            }
        }

        private async Task<SepayWebhookPayload?> ReadPayloadAsync(CancellationToken cancellationToken) {
            string body;
            using (var reader = new StreamReader(Request.Body)) {
                body = await reader.ReadToEndAsync(cancellationToken);
            }

            if (string.IsNullOrWhiteSpace(body)) {
                return null;
            }

            try {
                return JsonSerializer.Deserialize<SepayWebhookPayload>(body, JsonOptions);
            }
            catch (JsonException ex) {
                _logger.LogWarning(ex, "SePay webhook JSON parse failed. Body length={Length}", body.Length);
                return null;
            }
        }
    }
}
