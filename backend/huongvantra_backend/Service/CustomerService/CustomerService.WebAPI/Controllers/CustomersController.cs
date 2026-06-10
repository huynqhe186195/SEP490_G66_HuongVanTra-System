using CustomerService.Application.DTOs.Requests;
using CustomerService.Application.UseCases;
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

    [HttpGet("statistics")]
    [Authorize(Policy = PermissionNames.ViewCustomer)]
    public async Task<IActionResult> GetStatistics(CancellationToken ct = default)
    {
        var result = await _logic.GetStatisticsAsync(ct);
        return Ok(result);
    }

    [HttpGet]
    [Authorize(Policy = PermissionNames.ViewCustomer)]
    public async Task<IActionResult> GetAll([FromQuery] int page = 1, [FromQuery] int pageSize = 20, CancellationToken ct = default)
    {
        var result = await _logic.GetAllAsync(page, pageSize, ct);
        return Ok(result);
    }

    [HttpGet("inactive")]
    [Authorize(Policy = PermissionNames.ViewCustomer)]
    public async Task<IActionResult> GetInactive([FromQuery] int page = 1, [FromQuery] int pageSize = 20, CancellationToken ct = default)
    {
        var result = await _logic.GetInactiveAsync(page, pageSize, ct);
        return Ok(result);
    }

    [HttpGet("{id:guid}")]
    [Authorize(Policy = PermissionNames.ViewCustomer)]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct = default)
    {
        var result = await _logic.GetByIdAsync(id, ct);
        return Ok(result);
    }

    [HttpGet("{id:guid}/debts")]
    [Authorize(Policy = PermissionNames.ViewCustomer)]
    public async Task<IActionResult> GetDebts(Guid id, CancellationToken ct = default)
    {
        var result = await _logic.GetDebtsAsync(id, ct);
        return Ok(result);
    }

    [HttpGet("{id:guid}/debt-summary")]
    [Authorize(Policy = PermissionNames.ViewCustomer)]
    public async Task<IActionResult> GetDebtSummary(Guid id, CancellationToken ct = default)
    {
        var result = await _logic.GetDebtSummaryAsync(id, ct);
        return Ok(result);
    }

    [HttpPost("{id:guid}/debts")]
    [Authorize(Policy = PermissionNames.CreateCustomer)]
    public async Task<IActionResult> RecordDebt(Guid id, [FromBody] RecordDebtTransactionRequest request, CancellationToken ct = default)
    {
        var result = await _logic.RecordDebtTransactionAsync(id, request, ct);
        return Ok(result);
    }

    [HttpGet("{id:guid}/open-debts")]
    [Authorize(Policy = PermissionNames.ViewCustomer)]
    public async Task<IActionResult> GetOpenDebts(Guid id, CancellationToken ct = default)
    {
        var result = await _logic.GetOpenDebtsAsync(id, ct);
        return Ok(result);
    }

    [HttpGet("{id:guid}/debt-payments/preview")]
    [Authorize(Policy = PermissionNames.ViewCustomer)]
    public async Task<IActionResult> PreviewDebtPayment(Guid id, [FromQuery] decimal amount, CancellationToken ct = default)
    {
        var result = await _logic.PreviewDebtPaymentAsync(id, amount, ct);
        return Ok(result);
    }

    [HttpPost("{id:guid}/debt-payments")]
    [Authorize(Policy = PermissionNames.CreateCustomer)]
    public async Task<IActionResult> ApplyDebtPayment(Guid id, [FromBody] ApplyDebtPaymentRequest request, CancellationToken ct = default)
    {
        var result = await _logic.ApplyDebtPaymentAsync(id, request, ct);
        return Ok(result);
    }

    [HttpGet("{id:guid}/activities")]
    [Authorize(Policy = PermissionNames.ViewCustomer)]
    public async Task<IActionResult> GetActivities(Guid id, CancellationToken ct = default)
    {
        var result = await _logic.GetActivitiesAsync(id, ct);
        return Ok(result);
    }

    [HttpPost]
    [Authorize(Policy = PermissionNames.CreateCustomer)]
    public async Task<IActionResult> Create([FromBody] CreateCustomerRequest request, CancellationToken ct = default)
    {
        var result = await _logic.CreateAsync(request, ct);
        return CreatedAtAction(nameof(GetById), new { id = result.Id }, result);
    }

    [HttpPut("{id:guid}")]
    [Authorize(Policy = PermissionNames.CreateCustomer)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateCustomerRequest request, CancellationToken ct = default)
    {
        var result = await _logic.UpdateAsync(id, request, ct);
        return Ok(result);
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Policy = PermissionNames.CreateCustomer)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct = default)
    {
        await _logic.DeleteAsync(id, ct);
        return NoContent();
    }

    [HttpPost("{id:guid}/restore")]
    [Authorize(Policy = PermissionNames.CreateCustomer)]
    public async Task<IActionResult> Restore(Guid id, CancellationToken ct = default)
    {
        var result = await _logic.RestoreAsync(id, ct);
        return Ok(result);
    }
}
