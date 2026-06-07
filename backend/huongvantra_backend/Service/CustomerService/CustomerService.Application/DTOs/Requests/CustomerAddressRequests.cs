namespace CustomerService.Application.DTOs.Requests;

public record CreateCustomerAddressRequest(
    string ReceiverName,
    string ReceiverPhone,
    string AddressLine,
    string Ward,
    string District,
    string Province,
    bool IsDefault
);

public record UpdateCustomerAddressRequest(
    string ReceiverName,
    string ReceiverPhone,
    string AddressLine,
    string Ward,
    string District,
    string Province,
    bool IsDefault
);
