using HuongVanTra.API.Models.Sales;
using HuongVanTra.Service.Sales;
using HuongVanTra.Service.Sales.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;

namespace HuongVanTra.API.Controllers {
    [ApiController]
    [Route("api/webhooks/payment")]
    public class PaymentWebhookController : ControllerBase {
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

        /// <summary>
        /// Sepay webhook endpoint. Public endpoint, không yêu cầu [Authorize].
        /// Validate webhook bằng HMAC-SHA256 signature hoặc secret token.
        /// </summary>
        [HttpPost("sepay")]
        public async Task<IActionResult> SepayWebhook([FromBody] SepayWebhookPayload payload) {
            if (!_settings.EnableWebhook) {
                _logger.LogWarning("Sepay webhook disabled in config.");
                return Ok(new { message = "Webhook disabled." });
            }

            // Validate API token từ Sepay — gửi qua header "Authorization: Bearer <token>"
            if (!string.IsNullOrWhiteSpace(_settings.WebhookSecret)) {
                var authHeader = Request.Headers["Authorization"].FirstOrDefault();
                var token = authHeader?.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase) == true
                    ? authHeader["Bearer ".Length..].Trim()
                    : authHeader?.Trim();

                if (string.IsNullOrWhiteSpace(token) ||
                    !string.Equals(token, _settings.WebhookSecret, StringComparison.Ordinal)) {
                    _logger.LogWarning("Invalid Sepay webhook token.");
                    return Unauthorized(new { message = "Invalid token." });
                }
            }

            var command = new SepayWebhookCommand {
                TransactionId = payload.Id,
                Gateway = payload.Gateway,
                AccountNumber = payload.AccountNumber,
                TransferType = payload.TransferType,
                TransferAmount = payload.TransferAmount,
                Content = payload.Content,
                ReferenceCode = payload.ReferenceCode,
                TransactionDate = payload.TransactionDate
            };

            try {
                var result = await _webhookService.ProcessSepayWebhookAsync(command);

                if (result.Success) {
                    _logger.LogInformation(
                        "Sepay webhook processed. OrderId={OrderId}, InvoiceCode={InvoiceCode}, Skipped={Skipped}",
                        result.OrderId, result.InvoiceCode, result.Skipped);
                }

                return Ok(result);
            }
            catch (Exception ex) {
                _logger.LogError(ex, "Error processing Sepay webhook for transaction {TransactionId}", payload.Id);
                return StatusCode(500, new { message = "Internal server error." });
            }
        }
    }
}
