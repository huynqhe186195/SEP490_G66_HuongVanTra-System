using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using ProductService.Application.DTOs.Requests;
using ProductService.Application.DTOs.Responses;
using ProductService.Application.UseCases;
using ProductService.Application.Validation;
using ProductService.Domain.Entities;
using ProductService.Domain.Enums;
using ProductService.Domain.Exceptions;
using ProductService.Infrastructure.Data;

namespace ProductService.Infrastructure.UseCases;

public class ProductApprovalLogic(ProductDbContext _db, ProductLogic _productLogic)
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    public async Task<PagedResponse<NewProductApprovalResponse>> GetPagedAsync(GetProductApprovalRequestsRequest request, CancellationToken ct = default)
    {
        request ??= new GetProductApprovalRequestsRequest(null, null);
        ProductInputValidator.ValidatePagination(request.Page, request.PageSize);

        var query = _db.NewProductApprovalRequests.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(request.Status)
            && !string.Equals(request.Status, "all", StringComparison.OrdinalIgnoreCase))
        {
            var status = ParseStatus(request.Status);
            query = query.Where(x => x.Status == status);
        }

        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            var search = request.Search.Trim().ToLower();
            query = query.Where(x =>
                x.ApprovalCode.ToLower().Contains(search)
                || x.ProductName.ToLower().Contains(search)
                || (x.AdminNotes != null && x.AdminNotes.ToLower().Contains(search)));
        }

        var total = await query.CountAsync(ct);
        var items = await query
            .OrderByDescending(x => x.CreatedAt)
            .ThenBy(x => x.ProductName)
            .Skip((request.Page - 1) * request.PageSize)
            .Take(request.PageSize)
            .ToListAsync(ct);

        return new PagedResponse<NewProductApprovalResponse>(
            items.Select(MapToResponse).ToList(),
            request.Page,
            request.PageSize,
            total,
            (int)Math.Ceiling((double)total / request.PageSize));
    }

    public async Task<NewProductApprovalResponse> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        var approval = await _db.NewProductApprovalRequests.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct)
            ?? throw new ProductValidationException("Không tìm thấy biên bản phê duyệt sản phẩm.");
        return MapToResponse(approval);
    }

    public async Task<NewProductApprovalResponse> CreateAsync(CreateNewProductApprovalRequest request, ProductApprovalActorSnapshot actor, CancellationToken ct = default)
    {
        if (request?.Product is null)
            throw new ProductValidationException("Thông tin sản phẩm cần phê duyệt là bắt buộc.");

        var now = DateTime.UtcNow;
        var product = request.Product;
        var approval = new NewProductApprovalRequest
        {
            ApprovalCode = await GenerateApprovalCodeAsync(ct),
            Status = NewProductApprovalStatus.Draft,
            ProductSnapshotJson = SerializeProduct(product),
            ProductName = NormalizeRequired(product.Name, "Tên sản phẩm trong biên bản là bắt buộc."),
            ProductType = NormalizeText(product.ProductType) ?? ProductType.THANH_PHAM.ToString(),
            CategoryId = product.CategoryId > 0 ? product.CategoryId : null,
            InitialPrice = ResolveInitialPrice(product),
            RequestedBy = NormalizeActorId(actor),
            RequestedByName = NormalizeText(actor.FullName),
            RequestedByRoleName = NormalizeText(actor.RoleName),
            RequestedAt = now,
            AdminNotes = NormalizeText(request.AdminNotes),
            CreatedAt = now
        };

        _db.NewProductApprovalRequests.Add(approval);
        await _db.SaveChangesAsync(ct);
        return MapToResponse(approval);
    }

    public async Task<NewProductApprovalResponse> AuthorizeAsync(Guid id, AuthorizeProductApprovalRequest request, ProductApprovalActorSnapshot actor, CancellationToken ct = default)
    {
        var approval = await GetTrackedAsync(id, ct);
        if (approval.Status is NewProductApprovalStatus.Completed or NewProductApprovalStatus.Cancelled or NewProductApprovalStatus.Rejected)
            throw new ProductValidationException("Biên bản này không còn đủ điều kiện cấp mã phê duyệt.");

        var now = DateTime.UtcNow;
        approval.Status = NewProductApprovalStatus.AwaitingWarehouseConfirmation;
        approval.AuthorisedBy = NormalizeActorId(actor);
        approval.AuthorisedByName = NormalizeText(actor.FullName);
        approval.AuthorisedByRoleName = NormalizeText(actor.RoleName);
        approval.AuthorisedAt = now;
        approval.UpdatedAt = now;
        approval.AdminNotes = MergeNote(approval.AdminNotes, request?.AdminNotes);

        await _db.SaveChangesAsync(ct);
        return MapToResponse(approval);
    }

    public async Task<NewProductApprovalResponse> CancelAsync(Guid id, CancelProductApprovalRequest request, ProductApprovalActorSnapshot actor, CancellationToken ct = default)
    {
        var reason = NormalizeRequired(request?.Reason, "Lý do hủy mã phê duyệt là bắt buộc.");
        var approval = await GetTrackedAsync(id, ct);
        if (approval.Status == NewProductApprovalStatus.Completed)
            throw new ProductValidationException("Không thể hủy biên bản đã hoàn tất tạo sản phẩm.");

        var now = DateTime.UtcNow;
        approval.Status = NewProductApprovalStatus.Cancelled;
        approval.CancelledBy = NormalizeActorId(actor);
        approval.CancelledByName = NormalizeText(actor.FullName);
        approval.CancelledByRoleName = NormalizeText(actor.RoleName);
        approval.CancelledAt = now;
        approval.CancelReason = reason;
        approval.UpdatedAt = now;

        await _db.SaveChangesAsync(ct);
        return MapToResponse(approval);
    }

    public async Task<ProductApprovalCodeValidationResponse> ValidateCodeAsync(ValidateProductApprovalCodeRequest request, CancellationToken ct = default)
    {
        var approval = await FindByCodeAsync(request?.ApprovalCode, asTracking: false, ct);
        if (approval is null)
            return new ProductApprovalCodeValidationResponse(false, "Mã phê duyệt không tồn tại.", null);

        var invalidReason = GetInvalidUseReason(approval);
        if (invalidReason is not null)
            return new ProductApprovalCodeValidationResponse(false, invalidReason, MapToResponse(approval));

        return new ProductApprovalCodeValidationResponse(true, null, MapToResponse(approval));
    }

    public async Task<ProductApprovalCreationResponse> CreateAutomaticAsync(CreateProductFromApprovalRequest request, ProductApprovalActorSnapshot actor, CancellationToken ct = default)
    {
        var approval = await FindByCodeAsync(request?.ApprovalCode, asTracking: true, ct)
            ?? throw new ProductValidationException("Mã phê duyệt không tồn tại.");
        EnsureCanUse(approval);

        var productRequest = DeserializeProduct(approval.ProductSnapshotJson);
        return await CompleteCreationAsync(approval, productRequest, ProductCreationMethod.Automatic, null, null, actor, ct);
    }

    public async Task<ProductApprovalCreationResponse> CreateManualAsync(CreateProductManualFromApprovalRequest request, ProductApprovalActorSnapshot actor, CancellationToken ct = default)
    {
        var reason = NormalizeRequired(request?.ManualModeReason, "Lý do nhập thủ công là bắt buộc.");
        if (request?.Product is null)
            throw new ProductValidationException("Thông tin sản phẩm nhập thủ công là bắt buộc.");

        var approval = await FindByCodeAsync(request.ApprovalCode, asTracking: true, ct)
            ?? throw new ProductValidationException("Mã phê duyệt không tồn tại.");
        EnsureCanUse(approval);

        return await CompleteCreationAsync(
            approval,
            request.Product,
            ProductCreationMethod.Manual,
            reason,
            NormalizeText(request.WarehouseNotes),
            actor,
            ct);
    }

    private async Task<ProductApprovalCreationResponse> CompleteCreationAsync(
        NewProductApprovalRequest approval,
        CreateProductRequest productRequest,
        ProductCreationMethod method,
        string? manualReason,
        string? warehouseNotes,
        ProductApprovalActorSnapshot actor,
        CancellationToken ct)
    {
        await using var tx = await _db.Database.BeginTransactionAsync(ct);
        var created = await _productLogic.CreateAsync(productRequest);

        var now = DateTime.UtcNow;
        approval.Status = NewProductApprovalStatus.Completed;
        approval.CreationMethod = method;
        approval.ManualModeReason = manualReason;
        approval.WarehouseNotes = warehouseNotes;
        approval.UsedAt = now;
        approval.ConfirmedBy = NormalizeActorId(actor);
        approval.ConfirmedByName = NormalizeText(actor.FullName);
        approval.ConfirmedByRoleName = NormalizeText(actor.RoleName);
        approval.ConfirmedAt = now;
        approval.CreatedProductId = created.Id;
        approval.CreatedSkuIdsJson = JsonSerializer.Serialize(created.Variants.Select(v => v.Id).ToList(), JsonOptions);
        approval.CreatedBomIdsJson = JsonSerializer.Serialize(
            created.Variants
                .SelectMany(v => v.BomLines.Select(b => new { v.Id, b.MaterialId }))
                .ToList(),
            JsonOptions);
        approval.FinalProductSnapshotJson = SerializeProduct(productRequest);
        approval.UpdatedAt = now;

        await _db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);

        return new ProductApprovalCreationResponse(MapToResponse(approval), created);
    }

    private async Task<NewProductApprovalRequest> GetTrackedAsync(Guid id, CancellationToken ct)
    {
        return await _db.NewProductApprovalRequests.FirstOrDefaultAsync(x => x.Id == id, ct)
            ?? throw new ProductValidationException("Không tìm thấy biên bản phê duyệt sản phẩm.");
    }

    private async Task<NewProductApprovalRequest?> FindByCodeAsync(string? approvalCode, bool asTracking, CancellationToken ct)
    {
        var code = NormalizeText(approvalCode)?.ToUpperInvariant();
        if (string.IsNullOrWhiteSpace(code)) return null;

        var query = asTracking
            ? _db.NewProductApprovalRequests.AsQueryable()
            : _db.NewProductApprovalRequests.AsNoTracking();

        return await query.FirstOrDefaultAsync(x => x.ApprovalCode == code, ct);
    }

    private static void EnsureCanUse(NewProductApprovalRequest approval)
    {
        var reason = GetInvalidUseReason(approval);
        if (reason is not null)
            throw new ProductValidationException(reason);
    }

    private static string? GetInvalidUseReason(NewProductApprovalRequest approval)
    {
        return approval.Status switch
        {
            NewProductApprovalStatus.AwaitingWarehouseConfirmation when approval.UsedAt is null && approval.CreatedProductId is null => null,
            NewProductApprovalStatus.Draft => "Mã phê duyệt chưa được Admin xác nhận.",
            NewProductApprovalStatus.Completed => "Mã phê duyệt đã được sử dụng.",
            NewProductApprovalStatus.Cancelled => "Mã phê duyệt đã bị hủy.",
            NewProductApprovalStatus.Rejected => "Biên bản phê duyệt đã bị từ chối.",
            NewProductApprovalStatus.Expired => "Mã phê duyệt đã hết hạn.",
            _ => "Mã phê duyệt không còn hiệu lực."
        };
    }

    private async Task<string> GenerateApprovalCodeAsync(CancellationToken ct)
    {
        for (var i = 0; i < 20; i++)
        {
            var code = $"NPA-{DateTime.UtcNow:yyyyMMdd}-{RandomNumberGenerator.GetInt32(100000, 999999)}";
            if (!await _db.NewProductApprovalRequests.AnyAsync(x => x.ApprovalCode == code, ct))
                return code;
        }

        throw new ProductValidationException("Không thể tạo mã phê duyệt duy nhất. Vui lòng thử lại.");
    }

    private static NewProductApprovalStatus ParseStatus(string? value)
    {
        if (Enum.TryParse<NewProductApprovalStatus>(value, ignoreCase: true, out var status))
            return status;

        throw new ProductValidationException("Trạng thái biên bản phê duyệt không hợp lệ.");
    }

    private static string SerializeProduct(CreateProductRequest product) =>
        JsonSerializer.Serialize(product, JsonOptions);

    private static CreateProductRequest DeserializeProduct(string json) =>
        JsonSerializer.Deserialize<CreateProductRequest>(json, JsonOptions)
        ?? throw new ProductValidationException("Snapshot sản phẩm trong biên bản không hợp lệ.");

    private static Guid? NormalizeActorId(ProductApprovalActorSnapshot actor) =>
        actor.UserId.HasValue && actor.UserId.Value != Guid.Empty ? actor.UserId.Value : null;

    private static string? NormalizeText(string? value)
    {
        var text = value?.Trim();
        return string.IsNullOrWhiteSpace(text) ? null : text;
    }

    private static string NormalizeRequired(string? value, string message) =>
        NormalizeText(value) ?? throw new ProductValidationException(message);

    private static decimal? ResolveInitialPrice(CreateProductRequest product)
    {
        var variantPrice = product.Variants?.FirstOrDefault()?.RetailPrice;
        if (variantPrice.HasValue) return variantPrice.Value;

        return product.Units?.FirstOrDefault(unit => unit.IsBaseUnit)?.Price
            ?? product.Units?.FirstOrDefault()?.Price;
    }

    private static string? MergeNote(string? current, string? addition)
    {
        var next = NormalizeText(addition);
        if (next is null) return current;
        var existing = NormalizeText(current);
        return existing is null ? next : $"{existing}\n{next}";
    }

    private static List<Guid> ParseGuidList(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return [];
        return JsonSerializer.Deserialize<List<Guid>>(json, JsonOptions) ?? [];
    }

    private static CreateProductRequest? TryDeserializeProduct(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return null;
        try
        {
            return DeserializeProduct(json);
        }
        catch
        {
            return null;
        }
    }

    private static NewProductApprovalResponse MapToResponse(NewProductApprovalRequest x) => new(
        x.Id,
        x.ApprovalCode,
        x.Status.ToString(),
        TryDeserializeProduct(x.ProductSnapshotJson),
        TryDeserializeProduct(x.FinalProductSnapshotJson),
        x.ProductName,
        x.ProductType,
        x.CategoryId,
        x.InitialPrice,
        x.RequestedBy,
        x.RequestedByName,
        x.RequestedByRoleName,
        x.RequestedAt,
        x.AuthorisedBy,
        x.AuthorisedByName,
        x.AuthorisedByRoleName,
        x.AuthorisedAt,
        x.ConfirmedBy,
        x.ConfirmedByName,
        x.ConfirmedByRoleName,
        x.ConfirmedAt,
        x.CancelledBy,
        x.CancelledByName,
        x.CancelledByRoleName,
        x.CancelledAt,
        x.CancelReason,
        x.CreationMethod?.ToString(),
        x.ManualModeReason,
        x.UsedAt,
        x.CreatedProductId,
        ParseGuidList(x.CreatedSkuIdsJson),
        x.AdminNotes,
        x.WarehouseNotes,
        x.CreatedAt,
        x.UpdatedAt);
}

