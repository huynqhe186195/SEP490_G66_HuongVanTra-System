using CustomerService.Application.DTOs.Requests;
using CustomerService.Application.Interfaces;
using CustomerService.Application.UseCases;
using CustomerService.Domain.Exceptions;
using HuongVanTra.Shared.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CustomerService.WebAPI.Controllers;

[ApiController]
[Route("api/customers")]
[Authorize]
public class CustomersController : ControllerBase
{
    private readonly CustomerLogic _logic;

    public CustomersController(CustomerLogic logic) => _logic = logic;

    private CustomerAccessContext AccessContext() => new(
        User.GetUserId(),
        User.HasPermission(PermissionNames.ViewAllCustomers),
        User.HasPermission(PermissionNames.ManageRole));

    [HttpGet("statistics")]
    [Authorize(Policy = PermissionNames.ViewCustomerAccess)]
    public async Task<IActionResult> GetStatistics(CancellationToken ct = default)
    {
        var result = await _logic.GetStatisticsAsync(AccessContext(), ct);
        return Ok(result);
    }

    [HttpGet]
    [Authorize(Policy = PermissionNames.ViewCustomerAccess)]
    public async Task<IActionResult> GetAll([FromQuery] int page = 1, [FromQuery] int pageSize = 20, CancellationToken ct = default)
    {
        var result = await _logic.GetAllAsync(page, pageSize, AccessContext(), ct);
        return Ok(result);
    }

    [HttpGet("inactive")]
    [Authorize(Policy = PermissionNames.ViewCustomerAccess)]
    public async Task<IActionResult> GetInactive([FromQuery] int page = 1, [FromQuery] int pageSize = 20, CancellationToken ct = default)
    {
        var result = await _logic.GetInactiveAsync(page, pageSize, AccessContext(), ct);
        return Ok(result);
    }

    [HttpGet("lookup")]
    [Authorize(Policy = PermissionNames.ViewCustomerAccess)]
    public async Task<IActionResult> LookupByPhone([FromQuery] string phone, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(phone))
            return BadRequest(new { error = "Số điện thoại là bắt buộc.", statusCode = 400 });

