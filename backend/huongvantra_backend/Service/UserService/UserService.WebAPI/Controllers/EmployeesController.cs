using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using UserService.Application.DTOs.Requests;
using UserService.Application.UseCases;
using UserService.Domain.Constants;
using UserService.WebAPI.Extensions;

namespace UserService.WebAPI.Controllers;

[ApiController]
[Route("api/employees")]
[Authorize]
public class EmployeesController(EmployeeLogic employeeLogic) : ControllerBase
{
    private IReadOnlyList<string> ActorPermissions => User.GetPermissions().ToList();

    [HttpGet("sales-assignees")]
    [Authorize(Policy = PermissionNames.ViewAllCustomers)]
    public async Task<IActionResult> GetSalesAssignees()
    {
        var result = await employeeLogic.GetSalesAssigneesAsync();
        return Ok(result);
    }

    [HttpGet]
    [Authorize(Policy = PermissionNames.ManageEmployee)]
    public async Task<IActionResult> GetAll([FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        var result = await employeeLogic.GetAllAsync(page, pageSize, ActorPermissions);
        return Ok(result);
    }

    [HttpGet("sales")]
    public async Task<IActionResult> GetSales()
    {
        var result = await employeeLogic.GetSalesAsync();
        return Ok(result);
    }

    [HttpGet("{id:long}")]
    [Authorize(Policy = PermissionNames.ManageEmployee)]
    public async Task<IActionResult> GetById(long id)
    {
        var result = await employeeLogic.GetByIdAsync(id, ActorPermissions);
        return Ok(result);
    }

    [HttpPost]
    [Authorize(Policy = PermissionNames.ManageEmployee)]
    public async Task<IActionResult> Create([FromBody] CreateEmployeeRequest request)
    {
        var result = await employeeLogic.CreateAsync(request, ActorPermissions);
        return CreatedAtAction(nameof(GetById), new { id = result.Id }, result);
    }

    [HttpPut("{id:long}")]
    [Authorize(Policy = PermissionNames.ManageEmployee)]
    public async Task<IActionResult> Update(long id, [FromBody] UpdateEmployeeRequest request)
    {
        await employeeLogic.UpdateAsync(id, request, ActorPermissions);
        return NoContent();
    }

    [HttpPut("{id:long}/deactivate")]
    [Authorize(Policy = PermissionNames.ManageEmployee)]
    public async Task<IActionResult> Deactivate(long id)
    {
        await employeeLogic.DeactivateAsync(id, ActorPermissions);
        return NoContent();
    }
}
