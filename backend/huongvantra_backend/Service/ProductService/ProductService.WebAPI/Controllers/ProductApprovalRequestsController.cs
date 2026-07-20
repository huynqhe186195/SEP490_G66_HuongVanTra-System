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
    private static readonly object LegacyWriteDisabled = new
    {
        message = "Luồng mã phê duyệt sản phẩm cũ đã chuyển sang ProductCreationRequest. Vui lòng dùng /api/v1/product-creation-requests."
    };

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
    [Authorize(Roles = "Admin,Warehouse")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct = default) =>
        Ok(await _logic.GetByIdAsync(id, ct));

    [HttpPost]
    [Authorize(Roles = "Admin")]
    public IActionResult Create([FromBody] CreateNewProductApprovalRequest request, CancellationToken ct = default) =>
        StatusCode(StatusCodes.Status410Gone, LegacyWriteDisabled);

    [HttpPost("{id:guid}/authorize")]
    [Authorize(Roles = "Admin")]
    public IActionResult Authorize(Guid id, [FromBody] AuthorizeProductApprovalRequest request, CancellationToken ct = default) =>
        StatusCode(StatusCodes.Status410Gone, LegacyWriteDisabled);

    [HttpPost("{id:guid}/cancel")]
    [Authorize(Roles = "Admin")]
    public IActionResult Cancel(Guid id, [FromBody] CancelProductApprovalRequest request, CancellationToken ct = default) =>
        StatusCode(StatusCodes.Status410Gone, LegacyWriteDisabled);

    [HttpPost("validate-code")]
    [Authorize(Roles = "Warehouse")]
    public IActionResult ValidateCode([FromBody] ValidateProductApprovalCodeRequest request, CancellationToken ct = default) =>
        StatusCode(StatusCodes.Status410Gone, LegacyWriteDisabled);

    [HttpPost("create-automatic")]
    [Authorize(Roles = "Warehouse")]
    public IActionResult CreateAutomatic([FromBody] CreateProductFromApprovalRequest request, CancellationToken ct = default) =>
        StatusCode(StatusCodes.Status410Gone, LegacyWriteDisabled);

    [HttpPost("create-manual")]
    [Authorize(Roles = "Warehouse")]
    public IActionResult CreateManual([FromBody] CreateProductManualFromApprovalRequest request, CancellationToken ct = default) =>
        StatusCode(StatusCodes.Status410Gone, LegacyWriteDisabled);
}
