using CustomerService.Application.DTOs.Requests;
using CustomerService.Application.DTOs.Responses;
using CustomerService.Application.Interfaces;
using CustomerService.Domain.Entities;
using Microsoft.AspNetCore.Mvc;

namespace CustomerService.WebAPI.Controllers;

[ApiController]
[Route("api/customers/{customerId:guid}/addresses")]
public class CustomerAddressesController : ControllerBase
{
    private readonly ICustomerAddressRepository _addressRepo;

    public CustomerAddressesController(ICustomerAddressRepository addressRepo)
        => _addressRepo = addressRepo;

    [HttpGet]
    public async Task<IActionResult> GetAll(Guid customerId, CancellationToken ct = default)
    {
        var addresses = await _addressRepo.GetByCustomerIdAsync(customerId, ct);
        var result = addresses.Select(a => new CustomerAddressResponse(
            a.Id, a.CustomerId, a.ReceiverName, a.ReceiverPhone,
            a.AddressLine, a.Ward, a.District, a.Province, a.IsDefault));
        return Ok(result);
    }

    [HttpPost]
    public async Task<IActionResult> Create(Guid customerId, [FromBody] CreateCustomerAddressRequest request, CancellationToken ct = default)
    {
        var address = new CustomerAddress
        {
            Id = Guid.NewGuid(),
            CustomerId = customerId,
            ReceiverName = request.ReceiverName,
            ReceiverPhone = request.ReceiverPhone,
            AddressLine = request.AddressLine,
            Ward = request.Ward,
            District = request.District,
            Province = request.Province,
            IsDefault = request.IsDefault,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        await _addressRepo.AddAsync(address, ct);
        await _addressRepo.SaveChangesAsync(ct);

        var result = new CustomerAddressResponse(address.Id, address.CustomerId, address.ReceiverName,
            address.ReceiverPhone, address.AddressLine, address.Ward, address.District, address.Province, address.IsDefault);
        return CreatedAtAction(nameof(GetAll), new { customerId }, result);
    }

    [HttpPut("{addressId:guid}")]
    public async Task<IActionResult> Update(Guid customerId, Guid addressId, [FromBody] UpdateCustomerAddressRequest request, CancellationToken ct = default)
    {
        var address = await _addressRepo.GetByIdAsync(addressId, ct);
        if (address == null || address.CustomerId != customerId) return NotFound();

        address.ReceiverName = request.ReceiverName;
        address.ReceiverPhone = request.ReceiverPhone;
        address.AddressLine = request.AddressLine;
        address.Ward = request.Ward;
        address.District = request.District;
        address.Province = request.Province;
        address.IsDefault = request.IsDefault;
        address.UpdatedAt = DateTime.UtcNow;

        _addressRepo.Update(address);
        await _addressRepo.SaveChangesAsync(ct);
        return Ok();
    }

    [HttpDelete("{addressId:guid}")]
    public async Task<IActionResult> Delete(Guid customerId, Guid addressId, CancellationToken ct = default)
    {
        var address = await _addressRepo.GetByIdAsync(addressId, ct);
        if (address == null || address.CustomerId != customerId) return NotFound();

        _addressRepo.Delete(address);
        await _addressRepo.SaveChangesAsync(ct);
        return NoContent();
    }
}
