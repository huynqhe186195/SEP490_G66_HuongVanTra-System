using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ProductService.Application.DTOs.Requests;
using ProductService.Infrastructure.UseCases;
using ProductService.WebAPI.Extensions;

namespace ProductService.WebAPI.Controllers;

[ApiController]
[Route("api/v1/product-approval-requests")]
public class ProductApprovalRequestsController(ProductApprovalLogic _logic) : ControllerBase
{
    [HttpGet]
    [Authorize(Roles = "Admin,Warehouse")]
    public async Task<IActionResult> GetPaged(
        [FromQuery] string? status,
        [FromQuery] string? search,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default) =>
        Ok(await _logic.GetPagedAsync(new GetProductApprovalRequestsRequest(status, search, page, pageSize), ct));

    [HttpGet("{id:guid}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct = default) =>
        Ok(await _logic.GetByIdAsync(id, ct));

    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Create([FromBody] CreateNewProductApprovalRequest request, CancellationToken ct = default)
    {
        var result = await _logic.CreateAsync(request, User.ToProductApprovalActorSnapshot(), ct);
        return CreatedAtAction(nameof(GetById), new { id = result.Id }, result);
    }

    [HttpPost("{id:guid}/authorize")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Authorize(Guid id, [FromBody] AuthorizeProductApprovalRequest request, CancellationToken ct = default) =>
        Ok(await _logic.AuthorizeAsync(id, request, User.ToProductApprovalActorSnapshot(), ct));

    [HttpPost("{id:guid}/cancel")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Cancel(Guid id, [FromBody] CancelProductApprovalRequest request, CancellationToken ct = default) =>
        Ok(await _logic.CancelAsync(id, request, User.ToProductApprovalActorSnapshot(), ct));

    [HttpPost("validate-code")]
    [Authorize(Roles = "Warehouse")]
    public async Task<IActionResult> ValidateCode([FromBody] ValidateProductApprovalCodeRequest request, CancellationToken ct = default) =>
        Ok(await _logic.ValidateCodeAsync(request, ct));

    [HttpPost("create-automatic")]
    [Authorize(Roles = "Warehouse")]
    public async Task<IActionResult> CreateAutomatic([FromBody] CreateProductFromApprovalRequest request, CancellationToken ct = default) =>
        Ok(await _logic.CreateAutomaticAsync(request, User.ToProductApprovalActorSnapshot(), ct));

    [HttpPost("create-manual")]
    [Authorize(Roles = "Warehouse")]
    public async Task<IActionResult> CreateManual([FromBody] CreateProductManualFromApprovalRequest request, CancellationToken ct = default) =>
        Ok(await _logic.CreateManualAsync(request, User.ToProductApprovalActorSnapshot(), ct));
}
