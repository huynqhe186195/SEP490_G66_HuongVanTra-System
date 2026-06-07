using CustomerService.Application.DTOs.Requests;
using CustomerService.Application.DTOs.Responses;
using CustomerService.Application.Interfaces;
using CustomerService.Domain.Entities;
using CustomerService.Domain.Exceptions;

namespace CustomerService.Application.UseCases;

public class CustomerLogic
{
    private readonly ICustomerRepository _customerRepo;
    private readonly ICustomerTierRepository _tierRepo;

    public CustomerLogic(ICustomerRepository customerRepo, ICustomerTierRepository tierRepo)
    {
        _customerRepo = customerRepo;
        _tierRepo = tierRepo;
    }

    public async Task<CustomerResponse> CreateAsync(CreateCustomerRequest request, CancellationToken ct = default)
    {
        var existing = await _customerRepo.GetByPhoneAsync(request.PhoneNumber, ct);
        if (existing != null)
            throw new DuplicatePhoneNumberException(request.PhoneNumber);

        var customer = new Customer
        {
            Id = Guid.NewGuid(),
            FullName = request.FullName,
            PhoneNumber = request.PhoneNumber,
            CustomerGroup = request.CustomerGroup,
            TaxCode = request.TaxCode,
            AssignedSaleId = request.AssignedSaleId,
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

        customer.FullName = request.FullName;
        customer.PhoneNumber = request.PhoneNumber;
        customer.CustomerGroup = request.CustomerGroup;
        customer.TaxCode = request.TaxCode;
        customer.TierId = request.TierId;
        customer.AssignedSaleId = request.AssignedSaleId;
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
        var customers = await _customerRepo.GetAllAsync(page, pageSize, ct);
        var items = customers.Select(MapToResponse);
        return new PagedResult<CustomerResponse>(items, page, pageSize, items.Count());
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
}
