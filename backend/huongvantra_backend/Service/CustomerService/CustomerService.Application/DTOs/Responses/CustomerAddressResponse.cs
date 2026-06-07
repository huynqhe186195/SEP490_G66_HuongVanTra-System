namespace CustomerService.Application.DTOs.Responses;

public record CustomerAddressResponse(
    Guid Id,
    Guid CustomerId,
    string ReceiverName,
    string ReceiverPhone,
    string AddressLine,
    string Ward,
    string District,
    string Province,
    bool IsDefault
);