        try
        {
            var result = await _logic.GetByPhoneAsync(phone, AccessContext(), ct);
            if (result is null)
                return NotFound(new { error = "Không tìm thấy khách hàng với số điện thoại này.", statusCode = 404 });
            return Ok(result);
        }
        catch (CustomerForbiddenException ex)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { error = ex.Message, statusCode = 403 });
        }
    }

    [HttpGet("import-template")]
    [Authorize(Policy = PermissionNames.CreateCustomer)]
    public IActionResult DownloadImportTemplate()
    {
        var content = _logic.BuildImportTemplate();
        return File(content, CustomerLogic.CustomerImportContentType, CustomerLogic.CustomerImportTemplateFileName);
    }

    [HttpPost("import")]
    [Authorize(Policy = PermissionNames.CreateCustomer)]
    [RequestSizeLimit(10_000_000)]
    public async Task<IActionResult> ImportCustomers([FromForm] IFormFile? file, CancellationToken ct = default)
    {
        if (file is null || file.Length == 0)
            throw new CustomerValidationException(["Vui lòng chọn file Excel cần import."]);

        await using var stream = file.OpenReadStream();
        var result = await _logic.ImportFromExcelAsync(stream, file.FileName, AccessContext(), ct);
        return Ok(result);
    }

    [HttpGet("export")]
    [Authorize(Policy = PermissionNames.ViewCustomerAccess)]
    public async Task<IActionResult> ExportCustomers([FromQuery] CustomerExportRequest request, CancellationToken ct = default)
    {
        var result = await _logic.ExportToExcelAsync(request, AccessContext(), ct);
        return File(result.Content, result.ContentType, result.FileName);
    }

    [HttpGet("{id:guid}")]
    [Authorize(Policy = PermissionNames.ViewCustomerAccess)]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct = default)
    {
        var result = await _logic.GetByIdAsync(id, AccessContext(), ct);
        return Ok(result);
    }

    [HttpGet("{id:guid}/debts")]
    [Authorize(Policy = PermissionNames.ViewCustomerAccess)]
    public async Task<IActionResult> GetDebts(Guid id, CancellationToken ct = default)
    {
        var result = await _logic.GetDebtsAsync(id, AccessContext(), ct);
        return Ok(result);
    }

    [HttpGet("{id:guid}/debt-summary")]
    [Authorize(Policy = PermissionNames.ViewCustomerAccess)]
    public async Task<IActionResult> GetDebtSummary(Guid id, CancellationToken ct = default)
    {
        var result = await _logic.GetDebtSummaryAsync(id, AccessContext(), ct);
        return Ok(result);
    }

    [HttpPost("{id:guid}/debts")]
    [Authorize(Policy = PermissionNames.CreateCustomer)]
    public async Task<IActionResult> RecordDebt(Guid id, [FromBody] RecordDebtTransactionRequest request, CancellationToken ct = default)
    {
        var result = await _logic.RecordDebtTransactionAsync(id, request, AccessContext(), ct);
        return Ok(result);
    }

    [HttpGet("{id:guid}/open-debts")]
    [Authorize(Policy = PermissionNames.ViewCustomerAccess)]
    public async Task<IActionResult> GetOpenDebts(Guid id, CancellationToken ct = default)
    {
        var result = await _logic.GetOpenDebtsAsync(id, AccessContext(), ct);
        return Ok(result);
    }

    [HttpGet("{id:guid}/debt-payments/preview")]
    [Authorize(Policy = PermissionNames.ViewCustomerAccess)]
    public async Task<IActionResult> PreviewDebtPayment(Guid id, [FromQuery] decimal amount, CancellationToken ct = default)
    {
        var result = await _logic.PreviewDebtPaymentAsync(id, amount, AccessContext(), ct);
        return Ok(result);
    }

    [HttpPost("{id:guid}/debt-payments")]
    [Authorize(Policy = PermissionNames.ApplyDebtPayment)]
    public async Task<IActionResult> ApplyDebtPayment(Guid id, [FromBody] ApplyDebtPaymentRequest request, CancellationToken ct = default)
    {
        var result = await _logic.ApplyDebtPaymentAsync(id, request, AccessContext(), ct);
        return Ok(result);
    }

    [HttpGet("{id:guid}/activities")]
    [Authorize(Policy = PermissionNames.ViewCustomerAccess)]
    public async Task<IActionResult> GetActivities(Guid id, CancellationToken ct = default)
    {
        var result = await _logic.GetActivitiesAsync(id, AccessContext(), ct);
        return Ok(result);
    }

    [HttpPost("pos-quick")]
    [Authorize(Policy = PermissionNames.CreateOrder)]
    public async Task<IActionResult> CreateFromPos([FromBody] CreateCustomerRequest request, CancellationToken ct = default)
    {
        var result = await _logic.CreateAsync(request, AccessContext(), ct);
        return CreatedAtAction(nameof(GetById), new { id = result.Id }, result);
    }

    [HttpPost]
    [Authorize(Policy = PermissionNames.CreateCustomer)]
    public async Task<IActionResult> Create([FromBody] CreateCustomerRequest request, CancellationToken ct = default)
    {
        var result = await _logic.CreateAsync(request, AccessContext(), ct);
        return CreatedAtAction(nameof(GetById), new { id = result.Id }, result);
    }

    [HttpPut("{id:guid}")]
    [Authorize(Policy = PermissionNames.EditCustomerProfile)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateCustomerRequest request, CancellationToken ct = default)
    {
        var result = await _logic.UpdateAsync(id, request, AccessContext(), ct);
        return Ok(result);
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Policy = PermissionNames.ManageRole)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct = default)
    {
        await _logic.DeleteAsync(id, AccessContext(), ct);
        return NoContent();
    }

    [HttpPost("{id:guid}/restore")]
    [Authorize(Policy = PermissionNames.ManageRole)]
    public async Task<IActionResult> Restore(Guid id, CancellationToken ct = default)
    {
        var result = await _logic.RestoreAsync(id, AccessContext(), ct);
        return Ok(result);
    }
}
