using CustomerService.Application.DTOs.Requests;
using CustomerService.Application.UseCases;
using HuongVanTra.Shared.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CustomerService.WebAPI.Controllers;

[ApiController]
[Route("api/customer-tiers")]
[Authorize]
public class CustomerTiersController : ControllerBase
{
    private readonly CustomerTierLogic _logic;

    public CustomerTiersController(CustomerTierLogic logic) => _logic = logic;

    [HttpGet]
    [Authorize(Policy = PermissionNames.ViewCustomerAccess)]
    public async Task<IActionResult> GetAll(
        [FromQuery] bool includeInactive = false,
        CancellationToken ct = default)
    {
        var result = await _logic.GetAllAsync(includeInactive, ct);
        return Ok(result);
    }

    [HttpPost]
    [Authorize(Policy = PermissionNames.ManageBusinessPolicy)]
    public async Task<IActionResult> Create([FromBody] CreateCustomerTierRequest request, CancellationToken ct = default)
    {
        var result = await _logic.CreateAsync(request, ct);
        return CreatedAtAction(nameof(GetAll), result);
    }

    [HttpPut("{id:int}")]
    [Authorize(Policy = PermissionNames.ManageBusinessPolicy)]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateCustomerTierRequest request, CancellationToken ct = default)
    {
        var result = await _logic.UpdateAsync(id, request, ct);
        if (result == null) return NotFound();
        return Ok(result);
    }

    [HttpPost("{id:int}/deactivate")]
    [Authorize(Policy = PermissionNames.ManageBusinessPolicy)]
    public async Task<IActionResult> Deactivate(int id, CancellationToken ct = default)
    {
        var result = await _logic.DeactivateAsync(id, ct);
        if (result == null) return NotFound();
        return Ok(result);
    }

    [HttpPost("{id:int}/reactivate")]
    [Authorize(Policy = PermissionNames.ManageBusinessPolicy)]
    public async Task<IActionResult> Reactivate(int id, CancellationToken ct = default)
    {
        var result = await _logic.ReactivateAsync(id, ct);
        if (result == null) return NotFound();
        return Ok(result);
    }
}
