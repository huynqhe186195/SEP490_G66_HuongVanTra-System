using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;
using ClosedXML.Excel;
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
    public const string CustomerImportTemplateFileName = "mau-import-khach-hang.xlsx";
    public const string CustomerImportContentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    private const int ImportHeaderScanRowCount = 10;
    private const string ImportFullNameHeader = "Họ và tên";
    private const string ImportPhoneHeader = "Số điện thoại";
    private const string ImportEmailHeader = "Email";
    private const string ImportCustomerGroupHeader = "Nhóm khách hàng";
    private const string ImportTaxCodeHeader = "Mã số thuế";
    private const string ImportSourceHeader = "Nguồn khách hàng";
    private const string ImportNoteHeader = "Ghi chú";
    private const string DefaultImportedAddressLine = "Chưa có địa chỉ giao hàng";
    public const string OrderCompletedEventType = "OrderCompleted";
    public const string OrderReturnedEventType = "OrderReturned";

    private static readonly string[] CustomerImportHeaders =
    [
        ImportFullNameHeader,
        ImportPhoneHeader,
        ImportEmailHeader,
        ImportCustomerGroupHeader,
        ImportTaxCodeHeader,
        ImportSourceHeader,
        ImportNoteHeader
    ];

    private static readonly Regex ImportEmailRegex = new(
        @"^[^\s@]+@[^\s@]+\.[^\s@]{2,}$",
        RegexOptions.Compiled | RegexOptions.IgnoreCase);

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

    public async Task<CustomerResponse> CreateAsync(
        CreateCustomerRequest request,
        CustomerAccessContext access,
        CancellationToken ct = default)
    {
        var input = ValidateCustomerRequest(request);
        EnsureCanManageCorporateCustomer(input.CustomerGroup, access);

        if (await _customerRepo.PhoneExistsAsync(input.PhoneNumber, ct: ct))
            throw await BuildDuplicatePhoneExceptionAsync(input.PhoneNumber, access, ct);

        if (!string.IsNullOrWhiteSpace(input.Email) && await _customerRepo.EmailExistsAsync(input.Email, ct: ct))
            throw new DuplicateEmailException(input.Email);

        var customerCode = await _customerRepo.GenerateNextCustomerCodeAsync(ct);
        var initialTierId = await ResolveInitialTierIdAsync(input.CustomerGroup, input.TierId, ct);
        var assignedSaleId = ResolveAssignedSaleId(input.AssignedSaleId, access);

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
            AssignedSaleId = assignedSaleId,
            Source = input.Source,
            Department = input.Department,
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

    public async Task<CustomerResponse> UpdateAsync(
        Guid id,
        UpdateCustomerRequest request,
        CustomerAccessContext access,
        CancellationToken ct = default)
    {
        var customer = await _customerRepo.GetByIdAsync(id, ct)
            ?? throw new CustomerNotFoundException(id);

        EnsureCanAccess(customer, access);

        var input = ValidateCustomerRequest(request);
        EnsureCanManageCorporateCustomer(customer.CustomerGroup, access);
        EnsureCanManageCorporateCustomer(input.CustomerGroup, access);

        if (await _customerRepo.PhoneExistsAsync(input.PhoneNumber, id, ct))
            throw new DuplicatePhoneNumberException(input.PhoneNumber);

        if (!string.IsNullOrWhiteSpace(input.Email) && await _customerRepo.EmailExistsAsync(input.Email, id, ct))
            throw new DuplicateEmailException(input.Email);

        customer.FullName = input.FullName;
        customer.PhoneNumber = input.PhoneNumber;
        customer.Email = input.Email;
        customer.CustomerGroup = input.CustomerGroup;
        customer.TaxCode = input.TaxCode;
        customer.Source = input.Source;
        customer.Department = input.Department;
        customer.AssignedSaleId = access.CanViewAllCustomers
            ? input.AssignedSaleId
            : customer.AssignedSaleId ?? access.UserId;
        customer.TierId = await ResolveTierIdOnUpdateAsync(input.CustomerGroup, input.TierId, customer, ct);
        customer.UpdatedAt = DateTime.UtcNow;

        _customerRepo.Update(customer);
        await UpsertPrimaryAddressAsync(id, input.FullName, input.PhoneNumber, input.AddressLine, ct);
        await RecordActivityAsync(id, CustomerActivityType.Updated, $"Cập nhật thông tin khách {customer.FullName}", ct);

        await _customerRepo.SaveChangesAsync(ct);
        customer = await _customerRepo.GetByIdAsync(id, ct) ?? customer;
        return MapToResponse(customer);
    }

    public async Task DeleteAsync(Guid id, CustomerAccessContext access, CancellationToken ct = default)
    {
        var customer = await _customerRepo.GetByIdAsync(id, ct);
        if (customer == null)
            throw new CustomerNotFoundException(id);

        EnsureCanAccess(customer, access);
        EnsureCanManageCorporateCustomer(customer.CustomerGroup, access);

        await _customerRepo.SoftDeleteAsync(id, ct);
        await RecordActivityAsync(id, CustomerActivityType.Updated, "Xóa mềm khách hàng", ct);
        await _customerRepo.SaveChangesAsync(ct);
    }

    public async Task<CustomerResponse> RestoreAsync(Guid id, CustomerAccessContext access, CancellationToken ct = default)
    {
        var customer = await _customerRepo.GetByIdIncludingDeletedAsync(id, ct)
            ?? throw new CustomerNotFoundException(id);

        EnsureCanAccess(customer, access);
        EnsureCanManageCorporateCustomer(customer.CustomerGroup, access);

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

    public byte[] BuildImportTemplate()
    {
        using var workbook = new XLWorkbook();
        var worksheet = workbook.AddWorksheet("KhachHang");

        for (var index = 0; index < CustomerImportHeaders.Length; index++)
        {
            var cell = worksheet.Cell(1, index + 1);
            cell.Value = CustomerImportHeaders[index];
            cell.Style.Font.Bold = true;
            cell.Style.Fill.BackgroundColor = XLColor.FromHtml("#EAF3E6");
            cell.Style.Border.OutsideBorder = XLBorderStyleValues.Thin;
        }

        worksheet.Column(2).Style.NumberFormat.Format = "@";
        worksheet.SheetView.FreezeRows(1);
        worksheet.Range(1, 1, 1, CustomerImportHeaders.Length).SetAutoFilter();
        worksheet.Columns(1, CustomerImportHeaders.Length).AdjustToContents();

        using var stream = new MemoryStream();
        workbook.SaveAs(stream);
        return stream.ToArray();
    }

    public async Task<CustomerImportResultResponse> ImportFromExcelAsync(
        Stream fileStream,
        string fileName,
        CustomerAccessContext access,
        CancellationToken ct = default)
    {
        if (fileStream is null)
            throw new CustomerValidationException(["Vui lòng chọn file Excel cần import."]);

        if (!string.Equals(Path.GetExtension(fileName), ".xlsx", StringComparison.OrdinalIgnoreCase))
            throw new CustomerValidationException(["Chỉ hỗ trợ import file Excel định dạng .xlsx."]);

        if (fileStream.CanSeek && fileStream.Length == 0)
            throw new CustomerValidationException(["File Excel không có dữ liệu."]);

        XLWorkbook workbook;
        try
        {
            workbook = new XLWorkbook(fileStream);
        }
        catch
        {
            throw new CustomerValidationException(["Không đọc được file Excel. Vui lòng kiểm tra lại định dạng .xlsx."]);
        }

        using (workbook)
        {
            var worksheet = workbook.Worksheets.FirstOrDefault()
                ?? throw new CustomerValidationException(["File Excel không có dữ liệu."]);

            var headerLookup = FindImportHeaderRow(worksheet);
            var headerRow = headerLookup.HeaderRow;
            var headerMap = headerLookup.HeaderMap;
            var missingHeaders = new List<string>();
            if (!headerMap.ContainsKey("fullName")) missingHeaders.Add(ImportFullNameHeader);
            if (!headerMap.ContainsKey("phoneNumber")) missingHeaders.Add(ImportPhoneHeader);
            if (missingHeaders.Count > 0)
                throw new CustomerValidationException([BuildMissingRequiredImportHeadersMessage(missingHeaders, headerLookup.DetectedHeaders)]);

            var lastRow = worksheet.LastRowUsed();
            if (lastRow is null || lastRow.RowNumber() <= headerRow.RowNumber())
                throw new CustomerValidationException(["File Excel không có dữ liệu khách hàng."]);

            var rowResults = new List<CustomerImportRowResultResponse>();
            var seenPhones = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            var totalRows = 0;

            for (var rowNumber = headerRow.RowNumber() + 1; rowNumber <= lastRow.RowNumber(); rowNumber++)
            {
                var rawRow = ReadImportRow(worksheet.Row(rowNumber), headerMap);
                if (rawRow.IsEmpty) continue;

                totalRows++;
                var result = await ImportCustomerRowAsync(rowNumber, rawRow, seenPhones, access, ct);
                rowResults.Add(result);
            }

            if (totalRows == 0)
                throw new CustomerValidationException(["File Excel không có dữ liệu khách hàng."]);

            var successCount = rowResults.Count(r => r.Status == "Success" || r.Status == "Warning");
            var failedCount = rowResults.Count(r => r.Status == "Failed");
            var warningCount = rowResults.Count(r => r.Status == "Warning");

            return new CustomerImportResultResponse(totalRows, successCount, failedCount, warningCount, rowResults);
        }
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
            if (!await _debtRepo.HasOrderDebtAsync(orderId, ct))
            {
                await ReconcileCurrentDebtFromLedgerAsync(customer, ct);
                customer.CurrentDebt += debtAmount;
                await RecordDebtAsync(customer, DebtTransactionType.IncreaseDebt, debtAmount, "Order", orderId,
                    $"Mua chịu đơn {orderCode}", orderCode, ct);
                await RecordActivityAsync(customerId, CustomerActivityType.DebtUpdated,
                    $"Công nợ +{debtAmount:N0} từ đơn {orderCode}", ct);
            }
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

    public async Task<OrderReturnedHandlingResult> HandleOrderReturnedAsync(
        Guid returnId,
        string returnCode,
        Guid orderId,
        string orderCode,
        Guid? customerId,
        decimal returnAmount,
        decimal orderFinalAmount,
        decimal refundAmount,
        CancellationToken ct = default)
    {
        if (await _processedEvents.ExistsAsync(OrderReturnedEventType, returnId, ct))
        {
            return new OrderReturnedHandlingResult(
                returnId, orderId, customerId, SkippedDuplicate: true, CustomerNotFound: false,
                SkippedNoCustomer: false, SpendingReduced: 0, DebtReduced: 0, TotalSpending: 0, CurrentDebt: 0);
        }

        if (!customerId.HasValue || customerId == Guid.Empty)
        {
            await _processedEvents.AddAsync(OrderReturnedEventType, returnId, ct);
            await _customerRepo.SaveChangesAsync(ct);
            return new OrderReturnedHandlingResult(
                returnId, orderId, null, SkippedDuplicate: false, CustomerNotFound: false,
                SkippedNoCustomer: true, SpendingReduced: 0, DebtReduced: 0, TotalSpending: 0, CurrentDebt: 0);
        }

        var customer = await _customerRepo.GetByIdAsync(customerId.Value, ct);
        if (customer is null)
        {
            return new OrderReturnedHandlingResult(
                returnId, orderId, customerId, SkippedDuplicate: false, CustomerNotFound: true,
                SkippedNoCustomer: false, SpendingReduced: 0, DebtReduced: 0, TotalSpending: 0, CurrentDebt: 0);
        }

        var spendingReduction = Math.Max(0, returnAmount);
        if (spendingReduction > 0)
            customer.TotalSpending = Math.Max(0, customer.TotalSpending - spendingReduction);

        var debtReduction = 0m;
        if (spendingReduction > 0 && orderFinalAmount > 0)
        {
            await ReconcileCurrentDebtFromLedgerAsync(customer, ct);
            var openDebts = await BuildOpenDebtItemsAsync(customer.Id, ct);
            var orderDebt = openDebts.FirstOrDefault(d => d.OrderId == orderId);
            if (orderDebt is not null && orderDebt.RemainingDebt > 0)
            {
                var proportional = Math.Round(
                    orderDebt.OriginalDebt * spendingReduction / orderFinalAmount,
                    0,
                    MidpointRounding.AwayFromZero);
                debtReduction = Math.Min(orderDebt.RemainingDebt, proportional);
            }
        }

        if (debtReduction > 0)
        {
            customer.CurrentDebt = Math.Max(0, customer.CurrentDebt - debtReduction);
            var transaction = await RecordDebtAsync(
                customer,
                DebtTransactionType.DecreaseDebt,
                debtReduction,
                "OrderReturn",
                returnId,
                $"Trả hàng {returnCode} từ đơn {orderCode}" +
                (refundAmount > 0 ? $" (hoàn {refundAmount:N0} đ)" : string.Empty),
                orderCode,
                ct);

            await _allocationRepo.AddRangeAsync(
            [
                new CustomerDebtAllocation
                {
                    Id = Guid.NewGuid(),
                    DebtTransactionId = transaction.Id,
                    CustomerId = customer.Id,
                    OrderId = orderId,
                    OrderCode = orderCode,
                    Amount = debtReduction,
                    CreatedAt = DateTime.UtcNow
                }
            ], ct);
        }

        customer.UpdatedAt = DateTime.UtcNow;
        _customerRepo.Update(customer);
        await _processedEvents.AddAsync(OrderReturnedEventType, returnId, ct);

        if (spendingReduction > 0 || debtReduction > 0)
        {
            var parts = new List<string>();
            if (spendingReduction > 0)
                parts.Add($"chi tiêu -{spendingReduction:N0}");
            if (debtReduction > 0)
                parts.Add($"công nợ -{debtReduction:N0}");
            await RecordActivityAsync(
                customer.Id,
                CustomerActivityType.DebtUpdated,
                $"Trả hàng {returnCode}: {string.Join(", ", parts)}",
                ct);
        }

        await _customerRepo.SaveChangesAsync(ct);

        return new OrderReturnedHandlingResult(
            returnId,
            orderId,
            customer.Id,
            SkippedDuplicate: false,
            CustomerNotFound: false,
            SkippedNoCustomer: false,
            SpendingReduced: spendingReduction,
            DebtReduced: debtReduction,
            TotalSpending: customer.TotalSpending,
            CurrentDebt: customer.CurrentDebt);
    }

    public async Task<CustomerDebtTransactionResponse> RecordDebtTransactionAsync(
        Guid customerId,
        RecordDebtTransactionRequest request,
        CustomerAccessContext access,
        CancellationToken ct = default)
    {
        if (request is null)
            throw new CustomerValidationException(["Request body is required."]);

        if (request.Amount <= 0)
            throw new CustomerValidationException(["Amount must be greater than zero."]);

        var customer = await _customerRepo.GetByIdAsync(customerId, ct)
            ?? throw new CustomerNotFoundException(customerId);

        EnsureCanAccess(customer, access);
        EnsureCanManageCorporateCustomer(customer.CustomerGroup, access);

        if (request.Type == DebtTransactionType.DecreaseDebt)
        {
            var payment = await ApplyDebtPaymentAsync(customerId, new ApplyDebtPaymentRequest(
                request.Amount,
                request.Note ?? "Thanh toán công nợ"), access, ct);
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
        CustomerAccessContext access,
        CancellationToken ct = default)
    {
        var customer = await _customerRepo.GetByIdAsync(customerId, ct)
            ?? throw new CustomerNotFoundException(customerId);

        EnsureCanAccess(customer, access);

        var items = await BuildOpenDebtItemsAsync(customerId, ct);
        return items
            .Select(i => new CustomerOpenDebtResponse(
                i.OrderId, i.OrderCode, i.OriginalDebt, i.PaidAmount, i.RemainingDebt, i.CreatedAt))
            .ToList();
    }

    public async Task<CustomerDebtPaymentPreviewResponse> PreviewDebtPaymentAsync(
        Guid customerId,
        decimal amount,
        CustomerAccessContext access,
        CancellationToken ct = default)
    {
        if (amount <= 0)
            throw new CustomerValidationException(["Amount must be greater than zero."]);

        var customer = await _customerRepo.GetByIdAsync(customerId, ct)
            ?? throw new CustomerNotFoundException(customerId);

        EnsureCanAccess(customer, access);

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
        CustomerAccessContext access,
        CancellationToken ct = default)
    {
        if (request is null)
            throw new CustomerValidationException(["Request body is required."]);

        if (request.Amount <= 0)
            throw new CustomerValidationException(["Amount must be greater than zero."]);

        var customer = await _customerRepo.GetByIdAsync(customerId, ct)
            ?? throw new CustomerNotFoundException(customerId);

        EnsureCanAccess(customer, access);
        EnsureCanManageCorporateCustomer(customer.CustomerGroup, access);

        await ReconcileCurrentDebtFromLedgerAsync(customer, ct);

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

    public async Task<IEnumerable<CustomerDebtTransactionResponse>> GetDebtsAsync(
        Guid customerId,
        CustomerAccessContext access,
        CancellationToken ct = default)
    {
        var customer = await _customerRepo.GetByIdAsync(customerId, ct)
            ?? throw new CustomerNotFoundException(customerId);

        EnsureCanAccess(customer, access);

        var items = await _debtRepo.GetByCustomerIdAsync(customerId, ct);
        return MapDebtsWithLedgerBalances(items);
    }

    public async Task<CustomerDebtSummaryResponse> GetDebtSummaryAsync(
        Guid customerId,
        CustomerAccessContext access,
        CancellationToken ct = default)
    {
        var customer = await _customerRepo.GetByIdAsync(customerId, ct)
            ?? throw new CustomerNotFoundException(customerId);

        EnsureCanAccess(customer, access);

        await ReconcileCurrentDebtFromLedgerAsync(customer, ct);
        var (increase, decrease, count) = await _debtRepo.GetSummaryAsync(customerId, ct);
        return new CustomerDebtSummaryResponse(customer.CurrentDebt, increase, decrease, count);
    }

    public async Task<IEnumerable<CustomerActivityResponse>> GetActivitiesAsync(
        Guid customerId,
        CustomerAccessContext access,
        CancellationToken ct = default)
    {
        var customer = await _customerRepo.GetByIdAsync(customerId, ct)
            ?? throw new CustomerNotFoundException(customerId);

        EnsureCanAccess(customer, access);

        var items = await _activityRepo.GetByCustomerIdAsync(customerId, 100, ct);
        return items.Select(a => new CustomerActivityResponse(a.Id, a.CustomerId, a.ActivityType, a.Description, a.CreatedAt));
    }

    public async Task<CustomerStatisticsResponse> GetStatisticsAsync(CustomerAccessContext access, CancellationToken ct = default)
    {
        var filter = access.AssignedSaleFilter;
        var monthStart = new DateTime(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        var total = await _customerRepo.CountAsync(filter, ct);
        var newThisMonth = await _customerRepo.CountCreatedSinceAsync(monthStart, filter, ct);
        var topSpenders = (await _customerRepo.GetTopSpendersAsync(5, filter, ct)).Select(MapToResponse);
        var topDebtors = (await _customerRepo.GetTopDebtorsAsync(5, filter, ct)).Select(MapToResponse);
        var byTier = (await _customerRepo.CountByTierAsync(filter, ct))
            .Select(x => new TierCountResponse(x.TierName, x.Count));

        return new CustomerStatisticsResponse(total, newThisMonth, topSpenders, topDebtors, byTier);
    }

    public async Task<CustomerDetailResponse?> GetByPhoneAsync(
        string phone,
        CustomerAccessContext access,
        CancellationToken ct = default)
    {
        var normalized = phone?.Trim() ?? string.Empty;
        if (string.IsNullOrEmpty(normalized))
            throw new CustomerValidationException(["Số điện thoại là bắt buộc."]);

        var customer = await _customerRepo.GetByPhoneAsync(normalized, ct);
        if (customer is null)
            return null;

        EnsureCanAccess(customer, access);
        return MapToDetailResponse(customer);
    }

    public async Task<CustomerDetailResponse> GetByIdAsync(Guid id, CustomerAccessContext access, CancellationToken ct = default)
    {
        var customer = await _customerRepo.GetByIdAsync(id, ct)
            ?? throw new CustomerNotFoundException(id);

        EnsureCanAccess(customer, access);
        await ReconcileCurrentDebtFromLedgerAsync(customer, ct);
        return MapToDetailResponse(customer);
    }

    public async Task<PagedResult<CustomerResponse>> GetAllAsync(
        int page, int pageSize, CustomerAccessContext access, CancellationToken ct = default)
    {
        ValidatePagination(page, pageSize);

        var filter = access.AssignedSaleFilter;
        var totalCount = await _customerRepo.CountAsync(filter, ct);
        var customers = await _customerRepo.GetAllAsync(page, pageSize, filter, ct);
        var items = customers.Select(MapToResponse).ToList();
        return new PagedResult<CustomerResponse>(items, page, pageSize, totalCount);
    }

    public async Task<PagedResult<CustomerResponse>> GetInactiveAsync(
        int page, int pageSize, CustomerAccessContext access, CancellationToken ct = default)
    {
        ValidatePagination(page, pageSize);

        var filter = access.AssignedSaleFilter;
        var totalCount = await _customerRepo.CountDeletedAsync(filter, ct);
        var customers = await _customerRepo.GetAllDeletedAsync(page, pageSize, filter, ct);
        var items = customers.Select(MapToResponse).ToList();
        return new PagedResult<CustomerResponse>(items, page, pageSize, totalCount);
    }

    private async Task<CustomerImportRowResultResponse> ImportCustomerRowAsync(
        int rowNumber,
        CustomerImportRawRow rawRow,
        HashSet<string> seenPhones,
        CustomerAccessContext access,
        CancellationToken ct)
    {
        var errors = new List<string>();
        var warnings = new List<string>();

        var fullName = NormalizeImportText(rawRow.FullName);
        var phoneNumber = NormalizeImportPhone(rawRow.PhoneNumber);
        var email = NormalizeImportText(rawRow.Email);
        var taxCode = NormalizeImportText(rawRow.TaxCode);
        var note = NormalizeImportText(rawRow.Note);

        if (string.IsNullOrWhiteSpace(fullName))
            errors.Add("Họ và tên là bắt buộc.");
        else if (fullName.Length > 100)
            errors.Add("Họ và tên tối đa 100 ký tự.");

        if (!VietnamPhoneValidator.TryValidate(phoneNumber, out var phoneError))
        {
            errors.Add(phoneError!);
        }
        else
        {
            if (!seenPhones.Add(phoneNumber))
                errors.Add("Số điện thoại bị trùng trong file import.");

            if (await _customerRepo.PhoneExistsAsync(phoneNumber, ct: ct))
                errors.Add("Số điện thoại đã tồn tại trong hệ thống.");
        }

        if (!string.IsNullOrWhiteSpace(email))
        {
            if (email.Length > 100 || !ImportEmailRegex.IsMatch(email))
            {
                warnings.Add("Email không đúng định dạng nên không được lưu.");
                email = null;
            }
            else if (await _customerRepo.EmailExistsAsync(email, ct: ct))
            {
                errors.Add("Email đã được sử dụng trong hệ thống.");
            }
        }
        else
        {
            email = null;
        }

        var customerGroup = ResolveImportCustomerGroup(rawRow.CustomerGroup, warnings);

        if (!string.IsNullOrWhiteSpace(taxCode) &&
            !VietnamTaxCodeValidator.TryValidate(taxCode, required: false, out _))
        {
            warnings.Add("Mã số thuế không hợp lệ nên không được lưu.");
            taxCode = null;
        }

        if (customerGroup == CustomerGroup.DoanhNghiep && string.IsNullOrWhiteSpace(taxCode))
        {
            warnings.Add("Khách doanh nghiệp cần mã số thuế hợp lệ, dòng này được nhập vào nhóm Phổ thông.");
            customerGroup = CustomerGroup.PhoThong;
        }

        var source = ResolveImportCustomerSource(rawRow.Source, warnings);

        if (!string.IsNullOrWhiteSpace(note))
            warnings.Add("Cột Ghi chú chưa có trường lưu riêng trong hồ sơ khách hàng nên không được lưu.");

        if (errors.Count > 0)
        {
            return new CustomerImportRowResultResponse(
                rowNumber,
                fullName,
                phoneNumber,
                "Failed",
                errors.Concat(warnings).ToList());
        }

        try
        {
            await CreateAsync(
                new CreateCustomerRequest(
                    fullName,
                    phoneNumber,
                    email,
                    DefaultImportedAddressLine,
                    customerGroup,
                    taxCode,
                    TierId: null,
                    AssignedSaleId: null,
                    Source: source,
                    Department: null),
                access,
                ct);
        }
        catch (CustomerValidationException ex)
        {
            return new CustomerImportRowResultResponse(rowNumber, fullName, phoneNumber, "Failed", ex.Errors.ToList());
        }
        catch (DuplicatePhoneNumberException ex)
        {
            return new CustomerImportRowResultResponse(rowNumber, fullName, phoneNumber, "Failed", [ex.Message]);
        }
        catch (DuplicateEmailException ex)
        {
            return new CustomerImportRowResultResponse(rowNumber, fullName, phoneNumber, "Failed", [ex.Message]);
        }
        catch (CustomerForbiddenException ex)
        {
            return new CustomerImportRowResultResponse(rowNumber, fullName, phoneNumber, "Failed", [ex.Message]);
        }

        return new CustomerImportRowResultResponse(
            rowNumber,
            fullName,
            phoneNumber,
            warnings.Count > 0 ? "Warning" : "Success",
            warnings.Count > 0 ? warnings : ["Import thành công."]);
    }

    private static ImportHeaderLookup FindImportHeaderRow(IXLWorksheet worksheet)
    {
        var firstRow = worksheet.FirstRowUsed()
            ?? throw new CustomerValidationException(["File Excel không có dữ liệu."]);
        var lastRow = worksheet.LastRowUsed()
            ?? throw new CustomerValidationException(["File Excel không có dữ liệu."]);

        var startRowNumber = firstRow.RowNumber();
        var endRowNumber = Math.Min(lastRow.RowNumber(), startRowNumber + ImportHeaderScanRowCount - 1);
        ImportHeaderLookup? bestMatch = null;
        var bestScore = -1;

        for (var rowNumber = startRowNumber; rowNumber <= endRowNumber; rowNumber++)
        {
            var row = worksheet.Row(rowNumber);
            var headerMap = BuildImportHeaderMap(row);
            var detectedHeaders = GetImportHeaderTexts(row);
            var score = headerMap.Count
                + (headerMap.ContainsKey("fullName") ? 10 : 0)
                + (headerMap.ContainsKey("phoneNumber") ? 10 : 0);

            var lookup = new ImportHeaderLookup(row, headerMap, detectedHeaders);
            if (headerMap.ContainsKey("fullName") && headerMap.ContainsKey("phoneNumber"))
                return lookup;

            if (score > bestScore || (bestMatch is null && detectedHeaders.Count > 0))
            {
                bestMatch = lookup;
                bestScore = score;
            }
        }

        return bestMatch ?? new ImportHeaderLookup(firstRow, BuildImportHeaderMap(firstRow), GetImportHeaderTexts(firstRow));
    }

    private static string BuildMissingRequiredImportHeadersMessage(
        IReadOnlyCollection<string> missingHeaders,
        IReadOnlyCollection<string> detectedHeaders)
    {
        var message = $"File Excel thiếu cột bắt buộc: {string.Join(", ", missingHeaders)}.";
        return detectedHeaders.Count > 0
            ? $"{message} Các cột đã đọc: {string.Join(", ", detectedHeaders)}."
            : $"{message} Không đọc được dòng tiêu đề trong {ImportHeaderScanRowCount} dòng đầu.";
    }

    private static List<string> GetImportHeaderTexts(IXLRow headerRow) =>
        headerRow.CellsUsed()
            .Select(cell => NormalizeImportText(cell.GetFormattedString()))
            .Where(text => !string.IsNullOrWhiteSpace(text))
            .ToList();

    private static Dictionary<string, int> BuildImportHeaderMap(IXLRow headerRow)
    {
        var headerMap = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        foreach (var cell in headerRow.CellsUsed())
        {
            var key = ResolveImportColumnKey(cell.GetString());
            if (key is not null && !headerMap.ContainsKey(key))
                headerMap[key] = cell.Address.ColumnNumber;
        }

        return headerMap;
    }

    private static CustomerImportRawRow ReadImportRow(IXLRow row, IReadOnlyDictionary<string, int> headerMap) =>
        new(
            GetImportCellText(row, headerMap, "fullName"),
            GetImportCellText(row, headerMap, "phoneNumber"),
            GetImportCellText(row, headerMap, "email"),
            GetImportCellText(row, headerMap, "customerGroup"),
            GetImportCellText(row, headerMap, "taxCode"),
            GetImportCellText(row, headerMap, "source"),
            GetImportCellText(row, headerMap, "note"));

    private static string GetImportCellText(IXLRow row, IReadOnlyDictionary<string, int> headerMap, string key)
    {
        if (!headerMap.TryGetValue(key, out var columnNumber))
            return string.Empty;

        return row.Cell(columnNumber).GetFormattedString().Trim();
    }

    private static string? ResolveImportColumnKey(string header)
    {
        var key = NormalizeImportKey(header);
        if (string.IsNullOrWhiteSpace(key))
            return null;

        if (key is "hovaten" or "hoten" or "fullname" or "customername"
            || key.StartsWith("hovaten", StringComparison.Ordinal)
            || key.StartsWith("hoten", StringComparison.Ordinal)
            || key.StartsWith("fullname", StringComparison.Ordinal))
            return "fullName";

        if (key is "sodienthoai" or "dienthoai" or "sdt" or "phone" or "phonenumber"
            || key.StartsWith("sodienthoai", StringComparison.Ordinal)
            || key.StartsWith("dienthoai", StringComparison.Ordinal)
            || key.StartsWith("phonenumber", StringComparison.Ordinal))
            return "phoneNumber";

        return key switch
        {
            "email" => "email",
            "nhomkhachhang" or "loaikhachhang" or "customergroup" or "customertype" => "customerGroup",
            "masothue" or "mst" or "taxcode" => "taxCode",
            "nguonkhachhang" or "nguon" or "source" or "customersource" => "source",
            "ghichu" or "note" or "notes" => "note",
            _ => null
        };
    }

    private static CustomerGroup ResolveImportCustomerGroup(string value, List<string> warnings)
    {
        var key = NormalizeImportKey(value);
        if (string.IsNullOrWhiteSpace(key))
            return CustomerGroup.PhoThong;

        return key switch
        {
            "phothong" or "khachle" or "banle" or "general" or "retail" or "member" => CustomerGroup.PhoThong,
            "vip" or "doingoai" or "vvip" => CustomerGroup.DoiNgoai,
            "doanhnghiep" or "congty" or "corporate" or "business" => CustomerGroup.DoanhNghiep,
            _ => WarnAndDefaultGroup(value, warnings)
        };
    }

    private static CustomerGroup WarnAndDefaultGroup(string value, List<string> warnings)
    {
        warnings.Add($"Nhóm khách hàng '{value.Trim()}' không hợp lệ, đã mặc định là Phổ thông.");
        return CustomerGroup.PhoThong;
    }

    private static CustomerSource? ResolveImportCustomerSource(string value, List<string> warnings)
    {
        var key = NormalizeImportKey(value);
        if (string.IsNullOrWhiteSpace(key))
            return null;

        return key switch
        {
            "website" or "web" => CustomerSource.Website,
            "zalo" => CustomerSource.Zalo,
            "phone" or "dienthoai" or "sodienthoai" => CustomerSource.Phone,
            "walkin" or "cuahang" or "taicuahang" or "tructiep" => CustomerSource.WalkIn,
            "referral" or "gioithieu" => CustomerSource.Referral,
            "other" or "khac" => CustomerSource.Other,
            _ => WarnAndDefaultSource(value, warnings)
        };
    }

    private static CustomerSource WarnAndDefaultSource(string value, List<string> warnings)
    {
        warnings.Add($"Nguồn khách hàng '{value.Trim()}' không hợp lệ, đã mặc định là Other.");
        return CustomerSource.Other;
    }

    private static string NormalizeImportText(string? value) =>
        string.IsNullOrWhiteSpace(value) ? string.Empty : value.Trim().Normalize(NormalizationForm.FormC);

    private static string NormalizeImportPhone(string? value)
    {
        var text = NormalizeImportText(value);
        return string.IsNullOrWhiteSpace(text)
            ? string.Empty
            : Regex.Replace(text, @"[\s\-.]", string.Empty);
    }

    private static string NormalizeImportKey(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return string.Empty;

        var cleaned = value.Trim()
            .Normalize(NormalizationForm.FormKC)
            .Replace('\u00A0', ' ')
            .Replace('\u200B', ' ')
            .Replace('\u200C', ' ')
            .Replace('\u200D', ' ')
            .Replace('\uFEFF', ' ');

        var normalized = cleaned
            .Replace('đ', 'd')
            .Replace('Đ', 'D')
            .Normalize(NormalizationForm.FormD);

        var builder = new StringBuilder();
        foreach (var c in normalized)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(c) == UnicodeCategory.NonSpacingMark)
                continue;

            if (char.IsLetterOrDigit(c))
                builder.Append(char.ToLowerInvariant(c));
        }

        return builder.ToString();
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

    private sealed record ImportHeaderLookup(
        IXLRow HeaderRow,
        Dictionary<string, int> HeaderMap,
        IReadOnlyList<string> DetectedHeaders);

    private sealed record CustomerImportRawRow(
        string FullName,
        string PhoneNumber,
        string Email,
        string CustomerGroup,
        string TaxCode,
        string Source,
        string Note)
    {
        public bool IsEmpty =>
            string.IsNullOrWhiteSpace(FullName) &&
            string.IsNullOrWhiteSpace(PhoneNumber) &&
            string.IsNullOrWhiteSpace(Email) &&
            string.IsNullOrWhiteSpace(CustomerGroup) &&
            string.IsNullOrWhiteSpace(TaxCode) &&
            string.IsNullOrWhiteSpace(Source) &&
            string.IsNullOrWhiteSpace(Note);
    }

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

    private async Task<int?> ResolveInitialTierIdAsync(
        CustomerGroup customerGroup, int? requestedTierId, CancellationToken ct)
    {
        if (customerGroup == CustomerGroup.DoiNgoai)
            return null;

        if (customerGroup == CustomerGroup.PhoThong)
        {
            var defaultTier = await _tierRepo.GetDefaultTierAsync(ct);
            return defaultTier?.Id;
        }

        return null;
    }

    private async Task<int?> ResolveTierIdOnUpdateAsync(
        CustomerGroup customerGroup,
        int? requestedTierId,
        Customer customer,
        CancellationToken ct)
    {
        if (customerGroup == CustomerGroup.DoiNgoai)
        {
            if (customer.TierId.HasValue)
            {
                await RecordActivityAsync(
                    customer.Id,
                    CustomerActivityType.TierChanged,
                    $"Gỡ hạng thẻ khỏi khách VIP: {customer.Tier?.TierName ?? "—"}",
                    ct);
            }
            return null;
        }

        return customer.TierId;
    }

    private async Task<DuplicatePhoneNumberException> BuildDuplicatePhoneExceptionAsync(
        string phone,
        CustomerAccessContext access,
        CancellationToken ct)
    {
        var existing = await _customerRepo.GetByPhoneAsync(phone, ct);
        if (existing is not null && !access.CanAccessCustomer(existing.AssignedSaleId))
        {
            return new DuplicatePhoneNumberException(
                $"Số điện thoại '{phone}' đã có trong hệ thống nhưng không thuộc khách bạn phụ trách. Vui lòng liên hệ quản lý để được gán khách.");
        }

        return new DuplicatePhoneNumberException(
            $"Số điện thoại '{phone}' đã được đăng ký. Hãy tìm khách trong danh sách hoặc ô tìm kiếm tại POS.");
    }

    private static void EnsureCanAccess(Customer customer, CustomerAccessContext access)
    {
        if (!access.CanAccessCustomer(customer.AssignedSaleId))
            throw new CustomerForbiddenException();
    }

    private static void EnsureCanManageCorporateCustomer(CustomerGroup customerGroup, CustomerAccessContext access)
    {
        if (customerGroup == CustomerGroup.DoanhNghiep && !access.CanManageCorporateCustomers)
            throw new CustomerForbiddenException("Chỉ Admin được tạo hoặc chỉnh sửa khách doanh nghiệp.");
    }

    private static Guid? ResolveAssignedSaleId(Guid? requestedSaleId, CustomerAccessContext access)
    {
        if (access.CanViewAllCustomers)
            return requestedSaleId;

        return access.UserId != Guid.Empty ? access.UserId : requestedSaleId;
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
            request.AssignedSaleId,
            request.Source,
            request.Department);
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
            request.AssignedSaleId,
            request.Source,
            request.Department);
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

    private static IEnumerable<CustomerDebtTransactionResponse> MapDebtsWithLedgerBalances(
        IEnumerable<CustomerDebtTransaction> items)
    {
        var ordered = items.OrderBy(t => t.CreatedAt).ThenBy(t => t.Id).ToList();
        decimal balance = 0;
        var results = new List<CustomerDebtTransactionResponse>();

        foreach (var transaction in ordered)
        {
            balance = transaction.Type == DebtTransactionType.IncreaseDebt
                ? balance + transaction.Amount
                : Math.Max(0, balance - transaction.Amount);

            results.Add(new CustomerDebtTransactionResponse(
                transaction.Id,
                transaction.CustomerId,
                transaction.Type,
                transaction.Amount,
                balance,
                transaction.ReferenceType,
                transaction.ReferenceId,
                transaction.Note,
                transaction.CreatedAt));
        }

        return results
            .OrderByDescending(t => t.CreatedAt)
            .ThenByDescending(t => t.Id);
    }

    private async Task ReconcileCurrentDebtFromLedgerAsync(Customer customer, CancellationToken ct)
    {
        var ledgerBalance = await _debtRepo.GetLedgerBalanceAsync(customer.Id, ct);
        if (customer.CurrentDebt == ledgerBalance)
            return;

        customer.CurrentDebt = ledgerBalance;
        customer.UpdatedAt = DateTime.UtcNow;
        _customerRepo.Update(customer);
        await _customerRepo.SaveChangesAsync(ct);
    }

    private static CustomerResponse MapToResponse(Customer c) =>
        new(c.Id, c.CustomerCode, c.FullName, c.PhoneNumber, c.Email, c.CustomerGroup, c.TaxCode,
            c.TierId, c.Tier?.TierName, c.TotalSpending, c.CurrentDebt,
            c.AssignedSaleId, c.Source, c.Department, c.CreatedAt, c.UpdatedAt);

    private static CustomerDetailResponse MapToDetailResponse(Customer c) =>
        new(c.Id, c.CustomerCode, c.FullName, c.PhoneNumber, c.Email, c.CustomerGroup, c.TaxCode,
            c.Tier == null ? null : new CustomerTierResponse(c.Tier.Id, c.Tier.TierName,
                c.Tier.MinSpendingThreshold, c.Tier.DiscountPercent, c.Tier.ValidityMonths),
            c.TotalSpending, c.CurrentDebt, c.AssignedSaleId, c.Source, c.Department,
            c.Addresses.Where(a => !a.IsDeleted).Select(a => new CustomerAddressResponse(a.Id, a.CustomerId, a.ReceiverName,
                a.ReceiverPhone, a.AddressLine, a.Ward, a.District, a.Province, a.IsDefault)),
            c.CreatedAt, c.UpdatedAt);
}
