using HuongVanTra.Shared.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ProductService.Application.DTOs.Requests;
using ProductService.Infrastructure.UseCases;
using ProductService.WebAPI.Extensions;

namespace ProductService.WebAPI.Controllers;

[ApiController]
[Route("api/v1/product-deletion-requests")]
public class ProductDeletionRequestsController(ProductDeletionRequestLogic _logic) : ControllerBase
{
    [HttpGet]
    [Authorize(Policy = PermissionNames.ViewProductRequest)]
    public async Task<IActionResult> GetPaged(
        [FromQuery] string? status,
        [FromQuery] string? search,
        [FromQuery] bool mineOnly = false,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default) =>
        Ok(await _logic.GetPagedAsync(
            new GetProductDeletionRequestsRequest(status, search, mineOnly, page, pageSize),
            User.ToProductApprovalActorSnapshot(),
            ct));

    [HttpGet("{id:guid}")]
    [Authorize(Policy = PermissionNames.ViewProductRequest)]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct = default) =>
        Ok(await _logic.GetByIdAsync(id, User.ToProductApprovalActorSnapshot(), ct));

    [HttpPost]
    [Authorize(Policy = PermissionNames.ManageCatalog)]
    public async Task<IActionResult> Create([FromBody] CreateProductDeletionRequest request, CancellationToken ct = default)
    {
        var result = await _logic.CreateAsync(request, User.ToProductApprovalActorSnapshot(), GetAuthorizationHeader(), ct);
        return CreatedAtAction(nameof(GetById), new { id = result.Id }, result);
    }

    [HttpPut("{id:guid}")]
    [Authorize(Policy = PermissionNames.ManageCatalog)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateProductDeletionRequest request, CancellationToken ct = default) =>
        Ok(await _logic.UpdateAsync(id, request, User.ToProductApprovalActorSnapshot(), GetAuthorizationHeader(), ct));

    [HttpPost("{id:guid}/submit")]
    [Authorize(Policy = PermissionNames.ManageCatalog)]
    public async Task<IActionResult> Submit(Guid id, [FromBody] SubmitProductDeletionRequest request, CancellationToken ct = default) =>
        Ok(await _logic.SubmitAsync(id, request, User.ToProductApprovalActorSnapshot(), GetAuthorizationHeader(), ct));

    [HttpPost("{id:guid}/approve")]
    [Authorize(Policy = PermissionNames.ApproveProductRequest)]
    public async Task<IActionResult> Approve(Guid id, [FromBody] ApproveProductDeletionRequest request, CancellationToken ct = default) =>
        Ok(await _logic.ApproveAsync(id, request, User.ToProductApprovalActorSnapshot(), GetAuthorizationHeader(), ct));

    [HttpPost("{id:guid}/reject")]
    [Authorize(Policy = PermissionNames.ApproveProductRequest)]
    public async Task<IActionResult> Reject(Guid id, [FromBody] RejectProductDeletionRequest request, CancellationToken ct = default) =>
        Ok(await _logic.RejectAsync(id, request, User.ToProductApprovalActorSnapshot(), ct));

    [HttpPost("{id:guid}/cancel")]
    [Authorize(Policy = PermissionNames.ApproveProductRequest)]
    public async Task<IActionResult> Cancel(Guid id, [FromBody] CancelProductDeletionRequest request, CancellationToken ct = default) =>
        Ok(await _logic.CancelAsync(id, request, User.ToProductApprovalActorSnapshot(), ct));

    private string? GetAuthorizationHeader() => Request.Headers.Authorization.FirstOrDefault();
}
