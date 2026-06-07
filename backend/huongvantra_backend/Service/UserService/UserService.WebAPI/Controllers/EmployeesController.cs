using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using UserService.Application.DTOs.Requests;
using UserService.Application.UseCases;
using UserService.Domain.Constants;

namespace UserService.WebAPI.Controllers;

[ApiController]
[Route("api/employees")]
[Authorize(Policy = PermissionNames.ManageEmployee)]
public class EmployeesController(EmployeeLogic employeeLogic) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        var result = await employeeLogic.GetAllAsync(page, pageSize);
        return Ok(result);
    }

    [HttpGet("{id:long}")]
    public async Task<IActionResult> GetById(long id)
    {
        var result = await employeeLogic.GetByIdAsync(id);
        return Ok(result);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateEmployeeRequest request)
    {
        var result = await employeeLogic.CreateAsync(request);
        return CreatedAtAction(nameof(GetById), new { id = result.Id }, result);
    }

    [HttpPut("{id:long}")]
    public async Task<IActionResult> Update(long id, [FromBody] UpdateEmployeeRequest request)
    {
        await employeeLogic.UpdateAsync(id, request);
        return NoContent();
    }

    [HttpPut("{id:long}/deactivate")]
    public async Task<IActionResult> Deactivate(long id)
    {
        await employeeLogic.DeactivateAsync(id);
        return NoContent();
    }
}
