using CustomerService.Application.DTOs.Requests;
using CustomerService.Application.UseCases;
using Microsoft.AspNetCore.Mvc;

namespace CustomerService.WebAPI.Controllers;

[ApiController]
[Route("api/customer-tiers")]
public class CustomerTiersController : ControllerBase
{
    private readonly CustomerTierLogic _logic;

    public CustomerTiersController(CustomerTierLogic logic) => _logic = logic;

    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct = default)
    {
        var result = await _logic.GetAllAsync(ct);
        return Ok(result);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateCustomerTierRequest request, CancellationToken ct = default)
    {
        var result = await _logic.CreateAsync(request, ct);
        return CreatedAtAction(nameof(GetAll), result);
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateCustomerTierRequest request, CancellationToken ct = default)
    {
        var result = await _logic.UpdateAsync(id, request, ct);
        if (result == null) return NotFound();
        return Ok(result);
    }
}
