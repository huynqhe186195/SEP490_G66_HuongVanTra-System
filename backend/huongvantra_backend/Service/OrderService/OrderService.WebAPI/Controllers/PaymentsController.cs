using HuongVanTra.Shared.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OrderService.Application.DTOs.Requests;
using OrderService.Application.UseCases;

namespace OrderService.WebAPI.Controllers;

[ApiController]
[Route("api/v1/payments")]
[Authorize]
public class PaymentsController(PaymentLogic _paymentLogic) : ControllerBase
{
    [HttpGet("orders/{orderId:guid}")]
    [Authorize(Policy = PermissionNames.ViewOrder)]
    public async Task<IActionResult> GetByOrderId(Guid orderId, CancellationToken ct = default) =>
        Ok(await _paymentLogic.GetByOrderIdAsync(orderId, ct));

    [HttpGet("cod/pending")]
    [Authorize(Policy = PermissionNames.ViewOrder)]
    public async Task<IActionResult> GetPendingCod(CancellationToken ct = default) =>
        Ok(await _paymentLogic.GetPendingCodAsync(ct));

    [HttpGet("cod/unverified")]
    [Authorize(Policy = PermissionNames.ViewOrder)]
    public async Task<IActionResult> GetUnverifiedCod(CancellationToken ct = default) =>
        Ok(await _paymentLogic.GetUnverifiedCodAsync(ct));

    [HttpPost("{id:guid}/verify-cod")]
    [Authorize(Policy = PermissionNames.CreateOrder)]
    public async Task<IActionResult> VerifyCod(
        Guid id, [FromBody] VerifyCodPaymentRequest request, CancellationToken ct = default) =>
        Ok(await _paymentLogic.VerifyCodAsync(id, request, ct));
}
