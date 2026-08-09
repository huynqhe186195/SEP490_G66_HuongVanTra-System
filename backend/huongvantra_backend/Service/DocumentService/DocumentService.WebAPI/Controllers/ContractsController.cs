using DocumentService.Application.DTOs.Requests;
using DocumentService.Application.Interfaces;
using DocumentService.Application.UseCases;
using HuongVanTra.Shared.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DocumentService.WebAPI.Controllers;

[ApiController]
[Route("api/contracts")]
[Authorize]
public class ContractsController : ControllerBase
{
    private readonly ContractLogic _logic;
    private readonly IContractDocumentGenerator _docxGen;
    private readonly IContractDocumentGenerator _pdfGen;

    public ContractsController(
        ContractLogic logic,
        [FromKeyedServices("docx")] IContractDocumentGenerator docxGen,
        [FromKeyedServices("pdf")] IContractDocumentGenerator pdfGen)
    {
        _logic = logic;
        _docxGen = docxGen;
        _pdfGen = pdfGen;
    }

    private DocumentAccessContext AccessContext() => new(
        User.GetUserId(),
        User.HasPermission(PermissionNames.ApproveContract));

    [HttpGet]
    [Authorize(Policy = PermissionNames.ViewCustomerAccess)]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? search,
        [FromQuery] Guid? customerId,
        [FromQuery] string? status,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
    {
        var result = await _logic.GetPagedAsync(search, customerId, status, page, pageSize, AccessContext(), ct);
        return Ok(result);
    }

    [HttpGet("{id:guid}")]
    [Authorize(Policy = PermissionNames.ViewCustomerAccess)]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct = default)
    {
        var result = await _logic.GetByIdAsync(id, AccessContext(), ct);
        return Ok(result);
    }

    [HttpGet("active-for-customer/{customerId:guid}")]
    [Authorize(Policy = PermissionNames.ViewCustomerAccess)]
    public async Task<IActionResult> GetActiveForCustomer(Guid customerId, CancellationToken ct = default)
    {
        var result = await _logic.GetActiveForCustomerAsync(customerId, ct);
        return result is null ? NotFound() : Ok(result);
    }

    [HttpGet("{id:guid}/export-docx")]
    [Authorize(Policy = PermissionNames.ViewCustomerAccess)]
    public async Task<IActionResult> ExportDocx(Guid id, CancellationToken ct = default)
    {
        var (data, contentType, fileName) = await _logic.ExportAsync(id, "docx", AccessContext(), _docxGen, _pdfGen, ct);
        return File(data, contentType, fileName);
    }

    [HttpGet("{id:guid}/export-pdf")]
    [Authorize(Policy = PermissionNames.ViewCustomerAccess)]
    public async Task<IActionResult> ExportPdf(Guid id, CancellationToken ct = default)
    {
        var (data, contentType, fileName) = await _logic.ExportAsync(id, "pdf", AccessContext(), _docxGen, _pdfGen, ct);
        return File(data, contentType, fileName);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateContractRequest request, CancellationToken ct = default)
    {
        var result = await _logic.CreateAsync(request, AccessContext(), ct);
        return CreatedAtAction(nameof(GetById), new { id = result.Id }, result);
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateContractRequest request, CancellationToken ct = default)
    {
        var result = await _logic.UpdateAsync(id, request, AccessContext(), ct);
        return Ok(result);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct = default)
    {
        await _logic.DeleteAsync(id, AccessContext(), ct);
        return NoContent();
    }

    [HttpPost("{id:guid}/submit")]
    public async Task<IActionResult> Submit(Guid id, CancellationToken ct = default)
    {
        var result = await _logic.SubmitAsync(id, AccessContext(), ct);
        return Ok(result);
    }

    [HttpPost("{id:guid}/review")]
    [Authorize(Policy = PermissionNames.ApproveContract)]
    public async Task<IActionResult> Review(Guid id, [FromBody] ReviewContractRequest request, CancellationToken ct = default)
    {
        var result = await _logic.ReviewAsync(id, request, AccessContext(), ct);
        return Ok(result);
    }
}

