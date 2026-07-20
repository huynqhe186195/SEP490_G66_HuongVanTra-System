using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ProductService.Application.DTOs.Requests;
using ProductService.Infrastructure.UseCases;
using ProductService.WebAPI.Extensions;

namespace ProductService.WebAPI.Controllers;

[ApiController]
[Route("api/v1/product-creation-requests")]
public class ProductCreationRequestsController(ProductCreationRequestLogic _logic) : ControllerBase
{
    [HttpGet]
    [Authorize(Roles = "Admin,Warehouse")]
    public async Task<IActionResult> GetPaged(
        [FromQuery] string? status,
        [FromQuery] string? search,
        [FromQuery] bool mineOnly = false,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default) =>
        Ok(await _logic.GetPagedAsync(
            new GetProductCreationRequestsRequest(status, search, mineOnly, page, pageSize),
            User.ToProductApprovalActorSnapshot(),
            ct));

    [HttpGet("{id:guid}")]
    [Authorize(Roles = "Admin,Warehouse")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct = default) =>
        Ok(await _logic.GetByIdAsync(id, User.ToProductApprovalActorSnapshot(), ct));

    [HttpPost]
    [Authorize(Roles = "Warehouse")]
    public async Task<IActionResult> Create([FromBody] CreateProductCreationRequest request, CancellationToken ct = default)
    {
        var result = await _logic.CreateAsync(request, User.ToProductApprovalActorSnapshot(), ct);
        return CreatedAtAction(nameof(GetById), new { id = result.Id }, result);
    }

    [HttpPut("{id:guid}")]
    [Authorize(Roles = "Warehouse")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateProductCreationRequest request, CancellationToken ct = default) =>
        Ok(await _logic.UpdateAsync(id, request, User.ToProductApprovalActorSnapshot(), ct));

    [HttpPost("{id:guid}/submit")]
    [Authorize(Roles = "Warehouse")]
    public async Task<IActionResult> Submit(Guid id, [FromBody] SubmitProductCreationRequest request, CancellationToken ct = default) =>
        Ok(await _logic.SubmitAsync(id, request, User.ToProductApprovalActorSnapshot(), ct));

    [HttpPost("{id:guid}/approve")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Approve(Guid id, [FromBody] ApproveProductCreationRequest request, CancellationToken ct = default) =>
        Ok(await _logic.ApproveAsync(id, request, User.ToProductApprovalActorSnapshot(), ct));

    [HttpPost("{id:guid}/reject")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Reject(Guid id, [FromBody] RejectProductCreationRequest request, CancellationToken ct = default) =>
        Ok(await _logic.RejectAsync(id, request, User.ToProductApprovalActorSnapshot(), ct));

    [HttpPost("{id:guid}/cancel")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Cancel(Guid id, [FromBody] CancelProductCreationRequest request, CancellationToken ct = default) =>
        Ok(await _logic.CancelAsync(id, request, User.ToProductApprovalActorSnapshot(), ct));
}
