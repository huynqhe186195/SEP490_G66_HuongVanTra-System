using CustomerService.Application.DTOs.Requests;
using CustomerService.Application.DTOs.Responses;
using CustomerService.Application.Interfaces;
using CustomerService.Domain.Entities;
using CustomerService.Domain.Enums;
using CustomerService.Domain.Exceptions;

namespace CustomerService.Application.UseCases;

public class CustomerLogic
{
    private const int MaxPageSize = 100;

    private readonly ICustomerRepository _customerRepo;
    private readonly ICustomerTierRepository _tierRepo;

    public CustomerLogic(ICustomerRepository customerRepo, ICustomerTierRepository tierRepo)
    {
        _customerRepo = customerRepo;
        _tierRepo = tierRepo;
    }

    public async Task<CustomerResponse> CreateAsync(CreateCustomerRequest request, CancellationToken ct = default)
    {
        var input = ValidateCustomerRequest(request);

        if (await _customerRepo.PhoneExistsAsync(input.PhoneNumber, ct: ct))
            throw new DuplicatePhoneNumberException(input.PhoneNumber);

        var customer = new Customer
        {
            Id = Guid.NewGuid(),
            FullName = input.FullName,
            PhoneNumber = input.PhoneNumber,
            CustomerGroup = input.CustomerGroup,
            TaxCode = input.TaxCode,
            AssignedSaleId = input.AssignedSaleId,
            TotalSpending = 0,
            CurrentDebt = 0,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        await _customerRepo.AddAsync(customer, ct);
        await _customerRepo.SaveChangesAsync(ct);
        return MapToResponse(customer);
    }

    public async Task<CustomerResponse> UpdateAsync(Guid id, UpdateCustomerRequest request, CancellationToken ct = default)
    {
        var customer = await _customerRepo.GetByIdAsync(id, ct)
            ?? throw new CustomerNotFoundException(id);

        var input = ValidateCustomerRequest(request);

        if (await _customerRepo.PhoneExistsAsync(input.PhoneNumber, id, ct))
            throw new DuplicatePhoneNumberException(input.PhoneNumber);

        if (input.TierId.HasValue && await _tierRepo.GetByIdAsync(input.TierId.Value, ct) is null)
            throw new CustomerValidationException([$"CustomerTier with id '{input.TierId.Value}' does not exist."]);

        customer.FullName = input.FullName;
        customer.PhoneNumber = input.PhoneNumber;
        customer.CustomerGroup = input.CustomerGroup;
        customer.TaxCode = input.TaxCode;
        customer.TierId = input.TierId;
        customer.AssignedSaleId = input.AssignedSaleId;
        customer.UpdatedAt = DateTime.UtcNow;

        _customerRepo.Update(customer);
        await _customerRepo.SaveChangesAsync(ct);
        return MapToResponse(customer);
    }

    public async Task HandleOrderCompletedAsync(Guid customerId, decimal amountSpent, decimal debtAmount, CancellationToken ct = default)
    {
        var customer = await _customerRepo.GetByIdAsync(customerId, ct);
        if (customer == null) return;

        customer.TotalSpending += amountSpent;
        customer.CurrentDebt += debtAmount;
        customer.UpdatedAt = DateTime.UtcNow;

        var newTier = await _tierRepo.GetTierForSpendingAsync(customer.TotalSpending, ct);
        if (newTier != null && customer.TierId != newTier.Id)
            customer.TierId = newTier.Id;

        _customerRepo.Update(customer);
        await _customerRepo.SaveChangesAsync(ct);
    }

    public async Task<CustomerDetailResponse> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        var customer = await _customerRepo.GetByIdAsync(id, ct)
            ?? throw new CustomerNotFoundException(id);
        return MapToDetailResponse(customer);
    }

    public async Task<PagedResult<CustomerResponse>> GetAllAsync(int page, int pageSize, CancellationToken ct = default)
    {
        ValidatePagination(page, pageSize);

        var totalCount = await _customerRepo.CountAsync(ct);
        var customers = await _customerRepo.GetAllAsync(page, pageSize, ct);
        var items = customers.Select(MapToResponse).ToList();
        return new PagedResult<CustomerResponse>(items, page, pageSize, totalCount);
    }

    private static ValidatedCustomerInput ValidateCustomerRequest(CreateCustomerRequest request)
    {
        if (request is null)
            throw new CustomerValidationException(["Request body is required."]);

        return ValidateCustomerFields(
            request.FullName,
            request.PhoneNumber,
            request.CustomerGroup,
            request.TaxCode,
            tierId: null,
            request.AssignedSaleId);
    }

