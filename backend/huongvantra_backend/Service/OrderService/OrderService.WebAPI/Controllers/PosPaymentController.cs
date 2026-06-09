using HuongVanTra.Shared.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OrderService.Application.DTOs.Responses;
using OrderService.Application.UseCases;

namespace OrderService.WebAPI.Controllers;

[ApiController]
[Route("api/pos")]
public class PosPaymentController(PosTransferPaymentLogic _posPaymentLogic) : ControllerBase
{
    [HttpGet("transfer-payment-info")]
    [Authorize(Policy = PermissionNames.CreateOrder)]
    public IActionResult GetTransferPaymentInfo() =>
        Ok(_posPaymentLogic.GetTransferPaymentInfo());

    [HttpGet("sepay-setup")]
    [Authorize(Policy = PermissionNames.CreateOrder)]
    public IActionResult GetSepaySetup() =>
        Ok(_posPaymentLogic.GetSepaySetup());

    [HttpPost("transfer-qr")]
    [Authorize(Policy = PermissionNames.CreateOrder)]
    public IActionResult BuildTransferQr([FromBody] BuildTransferQrRequest request) =>
        Ok(_posPaymentLogic.BuildTransferQr(request));

    [HttpGet("orders/{orderId:guid}/payment-status")]
    [Authorize(Policy = PermissionNames.ViewOrder)]
    public async Task<IActionResult> GetOrderPaymentStatus(Guid orderId, CancellationToken ct) =>
        Ok(await _posPaymentLogic.GetOrderPaymentStatusAsync(orderId, ct));

    [HttpPost("sepay/webhook")]
    [AllowAnonymous]
    public async Task<IActionResult> SepayWebhook(
        [FromBody] SepayWebhookPayload payload,
        CancellationToken ct)
    {
        if (!IsWebhookAuthorized())
            return Unauthorized(new { success = false, message = "Unauthorized webhook." });

        await _posPaymentLogic.HandleSepayWebhookAsync(payload, ct);
        return Ok(new { success = true });
    }

    [HttpPost("sepay/simulate-webhook")]
    [AllowAnonymous]
    public async Task<IActionResult> SimulateSepayWebhook(
        [FromHeader(Name = "X-Simulate-Webhook-Secret")] string? secret,
        [FromBody] SimulateSepayWebhookRequest request,
        CancellationToken ct)
    {
        var configuredSecret = HttpContext.RequestServices
            .GetRequiredService<IConfiguration>()["PosTransferPayment:SimulateWebhookSecret"];

        if (string.IsNullOrWhiteSpace(configuredSecret) || !string.Equals(secret, configuredSecret))
            return Unauthorized(new { success = false, message = "Invalid simulate webhook secret." });

        await _posPaymentLogic.SimulateWebhookAsync(request, ct);
        return Ok(new { success = true });
    }

    private bool IsWebhookAuthorized()
    {
        var configuredSecret = HttpContext.RequestServices
            .GetRequiredService<IConfiguration>()["Sepay:WebhookSecret"];

        if (string.IsNullOrWhiteSpace(configuredSecret))
            return false;

        var authHeader = Request.Headers.Authorization.ToString();
        if (authHeader.StartsWith("Apikey ", StringComparison.OrdinalIgnoreCase))
        {
            var apiKey = authHeader["Apikey ".Length..].Trim();
            return string.Equals(apiKey, configuredSecret, StringComparison.Ordinal);
        }

        if (authHeader.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
        {
            var bearer = authHeader["Bearer ".Length..].Trim();
            return string.Equals(bearer, configuredSecret, StringComparison.Ordinal);
        }

        return false;
    }
}
