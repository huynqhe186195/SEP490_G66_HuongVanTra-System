using CustomerService.Application.DTOs.Requests;
using CustomerService.Application.DTOs.Responses;
using CustomerService.Application.Interfaces;
using CustomerService.Application.Validation;
using CustomerService.Domain.Entities;
using CustomerService.Domain.Enums;
using CustomerService.Domain.Exceptions;

namespace CustomerService.Application.UseCases;

public class CustomerLogic
{
    private const int MaxPageSize = 100;
    public const string OrderCompletedEventType = "OrderCompleted";

    private readonly ICustomerRepository _customerRepo;
    private readonly ICustomerTierRepository _tierRepo;
    private readonly IProcessedIntegrationEventRepository _processedEvents;
    private readonly ICustomerDebtTransactionRepository _debtRepo;
    private readonly ICustomerActivityRepository _activityRepo;
    private readonly ICustomerAddressRepository _addressRepo;

    public CustomerLogic(
        ICustomerRepository customerRepo,
        ICustomerTierRepository tierRepo,
        IProcessedIntegrationEventRepository processedEvents,
        ICustomerDebtTransactionRepository debtRepo,
        ICustomerActivityRepository activityRepo,
        ICustomerAddressRepository addressRepo)
    {
        _customerRepo = customerRepo;
        _tierRepo = tierRepo;
        _processedEvents = processedEvents;
        _debtRepo = debtRepo;
        _activityRepo = activityRepo;
        _addressRepo = addressRepo;
    }

