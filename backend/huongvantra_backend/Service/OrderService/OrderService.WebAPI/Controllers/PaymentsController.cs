using HuongVanTra.Shared.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OrderService.Application.Authorization;
using OrderService.Application.DTOs.Requests;
using OrderService.Application.UseCases;

namespace OrderService.WebAPI.Controllers;

[ApiController]
[Route("api/v1/payments")]
[Authorize]
public class PaymentsController(PaymentLogic paymentLogic) : ControllerBase
{
    private OrderAccessContext AccessContext()
    {
        var canViewAll = User.HasPermission(PermissionNames.ManageEmployee)
            || User.HasPermission(PermissionNames.ManageRole)
            || User.HasPermission(PermissionNames.ViewAllCustomers);
        var codOnly = !canViewAll && User.HasPermission(PermissionNames.VerifyCod);
        return new OrderAccessContext(User.GetUserId(), canViewAll, codOnly);
    }

    [HttpGet("orders/{orderId:guid}")]
    [Authorize(Policy = PermissionNames.ViewOrder)]
    public async Task<IActionResult> GetByOrderId(Guid orderId, CancellationToken ct = default) =>
        Ok(await paymentLogic.GetByOrderIdAsync(orderId, AccessContext(), ct));

    [HttpGet("cod/pending")]
    [Authorize(Policy = PermissionNames.ViewOrder)]
    public async Task<IActionResult> GetPendingCod(CancellationToken ct = default) =>
        Ok(await paymentLogic.GetPendingCodAsync(AccessContext(), ct));

    [HttpGet("cod/unverified")]
    [Authorize(Policy = PermissionNames.ViewOrder)]
    public async Task<IActionResult> GetUnverifiedCod(CancellationToken ct = default) =>
        Ok(await paymentLogic.GetUnverifiedCodAsync(AccessContext(), ct));

    [HttpPost("{id:guid}/verify-cod")]
    [Authorize(Policy = PermissionNames.VerifyCod)]
    public async Task<IActionResult> VerifyCod(
        Guid id, [FromBody] VerifyCodPaymentRequest request, CancellationToken ct = default)
    {
        // Policy VERIFY_COD: SaleCod / Manager (seed) / Admin (all perms).
        var actorId = User.GetUserId();
        var actorName = User.GetUsername();
        return Ok(await paymentLogic.VerifyCodAsync(
            id,
            request,
            AccessContext(),
            actorId == Guid.Empty ? null : actorId,
            string.IsNullOrWhiteSpace(actorName) ? null : actorName,
            ct));
    }
}
