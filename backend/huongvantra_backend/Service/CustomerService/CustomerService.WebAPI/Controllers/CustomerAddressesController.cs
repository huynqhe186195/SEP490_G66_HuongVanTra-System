using CustomerService.Application.DTOs.Requests;
using CustomerService.Application.DTOs.Responses;
using CustomerService.Application.Interfaces;
using CustomerService.Application.Validation;
using CustomerService.Domain.Entities;
using HuongVanTra.Shared.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CustomerService.WebAPI.Controllers;

[ApiController]
[Route("api/customers/{customerId:guid}/addresses")]
[Authorize]
public class CustomerAddressesController : ControllerBase
{
    private readonly ICustomerAddressRepository _addressRepo;

    public CustomerAddressesController(ICustomerAddressRepository addressRepo)
        => _addressRepo = addressRepo;

    [HttpGet]
    [Authorize(Policy = PermissionNames.ViewCustomer)]
    public async Task<IActionResult> GetAll(Guid customerId, CancellationToken ct = default)
    {
        var addresses = await _addressRepo.GetByCustomerIdAsync(customerId, ct);
        var result = addresses.Select(a => new CustomerAddressResponse(
            a.Id, a.CustomerId, a.ReceiverName, a.ReceiverPhone,
            a.AddressLine, a.Ward, a.District, a.Province, a.IsDefault));
        return Ok(result);
    }

    [HttpPost]
    [Authorize(Policy = PermissionNames.CreateCustomer)]
    public async Task<IActionResult> Create(Guid customerId, [FromBody] CreateCustomerAddressRequest request, CancellationToken ct = default)
    {
        var validated = CustomerAddressInputValidator.Validate(
            request.ReceiverName,
            request.ReceiverPhone,
            request.AddressLine,
            request.Ward,
            request.District,
            request.Province);

        if (request.IsDefault)
            await _addressRepo.ClearDefaultForCustomerAsync(customerId, ct: ct);

        var address = new CustomerAddress
        {
            Id = Guid.NewGuid(),
            CustomerId = customerId,
            ReceiverName = validated.ReceiverName,
            ReceiverPhone = validated.ReceiverPhone,
            AddressLine = validated.AddressLine,
            Ward = validated.Ward,
            District = validated.District,
            Province = validated.Province,
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
    [Authorize(Policy = PermissionNames.CreateCustomer)]
    public async Task<IActionResult> Update(Guid customerId, Guid addressId, [FromBody] UpdateCustomerAddressRequest request, CancellationToken ct = default)
    {
        var address = await _addressRepo.GetByIdAsync(addressId, ct);
        if (address == null || address.CustomerId != customerId) return NotFound();

        if (request.IsDefault)
            await _addressRepo.ClearDefaultForCustomerAsync(customerId, addressId, ct);

        var validated = CustomerAddressInputValidator.Validate(
            request.ReceiverName,
            request.ReceiverPhone,
            request.AddressLine,
            request.Ward,
            request.District,
            request.Province);

        address.ReceiverName = validated.ReceiverName;
        address.ReceiverPhone = validated.ReceiverPhone;
        address.AddressLine = validated.AddressLine;
        address.Ward = validated.Ward;
        address.District = validated.District;
        address.Province = validated.Province;
        address.IsDefault = request.IsDefault;
        address.UpdatedAt = DateTime.UtcNow;

        _addressRepo.Update(address);
        await _addressRepo.SaveChangesAsync(ct);
        return Ok();
    }

    [HttpDelete("{addressId:guid}")]
    [Authorize(Policy = PermissionNames.CreateCustomer)]
    public async Task<IActionResult> Delete(Guid customerId, Guid addressId, CancellationToken ct = default)
    {
        var address = await _addressRepo.GetByIdAsync(addressId, ct);
        if (address == null || address.CustomerId != customerId) return NotFound();

        _addressRepo.Delete(address);
        await _addressRepo.SaveChangesAsync(ct);
        return NoContent();
    }
}
