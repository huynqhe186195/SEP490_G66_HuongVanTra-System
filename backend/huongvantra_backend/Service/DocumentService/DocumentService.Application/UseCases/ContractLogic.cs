using DocumentService.Application.DTOs.Requests;
using DocumentService.Application.DTOs.Responses;
using DocumentService.Application.Interfaces;
using DocumentService.Domain.Entities;
using DocumentService.Domain.Enums;
using DocumentService.Domain.Exceptions;

namespace DocumentService.Application.UseCases;

public sealed record DocumentAccessContext(Guid UserId, bool IsAdmin);

public class ContractLogic
{
    private const int MaxPageSize = 100;

    private readonly IContractRepository _contractRepo;
    private readonly ICustomerCatalogClient _customerClient;

    public ContractLogic(IContractRepository contractRepo, ICustomerCatalogClient customerClient)
    {
        _contractRepo = contractRepo;
        _customerClient = customerClient;
    }

    public async Task<ContractPagedResponse> GetPagedAsync(
        string? search,
        Guid? customerId,
        string? statusStr,
        int page,
        int pageSize,
        DocumentAccessContext access,
        CancellationToken ct = default)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, MaxPageSize);

        ContractStatus? status = ParseStatus(statusStr);
        Guid? filterByOwner = access.IsAdmin ? null : access.UserId;

        var (items, total) = await _contractRepo.GetPagedAsync(
            search, customerId, status, filterByOwner, page, pageSize, ct);

        return new ContractPagedResponse(
            items.Select(MapToResponse).ToList(),
            page, pageSize, total,
            (int)Math.Ceiling((double)total / pageSize));
    }

    public async Task<ContractResponse> GetByIdAsync(Guid id, DocumentAccessContext access, CancellationToken ct = default)
    {
        var contract = await _contractRepo.GetByIdAsync(id, ct)
            ?? throw new ContractNotFoundException(id);

        EnsureCanView(contract, access);
        return MapToResponse(contract);
    }

    public async Task<ContractResponse> CreateAsync(CreateContractRequest request, DocumentAccessContext access, CancellationToken ct = default)
    {
        ValidateContractFields(request.Title, request.EffectiveDate, request.ExpiryDate,
            request.DiscountPercent, request.CreditLimit, request.PaymentTermDays, request.Notes);

        if (request.CustomerId == Guid.Empty)
            throw new ContractValidationException("Khách hàng không hợp lệ.");

        var customer = await _customerClient.GetCustomerAsync(request.CustomerId, ct)
            ?? throw new ContractValidationException("Không tìm thấy khách hàng.");

        if (!customer.IsDoanhNghiep)
            throw new ContractValidationException("Hợp đồng chỉ có thể được tạo cho khách doanh nghiệp.");

        var code = await _contractRepo.GenerateNextContractCodeAsync(ct);

        var contract = new Contract
        {
            Id = Guid.NewGuid(),
            ContractCode = code,
            CustomerId = request.CustomerId,
            CustomerName = customer.FullName,
            CustomerCode = customer.CustomerCode,
            CreatedByUserId = access.UserId,
            Title = request.Title.Trim(),
            ContractType = request.ContractType,
            Status = ContractStatus.Draft,
            EffectiveDate = request.EffectiveDate,
            ExpiryDate = request.ExpiryDate,
            DiscountPercent = request.DiscountPercent,
            CreditLimit = request.CreditLimit,
            PaymentTermDays = request.PaymentTermDays,
            Notes = request.Notes?.Trim(),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        await _contractRepo.AddAsync(contract, ct);
        await _contractRepo.SaveChangesAsync(ct);

        var created = await _contractRepo.GetByIdAsync(contract.Id, ct) ?? contract;
        return MapToResponse(created);
    }

    public async Task<ContractResponse> UpdateAsync(Guid id, UpdateContractRequest request, DocumentAccessContext access, CancellationToken ct = default)
    {
        var contract = await _contractRepo.GetByIdAsync(id, ct)
            ?? throw new ContractNotFoundException(id);

        EnsureIsOwner(contract, access);
        EnsureIsDraft(contract);

        ValidateContractFields(request.Title, request.EffectiveDate, request.ExpiryDate,
            request.DiscountPercent, request.CreditLimit, request.PaymentTermDays, request.Notes);

        contract.Title = request.Title.Trim();
        contract.ContractType = request.ContractType;
        contract.EffectiveDate = request.EffectiveDate;
        contract.ExpiryDate = request.ExpiryDate;
        contract.DiscountPercent = request.DiscountPercent;
        contract.CreditLimit = request.CreditLimit;
        contract.PaymentTermDays = request.PaymentTermDays;
        contract.Notes = request.Notes?.Trim();
        contract.UpdatedAt = DateTime.UtcNow;

        _contractRepo.Update(contract);
        await _contractRepo.SaveChangesAsync(ct);

        var updated = await _contractRepo.GetByIdAsync(id, ct) ?? contract;
        return MapToResponse(updated);
    }

    public async Task<ContractResponse> SubmitAsync(Guid id, DocumentAccessContext access, CancellationToken ct = default)
    {
        var contract = await _contractRepo.GetByIdAsync(id, ct)
            ?? throw new ContractNotFoundException(id);

        EnsureIsOwner(contract, access);
        EnsureIsDraft(contract);

        contract.Status = ContractStatus.PendingApproval;
        contract.SubmittedAt = DateTime.UtcNow;
        contract.UpdatedAt = DateTime.UtcNow;

        _contractRepo.Update(contract);
        await _contractRepo.SaveChangesAsync(ct);

        var updated = await _contractRepo.GetByIdAsync(id, ct) ?? contract;
        return MapToResponse(updated);
    }

    public async Task<ContractResponse> ReviewAsync(Guid id, ReviewContractRequest request, DocumentAccessContext access, CancellationToken ct = default)
    {
        if (!access.IsAdmin)
            throw new ContractForbiddenException("Chỉ Admin mới có quyền phán quyết hợp đồng.");

        var contract = await _contractRepo.GetByIdAsync(id, ct)
            ?? throw new ContractNotFoundException(id);

        if (contract.Status != ContractStatus.PendingApproval)
            throw new ContractValidationException("Chỉ có thể duyệt hợp đồng đang ở trạng thái Chờ duyệt.");

        if (request.Approved)
        {
            contract.Status = ContractStatus.Active;
            contract.RejectionNote = null;
        }
        else
        {
            if (string.IsNullOrWhiteSpace(request.RejectionNote))
                throw new ContractValidationException("Lý do từ chối là bắt buộc khi không duyệt hợp đồng.");

            var trimmedNote = request.RejectionNote.Trim();
            if (trimmedNote.Length < 10)
                throw new ContractValidationException("Lý do từ chối phải có ít nhất 10 ký tự.");
            if (trimmedNote.Length > 1000)
                throw new ContractValidationException("Lý do từ chối không được vượt quá 1000 ký tự.");

            contract.Status = ContractStatus.Draft;
            contract.RejectionNote = trimmedNote;
        }

        contract.ReviewedAt = DateTime.UtcNow;
        contract.UpdatedAt = DateTime.UtcNow;

        _contractRepo.Update(contract);
        await _contractRepo.SaveChangesAsync(ct);

        var updated = await _contractRepo.GetByIdAsync(id, ct) ?? contract;
        return MapToResponse(updated);
    }

    public async Task DeleteAsync(Guid id, DocumentAccessContext access, CancellationToken ct = default)
    {
        var contract = await _contractRepo.GetByIdAsync(id, ct)
            ?? throw new ContractNotFoundException(id);

        EnsureIsOwner(contract, access);
        EnsureIsDraft(contract);

        contract.IsDeleted = true;
        contract.UpdatedAt = DateTime.UtcNow;

        _contractRepo.Update(contract);
        await _contractRepo.SaveChangesAsync(ct);
    }

    private static void ValidateContractFields(
        string? title,
        DateOnly? effectiveDate,
        DateOnly? expiryDate,
        decimal? discountPercent,
        decimal? creditLimit,
        int? paymentTermDays,
        string? notes)
    {
        var errs = new List<string>();

        var trimmedTitle = title?.Trim() ?? string.Empty;
        if (string.IsNullOrEmpty(trimmedTitle))
            errs.Add("Tiêu đề hợp đồng là bắt buộc.");
        else if (trimmedTitle.Length < 5)
            errs.Add("Tiêu đề hợp đồng phải có ít nhất 5 ký tự.");
        else if (trimmedTitle.Length > 200)
            errs.Add("Tiêu đề hợp đồng không được vượt quá 200 ký tự.");

        if (effectiveDate.HasValue && expiryDate.HasValue && expiryDate.Value <= effectiveDate.Value)
            errs.Add("Ngày hết hạn phải sau ngày hiệu lực.");

        if (effectiveDate.HasValue && effectiveDate.Value < DateOnly.FromDateTime(DateTime.UtcNow.Date).AddYears(-10))
            errs.Add("Ngày hiệu lực không hợp lệ.");

        if (discountPercent.HasValue)
        {
            if (discountPercent.Value < 0 || discountPercent.Value > 100)
                errs.Add("Chiết khấu phải trong khoảng 0–100%.");
            if (Math.Round(discountPercent.Value, 2) != discountPercent.Value)
                errs.Add("Chiết khấu tối đa 2 chữ số thập phân.");
        }

        if (creditLimit.HasValue)
        {
            if (creditLimit.Value < 0)
                errs.Add("Hạn mức công nợ không được âm.");
            if (creditLimit.Value > 10_000_000_000m)
                errs.Add("Hạn mức công nợ không được vượt quá 10 tỷ đồng.");
            if (Math.Round(creditLimit.Value, 2) != creditLimit.Value)
                errs.Add("Hạn mức công nợ tối đa 2 chữ số thập phân.");
        }

        if (paymentTermDays.HasValue)
        {
            if (paymentTermDays.Value <= 0)
                errs.Add("Kỳ hạn thanh toán phải lớn hơn 0 ngày.");
            if (paymentTermDays.Value > 365)
                errs.Add("Kỳ hạn thanh toán không được vượt quá 365 ngày.");
        }

        if (!string.IsNullOrEmpty(notes) && notes.Length > 4000)
            errs.Add("Ghi chú không được vượt quá 4000 ký tự.");

        if (errs.Count > 0)
            throw new ContractValidationException(string.Join(" ", errs));
    }

    private static void EnsureCanView(Contract contract, DocumentAccessContext access)
    {
        if (access.IsAdmin) return;
        if (contract.CreatedByUserId == access.UserId) return;
        throw new ContractForbiddenException("Bạn không có quyền xem hợp đồng này.");
    }

    private static void EnsureIsOwner(Contract contract, DocumentAccessContext access)
    {
        if (contract.CreatedByUserId != access.UserId)
            throw new ContractForbiddenException("Chỉ người tạo hợp đồng mới có quyền thực hiện thao tác này.");
    }

    private static void EnsureIsDraft(Contract contract)
    {
        if (contract.Status != ContractStatus.Draft)
            throw new ContractValidationException("Hợp đồng đã bị khóa. Chỉ có thể chỉnh sửa khi ở trạng thái Nháp.");
    }

    private static ContractStatus? ParseStatus(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null
        : Enum.TryParse<ContractStatus>(value, ignoreCase: true, out var result) ? result : null;

    private static ContractResponse MapToResponse(Contract c) => new(
        c.Id,
        c.ContractCode,
        c.CustomerId,
        c.CustomerName,
        c.CustomerCode,
        c.CreatedByUserId,
        c.Title,
        c.ContractType.ToString(),
        c.Status.ToString(),
        c.EffectiveDate,
        c.ExpiryDate,
        c.DiscountPercent,
        c.CreditLimit,
        c.PaymentTermDays,
        c.Notes,
        c.RejectionNote,
        c.SubmittedAt,
        c.ReviewedAt,
        c.CreatedAt,
        c.UpdatedAt);
}
