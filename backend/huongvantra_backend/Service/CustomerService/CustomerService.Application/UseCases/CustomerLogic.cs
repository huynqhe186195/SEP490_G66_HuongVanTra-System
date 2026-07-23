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
    private const int MaxCheckoutSearchPageSize = 50;
    private const int MaxCheckoutSearchLength = 100;
    public const string CustomerImportTemplateFileName = "Mau_Import_Khach_Hang_Huong_Van_Tra.xlsx";
    public const string CustomerImportContentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    private const int ImportHeaderScanRowCount = 20;
    private const int CustomerExcelHeaderRow = 7;
    private const string CustomerImportExportSheetName = "Import-Export Khách Hàng";
    private const string ImportCustomerCodeHeader = "Mã Khách Hàng";
    private const string ImportFullNameHeader = "Họ và Tên (*)";
    private const string ImportPhoneHeader = "Số Điện Thoại (*)";
    private const string ImportEmailHeader = "Email";
    private const string ImportBirthDateHeader = "Ngày Sinh (DD/MM/YYYY)";
    private const string ImportGenderHeader = "Giới Tính";
    private const string ImportAddressHeader = "Địa Chỉ";
    private const string ImportCustomerGroupHeader = "Loại Khách Hàng";
    private const string ImportTaxCodeHeader = "Mã Số Thuế";
    private const string ImportSourceHeader = "Nguồn Khách Hàng";
    private const string ImportPointsHeader = "Điểm Tích Lũy";
    private const string ImportNoteHeader = "Ghi Chú Đặc Điểm KH";
    private const string RequiredFullNameHeader = "Họ và Tên";
    private const string RequiredPhoneHeader = "Số Điện Thoại";
    private const string DefaultImportedAddressLine = "Chưa có địa chỉ giao hàng";
    public const string OrderCompletedEventType = "OrderCompleted";
    public const string OrderReturnedEventType = "OrderReturned";

    private static readonly string[] CustomerImportHeaders =
    [
        ImportCustomerCodeHeader,
        ImportFullNameHeader,
        ImportPhoneHeader,
        ImportEmailHeader,
        ImportBirthDateHeader,
        ImportGenderHeader,
        ImportAddressHeader,
        ImportCustomerGroupHeader,
        ImportTaxCodeHeader,
        ImportSourceHeader,
        ImportPointsHeader,
        ImportNoteHeader
    ];

    private static readonly Regex ImportEmailRegex = new(
        @"^[^\s@]+@[^\s@]+\.[^\s@]{2,}$",
        RegexOptions.Compiled | RegexOptions.IgnoreCase);
    private static readonly Regex ImportPhoneRegex = new(@"^0\d{9}$", RegexOptions.Compiled);

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
        await RecordActivityAsync(id, CustomerActivityType.Deleted, "Xóa mềm khách hàng", ct);
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
        await RecordActivityAsync(id, CustomerActivityType.Restored, "Khôi phục khách hàng", ct);
        await _customerRepo.SaveChangesAsync(ct);

        customer = await _customerRepo.GetByIdAsync(id, ct) ?? customer;
        return MapToResponse(customer);
    }

    public byte[] BuildImportTemplate()
    {
        using var workbook = new XLWorkbook();
        var worksheet = workbook.AddWorksheet(CustomerImportExportSheetName);

        BuildCustomerExcelChrome(
            worksheet,
            "Mẫu import khách hàng",
            "Dùng một file cho khách Phổ Thông, VIP và Doanh Nghiệp.",
            "Họ và Tên, Số Điện Thoại là bắt buộc. Mã Khách Hàng và Điểm Tích Lũy không được import thủ công.",
            0);
        WriteCustomerExcelHeaders(worksheet);
        ApplyCustomerExcelWorksheetLayout(worksheet);

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
            var worksheet = ResolveImportWorksheet(workbook)
                ?? throw new CustomerValidationException(["File Excel không có dữ liệu."]);

            var headerLookup = FindImportHeaderRow(worksheet);
            var headerRow = headerLookup.HeaderRow;
            var headerMap = headerLookup.HeaderMap;
            var missingHeaders = new List<string>();
            if (!headerMap.ContainsKey("fullName")) missingHeaders.Add(RequiredFullNameHeader);
            if (!headerMap.ContainsKey("phoneNumber")) missingHeaders.Add(RequiredPhoneHeader);
            if (missingHeaders.Count > 0)
            {
                Console.Error.WriteLine(
                    $"Customer Excel import missing required headers. HeaderRow={headerRow.RowNumber()}; " +
                    $"Missing={string.Join(", ", missingHeaders)}; " +
                    $"RawHeaders={string.Join(" | ", headerLookup.DetectedHeaders)}; " +
                    $"NormalizedHeaders={string.Join(" | ", BuildImportHeaderDiagnostics(headerRow))}; " +
                    $"ResolvedFields={string.Join(", ", headerMap.Keys.OrderBy(key => key))}");

                throw new CustomerValidationException([BuildMissingRequiredImportHeadersMessage(missingHeaders, headerLookup.DetectedHeaders)]);
            }

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
            var failedCount = rowResults.Count(r => r.Status == "Error");
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
        string? codDebtSettlementJson = null,
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

        // Xử lý trừ nợ cũ bằng tiền thừa COD (nếu cashier đã cấu hình khi tạo đơn).
        // Thực hiện ngay trong cùng handler để đảm bảo atomicity — tránh mất settlement
        // nếu frontend crash sau khi verify COD nhưng trước khi gọi ApplyDebtPayment.
        if (!string.IsNullOrWhiteSpace(codDebtSettlementJson))
        {
            await TryApplyCodDebtSettlementAsync(customer, orderId, orderCode, codDebtSettlementJson, ct);
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

    /// <summary>
    /// Parse CodDebtSettlementJson và trừ nợ cũ của khách bằng tiền thừa COD.
    /// Được gọi nội bộ trong HandleOrderCompletedAsync — không throw nếu JSON lỗi
    /// hoặc số tiền không hợp lệ (chỉ log), để không block việc ghi nợ mới của đơn hiện tại.
    /// </summary>
    private async Task TryApplyCodDebtSettlementAsync(
        Customer customer,
        Guid sourceOrderId,
        string orderCode,
        string settlementJson,
        CancellationToken ct)
    {
        CodDebtSettlement? settlement;
        try
        {
            settlement = System.Text.Json.JsonSerializer.Deserialize<CodDebtSettlement>(
                settlementJson,
                new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true });
        }
        catch
        {
            // JSON hỏng — bỏ qua, không làm hỏng toàn bộ handler
            return;
        }

        if (settlement is null || !settlement.PayDebtsEnabled || settlement.AllocatedAmount <= 0)
            return;

        // Clamp: không được trừ quá tổng nợ hiện tại (có thể đã thay đổi từ lúc tạo đơn)
        var maxPayable = customer.CurrentDebt;
        if (maxPayable <= 0) return;

        var allocatedAmount = Math.Min(settlement.AllocatedAmount, maxPayable);
        if (allocatedAmount <= 0) return;

        // Xây allocation plans từ danh sách explicit hoặc FIFO
        var openDebts = await BuildOpenDebtItemsAsync(customer.Id, ct);
        List<CustomerDebtAllocationResponse> allocationPlans;

        if (settlement.Allocations is { Count: > 0 })
        {
            // Scale down proportionally nếu tổng preset > maxPayable
            var presetTotal = settlement.Allocations.Sum(a => a.Amount);
            var scale = presetTotal > maxPayable ? maxPayable / presetTotal : 1m;
            var scaledAllocations = settlement.Allocations
                .Select(a => new DebtAllocationItemRequest(a.OrderId, Math.Floor(a.Amount * scale)))
                .Where(a => a.Amount > 0)
                .ToList();
            allocationPlans = BuildExplicitAllocations(scaledAllocations, openDebts);
        }
        else
        {
            allocationPlans = BuildFifoAllocations(allocatedAmount, openDebts);
        }

        allocatedAmount = allocationPlans.Sum(a => a.Amount);
        if (allocatedAmount <= 0) return;

        // Trim nếu vẫn vượt (phòng thủ)
        if (allocatedAmount > customer.CurrentDebt)
        {
            allocationPlans = TrimAllocationPlans(allocationPlans, customer.CurrentDebt);
            allocatedAmount = allocationPlans.Sum(a => a.Amount);
        }
        if (allocatedAmount <= 0) return;

        customer.CurrentDebt -= allocatedAmount;

        var note = $"Trừ từ tiền thừa đơn COD {orderCode}";
        var transaction = await RecordDebtAsync(
            customer,
            DebtTransactionType.DecreaseDebt,
            allocatedAmount,
            "OrderPayment",
            sourceOrderId,
            note,
            null,
            ct);

        var now = DateTime.UtcNow;
        var allocationEntities = allocationPlans.Select(plan => new CustomerDebtAllocation
        {
            Id = Guid.NewGuid(),
            DebtTransactionId = transaction.Id,
            CustomerId = customer.Id,
            OrderId = plan.OrderId,
            OrderCode = plan.OrderCode,
            Amount = plan.Amount,
            CreatedAt = now
        }).ToList();

        await _allocationRepo.AddRangeAsync(allocationEntities, ct);

        var orderSummary = string.Join(", ", allocationPlans.Select(a => $"{a.OrderCode} {a.Amount:N0}"));
        await RecordActivityAsync(customer.Id, CustomerActivityType.DebtUpdated,
            $"Trừ nợ COD -{allocatedAmount:N0} ({orderSummary})", ct);
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
        {
            customer.TotalSpending = Math.Max(0, customer.TotalSpending - spendingReduction);
            await TryDowngradeMembershipTierAsync(customer, ct);
        }

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

        if (await ReconcileCurrentDebtFromLedgerAsync(customer, ct))
            await _customerRepo.SaveChangesAsync(ct);
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
        if (await ReconcileCurrentDebtFromLedgerAsync(customer, ct))
            await _customerRepo.SaveChangesAsync(ct);
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

    public async Task<PagedResult<CheckoutCustomerSearchResponse>> SearchForCheckoutAsync(
        CheckoutCustomerSearchRequest request,
        CustomerAccessContext access,
        CancellationToken ct = default)
    {
        request ??= new CheckoutCustomerSearchRequest();
        ValidatePagination(request.Page, request.PageSize, MaxCheckoutSearchPageSize);

        var search = NormalizeCheckoutSearch(request.Search);
        var normalizedPhone = NormalizePhoneSearch(search);
        var customerGroup = ParseCheckoutCustomerType(request.CustomerType);

        if (request.ExactPhone
            && !VietnamPhoneValidator.TryValidate(normalizedPhone, out var phoneError))
        {
            throw new CustomerValidationException([phoneError ?? "Số điện thoại tìm kiếm không hợp lệ."]);
        }

        if (string.IsNullOrEmpty(search) && !customerGroup.HasValue)
        {
            return new PagedResult<CheckoutCustomerSearchResponse>(
                Array.Empty<CheckoutCustomerSearchResponse>(),
                request.Page,
                request.PageSize,
                0);
        }

        var (customers, totalCount) = await _customerRepo.SearchForCheckoutAsync(
            search,
            normalizedPhone,
            request.ExactPhone,
            customerGroup,
            access.AssignedSaleFilter,
            request.Page,
            request.PageSize,
            ct);

        var items = customers.Select(MapToCheckoutSearchResponse).ToList();
        return new PagedResult<CheckoutCustomerSearchResponse>(
            items,
            request.Page,
            request.PageSize,
            totalCount);
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

    public async Task<CustomerExcelFileResponse> ExportToExcelAsync(
        CustomerExportRequest? request,
        CustomerAccessContext access,
        CancellationToken ct = default)
    {
        request ??= new CustomerExportRequest();
        var includeDeleted = string.Equals(request.ActiveTab, "inactive", StringComparison.OrdinalIgnoreCase);
        var customers = (await _customerRepo.GetAllForExportAsync(access.AssignedSaleFilter, includeDeleted, ct)).ToList();
        var filteredCustomers = ApplyCustomerExportFilters(customers, request).ToList();

        using var workbook = new XLWorkbook();
        var worksheet = workbook.AddWorksheet(CustomerImportExportSheetName);
        BuildCustomerExcelChrome(
            worksheet,
            "Danh sách khách hàng",
            "Export theo bộ lọc hiện tại trên màn hình Customers.",
            $"Thời gian export: {DateTime.UtcNow.AddHours(7):dd/MM/yyyy HH:mm} · Tổng số dòng: {filteredCustomers.Count}",
            filteredCustomers.Count);
        WriteCustomerExcelHeaders(worksheet);
        WriteCustomerExportRows(worksheet, filteredCustomers);
        ApplyCustomerExcelWorksheetLayout(worksheet);

        using var stream = new MemoryStream();
        workbook.SaveAs(stream);
        var fileName = $"Khach_Hang_Huong_Van_Tra_{DateTime.UtcNow.AddHours(7):yyyyMMdd_HHmm}.xlsx";
        return new CustomerExcelFileResponse(stream.ToArray(), fileName, CustomerImportContentType);
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
        var addressLine = NormalizeImportText(rawRow.AddressLine);
        var note = NormalizeImportText(rawRow.Note);

        if (string.IsNullOrWhiteSpace(fullName))
        {
            errors.Add("Họ và Tên là bắt buộc.");
        }
        else
        {
            if (fullName.Length < 2)
            {
                warnings.Add("Họ và Tên quá ngắn, vui lòng kiểm tra lại sau khi import.");
            }
            else if (fullName.Length > 100)
            {
                fullName = fullName[..100];
                warnings.Add("Họ và Tên dài hơn 100 ký tự nên đã được cắt ngắn khi import.");
            }
        }

        if (!TryValidateImportPhone(phoneNumber, out var phoneError))
        {
            errors.Add(phoneError!);
        }
        else if (seenPhones.Contains(phoneNumber))
        {
            errors.Add("Số điện thoại bị trùng trong file Excel.");
        }
        else
        {
            seenPhones.Add(phoneNumber);
            if (await _customerRepo.PhoneExistsAsync(phoneNumber, ct: ct))
                errors.Add("Số điện thoại đã tồn tại trong hệ thống.");
        }

        if (!string.IsNullOrWhiteSpace(email))
        {
            if (email.Length > 100 || !ImportEmailRegex.IsMatch(email))
            {
                warnings.Add("Email sai định dạng, đã bỏ qua email.");
                email = null;
            }
            else if (await _customerRepo.EmailExistsAsync(email, ct: ct))
            {
                warnings.Add("Email đã được sử dụng trong hệ thống nên đã bỏ qua email.");
                email = null;
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

        var source = ResolveImportCustomerSource(rawRow.Source, warnings);

        if (!string.IsNullOrWhiteSpace(rawRow.DateOfBirth))
        {
            if (TryParseImportDate(rawRow.DateOfBirth, out _))
                warnings.Add("Ngày Sinh chưa có trường lưu riêng nên không được lưu.");
            else
                warnings.Add("Ngày Sinh không hợp lệ nên không được lưu.");
        }

        if (!string.IsNullOrWhiteSpace(rawRow.Gender))
            ValidateImportGender(rawRow.Gender, warnings);

        if (!string.IsNullOrWhiteSpace(rawRow.Points))
            warnings.Add("Điểm tích lũy không được import thủ công, hệ thống đã bỏ qua giá trị này.");

        if (!string.IsNullOrWhiteSpace(note))
            warnings.Add("Cột Ghi Chú Đặc Điểm KH chưa có trường lưu riêng nên không được lưu.");

        if (string.IsNullOrWhiteSpace(addressLine))
        {
            addressLine = DefaultImportedAddressLine;
        }
        else if (addressLine.Length > 255)
        {
            warnings.Add("Địa Chỉ dài hơn 255 ký tự nên dùng địa chỉ mặc định.");
            addressLine = DefaultImportedAddressLine;
        }
        else if (addressLine.Length < 5 || Regex.IsMatch(addressLine, @"^\d+$"))
        {
            warnings.Add("Địa Chỉ không hợp lệ nên dùng địa chỉ mặc định.");
            addressLine = DefaultImportedAddressLine;
        }

        if (customerGroup.HasValue && customerGroup == CustomerGroup.DoanhNghiep)
        {
            try
            {
                EnsureCanManageCorporateCustomer(customerGroup.Value, access);
            }
            catch (CustomerForbiddenException ex)
            {
                errors.Add(ex.Message);
            }
        }

        if (errors.Count > 0 || !customerGroup.HasValue)
        {
            return new CustomerImportRowResultResponse(
                rowNumber,
                fullName,
                phoneNumber,
                "Error",
                errors.Concat(warnings).ToList());
        }

        try
        {
            var now = DateTime.UtcNow;
            var customer = new Customer
            {
                Id = Guid.NewGuid(),
                CustomerCode = await _customerRepo.GenerateNextCustomerCodeAsync(ct),
                FullName = fullName,
                PhoneNumber = phoneNumber,
                Email = email,
                CustomerGroup = customerGroup.Value,
                TaxCode = taxCode,
                TierId = await ResolveInitialTierIdAsync(customerGroup.Value, requestedTierId: null, ct),
                AssignedSaleId = ResolveAssignedSaleId(requestedSaleId: null, access),
                Source = source,
                Department = null,
                TotalSpending = 0,
                CurrentDebt = 0,
                CreatedAt = now,
                UpdatedAt = now
            };

            await _customerRepo.AddAsync(customer, ct);
            await UpsertPrimaryAddressAsync(customer.Id, fullName, phoneNumber, addressLine, ct);
            await RecordActivityAsync(customer.Id, CustomerActivityType.Created, $"Import khách hàng {customer.FullName}", ct);
            await _customerRepo.SaveChangesAsync(ct);
        }
        catch (CustomerForbiddenException ex)
        {
            _customerRepo.ClearChangeTracker();
            return new CustomerImportRowResultResponse(rowNumber, fullName, phoneNumber, "Error", [ex.Message]);
        }
        catch (Exception ex)
        {
            _customerRepo.ClearChangeTracker();
            return new CustomerImportRowResultResponse(rowNumber, fullName, phoneNumber, "Error", [$"Import dòng này thất bại: {ex.Message}"]);
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

    private static IXLWorksheet? ResolveImportWorksheet(XLWorkbook workbook) =>
        workbook.Worksheets.FirstOrDefault(sheet =>
            string.Equals(NormalizeImportKey(sheet.Name), NormalizeImportKey(CustomerImportExportSheetName), StringComparison.OrdinalIgnoreCase))
        ?? workbook.Worksheets.FirstOrDefault();

    private static Dictionary<string, int> BuildImportHeaderMap(IXLRow headerRow)
    {
        var headerMap = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        foreach (var cell in headerRow.CellsUsed())
        {
            var key = ResolveImportColumnKey(cell.GetFormattedString());
            if (key is not null && !headerMap.ContainsKey(key))
                headerMap[key] = cell.Address.ColumnNumber;
        }

        return headerMap;
    }

    private static List<string> BuildImportHeaderDiagnostics(IXLRow headerRow) =>
        headerRow.CellsUsed()
            .Select(cell =>
            {
                var raw = NormalizeImportText(cell.GetFormattedString());
                var normalized = NormalizeImportKey(raw);
                var resolved = ResolveImportColumnKey(raw) ?? "-";
                return $"{cell.Address.ColumnLetter}:{raw}=>{normalized}=>{resolved}";
            })
            .ToList();

    private static CustomerImportRawRow ReadImportRow(IXLRow row, IReadOnlyDictionary<string, int> headerMap) =>
        new(
            GetImportCellText(row, headerMap, "customerCode"),
            GetImportCellText(row, headerMap, "fullName"),
            GetImportCellText(row, headerMap, "phoneNumber"),
            GetImportCellText(row, headerMap, "email"),
            GetImportCellText(row, headerMap, "birthDate"),
            GetImportCellText(row, headerMap, "gender"),
            GetImportCellText(row, headerMap, "addressLine"),
            GetImportCellText(row, headerMap, "customerGroup"),
            GetImportCellText(row, headerMap, "taxCode"),
            GetImportCellText(row, headerMap, "source"),
            GetImportCellText(row, headerMap, "points"),
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

        var aliasMap = ImportHeaderAliasMap.Value;
        if (aliasMap.TryGetValue(key, out var fieldKey))
            return fieldKey;

        foreach (var (alias, field) in aliasMap)
        {
            if (key.StartsWith(alias, StringComparison.Ordinal))
                return field;
        }

        return null;
    }

    private static readonly Lazy<Dictionary<string, CustomerGroup>> ImportCustomerGroupAliasMap = new(BuildImportCustomerGroupAliasMap);

    private static Dictionary<string, CustomerGroup> BuildImportCustomerGroupAliasMap()
    {
        var aliases = new Dictionary<string, CustomerGroup>(StringComparer.OrdinalIgnoreCase);

        AddImportCustomerGroupAliases(
            aliases,
            CustomerGroup.PhoThong,
            "Phổ Thông",
            "phổ thông",
            "Pho Thong",
            "Pho thong",
            "pho Thong",
            "Khách thường",
            "Khach thuong",
            "khach thuong",
            "Khách lẻ",
            "Khach le",
            "khach le",
            "Thường",
            "Bán lẻ",
            "Normal",
            "normal",
            "General",
            "general",
            "Retail",
            "Member");

        AddImportCustomerGroupAliases(
            aliases,
            CustomerGroup.DoiNgoai,
            "VIP",
            "Vip",
            "vip",
            "Khách VIP",
            "Khach VIP",
            "khach vip",
            "khach VIP",
            "khách vip",
            "Đối ngoại",
            "Doi Ngoai",
            "Doi ngoai",
            "doingoai",
            "VVIP");

        AddImportCustomerGroupAliases(
            aliases,
            CustomerGroup.DoanhNghiep,
            "Doanh Nghiệp",
            "doanh nghiep",
            "doanh nghiệp",
            "doanh Nghiệp",
            "Doanh nghiệp",
            "Doanh Nghiep",
            "Doanh nghiep",
            "doanh Nghiep",
            "Công ty",
            "Cong ty",
            "Business",
            "business",
            "Company",
            "company",
            "Enterprise",
            "enterprise",
            "Corporate");

        return aliases;
    }

    private static void AddImportCustomerGroupAliases(
        Dictionary<string, CustomerGroup> aliases,
        CustomerGroup group,
        params string[] rawAliases)
    {
        foreach (var rawAlias in rawAliases)
        {
            var key = NormalizeImportKey(rawAlias);
            if (!string.IsNullOrWhiteSpace(key) && !aliases.ContainsKey(key))
                aliases[key] = group;
        }
    }

    private static CustomerGroup? ResolveImportCustomerGroup(string value, List<string> warnings)
    {
        var key = NormalizeImportKey(value);
        if (string.IsNullOrWhiteSpace(key))
            return CustomerGroup.PhoThong;

        return ImportCustomerGroupAliasMap.Value.TryGetValue(key, out var group)
            ? group
            : AddInvalidGroupWarning(value, warnings);
    }

    private static CustomerGroup? AddInvalidGroupWarning(string value, List<string> warnings)
    {
        warnings.Add("Loại khách hàng không nhận diện được, đã mặc định là Phổ Thông.");
        return CustomerGroup.PhoThong;
    }

    private static CustomerSource ResolveImportCustomerSource(string value, List<string> warnings)
    {
        var key = NormalizeImportKey(value);
        if (string.IsNullOrWhiteSpace(key))
            return CustomerSource.Other;

        return key switch
        {
            "website" or "web" => CustomerSource.Website,
            "zalo" => CustomerSource.Zalo,
            "phone" or "dienthoai" or "sodienthoai" => CustomerSource.Phone,
            "walkin" or "cuahang" or "taicuahang" or "tructiep" => CustomerSource.WalkIn,
            "referral" or "gioithieu" => CustomerSource.Referral,
            "other" or "khac" => CustomerSource.Other,
            "facebook" or "fb" or "tiktok" or "livestream" or "live" => WarnAndDefaultSource(value, warnings),
            _ => WarnAndDefaultSource(value, warnings)
        };
    }

    private static CustomerSource WarnAndDefaultSource(string value, List<string> warnings)
    {
        warnings.Add("Nguồn khách hàng không nhận diện được, đã mặc định là Khác.");
        return CustomerSource.Other;
    }

    private static bool TryParseImportDate(string value, out DateTime date)
    {
        var text = NormalizeImportText(value);
        var formats = new[] { "d/M/yyyy", "dd/MM/yyyy", "d-M-yyyy", "dd-MM-yyyy", "yyyy-MM-dd" };
        if (DateTime.TryParseExact(text, formats, CultureInfo.GetCultureInfo("vi-VN"), DateTimeStyles.None, out date))
            return true;

        if (DateTime.TryParse(text, CultureInfo.GetCultureInfo("vi-VN"), DateTimeStyles.None, out date))
            return true;

        if (double.TryParse(text, NumberStyles.Number, CultureInfo.InvariantCulture, out var serial))
        {
            try
            {
                date = DateTime.FromOADate(serial);
                return true;
            }
            catch
            {
                // ignored
            }
        }

        date = default;
        return false;
    }

    private static void ValidateImportGender(string value, List<string> warnings)
    {
        var key = NormalizeImportKey(value);
        if (key is "nam" or "male" or "m" or "nu" or "female" or "f" or "khac" or "other" or "o")
        {
            warnings.Add("Giới Tính chưa có trường lưu riêng nên không được lưu.");
            return;
        }

        warnings.Add("Giới Tính không hợp lệ nên không được lưu.");
    }

    private static void BuildCustomerExcelChrome(
        IXLWorksheet worksheet,
        string title,
        string purpose,
        string note,
        int totalRows)
    {
        var lastColumn = CustomerImportHeaders.Length;
        worksheet.Cell(1, 1).Value = "HƯƠNG VÂN TRÀ";
        worksheet.Range(1, 1, 1, lastColumn).Merge();
        worksheet.Cell(1, 1).Style.Font.Bold = true;
        worksheet.Cell(1, 1).Style.Font.FontSize = 18;
        worksheet.Cell(1, 1).Style.Font.FontColor = XLColor.FromHtml("#1F5033");

        worksheet.Cell(2, 1).Value = title;
        worksheet.Range(2, 1, 2, lastColumn).Merge();
        worksheet.Cell(2, 1).Style.Font.Bold = true;
        worksheet.Cell(2, 1).Style.Font.FontSize = 14;

        worksheet.Cell(3, 1).Value = purpose;
        worksheet.Range(3, 1, 3, lastColumn).Merge();
        worksheet.Cell(4, 1).Value = note;
        worksheet.Range(4, 1, 4, lastColumn).Merge();
        worksheet.Cell(5, 1).Value = $"Ngày tạo file: {DateTime.UtcNow.AddHours(7):dd/MM/yyyy HH:mm}" + (totalRows > 0 ? $" · Tổng số dòng: {totalRows}" : string.Empty);
        worksheet.Range(5, 1, 5, lastColumn).Merge();

        worksheet.Range(1, 1, 5, lastColumn).Style.Fill.BackgroundColor = XLColor.FromHtml("#F6F4EC");
        worksheet.Range(3, 1, 5, lastColumn).Style.Font.FontColor = XLColor.FromHtml("#414942");
    }

    private static void WriteCustomerExcelHeaders(IXLWorksheet worksheet)
    {
        for (var index = 0; index < CustomerImportHeaders.Length; index++)
        {
            var cell = worksheet.Cell(CustomerExcelHeaderRow, index + 1);
            cell.Value = CustomerImportHeaders[index];
            cell.Style.Font.Bold = true;
            cell.Style.Font.FontColor = XLColor.White;
            cell.Style.Fill.BackgroundColor = XLColor.FromHtml("#356647");
            cell.Style.Border.OutsideBorder = XLBorderStyleValues.Thin;
            cell.Style.Border.OutsideBorderColor = XLColor.FromHtml("#C1C9C0");
            cell.Style.Alignment.Vertical = XLAlignmentVerticalValues.Center;
        }
    }

    private static void ApplyCustomerExcelWorksheetLayout(IXLWorksheet worksheet)
    {
        var lastColumn = CustomerImportHeaders.Length;
        worksheet.SheetView.FreezeRows(CustomerExcelHeaderRow);
        worksheet.Range(CustomerExcelHeaderRow, 1, CustomerExcelHeaderRow, lastColumn).SetAutoFilter();

        worksheet.Column(1).Width = 18;
        worksheet.Column(2).Width = 28;
        worksheet.Column(3).Width = 18;
        worksheet.Column(4).Width = 28;
        worksheet.Column(5).Width = 20;
        worksheet.Column(6).Width = 14;
        worksheet.Column(7).Width = 36;
        worksheet.Column(8).Width = 20;
        worksheet.Column(9).Width = 18;
        worksheet.Column(10).Width = 20;
        worksheet.Column(11).Width = 18;
        worksheet.Column(12).Width = 32;

        worksheet.Column(1).Style.NumberFormat.Format = "@";
        worksheet.Column(3).Style.NumberFormat.Format = "@";
        worksheet.Column(5).Style.DateFormat.Format = "dd/MM/yyyy";
        worksheet.Column(9).Style.NumberFormat.Format = "@";
        worksheet.Column(11).Style.NumberFormat.Format = "#,##0";
        worksheet.Rows().Style.Alignment.WrapText = true;
    }

    private static void WriteCustomerExportRows(IXLWorksheet worksheet, IReadOnlyList<Customer> customers)
    {
        var rowNumber = CustomerExcelHeaderRow + 1;
        foreach (var customer in customers)
        {
            var primaryAddress = customer.Addresses?
                .Where(a => !a.IsDeleted)
                .OrderByDescending(a => a.IsDefault)
                .ThenBy(a => a.CreatedAt)
                .FirstOrDefault();

            worksheet.Cell(rowNumber, 1).Value = customer.CustomerCode;
            worksheet.Cell(rowNumber, 2).Value = customer.FullName;
            worksheet.Cell(rowNumber, 3).Value = customer.PhoneNumber;
            worksheet.Cell(rowNumber, 4).Value = customer.Email ?? string.Empty;
            worksheet.Cell(rowNumber, 5).Value = string.Empty;
            worksheet.Cell(rowNumber, 6).Value = string.Empty;
            worksheet.Cell(rowNumber, 7).Value = primaryAddress?.AddressLine ?? string.Empty;
            worksheet.Cell(rowNumber, 8).Value = FormatCustomerGroupForExcel(customer.CustomerGroup);
            worksheet.Cell(rowNumber, 9).Value = customer.TaxCode ?? string.Empty;
            worksheet.Cell(rowNumber, 10).Value = FormatCustomerSourceForExcel(customer.Source);
            worksheet.Cell(rowNumber, 11).Value = customer.TotalSpending;
            worksheet.Cell(rowNumber, 12).Value = string.Empty;
            rowNumber++;
        }

        if (customers.Count > 0)
        {
            var range = worksheet.Range(CustomerExcelHeaderRow + 1, 1, rowNumber - 1, CustomerImportHeaders.Length);
            range.Style.Border.OutsideBorder = XLBorderStyleValues.Thin;
            range.Style.Border.InsideBorder = XLBorderStyleValues.Thin;
            range.Style.Border.OutsideBorderColor = XLColor.FromHtml("#EAE8E0");
            range.Style.Border.InsideBorderColor = XLColor.FromHtml("#EAE8E0");
        }
    }

    private static IEnumerable<Customer> ApplyCustomerExportFilters(
        IEnumerable<Customer> customers,
        CustomerExportRequest request)
    {
        var result = customers;
        var activeTab = NormalizeImportKey(request.ActiveTab);
        if (activeTab is "general")
            result = result.Where(c => c.CustomerGroup == CustomerGroup.PhoThong);
        else if (activeTab is "vip")
            result = result.Where(c => c.CustomerGroup == CustomerGroup.DoiNgoai);
        else if (activeTab is "corporate")
            result = result.Where(c => c.CustomerGroup == CustomerGroup.DoanhNghiep);

        var customerType = NormalizeImportKey(request.CustomerType);
        if (!string.IsNullOrWhiteSpace(customerType))
        {
            result = customerType switch
            {
                "general" or "phothong" => result.Where(c => c.CustomerGroup == CustomerGroup.PhoThong),
                "vip" => result.Where(c => c.CustomerGroup == CustomerGroup.DoiNgoai),
                "corporate" or "doanhnghiep" => result.Where(c => c.CustomerGroup == CustomerGroup.DoanhNghiep),
                _ => result
            };
        }

        var keyword = NormalizeImportText(request.Keyword);
        if (!string.IsNullOrWhiteSpace(keyword))
        {
            var normalizedKeyword = keyword.ToLowerInvariant();
            var phoneKeyword = Regex.Replace(keyword, @"\D", string.Empty);
            result = result.Where(c =>
                c.FullName.ToLowerInvariant().Contains(normalizedKeyword) ||
                c.CustomerCode.ToLowerInvariant().Contains(normalizedKeyword) ||
                (!string.IsNullOrWhiteSpace(phoneKeyword) && c.PhoneNumber.Replace(" ", string.Empty).Contains(phoneKeyword)));
        }

        if (!string.IsNullOrWhiteSpace(request.TierCode))
        {
            var tierCode = request.TierCode.Trim();
            if (tierCode.Equals("Member", StringComparison.OrdinalIgnoreCase))
                result = result.Where(c => c.CustomerGroup == CustomerGroup.PhoThong && !c.TierId.HasValue);
            else
                result = result.Where(c => c.Tier != null && c.Tier.TierName.Equals(tierCode, StringComparison.OrdinalIgnoreCase));
        }
        else if (request.TierId.HasValue)
        {
            result = result.Where(c => c.TierId == request.TierId);
        }

        if (string.Equals(request.DebtFilter, "with_debt", StringComparison.OrdinalIgnoreCase))
            result = result.Where(c => c.CurrentDebt > 0);
        else if (string.Equals(request.DebtFilter, "no_debt", StringComparison.OrdinalIgnoreCase))
            result = result.Where(c => c.CurrentDebt <= 0);

        result = NormalizeImportKey(request.SortBy) switch
        {
            "name" => result.OrderBy(c => c.FullName),
            "spend" => result.OrderByDescending(c => c.TotalSpending),
            "debt" => result.OrderByDescending(c => c.CurrentDebt),
            _ => result.OrderByDescending(c => c.CreatedAt)
        };

        return result;
    }

    private static string FormatCustomerGroupForExcel(CustomerGroup group) =>
        group switch
        {
            CustomerGroup.DoiNgoai => "VIP",
            CustomerGroup.DoanhNghiep => "Doanh Nghiệp",
            _ => "Phổ Thông"
        };

    private static string FormatCustomerSourceForExcel(CustomerSource? source) =>
        source switch
        {
            CustomerSource.Website => "Website",
            CustomerSource.Zalo => "Zalo",
            CustomerSource.Phone => "Điện thoại",
            CustomerSource.WalkIn => "Tại cửa hàng",
            CustomerSource.Referral => "Giới thiệu",
            CustomerSource.Other => "Khác",
            _ => string.Empty
        };

    private static string NormalizeImportText(string? value) =>
        string.IsNullOrWhiteSpace(value) ? string.Empty : value.Trim().Normalize(NormalizationForm.FormC);

    private static string NormalizeImportPhone(string? value)
    {
        var text = NormalizeImportText(value);
        return string.IsNullOrWhiteSpace(text)
            ? string.Empty
            : Regex.Replace(text, @"[\s\-.]", string.Empty);
    }

    private static bool TryValidateImportPhone(string phoneNumber, out string? errorMessage)
    {
        errorMessage = null;
        if (string.IsNullOrWhiteSpace(phoneNumber))
        {
            errorMessage = "Số điện thoại là bắt buộc.";
            return false;
        }

        if (!ImportPhoneRegex.IsMatch(phoneNumber))
        {
            errorMessage = "Số điện thoại phải gồm 10 chữ số và bắt đầu bằng 0.";
            return false;
        }

        return true;
    }

    private static readonly Lazy<Dictionary<string, string>> ImportHeaderAliasMap = new(BuildImportHeaderAliasMap);

    private static Dictionary<string, string> BuildImportHeaderAliasMap()
    {
        var aliases = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

        AddImportHeaderAliases(
            aliases,
            "customerCode",
            "Mã Khách Hàng",
            "Ma Khach Hang",
            "Mã KH",
            "Ma KH",
            "Customer Code",
            "Customer Id",
            "Code");

        AddImportHeaderAliases(
            aliases,
            "fullName",
            "Họ và Tên",
            "Họ Và Tên",
            "Họ và Tên (*)",
            "Họ Và Tên (*)",
            "Ho va Ten",
            "Họ tên",
            "Ho ten",
            "Tên khách hàng",
            "Ten khach hang",
            "Full name",
            "Customer name",
            "Name");

        AddImportHeaderAliases(
            aliases,
            "phoneNumber",
            "Số Điện Thoại",
            "Số điện thoại",
            "Số Điện Thoại (*)",
            "Số điện thoại (*)",
            "So Dien Thoai",
            "SĐT",
            "SDT",
            "Điện thoại",
            "Dien thoai",
            "Phone",
            "Phone Number",
            "Mobile");

        AddImportHeaderAliases(aliases, "email", "Email");
        AddImportHeaderAliases(aliases, "birthDate", "Ngày Sinh", "Ngay Sinh", "Ngày Sinh (DD/MM/YYYY)", "Birth Date", "Date of Birth", "DOB");
        AddImportHeaderAliases(aliases, "gender", "Giới Tính", "Gioi Tinh", "Gender", "Sex");
        AddImportHeaderAliases(aliases, "addressLine", "Địa Chỉ", "Dia Chi", "Address", "Address Line");
        AddImportHeaderAliases(aliases, "customerGroup", "Nhóm Khách Hàng", "Nhom Khach Hang", "Loại Khách Hàng", "Loai Khach Hang", "Customer Group", "Customer Type", "Type");
        AddImportHeaderAliases(aliases, "taxCode", "Mã Số Thuế", "Ma So Thue", "MST", "Tax Code");
        AddImportHeaderAliases(aliases, "source", "Nguồn Khách Hàng", "Nguon Khach Hang", "Nguồn", "Nguon", "Source", "Customer Source");
        AddImportHeaderAliases(aliases, "points", "Điểm Tích Lũy", "Diem Tich Luy", "Points", "Loyalty Points");
        AddImportHeaderAliases(aliases, "note", "Ghi Chú", "Ghi Chú Đặc Điểm KH", "Ghi Chu Dac Diem KH", "Đặc Điểm KH", "Dac Diem KH", "Note", "Notes");

        return aliases;
    }

    private static void AddImportHeaderAliases(Dictionary<string, string> aliases, string fieldKey, params string[] rawAliases)
    {
        foreach (var rawAlias in rawAliases)
        {
            var key = NormalizeImportKey(rawAlias);
            if (!string.IsNullOrWhiteSpace(key) && !aliases.ContainsKey(key))
                aliases[key] = fieldKey;
        }
    }

    private static string NormalizeImportKey(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return string.Empty;

        var cleaned = RepairImportMojibakeForKey(value.Trim())
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

    private static string RepairImportMojibakeForKey(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return string.Empty;

        // Some legacy Excel/template text is UTF-8 Vietnamese decoded as Windows-1252/Latin1
        // (for example "Há» VĂ  TĂªn (*)"). Convert the common mojibake fragments to
        // ASCII base letters before building canonical header keys.
        var repaired = value;
        foreach (var (from, to) in ImportMojibakeKeyReplacements)
            repaired = repaired.Replace(from, to, StringComparison.Ordinal);

        return repaired;
    }

    private static readonly (string From, string To)[] ImportMojibakeKeyReplacements =
    [
        ("\u00C4\u0090", "D"),
        ("\u00C4\u0091", "d"),
        ("\u00C4\u2018", "d"),
        ("\u0102\u00A0", "a"),
        ("\u0102\u00A1", "a"),
        ("\u0102\u00A2", "a"),
        ("\u0102\u00A3", "a"),
        ("\u0102\u00A8", "e"),
        ("\u0102\u00A9", "e"),
        ("\u0102\u00AA", "e"),
        ("\u0102\u00AC", "i"),
        ("\u0102\u00AD", "i"),
        ("\u0102\u00B2", "o"),
        ("\u0102\u00B3", "o"),
        ("\u0102\u00B4", "o"),
        ("\u0102\u00B5", "o"),
        ("\u0102\u00B9", "u"),
        ("\u0102\u00BA", "u"),
        ("\u0102\u00BD", "y"),
        ("\u00C3\u00A0", "a"),
        ("\u00C3\u00A1", "a"),
        ("\u00C3\u00A2", "a"),
        ("\u00C3\u00A3", "a"),
        ("\u00C3\u00A8", "e"),
        ("\u00C3\u00A9", "e"),
        ("\u00C3\u00AA", "e"),
        ("\u00C3\u00AC", "i"),
        ("\u00C3\u00AD", "i"),
        ("\u00C3\u00B2", "o"),
        ("\u00C3\u00B3", "o"),
        ("\u00C3\u00B4", "o"),
        ("\u00C3\u00B5", "o"),
        ("\u00C3\u00B9", "u"),
        ("\u00C3\u00BA", "u"),
        ("\u00C3\u00BD", "y"),
        ("\u00C6\u00A0", "O"),
        ("\u00C6\u00A1", "o"),
        ("\u00C6\u00AF", "U"),
        ("\u00C6\u00B0", "u"),
        ("\u00E1\u00BA\u00A1", "a"),
        ("\u00E1\u00BA\u00A3", "a"),
        ("\u00E1\u00BA\u00A5", "a"),
        ("\u00E1\u00BA\u00A7", "a"),
        ("\u00E1\u00BA\u00A9", "a"),
        ("\u00E1\u00BA\u00AB", "a"),
        ("\u00E1\u00BA\u00AD", "a"),
        ("\u00E1\u00BA\u00AF", "a"),
        ("\u00E1\u00BA\u00B1", "a"),
        ("\u00E1\u00BA\u00B3", "a"),
        ("\u00E1\u00BA\u00B5", "a"),
        ("\u00E1\u00BA\u00B7", "a"),
        ("\u00E1\u00BA\u00B9", "e"),
        ("\u00E1\u00BA\u00BB", "e"),
        ("\u00E1\u00BA\u00BD", "e"),
        ("\u00E1\u00BA\u00BF", "e"),
        ("\u00E1\u00BB\u0081", "e"),
        ("\u00E1\u00BB\u0083", "e"),
        ("\u00E1\u00BB\u0192", "e"),
        ("\u00E1\u00BB\u0085", "e"),
        ("\u00E1\u00BB\u2026", "e"),
        ("\u00E1\u00BB\u0087", "e"),
        ("\u00E1\u00BB\u2021", "e"),
        ("\u00E1\u00BB\u0089", "i"),
        ("\u00E1\u00BB\u2030", "i"),
        ("\u00E1\u00BB\u008B", "i"),
        ("\u00E1\u00BB\u2039", "i"),
        ("\u00E1\u00BB\u008D", "o"),
        ("\u00E1\u00BB\u008F", "o"),
        ("\u00E1\u00BB\u0091", "o"),
        ("\u00E1\u00BB\u2018", "o"),
        ("\u00E1\u00BB\u0093", "o"),
        ("\u00E1\u00BB\u201C", "o"),
        ("\u00E1\u00BB\u0095", "o"),
        ("\u00E1\u00BB\u2022", "o"),
        ("\u00E1\u00BB\u0097", "o"),
        ("\u00E1\u00BB\u2014", "o"),
        ("\u00E1\u00BB\u0099", "o"),
        ("\u00E1\u00BB\u2122", "o"),
        ("\u00E1\u00BB\u009B", "o"),
        ("\u00E1\u00BB\u203A", "o"),
        ("\u00E1\u00BB\u009D", "o"),
        ("\u00E1\u00BB\u009F", "o"),
        ("\u00E1\u00BB\u00A1", "o"),
        ("\u00E1\u00BB\u00A3", "o"),
        ("\u00E1\u00BB\u00A5", "u"),
        ("\u00E1\u00BB\u00A7", "u"),
        ("\u00E1\u00BB\u00A9", "u"),
        ("\u00E1\u00BB\u00AB", "u"),
        ("\u00E1\u00BB\u00AD", "u"),
        ("\u00E1\u00BB\u00AF", "u"),
        ("\u00E1\u00BB\u00B1", "u"),
        ("\u00E1\u00BB\u00B3", "y"),
        ("\u00E1\u00BB\u00B5", "y"),
        ("\u00E1\u00BB\u00B7", "y"),
        ("\u00C5\u00A9", "u")
    ];

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
        string CustomerCode,
        string FullName,
        string PhoneNumber,
        string Email,
        string DateOfBirth,
        string Gender,
        string AddressLine,
        string CustomerGroup,
        string TaxCode,
        string Source,
        string Points,
        string Note)
    {
        public bool IsEmpty =>
            string.IsNullOrWhiteSpace(CustomerCode) &&
            string.IsNullOrWhiteSpace(FullName) &&
            string.IsNullOrWhiteSpace(PhoneNumber) &&
            string.IsNullOrWhiteSpace(Email) &&
            string.IsNullOrWhiteSpace(DateOfBirth) &&
            string.IsNullOrWhiteSpace(Gender) &&
            string.IsNullOrWhiteSpace(AddressLine) &&
            string.IsNullOrWhiteSpace(CustomerGroup) &&
            string.IsNullOrWhiteSpace(TaxCode) &&
            string.IsNullOrWhiteSpace(Source) &&
            string.IsNullOrWhiteSpace(Points) &&
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

    private async Task TryDowngradeMembershipTierAsync(Customer customer, CancellationToken ct)
    {
        if (customer.CustomerGroup != CustomerGroup.PhoThong || !customer.TierId.HasValue)
            return;

        var eligibleTier = await _tierRepo.GetTierForSpendingAsync(customer.TotalSpending, ct)
                           ?? await _tierRepo.GetDefaultTierAsync(ct);

        if (eligibleTier?.Id == customer.TierId)
            return;

        var oldName = customer.Tier?.TierName ?? "—";
        customer.TierId = eligibleTier?.Id;
        customer.Tier = eligibleTier;

        await RecordActivityAsync(
            customer.Id,
            CustomerActivityType.TierChanged,
            $"Điều chỉnh hạng sau hoàn hàng: {oldName} → {eligibleTier?.TierName ?? "Chưa có hạng"} (tổng chi tiêu {customer.TotalSpending:N0} đ)",
            ct);
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

    private static void ValidatePagination(int page, int pageSize, int maxPageSize = MaxPageSize)
    {
        var errors = new List<string>();
        if (page < 1) errors.Add("Page must be greater than or equal to 1.");
        if (pageSize < 1) errors.Add("PageSize must be greater than or equal to 1.");
        else if (pageSize > maxPageSize) errors.Add($"PageSize must be less than or equal to {maxPageSize}.");
        if (errors.Count > 0) throw new CustomerValidationException(errors);
    }

    private static string? NormalizeCheckoutSearch(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return null;

        var normalized = Regex.Replace(value.Trim(), @"\s+", " ");
        if (normalized.Length > MaxCheckoutSearchLength)
            throw new CustomerValidationException([$"Từ khóa tìm kiếm không được vượt quá {MaxCheckoutSearchLength} ký tự."]);

        return normalized;
    }

    private static string? NormalizePhoneSearch(string? value)
    {
        if (string.IsNullOrEmpty(value))
            return null;

        var digits = new string(value.Where(char.IsDigit).ToArray());
        return digits.Length > 0 ? digits : null;
    }

    private static CustomerGroup? ParseCheckoutCustomerType(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return null;

        return value.Trim().ToUpperInvariant() switch
        {
            "GENERAL" or "RETAIL" or "PHOTHONG" => CustomerGroup.PhoThong,
            "VIP" or "DOINGOAI" => CustomerGroup.DoiNgoai,
            "CORPORATE" or "DOANHNGHIEP" => CustomerGroup.DoanhNghiep,
            _ => throw new CustomerValidationException(["Loại khách hàng tìm kiếm không hợp lệ."])
        };
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

    private async Task<bool> ReconcileCurrentDebtFromLedgerAsync(Customer customer, CancellationToken ct)
    {
        var ledgerBalance = await _debtRepo.GetLedgerBalanceAsync(customer.Id, ct);
        if (customer.CurrentDebt == ledgerBalance)
            return false;

        customer.CurrentDebt = ledgerBalance;
        customer.UpdatedAt = DateTime.UtcNow;
        _customerRepo.Update(customer);
        return true;
    }

    private static CustomerResponse MapToResponse(Customer c) =>
        new(c.Id, c.CustomerCode, c.FullName, c.PhoneNumber, c.Email, c.CustomerGroup, c.TaxCode,
            c.TierId, c.Tier?.TierName, c.TotalSpending, c.CurrentDebt,
            c.AssignedSaleId, c.Source, c.Department, c.CreatedAt, c.UpdatedAt);

    private static CheckoutCustomerSearchResponse MapToCheckoutSearchResponse(Customer c) =>
        new(c.Id, c.CustomerCode, c.FullName, c.PhoneNumber, c.CustomerGroup,
            c.TierId, c.Tier?.TierName, c.Tier?.DiscountPercent ?? 0, c.CurrentDebt);

    private static CustomerDetailResponse MapToDetailResponse(Customer c) =>
        new(c.Id, c.CustomerCode, c.FullName, c.PhoneNumber, c.Email, c.CustomerGroup, c.TaxCode,
            c.Tier == null ? null : new CustomerTierResponse(c.Tier.Id, c.Tier.TierName,
                c.Tier.MinSpendingThreshold, c.Tier.DiscountPercent, c.Tier.ValidityMonths),
            c.TotalSpending, c.CurrentDebt, c.AssignedSaleId, c.Source, c.Department,
            c.Addresses.Where(a => !a.IsDeleted).Select(a => new CustomerAddressResponse(a.Id, a.CustomerId, a.ReceiverName,
                a.ReceiverPhone, a.AddressLine, a.Ward, a.District, a.Province, a.IsDefault)),
            c.CreatedAt, c.UpdatedAt);
}