    private static ValidatedCustomerInput ValidateCustomerRequest(UpdateCustomerRequest request)
    {
        if (request is null)
            throw new CustomerValidationException(["Request body is required."]);

        return ValidateCustomerFields(
            request.FullName,
            request.PhoneNumber,
            request.CustomerGroup,
            request.TaxCode,
            request.TierId,
            request.AssignedSaleId);
    }

    private static ValidatedCustomerInput ValidateCustomerFields(
        string? fullNameValue,
        string? phoneNumberValue,
        CustomerGroup customerGroup,
        string? taxCodeValue,
        int? tierId,
        Guid? assignedSaleId)
    {
        var errors = new List<string>();

        var fullName = fullNameValue?.Trim();
        if (string.IsNullOrWhiteSpace(fullName))
        {
            errors.Add("FullName is required.");
        }
        else if (fullName.Length > 100)
        {
            errors.Add("FullName must be at most 100 characters.");
        }

        var phoneNumber = phoneNumberValue?.Trim();
        if (string.IsNullOrWhiteSpace(phoneNumber))
        {
            errors.Add("PhoneNumber is required.");
        }
        else
        {
            if (!phoneNumber.All(char.IsDigit))
                errors.Add("PhoneNumber must contain digits only.");

            if (phoneNumber.Length != 10)
                errors.Add("PhoneNumber must be exactly 10 digits.");

            if (!phoneNumber.StartsWith('0'))
                errors.Add("PhoneNumber must start with '0'.");
        }

        var isValidCustomerGroup = Enum.IsDefined(typeof(CustomerGroup), customerGroup);
        if (!isValidCustomerGroup)
            errors.Add("CustomerGroup must be a valid enum value.");

        var taxCode = taxCodeValue?.Trim();
        if (string.IsNullOrWhiteSpace(taxCode))
        {
            taxCode = null;
        }
        else if (taxCode.Length > 50)
        {
            errors.Add("TaxCode must be at most 50 characters.");
        }

        if (isValidCustomerGroup &&
            customerGroup == CustomerGroup.DoanhNghiep &&
            string.IsNullOrWhiteSpace(taxCode))
        {
            errors.Add("TaxCode is required when CustomerGroup is DoanhNghiep.");
        }

        if (assignedSaleId == Guid.Empty)
            errors.Add("AssignedSaleId must not be empty when provided.");

        if (errors.Count > 0)
            throw new CustomerValidationException(errors);

        return new ValidatedCustomerInput(
            fullName!,
            phoneNumber!,
            customerGroup,
            taxCode,
            tierId,
            assignedSaleId);
    }

    private static void ValidatePagination(int page, int pageSize)
    {
        var errors = new List<string>();

        if (page < 1)
            errors.Add("Page must be greater than or equal to 1.");

        if (pageSize < 1)
            errors.Add("PageSize must be greater than or equal to 1.");
        else if (pageSize > MaxPageSize)
            errors.Add($"PageSize must be less than or equal to {MaxPageSize}.");

        if (errors.Count > 0)
            throw new CustomerValidationException(errors);
    }

    private static CustomerResponse MapToResponse(Customer c) =>
        new(c.Id, c.FullName, c.PhoneNumber, c.CustomerGroup, c.TaxCode,
            c.TierId, c.Tier?.TierName, c.TotalSpending, c.CurrentDebt,
            c.AssignedSaleId, c.CreatedAt, c.UpdatedAt);

    private static CustomerDetailResponse MapToDetailResponse(Customer c) =>
        new(c.Id, c.FullName, c.PhoneNumber, c.CustomerGroup, c.TaxCode,
            c.Tier == null ? null : new CustomerTierResponse(c.Tier.Id, c.Tier.TierName,
                c.Tier.MinSpendingThreshold, c.Tier.DiscountPercent, c.Tier.ValidityMonths),
            c.TotalSpending, c.CurrentDebt, c.AssignedSaleId,
            c.Addresses.Select(a => new CustomerAddressResponse(a.Id, a.CustomerId, a.ReceiverName,
                a.ReceiverPhone, a.AddressLine, a.Ward, a.District, a.Province, a.IsDefault)),
            c.CreatedAt, c.UpdatedAt);

    private record ValidatedCustomerInput(
        string FullName,
        string PhoneNumber,
        CustomerGroup CustomerGroup,
        string? TaxCode,
        int? TierId,
        Guid? AssignedSaleId);
}