    public async Task<CustomerResponse> CreateAsync(CreateCustomerRequest request, CancellationToken ct = default)
    {
        var input = ValidateCustomerRequest(request);

        if (await _customerRepo.PhoneExistsAsync(input.PhoneNumber, ct: ct))
            throw new DuplicatePhoneNumberException(input.PhoneNumber);

        if (!string.IsNullOrWhiteSpace(input.Email) && await _customerRepo.EmailExistsAsync(input.Email, ct: ct))
            throw new DuplicateEmailException(input.Email);

        var customerCode = await _customerRepo.GenerateNextCustomerCodeAsync(ct);
        var initialTierId = await ResolveInitialTierIdAsync(input.CustomerGroup, ct);

        var customer = new Customer
        {
            Id = Guid.NewGuid(),
            CustomerCode = customerCode,
            FullName = input.FullName,
            PhoneNumber = input.PhoneNumber,
            Email = input.Email,
            CustomerGroup = input.CustomerGroup,
            TaxCode = input.TaxCode,
            TierId = initialTierId,
            AssignedSaleId = input.AssignedSaleId,
            TotalSpending = 0,
            CurrentDebt = 0,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        await _customerRepo.AddAsync(customer, ct);
        await UpsertPrimaryAddressAsync(customer.Id, input.FullName, input.PhoneNumber, input.AddressLine, ct);
        await RecordActivityAsync(customer.Id, CustomerActivityType.Created, $"Tạo khách hàng {customer.FullName}", ct);
        await _customerRepo.SaveChangesAsync(ct);

        customer = await _customerRepo.GetByIdAsync(customer.Id, ct) ?? customer;
        return MapToResponse(customer);
    }

    public async Task<CustomerResponse> UpdateAsync(Guid id, UpdateCustomerRequest request, CancellationToken ct = default)
    {
        var customer = await _customerRepo.GetByIdAsync(id, ct)
            ?? throw new CustomerNotFoundException(id);

        var input = ValidateCustomerRequest(request);

        if (await _customerRepo.PhoneExistsAsync(input.PhoneNumber, id, ct))
            throw new DuplicatePhoneNumberException(input.PhoneNumber);

        if (!string.IsNullOrWhiteSpace(input.Email) && await _customerRepo.EmailExistsAsync(input.Email, id, ct))
            throw new DuplicateEmailException(input.Email);

        customer.FullName = input.FullName;
        customer.PhoneNumber = input.PhoneNumber;
        customer.Email = input.Email;
        customer.CustomerGroup = input.CustomerGroup;
        customer.TaxCode = input.TaxCode;
        customer.AssignedSaleId = input.AssignedSaleId;
        customer.UpdatedAt = DateTime.UtcNow;

        _customerRepo.Update(customer);
        await UpsertPrimaryAddressAsync(id, input.FullName, input.PhoneNumber, input.AddressLine, ct);
        await RecordActivityAsync(id, CustomerActivityType.Updated, $"Cập nhật thông tin khách {customer.FullName}", ct);

        await _customerRepo.SaveChangesAsync(ct);
        customer = await _customerRepo.GetByIdAsync(id, ct) ?? customer;
        return MapToResponse(customer);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct = default)
    {
        if (!await _customerRepo.ExistsAsync(id, ct))
            throw new CustomerNotFoundException(id);

        await _customerRepo.SoftDeleteAsync(id, ct);
        await RecordActivityAsync(id, CustomerActivityType.Updated, "Xóa mềm khách hàng", ct);
        await _customerRepo.SaveChangesAsync(ct);
    }

    public async Task<CustomerResponse> RestoreAsync(Guid id, CancellationToken ct = default)
    {
        var customer = await _customerRepo.GetByIdIncludingDeletedAsync(id, ct)
            ?? throw new CustomerNotFoundException(id);

        if (!customer.IsDeleted)
            throw new CustomerValidationException(["Khách hàng đang hoạt động, không cần khôi phục."]);

        if (await _customerRepo.PhoneExistsAsync(customer.PhoneNumber, id, ct))
            throw new DuplicatePhoneNumberException(customer.PhoneNumber);

        await _customerRepo.RestoreAsync(id, ct);
        await RecordActivityAsync(id, CustomerActivityType.Updated, "Khôi phục khách hàng", ct);
        await _customerRepo.SaveChangesAsync(ct);

        customer = await _customerRepo.GetByIdAsync(id, ct) ?? customer;
        return MapToResponse(customer);
    }

    public async Task<OrderCompletedHandlingResult> HandleOrderCompletedAsync(
        Guid orderId,
        string orderCode,
        Guid customerId,
        decimal amountSpent,
        decimal debtAmount,
        CancellationToken ct = default)
    {
        if (await _processedEvents.ExistsAsync(OrderCompletedEventType, orderId, ct))
        {
            return new OrderCompletedHandlingResult(
                orderId, customerId, SkippedDuplicate: true, CustomerNotFound: false,
                TotalSpending: 0, CurrentDebt: 0, TierId: null, TierName: null, TierUpgraded: false);
        }

        var customer = await _customerRepo.GetByIdAsync(customerId, ct);
        if (customer == null)
        {
            return new OrderCompletedHandlingResult(
                orderId, customerId, SkippedDuplicate: false, CustomerNotFound: true,
                TotalSpending: 0, CurrentDebt: 0, TierId: null, TierName: null, TierUpgraded: false);
        }

        if (amountSpent > 0)
            customer.TotalSpending += amountSpent;

        if (debtAmount > 0)
        {
            customer.CurrentDebt += debtAmount;
            await RecordDebtAsync(customer, DebtTransactionType.IncreaseDebt, debtAmount, "Order", orderId,
                $"Mua chịu đơn {orderCode}", ct);
            await RecordActivityAsync(customerId, CustomerActivityType.DebtUpdated,
                $"Công nợ +{debtAmount:N0} từ đơn {orderCode}", ct);
        }

        customer.UpdatedAt = DateTime.UtcNow;

        _customerRepo.Update(customer);
        await _processedEvents.AddAsync(OrderCompletedEventType, orderId, ct);

        await RecordActivityAsync(customerId, CustomerActivityType.OrderCreated,
            $"Hoàn tất đơn {orderCode}: chi tiêu +{amountSpent:N0}", ct);

        await _customerRepo.SaveChangesAsync(ct);

        return new OrderCompletedHandlingResult(
            orderId,
            customerId,
            SkippedDuplicate: false,
            CustomerNotFound: false,
            TotalSpending: customer.TotalSpending,
            CurrentDebt: customer.CurrentDebt,
            TierId: customer.TierId,
            TierName: customer.Tier?.TierName,
            TierUpgraded: false);
    }

    public async Task<CustomerDebtTransactionResponse> RecordDebtTransactionAsync(
        Guid customerId,
        RecordDebtTransactionRequest request,
        CancellationToken ct = default)
    {
        if (request is null)
            throw new CustomerValidationException(["Request body is required."]);

        if (request.Amount <= 0)
            throw new CustomerValidationException(["Amount must be greater than zero."]);

        var customer = await _customerRepo.GetByIdAsync(customerId, ct)
            ?? throw new CustomerNotFoundException(customerId);

        if (request.Type == DebtTransactionType.IncreaseDebt)
            customer.CurrentDebt += request.Amount;
        else
        {
            if (customer.CurrentDebt < request.Amount)
                throw new CustomerValidationException(["Decrease amount exceeds current debt."]);
            customer.CurrentDebt -= request.Amount;
        }

        customer.UpdatedAt = DateTime.UtcNow;
        _customerRepo.Update(customer);

        var transaction = await RecordDebtAsync(customer, request.Type, request.Amount, "Manual", null,
            request.Note ?? (request.Type == DebtTransactionType.DecreaseDebt ? "Thanh toán công nợ" : "Phát sinh nợ"), ct);

        await RecordActivityAsync(customerId, CustomerActivityType.DebtUpdated,
            request.Type == DebtTransactionType.DecreaseDebt
                ? $"Thanh toán -{request.Amount:N0}"
                : $"Phát sinh nợ +{request.Amount:N0}", ct);

        await _customerRepo.SaveChangesAsync(ct);

        return MapDebt(transaction);
    }

    public async Task<IEnumerable<CustomerDebtTransactionResponse>> GetDebtsAsync(Guid customerId, CancellationToken ct = default)
    {
        if (!await _customerRepo.ExistsAsync(customerId, ct))
            throw new CustomerNotFoundException(customerId);

        var items = await _debtRepo.GetByCustomerIdAsync(customerId, ct);
        return items.Select(MapDebt);
    }

    public async Task<CustomerDebtSummaryResponse> GetDebtSummaryAsync(Guid customerId, CancellationToken ct = default)
    {
        var customer = await _customerRepo.GetByIdAsync(customerId, ct)
            ?? throw new CustomerNotFoundException(customerId);

        var (increase, decrease, count) = await _debtRepo.GetSummaryAsync(customerId, ct);
        return new CustomerDebtSummaryResponse(customer.CurrentDebt, increase, decrease, count);
    }

    public async Task<IEnumerable<CustomerActivityResponse>> GetActivitiesAsync(Guid customerId, CancellationToken ct = default)
    {
        if (!await _customerRepo.ExistsAsync(customerId, ct))
            throw new CustomerNotFoundException(customerId);

        var items = await _activityRepo.GetByCustomerIdAsync(customerId, 100, ct);
        return items.Select(a => new CustomerActivityResponse(a.Id, a.CustomerId, a.ActivityType, a.Description, a.CreatedAt));
    }

    public async Task<CustomerStatisticsResponse> GetStatisticsAsync(CancellationToken ct = default)
    {
        var monthStart = new DateTime(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        var total = await _customerRepo.CountAsync(ct);
        var newThisMonth = await _customerRepo.CountCreatedSinceAsync(monthStart, ct);
        var topSpenders = (await _customerRepo.GetTopSpendersAsync(5, ct)).Select(MapToResponse);
        var topDebtors = (await _customerRepo.GetTopDebtorsAsync(5, ct)).Select(MapToResponse);
        var byTier = (await _customerRepo.CountByTierAsync(ct))
            .Select(x => new TierCountResponse(x.TierName, x.Count));

        return new CustomerStatisticsResponse(total, newThisMonth, topSpenders, topDebtors, byTier);
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

    public async Task<PagedResult<CustomerResponse>> GetInactiveAsync(int page, int pageSize, CancellationToken ct = default)
    {
        ValidatePagination(page, pageSize);

        var totalCount = await _customerRepo.CountDeletedAsync(ct);
        var customers = await _customerRepo.GetAllDeletedAsync(page, pageSize, ct);
        var items = customers.Select(MapToResponse).ToList();
        return new PagedResult<CustomerResponse>(items, page, pageSize, totalCount);
    }

    private async Task<CustomerDebtTransaction> RecordDebtAsync(
        Customer customer,
        DebtTransactionType type,
        decimal amount,
        string referenceType,
        Guid? referenceId,
        string note,
        CancellationToken ct)
    {
        var transaction = new CustomerDebtTransaction
        {
            Id = Guid.NewGuid(),
            CustomerId = customer.Id,
            Type = type,
            Amount = amount,
            BalanceAfter = customer.CurrentDebt,
            ReferenceType = referenceType,
            ReferenceId = referenceId,
            Note = note,
            CreatedAt = DateTime.UtcNow
        };

        await _debtRepo.AddAsync(transaction, ct);
        return transaction;
    }

    private async Task RecordActivityAsync(
        Guid customerId,
        CustomerActivityType type,
        string description,
        CancellationToken ct)
    {
        await _activityRepo.AddAsync(new CustomerActivity
        {
            Id = Guid.NewGuid(),
            CustomerId = customerId,
            ActivityType = type,
            Description = description,
            CreatedAt = DateTime.UtcNow
        }, ct);
    }

    private async Task UpsertPrimaryAddressAsync(
        Guid customerId,
        string receiverName,
        string receiverPhone,
        string addressLine,
        CancellationToken ct)
    {
        var addresses = (await _addressRepo.GetByCustomerIdAsync(customerId, ct)).ToList();
        var primary = addresses.FirstOrDefault(a => a.IsDefault) ?? addresses.FirstOrDefault();

        if (primary is null)
        {
            await _addressRepo.AddAsync(new CustomerAddress
            {
                Id = Guid.NewGuid(),
                CustomerId = customerId,
                ReceiverName = receiverName,
                ReceiverPhone = receiverPhone,
                AddressLine = addressLine,
                Ward = string.Empty,
                District = string.Empty,
                Province = string.Empty,
                IsDefault = true,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            }, ct);
            return;
        }

        primary.ReceiverName = receiverName;
        primary.ReceiverPhone = receiverPhone;
        primary.AddressLine = addressLine;
        primary.UpdatedAt = DateTime.UtcNow;
        _addressRepo.Update(primary);
    }

    private async Task<int?> ResolveInitialTierIdAsync(CustomerGroup customerGroup, CancellationToken ct)
    {
        if (customerGroup != CustomerGroup.PhoThong)
            return null;

        var defaultTier = await _tierRepo.GetDefaultTierAsync(ct);
        return defaultTier?.Id;
    }

    private static ValidatedCustomerInput ValidateCustomerRequest(CreateCustomerRequest request)
    {
        if (request is null)
            throw new CustomerValidationException(["Request body is required."]);

        return CustomerInputValidator.Validate(
            request.FullName,
            request.PhoneNumber,
            request.Email,
            request.AddressLine,
            request.CustomerGroup,
            request.TaxCode,
            request.TierId,
            request.AssignedSaleId);
    }

    private static ValidatedCustomerInput ValidateCustomerRequest(UpdateCustomerRequest request)
    {
        if (request is null)
            throw new CustomerValidationException(["Request body is required."]);

        return CustomerInputValidator.Validate(
            request.FullName,
            request.PhoneNumber,
            request.Email,
            request.AddressLine,
            request.CustomerGroup,
            request.TaxCode,
            request.TierId,
            request.AssignedSaleId);
    }

    private static void ValidatePagination(int page, int pageSize)
    {
        var errors = new List<string>();
        if (page < 1) errors.Add("Page must be greater than or equal to 1.");
        if (pageSize < 1) errors.Add("PageSize must be greater than or equal to 1.");
        else if (pageSize > MaxPageSize) errors.Add($"PageSize must be less than or equal to {MaxPageSize}.");
        if (errors.Count > 0) throw new CustomerValidationException(errors);
    }

    private static CustomerDebtTransactionResponse MapDebt(CustomerDebtTransaction t) =>
        new(t.Id, t.CustomerId, t.Type, t.Amount, t.BalanceAfter, t.ReferenceType, t.ReferenceId, t.Note, t.CreatedAt);

    private static CustomerResponse MapToResponse(Customer c) =>
        new(c.Id, c.CustomerCode, c.FullName, c.PhoneNumber, c.Email, c.CustomerGroup, c.TaxCode,
            c.TierId, c.Tier?.TierName, c.TotalSpending, c.CurrentDebt,
            c.AssignedSaleId, c.CreatedAt, c.UpdatedAt);

    private static CustomerDetailResponse MapToDetailResponse(Customer c) =>
        new(c.Id, c.CustomerCode, c.FullName, c.PhoneNumber, c.Email, c.CustomerGroup, c.TaxCode,
            c.Tier == null ? null : new CustomerTierResponse(c.Tier.Id, c.Tier.TierName,
                c.Tier.MinSpendingThreshold, c.Tier.DiscountPercent, c.Tier.ValidityMonths),
            c.TotalSpending, c.CurrentDebt, c.AssignedSaleId,
            c.Addresses.Where(a => !a.IsDeleted).Select(a => new CustomerAddressResponse(a.Id, a.CustomerId, a.ReceiverName,
                a.ReceiverPhone, a.AddressLine, a.Ward, a.District, a.Province, a.IsDefault)),
            c.CreatedAt, c.UpdatedAt);
}
