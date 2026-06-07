using CustomerService.Application.DTOs.Requests;
using CustomerService.Application.Interfaces;
using CustomerService.Application.Validation;
using CustomerService.Domain.Entities;
using HuongVanTra.Shared.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CustomerService.WebAPI.Controllers;

[ApiController]
[Route("api/addresses")]
[Authorize]
public class AddressesController : ControllerBase
{
    private readonly ICustomerAddressRepository _addressRepo;

    public AddressesController(ICustomerAddressRepository addressRepo) => _addressRepo = addressRepo;

    [HttpPut("{addressId:guid}")]
    [Authorize(Policy = PermissionNames.CreateCustomer)]
    public async Task<IActionResult> Update(Guid addressId, [FromBody] UpdateCustomerAddressRequest request, CancellationToken ct = default)
    {
        var address = await _addressRepo.GetByIdAsync(addressId, ct);
        if (address is null) return NotFound();

        if (request.IsDefault)
            await _addressRepo.ClearDefaultForCustomerAsync(address.CustomerId, addressId, ct);

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
    public async Task<IActionResult> Delete(Guid addressId, CancellationToken ct = default)
    {
        var address = await _addressRepo.GetByIdAsync(addressId, ct);
        if (address is null) return NotFound();

        _addressRepo.Delete(address);
        await _addressRepo.SaveChangesAsync(ct);
        return NoContent();
    }
}
