using HuongVanTra.Shared.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OrderService.Application.DTOs.Requests;
using OrderService.Application.UseCases;

namespace OrderService.WebAPI.Controllers;

[ApiController]
[Authorize]
public class PromotionsController(PromotionLogic _promotionLogic) : ControllerBase
{
    [HttpGet("api/admin/promotions")]
    [Authorize(Policy = PermissionNames.ManageEmployee)]
    public async Task<IActionResult> GetAdminPromotions(
        [FromQuery] GetAdminPromotionsRequest request,
        CancellationToken ct = default) =>
        Ok(await _promotionLogic.GetAdminPromotionsAsync(request, ct));

    [HttpPost("api/admin/promotions")]
    [Authorize(Policy = PermissionNames.ManageEmployee)]
    public async Task<IActionResult> Create(
        [FromBody] CreatePromotionRequest request, CancellationToken ct = default) =>
        Ok(await _promotionLogic.CreateAsync(request, ct));

    [HttpPut("api/admin/promotions/{id:guid}")]
    [Authorize(Policy = PermissionNames.ManageEmployee)]
    public async Task<IActionResult> Update(
        Guid id, [FromBody] UpdatePromotionRequest request, CancellationToken ct = default) =>
        Ok(await _promotionLogic.UpdateAsync(id, request, ct));

    [HttpDelete("api/admin/promotions/{id:guid}")]
    [Authorize(Policy = PermissionNames.ManageEmployee)]
    public async Task<IActionResult> Deactivate(Guid id, CancellationToken ct = default) =>
        Ok(await _promotionLogic.DeactivateAsync(id, ct));

    [HttpPost("api/admin/promotions/{id:guid}/reactivate")]
    [Authorize(Policy = PermissionNames.ManageEmployee)]
    public async Task<IActionResult> Reactivate(Guid id, CancellationToken ct = default) =>
        Ok(await _promotionLogic.ReactivateAsync(id, ct));

    [HttpGet("api/promotions/lookup")]
    [Authorize(Policy = PermissionNames.CreateOrder)]
    public async Task<IActionResult> Lookup([FromQuery] string? code, CancellationToken ct = default) =>
        Ok(await _promotionLogic.LookupByCodeAsync(code, ct));

    [HttpGet("api/promotions/available")]
    [Authorize(Policy = PermissionNames.CreateOrder)]
    public async Task<IActionResult> GetAvailable(CancellationToken ct = default) =>
        Ok(await _promotionLogic.GetAvailablePromotionsAsync(ct));

    [HttpPost("api/promotions/applicable")]
    [Authorize(Policy = PermissionNames.CreateOrder)]
    public async Task<IActionResult> GetApplicable(
        [FromBody] PromotionApplyPreviewRequest request, CancellationToken ct = default) =>
        Ok(await _promotionLogic.GetApplicablePromotionsAsync(request, ct));

    [HttpPost("api/promotions/apply-preview")]
    [Authorize(Policy = PermissionNames.CreateOrder)]
    public async Task<IActionResult> ApplyPreview(
        [FromBody] PromotionApplyPreviewRequest request, CancellationToken ct = default) =>
        Ok(await _promotionLogic.ApplyPreviewAsync(request, ct));
}
