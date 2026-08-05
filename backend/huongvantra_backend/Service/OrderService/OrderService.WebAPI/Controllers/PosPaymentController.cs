using HuongVanTra.Shared.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OrderService.Application.Authorization;
using OrderService.Application.DTOs.Responses;
using OrderService.Application.UseCases;
using OrderService.WebAPI.Authorization;

namespace OrderService.WebAPI.Controllers;

[ApiController]
[Route("api/pos")]
public class PosPaymentController(
    PosTransferPaymentLogic posPaymentLogic,
    OrderLogic orderLogic) : ControllerBase
{
    private OrderAccessContext AccessContext() => User.CreateOrderAccessContext();

    private (Guid? ActorId, string? ActorName) Actor() =>
    (
        User.GetUserId() is var id && id != Guid.Empty ? id : null,
        User.GetDisplayName()
    );

    [HttpGet("transfer-payment-info")]
    [Authorize(Policy = PermissionNames.CreatePosOrder)]
    public IActionResult GetTransferPaymentInfo() =>
        Ok(posPaymentLogic.GetTransferPaymentInfo());

    [HttpGet("sepay-setup")]
    [Authorize(Policy = PermissionNames.CreatePosOrder)]
    public IActionResult GetSepaySetup() =>
        Ok(posPaymentLogic.GetSepaySetup());

    [HttpPost("transfer-qr")]
    [Authorize(Policy = PermissionNames.CreatePosOrder)]
    public async Task<IActionResult> BuildTransferQr(
        [FromBody] BuildTransferQrRequest request, CancellationToken ct) =>
        Ok(await posPaymentLogic.BuildTransferQrAsync(request, AccessContext(), ct));

    [HttpGet("orders/{orderId:guid}/transfer-qr")]
    [Authorize(Policy = PermissionNames.ViewOrder)]
    public async Task<IActionResult> GetTransferQr(Guid orderId, CancellationToken ct) =>
        Ok(await posPaymentLogic.GetTransferQrForOrderAsync(orderId, AccessContext(), ct));

    [HttpPost("orders/{orderId:guid}/transfer-qr/refresh")]
    [Authorize(Policy = PermissionNames.CreatePosOrder)]
    public async Task<IActionResult> RefreshTransferQr(Guid orderId, CancellationToken ct) =>
        Ok(await posPaymentLogic.RefreshTransferQrForOrderAsync(orderId, AccessContext(), ct));

    [HttpGet("orders/{orderId:guid}/payment-status")]
    [Authorize(Policy = PermissionNames.ViewOrder)]
    public async Task<IActionResult> GetOrderPaymentStatus(Guid orderId, CancellationToken ct) =>
        Ok(await posPaymentLogic.GetOrderPaymentStatusAsync(orderId, AccessContext(), ct));

    [HttpGet("orders/{orderId:guid}/remaining-qr")]
    [Authorize(Policy = PermissionNames.ViewOrder)]
    public async Task<IActionResult> GetRemainingQr(Guid orderId, CancellationToken ct) =>
        Ok(await posPaymentLogic.GetRemainingBalanceQrAsync(orderId, AccessContext(), forceRefresh: false, ct));

    [HttpPost("orders/{orderId:guid}/remaining-qr/refresh")]
    [Authorize(Policy = PermissionNames.CreateOrder)]
    public async Task<IActionResult> RefreshRemainingQr(Guid orderId, CancellationToken ct) =>
        Ok(await posPaymentLogic.GetRemainingBalanceQrAsync(orderId, AccessContext(), forceRefresh: true, ct));

    [HttpGet("orders/{orderId:guid}/remaining-status")]
    [Authorize(Policy = PermissionNames.ViewOrder)]
    public async Task<IActionResult> GetRemainingStatus(Guid orderId, CancellationToken ct) =>
        Ok(await posPaymentLogic.GetRemainingBalanceStatusAsync(orderId, AccessContext(), ct));

    [HttpPost("orders/{orderId:guid}/transfer-payment/cancel")]
    [Authorize]
    public async Task<IActionResult> CancelPendingTransfer(Guid orderId, CancellationToken ct)
    {
        if (!User.HasPermission(PermissionNames.CreatePosOrder)
            && !User.HasPermission(PermissionNames.CreateCodOrder))
        {
            return Forbid();
        }

        var (actorId, actorName) = Actor();
        return Ok(await orderLogic.CancelPendingTransferAsync(
            orderId,
            AccessContext(),
            actorId,
            actorName,
            ct));
    }

    [HttpPost("sepay/webhook")]
    [AllowAnonymous]
    public async Task<IActionResult> SepayWebhook(
        [FromBody] SepayWebhookPayload payload,
        CancellationToken ct)
    {
        if (!IsWebhookAuthorized())
            return Unauthorized(new { success = false, message = "Unauthorized webhook." });

        await posPaymentLogic.HandleSepayWebhookAsync(payload, ct);
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

        await posPaymentLogic.SimulateWebhookAsync(request, ct);
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
