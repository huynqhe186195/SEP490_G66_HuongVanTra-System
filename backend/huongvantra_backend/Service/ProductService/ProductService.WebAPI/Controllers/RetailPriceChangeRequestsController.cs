using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ProductService.Application.DTOs.Requests;
using ProductService.Infrastructure.UseCases;
using ProductService.WebAPI.Extensions;
using HuongVanTra.Shared.Auth;

namespace ProductService.WebAPI.Controllers;

[ApiController]
[Route("api/v1/retail-price-change-requests")]
public class RetailPriceChangeRequestsController(RetailPriceChangeRequestLogic _logic) : ControllerBase
{
    [HttpGet]
    [Authorize(Policy = PermissionNames.ViewCost)]
    public async Task<IActionResult> GetPaged(
        [FromQuery] string? status,
        [FromQuery] string? search,
        [FromQuery] bool mineOnly = false,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default) =>
        Ok(await _logic.GetPagedAsync(
            new GetRetailPriceChangeRequestsRequest(status, search, mineOnly, page, pageSize),
            User.ToProductApprovalActorSnapshot(),
            ct));

    [HttpGet("{id:guid}")]
    [Authorize(Policy = PermissionNames.ViewCost)]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct = default) =>
        Ok(await _logic.GetByIdAsync(id, ct));

    [HttpPost]
    [Authorize(Policy = PermissionNames.RequestRetailPriceChange)]
    public async Task<IActionResult> Create([FromBody] CreateRetailPriceChangeRequest request, CancellationToken ct = default)
    {
        var result = await _logic.CreateAsync(request, User.ToProductApprovalActorSnapshot(), ct);
        return CreatedAtAction(nameof(GetById), new { id = result.Id }, result);
    }

    [HttpPost("{id:guid}/approve")]
    [Authorize(Policy = PermissionNames.ApproveRetailPriceChange)]
    public async Task<IActionResult> Approve(Guid id, [FromBody] ApproveRetailPriceChangeRequest request, CancellationToken ct = default) =>
        Ok(await _logic.ApproveAsync(id, request, User.ToProductApprovalActorSnapshot(), ct));

    [HttpPost("{id:guid}/reject")]
    [Authorize(Policy = PermissionNames.ApproveRetailPriceChange)]
    public async Task<IActionResult> Reject(Guid id, [FromBody] RejectRetailPriceChangeRequest request, CancellationToken ct = default) =>
        Ok(await _logic.RejectAsync(id, request, User.ToProductApprovalActorSnapshot(), ct));

    // Hủy yêu cầu đổi giá: Admin (APPROVE_*) hoặc Kế toán (REQUEST_*/MANAGE_COST).
    [HttpPost("{id:guid}/cancel")]
    [Authorize(Policy = PermissionNames.CancelRetailPriceAccess)]
    public async Task<IActionResult> Cancel(Guid id, [FromBody] CancelRetailPriceChangeRequest request, CancellationToken ct = default) =>
        Ok(await _logic.CancelAsync(id, request, User.ToProductApprovalActorSnapshot(), ct));
}