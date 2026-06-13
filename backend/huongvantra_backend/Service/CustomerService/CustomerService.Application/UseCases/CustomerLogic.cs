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
    private readonly ICustomerDebtAllocationRepository _allocationRepo;
    private readonly ICustomerActivityRepository _activityRepo;
    private readonly ICustomerAddressRepository _addressRepo;

    public CustomerLogic(
        ICustomerRepository customerRepo,
        ICustomerTierRepository tierRepo,
        IProcessedIntegrationEventRepository processedEvents,
        ICustomerDebtTransactionRepository debtRepo,
        ICustomerDebtAllocationRepository allocationRepo,
        ICustomerActivityRepository activityRepo,
        ICustomerAddressRepository addressRepo)
    {
        _customerRepo = customerRepo;
        _tierRepo = tierRepo;
        _processedEvents = processedEvents;
        _debtRepo = debtRepo;
        _allocationRepo = allocationRepo;
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
                $"Mua chịu đơn {orderCode}", orderCode, ct);
            await RecordActivityAsync(customerId, CustomerActivityType.DebtUpdated,
                $"Công nợ +{debtAmount:N0} từ đơn {orderCode}", ct);
        }

        customer.UpdatedAt = DateTime.UtcNow;

        _customerRepo.Update(customer);
        await _processedEvents.AddAsync(OrderCompletedEventType, orderId, ct);

        await RecordActivityAsync(customerId, CustomerActivityType.OrderCreated,
            $"Hoàn tất đơn {orderCode}: chi tiêu +{amountSpent:N0}", ct);

        var (tierUpgraded, upgradedTierName) = await TryUpgradeMembershipTierAsync(customer, ct);

        await _customerRepo.SaveChangesAsync(ct);

        return new OrderCompletedHandlingResult(
            orderId,
            customerId,
            SkippedDuplicate: false,
            CustomerNotFound: false,
            TotalSpending: customer.TotalSpending,
            CurrentDebt: customer.CurrentDebt,
            TierId: customer.TierId,
            TierName: upgradedTierName ?? customer.Tier?.TierName,
            TierUpgraded: tierUpgraded);
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

        if (request.Type == DebtTransactionType.DecreaseDebt)
        {
            var payment = await ApplyDebtPaymentAsync(customerId, new ApplyDebtPaymentRequest(
                request.Amount,
                request.Note ?? "Thanh toán công nợ"), ct);
            return payment.Transaction;
        }

        customer.CurrentDebt += request.Amount;
        customer.UpdatedAt = DateTime.UtcNow;
        _customerRepo.Update(customer);

        var transaction = await RecordDebtAsync(customer, request.Type, request.Amount, "Manual", null,
            request.Note ?? "Phát sinh nợ", null, ct);

        await RecordActivityAsync(customerId, CustomerActivityType.DebtUpdated,
            $"Phát sinh nợ +{request.Amount:N0}", ct);

        await _customerRepo.SaveChangesAsync(ct);

        return MapDebt(transaction);
    }

    public async Task<IReadOnlyList<CustomerOpenDebtResponse>> GetOpenDebtsAsync(
        Guid customerId,
        CancellationToken ct = default)
    {
        if (!await _customerRepo.ExistsAsync(customerId, ct))
            throw new CustomerNotFoundException(customerId);

        var items = await BuildOpenDebtItemsAsync(customerId, ct);
        return items
            .Select(i => new CustomerOpenDebtResponse(
                i.OrderId, i.OrderCode, i.OriginalDebt, i.PaidAmount, i.RemainingDebt, i.CreatedAt))
            .ToList();
    }

    public async Task<CustomerDebtPaymentPreviewResponse> PreviewDebtPaymentAsync(
        Guid customerId,
        decimal amount,
        CancellationToken ct = default)
    {
        if (amount <= 0)
            throw new CustomerValidationException(["Amount must be greater than zero."]);

        if (!await _customerRepo.ExistsAsync(customerId, ct))
            throw new CustomerNotFoundException(customerId);

        var openDebts = await BuildOpenDebtItemsAsync(customerId, ct);
        var allocations = BuildFifoAllocations(amount, openDebts);
        var allocated = allocations.Sum(a => a.Amount);

        return new CustomerDebtPaymentPreviewResponse(
            amount,
            allocated,
            Math.Max(0, amount - allocated),
            allocations);
    }

    public async Task<CustomerDebtPaymentResponse> ApplyDebtPaymentAsync(
        Guid customerId,
        ApplyDebtPaymentRequest request,
        CancellationToken ct = default)
    {
        if (request is null)
            throw new CustomerValidationException(["Request body is required."]);

        if (request.Amount <= 0)
            throw new CustomerValidationException(["Amount must be greater than zero."]);

        var customer = await _customerRepo.GetByIdAsync(customerId, ct)
            ?? throw new CustomerNotFoundException(customerId);

        var openDebts = await BuildOpenDebtItemsAsync(customerId, ct);
        var allocationPlans = request.Allocations is { Count: > 0 }
            ? BuildExplicitAllocations(request.Allocations, openDebts)
            : BuildFifoAllocations(request.Amount, openDebts);
        var allocatedAmount = allocationPlans.Sum(a => a.Amount);

        if (request.Allocations is { Count: > 0 } && allocatedAmount > request.Amount)
            throw new CustomerValidationException(["Tổng trừ theo hóa đơn vượt số tiền thanh toán."]);

        if (allocatedAmount <= 0)
        {
            if (customer.CurrentDebt <= 0)
                throw new CustomerValidationException(["Khách không có đơn nợ để trừ."]);

            var fallbackAmount = Math.Min(request.Amount, customer.CurrentDebt);
            var orphanId = CreateOrphanDebtOrderId(customerId);
            var orphanDebt = openDebts.FirstOrDefault(d => d.OrderId == orphanId);
            var orderCode = orphanDebt?.OrderCode ?? "CN-TONG-HOP";
            var remainingBefore = orphanDebt?.RemainingDebt ?? customer.CurrentDebt;

            allocationPlans =
            [
                new CustomerDebtAllocationResponse(
                    orphanId,
                    orderCode,
                    fallbackAmount,
                    Math.Max(0, remainingBefore - fallbackAmount))
            ];
            allocatedAmount = fallbackAmount;
        }

        if (allocatedAmount > customer.CurrentDebt)
        {
            allocationPlans = TrimAllocationPlans(allocationPlans, customer.CurrentDebt);
            allocatedAmount = allocationPlans.Sum(a => a.Amount);
        }

        if (allocatedAmount <= 0)
            throw new CustomerValidationException(["Khách không có công nợ để trừ."]);

        customer.CurrentDebt -= allocatedAmount;
        customer.UpdatedAt = DateTime.UtcNow;
        _customerRepo.Update(customer);

        var note = BuildDebtPaymentNote(request.Note, request.SourceOrderId, allocationPlans);
        var referenceType = request.SourceOrderId.HasValue ? "OrderPayment" : "DebtPayment";
        var transaction = await RecordDebtAsync(
            customer,
            DebtTransactionType.DecreaseDebt,
            allocatedAmount,
            referenceType,
            request.SourceOrderId,
            note,
            null,
            ct);

        var now = DateTime.UtcNow;
        var entities = allocationPlans.Select(plan => new CustomerDebtAllocation
        {
            Id = Guid.NewGuid(),
            DebtTransactionId = transaction.Id,
            CustomerId = customerId,
            OrderId = plan.OrderId,
            OrderCode = plan.OrderCode,
            Amount = plan.Amount,
            CreatedAt = now
        }).ToList();

        await _allocationRepo.AddRangeAsync(entities, ct);

        var orderSummary = string.Join(", ", allocationPlans.Select(a => $"{a.OrderCode} {a.Amount:N0}"));
        await RecordActivityAsync(customerId, CustomerActivityType.DebtUpdated,
            $"Thanh toán -{allocatedAmount:N0} ({orderSummary})", ct);

        await _customerRepo.SaveChangesAsync(ct);

        return new CustomerDebtPaymentResponse(
            MapDebt(transaction),
            allocationPlans,
            allocatedAmount,
            Math.Max(0, request.Amount - allocatedAmount));
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
        string? relatedOrderCode,
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
            RelatedOrderCode = relatedOrderCode,
            Note = note,
            CreatedAt = DateTime.UtcNow
        };

        await _debtRepo.AddAsync(transaction, ct);
        return transaction;
    }

    private sealed record OpenDebtItem(
        Guid OrderId,
        string OrderCode,
        decimal OriginalDebt,
        decimal PaidAmount,
        decimal RemainingDebt,
        DateTime CreatedAt);

    private async Task<List<OpenDebtItem>> BuildOpenDebtItemsAsync(Guid customerId, CancellationToken ct)
    {
        var customer = await _customerRepo.GetByIdAsync(customerId, ct);
        var transactions = (await _debtRepo.GetByCustomerIdAsync(customerId, ct)).ToList();
        var allocations = await _allocationRepo.GetByCustomerIdAsync(customerId, ct);

        var orderIncreases = transactions
            .Where(t => t.Type == DebtTransactionType.IncreaseDebt
                && t.ReferenceType == "Order"
                && t.ReferenceId.HasValue)
            .GroupBy(t => t.ReferenceId!.Value)
            .Select(g =>
            {
                var first = g.OrderBy(x => x.CreatedAt).First();
                var orderCode = ResolveOrderCode(first);
                return new
                {
                    OrderId = g.Key,
                    OrderCode = orderCode,
                    OriginalDebt = g.Sum(x => x.Amount),
                    CreatedAt = g.Min(x => x.CreatedAt)
                };
            })
            .OrderBy(item => item.CreatedAt)
            .ToList();

        var paidByOrder = allocations
            .GroupBy(a => a.OrderId)
            .ToDictionary(g => g.Key, g => g.Sum(x => x.Amount));

        var unallocatedPool = Math.Max(
            0,
            transactions
                .Where(t => t.Type == DebtTransactionType.DecreaseDebt)
                .Sum(t => t.Amount) - allocations.Sum(a => a.Amount));

        var items = new List<OpenDebtItem>();
        var trackedKeys = new HashSet<Guid>();

        foreach (var item in orderIncreases)
        {
            paidByOrder.TryGetValue(item.OrderId, out var paid);
            var remaining = Math.Max(0, item.OriginalDebt - paid);
            if (unallocatedPool > 0 && remaining > 0)
            {
                var fromPool = Math.Min(remaining, unallocatedPool);
                paid += fromPool;
                remaining -= fromPool;
                unallocatedPool -= fromPool;
            }

            if (remaining <= 0) continue;

            items.Add(new OpenDebtItem(
                item.OrderId,
                item.OrderCode,
                item.OriginalDebt,
                paid,
                remaining,
                item.CreatedAt));
            trackedKeys.Add(item.OrderId);
        }

        foreach (var transaction in transactions
            .Where(t => t.Type == DebtTransactionType.IncreaseDebt
                && (t.ReferenceType != "Order" || !t.ReferenceId.HasValue))
            .OrderBy(t => t.CreatedAt))
        {
            var pseudoOrderId = transaction.ReferenceId ?? transaction.Id;
            if (trackedKeys.Contains(pseudoOrderId)) continue;

            paidByOrder.TryGetValue(pseudoOrderId, out var paid);
            var remaining = Math.Max(0, transaction.Amount - paid);
            if (unallocatedPool > 0 && remaining > 0)
            {
                var fromPool = Math.Min(remaining, unallocatedPool);
                paid += fromPool;
                remaining -= fromPool;
                unallocatedPool -= fromPool;
            }

            if (remaining <= 0) continue;

            items.Add(new OpenDebtItem(
                pseudoOrderId,
                ResolveManualDebtCode(transaction),
                transaction.Amount,
                paid,
                remaining,
                transaction.CreatedAt));
            trackedKeys.Add(pseudoOrderId);
        }

        if (customer is not null)
        {
            items = CapOpenDebtItemsToBalance(items, customer.CurrentDebt);

            var trackedRemaining = items.Sum(i => i.RemainingDebt);
            var gap = customer.CurrentDebt - trackedRemaining;
            if (gap > 0)
            {
                var orphanOrderId = CreateOrphanDebtOrderId(customerId);
                if (!trackedKeys.Contains(orphanOrderId))
                {
                    items.Add(new OpenDebtItem(
                        orphanOrderId,
                        "CN-CHUA-LIEN-KET",
                        gap,
                        0,
                        gap,
                        items.Count > 0 ? items.Min(i => i.CreatedAt) : DateTime.UtcNow));
                }
            }
        }

        return items.OrderBy(i => i.CreatedAt).ToList();
    }

    private static Guid CreateOrphanDebtOrderId(Guid customerId)
    {
        var bytes = customerId.ToByteArray();
        bytes[8] = 0xde;
        bytes[9] = 0x0b;
        return new Guid(bytes);
    }

    private static string ResolveManualDebtCode(CustomerDebtTransaction transaction)
    {
        if (!string.IsNullOrWhiteSpace(transaction.RelatedOrderCode))
            return transaction.RelatedOrderCode!;

        return string.IsNullOrWhiteSpace(transaction.Note) ? "CN-THU-CONG" : transaction.Note!;
    }

    private static List<CustomerDebtAllocationResponse> BuildExplicitAllocations(
        IReadOnlyList<DebtAllocationItemRequest> allocations,
        IReadOnlyList<OpenDebtItem> openDebts)
    {
        var debtByOrder = openDebts.ToDictionary(d => d.OrderId);
        var results = new List<CustomerDebtAllocationResponse>();

        foreach (var item in allocations)
        {
            if (item.Amount <= 0) continue;

            if (!debtByOrder.TryGetValue(item.OrderId, out var debt))
                throw new CustomerValidationException([$"Không tìm thấy đơn nợ {item.OrderId}."]);

            if (item.Amount > debt.RemainingDebt)
                throw new CustomerValidationException([
                    $"Số tiền trừ đơn {debt.OrderCode} vượt nợ còn lại ({debt.RemainingDebt:N0})."]);

            var remainingAfter = debt.RemainingDebt - item.Amount;
            results.Add(new CustomerDebtAllocationResponse(
                debt.OrderId,
                debt.OrderCode,
                item.Amount,
                remainingAfter));
        }

        return results;
    }

    private static List<CustomerDebtAllocationResponse> TrimAllocationPlans(
        List<CustomerDebtAllocationResponse> plans,
        decimal maxAmount)
    {
        var remaining = maxAmount;
        var results = new List<CustomerDebtAllocationResponse>();

        foreach (var plan in plans)
        {
            if (remaining <= 0) break;

            var amount = Math.Min(plan.Amount, remaining);
            if (amount <= 0) continue;

            results.Add(new CustomerDebtAllocationResponse(
                plan.OrderId,
                plan.OrderCode,
                amount,
                plan.RemainingAfter + (plan.Amount - amount)));

            remaining -= amount;
        }

        return results;
    }

    private static List<OpenDebtItem> CapOpenDebtItemsToBalance(
        List<OpenDebtItem> items,
        decimal currentDebt)
    {
        var totalRemaining = items.Sum(i => i.RemainingDebt);
        if (totalRemaining <= currentDebt) return items;

        var excess = totalRemaining - currentDebt;
        var capped = new List<OpenDebtItem>();

        foreach (var item in items.OrderBy(i => i.CreatedAt))
        {
            if (excess <= 0)
            {
                capped.Add(item);
                continue;
            }

            var reduce = Math.Min(item.RemainingDebt, excess);
            var newRemaining = item.RemainingDebt - reduce;
            excess -= reduce;
            if (newRemaining <= 0) continue;

            capped.Add(item with
            {
                PaidAmount = item.OriginalDebt - newRemaining,
                RemainingDebt = newRemaining
            });
        }

        return capped;
    }

    private static List<CustomerDebtAllocationResponse> BuildFifoAllocations(
        decimal amount,
        IReadOnlyList<OpenDebtItem> openDebts)
    {
        var remaining = amount;
        var results = new List<CustomerDebtAllocationResponse>();

        foreach (var debt in openDebts)
        {
            if (remaining <= 0) break;

            var allocate = Math.Min(debt.RemainingDebt, remaining);
            if (allocate <= 0) continue;

            var remainingAfter = debt.RemainingDebt - allocate;
            results.Add(new CustomerDebtAllocationResponse(
                debt.OrderId,
                debt.OrderCode,
                allocate,
                remainingAfter));

            remaining -= allocate;
        }

        return results;
    }

    private static string ResolveOrderCode(CustomerDebtTransaction transaction)
    {
        if (!string.IsNullOrWhiteSpace(transaction.RelatedOrderCode))
            return transaction.RelatedOrderCode!;

        const string prefix = "Mua chịu đơn ";
        if (!string.IsNullOrWhiteSpace(transaction.Note) && transaction.Note.StartsWith(prefix, StringComparison.Ordinal))
            return transaction.Note[prefix.Length..].Trim();

        return "—";
    }

    private static string BuildDebtPaymentNote(
        string? requestNote,
        Guid? sourceOrderId,
        IReadOnlyList<CustomerDebtAllocationResponse> allocations)
    {
        var orderPart = string.Join(" · ", allocations.Select(a => $"{a.OrderCode}: {a.Amount:N0}"));
        var baseNote = string.IsNullOrWhiteSpace(requestNote)
            ? $"Trừ nợ theo đơn: {orderPart}"
            : $"{requestNote.Trim()} · {orderPart}";

        return sourceOrderId.HasValue
            ? $"{baseNote} (từ đơn thanh toán)"
            : baseNote;
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

    private async Task<(bool Upgraded, string? NewTierName)> TryUpgradeMembershipTierAsync(
        Customer customer, CancellationToken ct)
    {
        if (customer.CustomerGroup != CustomerGroup.PhoThong)
            return (false, null);

        var eligibleTier = await _tierRepo.GetTierForSpendingAsync(customer.TotalSpending, ct);
        if (eligibleTier is null)
            return (false, null);

        if (customer.TierId == eligibleTier.Id)
            return (false, null);

        var currentThreshold = customer.Tier?.MinSpendingThreshold ?? -1m;
        if (customer.TierId.HasValue && eligibleTier.MinSpendingThreshold <= currentThreshold)
            return (false, null);

        var oldName = customer.Tier?.TierName ?? "Chưa có hạng";
        customer.TierId = eligibleTier.Id;
        customer.Tier = eligibleTier;

        await RecordActivityAsync(
            customer.Id,
            CustomerActivityType.TierChanged,
            $"Tự động nâng hạng: {oldName} → {eligibleTier.TierName} (tổng chi tiêu {customer.TotalSpending:N0} đ)",
            ct);

        return (true, eligibleTier.TierName);
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
