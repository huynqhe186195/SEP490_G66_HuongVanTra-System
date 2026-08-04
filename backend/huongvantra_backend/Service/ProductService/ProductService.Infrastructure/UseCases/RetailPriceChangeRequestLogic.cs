using System.Security.Cryptography;
using Microsoft.EntityFrameworkCore;
using ProductService.Application.DTOs.Requests;
using ProductService.Application.DTOs.Responses;
using ProductService.Application.Interfaces;
using ProductService.Application.Validation;
using ProductService.Domain.Entities;
using ProductService.Domain.Enums;
using ProductService.Domain.Exceptions;
using ProductService.Infrastructure.Data;

namespace ProductService.Infrastructure.UseCases;

public class RetailPriceChangeRequestLogic(
    ProductDbContext _db,
    IAdminNotificationSender _adminNotificationSender)
{
    public async Task<PagedResponse<RetailPriceChangeRequestResponse>> GetPagedAsync(
        GetRetailPriceChangeRequestsRequest request,
        ProductApprovalActorSnapshot actor,
        CancellationToken ct = default)
    {
        request ??= new GetRetailPriceChangeRequestsRequest(null, null);
        ProductInputValidator.ValidatePagination(request.Page, request.PageSize);

        var query = _db.RetailPriceChangeRequests.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(request.Status)
            && !string.Equals(request.Status, "all", StringComparison.OrdinalIgnoreCase))
        {
            var status = ParseStatus(request.Status);
            query = query.Where(x => x.Status == status);
        }

        if (request.MineOnly)
        {
            var actorId = NormalizeActorId(actor);
            if (actorId.HasValue)
                query = query.Where(x => x.CreatedBy == actorId.Value);
        }

        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            var search = request.Search.Trim().ToLower();
            query = query.Where(x =>
                x.RequestCode.ToLower().Contains(search)
                || x.SkuCode.ToLower().Contains(search)
                || x.ProductName.ToLower().Contains(search)
                || x.VariantName.ToLower().Contains(search));
        }

        var total = await query.CountAsync(ct);
        var items = await query
            .OrderByDescending(x => x.CreatedAt)
            .Skip((request.Page - 1) * request.PageSize)
            .Take(request.PageSize)
            .ToListAsync(ct);

        return new PagedResponse<RetailPriceChangeRequestResponse>(
            items.Select(MapToResponse).ToList(),
            request.Page,
            request.PageSize,
            total,
            (int)Math.Ceiling((double)total / request.PageSize));
    }

    public async Task<RetailPriceChangeRequestResponse> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        var entity = await _db.RetailPriceChangeRequests.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == id, ct)
            ?? throw new ProductValidationException("Không tìm thấy yêu cầu đổi giá bán.");

        return MapToResponse(entity);
    }

    public async Task<RetailPriceChangeRequestResponse> CreateAsync(
        CreateRetailPriceChangeRequest request,
        ProductApprovalActorSnapshot actor,
        CancellationToken ct = default)
    {
        if (request is null)
            throw new ProductValidationException("Request body là bắt buộc.");
        if (request.SkuId == Guid.Empty)
            throw new ProductValidationException("SkuId không hợp lệ.");
        if (request.RequestedRetailPrice <= 0)
            throw new ProductValidationException("Giá bán đề xuất phải lớn hơn 0.");

        var requestedPrice = Math.Round(request.RequestedRetailPrice, 2, MidpointRounding.AwayFromZero);

        var variant = await _db.ProductVariants.AsNoTracking()
            .Include(item => item.Product)
            .FirstOrDefaultAsync(item => item.Id == request.SkuId, ct)
            ?? throw new ProductSkuNotFoundException(request.SkuId);

        if (variant.RetailPrice == requestedPrice)
            throw new ProductValidationException("Giá bán đề xuất trùng với giá bán hiện tại.");

        var hasPending = await _db.RetailPriceChangeRequests
            .AnyAsync(x => x.SkuId == request.SkuId
                && x.Status == RetailPriceChangeRequestStatus.PendingApproval, ct);
        if (hasPending)
            throw new ProductValidationException("Hàng hóa này đã có một yêu cầu đổi giá bán đang chờ phê duyệt.");

        var entity = new RetailPriceChangeRequest
        {
            Id = Guid.NewGuid(),
            RequestCode = await GenerateRequestCodeAsync(ct),
            Status = RetailPriceChangeRequestStatus.PendingApproval,
            SkuId = variant.Id,
            SkuCode = variant.SkuCode,
            ProductName = variant.Product.Name,
            VariantName = variant.VariantName,
            CurrentRetailPrice = variant.RetailPrice,
            RequestedRetailPrice = requestedPrice,
            AverageCostPriceAtRequest = CalculateAverageCost(variant),
            Reason = NormalizeText(request.Reason),
            CreatedBy = NormalizeActorId(actor),
            CreatedByName = NormalizeText(actor.FullName),
            CreatedByRoleName = NormalizeText(actor.RoleName),
            CreatedAt = DateTime.UtcNow
        };

        _db.RetailPriceChangeRequests.Add(entity);
        _db.Notifications.Add(BuildAdminNotification(entity));
        await _db.SaveChangesAsync(ct);

        await _adminNotificationSender.SendAsync(
            $"[Hương Vân Trà] Yêu cầu đổi giá bán {entity.RequestCode} chờ phê duyệt",
            BuildAdminEmailBody(entity),
            ct);

        return MapToResponse(entity);
    }

    public async Task<RetailPriceChangeRequestResponse> ApproveAsync(
        Guid id,
        ApproveRetailPriceChangeRequest request,
        ProductApprovalActorSnapshot actor,
        CancellationToken ct = default)
    {
        RetailPriceChangeRequest? entity = null;

        var strategy = _db.Database.CreateExecutionStrategy();
        await strategy.ExecuteAsync(async () =>
        {
            await using var transaction = await _db.Database.BeginTransactionAsync(ct);
            try
            {
                entity = await _db.RetailPriceChangeRequests
                    .FirstOrDefaultAsync(x => x.Id == id, ct)
                    ?? throw new ProductValidationException("Không tìm thấy yêu cầu đổi giá bán.");

                EnsureAdminCanDecide(entity);

                var variant = await _db.ProductVariants
                    .FirstOrDefaultAsync(item => item.Id == entity.SkuId, ct)
                    ?? throw new ProductSkuNotFoundException(entity.SkuId);

                var appliedAt = DateTime.UtcNow;
                var oldRetailPrice = variant.RetailPrice;

                if (oldRetailPrice != entity.RequestedRetailPrice)
                {
                    // Chỉ RetailPrice được đổi. CostPrice do luồng phiếu nhập sở hữu.
                    variant.RetailPrice = entity.RequestedRetailPrice;
                    variant.UpdatedAt = appliedAt;
                    var history = RetailPriceHistoryFactory.TryCreate(
                        variant.Id,
                        oldRetailPrice,
                        entity.RequestedRetailPrice,
                        NormalizeActorId(actor),
                        NormalizeText(actor.FullName),
                        RetailPriceHistoryFactory.SourceApprovedPriceChangeRequest,
                        note: entity.RequestCode,
                        changedAtUtc: appliedAt);
                    if (history is not null)
                        _db.ProductRetailPriceHistories.Add(history);
                }

                entity.Status = RetailPriceChangeRequestStatus.Approved;
                entity.ReviewedBy = NormalizeActorId(actor);
                entity.ReviewedByName = NormalizeText(actor.FullName);
                entity.ReviewedByRoleName = NormalizeText(actor.RoleName);
                entity.ReviewedAt = appliedAt;
                entity.AdminNote = MergeNote(entity.AdminNote, request?.AdminNote);
                entity.AppliedRetailPrice = entity.RequestedRetailPrice;
                entity.AppliedAt = appliedAt;
                entity.UpdatedAt = appliedAt;

                if (entity.CreatedBy.HasValue)
                    _db.Notifications.Add(BuildDecisionNotification(entity, approved: true));

                await _db.SaveChangesAsync(ct);
                await transaction.CommitAsync(ct);
            }
            catch
            {
                await transaction.RollbackAsync(ct);
                throw;
            }
        });

        return MapToResponse(entity!);
    }

    public async Task<RetailPriceChangeRequestResponse> RejectAsync(
        Guid id,
        RejectRetailPriceChangeRequest request,
        ProductApprovalActorSnapshot actor,
        CancellationToken ct = default)
    {
        if (request is null)
            throw new ProductValidationException("Request body là bắt buộc.");

        var reason = NormalizeRequired(request.Reason, "Lý do từ chối là bắt buộc.");

        var entity = await _db.RetailPriceChangeRequests
            .FirstOrDefaultAsync(x => x.Id == id, ct)
            ?? throw new ProductValidationException("Không tìm thấy yêu cầu đổi giá bán.");

        EnsureAdminCanDecide(entity);

        var reviewedAt = DateTime.UtcNow;
        entity.Status = RetailPriceChangeRequestStatus.Rejected;
        entity.ReviewedBy = NormalizeActorId(actor);
        entity.ReviewedByName = NormalizeText(actor.FullName);
        entity.ReviewedByRoleName = NormalizeText(actor.RoleName);
        entity.ReviewedAt = reviewedAt;
        entity.RejectReason = reason;
        entity.AdminNote = MergeNote(entity.AdminNote, request.AdminNote);
        entity.UpdatedAt = reviewedAt;

        if (entity.CreatedBy.HasValue)
            _db.Notifications.Add(BuildDecisionNotification(entity, approved: false));

        await _db.SaveChangesAsync(ct);
        return MapToResponse(entity);
    }

    public async Task<RetailPriceChangeRequestResponse> CancelAsync(
        Guid id,
        CancelRetailPriceChangeRequest request,
        ProductApprovalActorSnapshot actor,
        CancellationToken ct = default)
    {
        var entity = await _db.RetailPriceChangeRequests
            .FirstOrDefaultAsync(x => x.Id == id, ct)
            ?? throw new ProductValidationException("Không tìm thấy yêu cầu đổi giá bán.");

        if (entity.Status != RetailPriceChangeRequestStatus.PendingApproval)
            throw new ProductValidationException("Chỉ yêu cầu đang chờ phê duyệt mới được hủy.");

        var actorId = NormalizeActorId(actor);
        var isAdmin = string.Equals(actor.RoleName, "Admin", StringComparison.OrdinalIgnoreCase);
        if (!isAdmin && entity.CreatedBy != actorId)
            throw new ProductValidationException("Chỉ người tạo yêu cầu hoặc Admin mới được hủy yêu cầu này.");

        var cancelledAt = DateTime.UtcNow;
        entity.Status = RetailPriceChangeRequestStatus.Cancelled;
        entity.ReviewedBy = actorId;
        entity.ReviewedByName = NormalizeText(actor.FullName);
        entity.ReviewedByRoleName = NormalizeText(actor.RoleName);
        entity.ReviewedAt = cancelledAt;
        entity.AdminNote = MergeNote(entity.AdminNote, request?.Reason);
        entity.UpdatedAt = cancelledAt;

        await _db.SaveChangesAsync(ct);
        return MapToResponse(entity);
    }

    private static decimal? CalculateAverageCost(ProductVariant variant) =>
        variant.TotalApprovedInboundQuantity > 0
            ? Math.Round(
                variant.TotalApprovedInboundValue / variant.TotalApprovedInboundQuantity,
                2,
                MidpointRounding.AwayFromZero)
            : null;

    private static Notification BuildAdminNotification(RetailPriceChangeRequest entity) => new()
    {
        Id = Guid.NewGuid(),
        RecipientRoleName = "Admin",
        Type = "retail_price_change_request_created",
        Title = $"Yêu cầu đổi giá bán {entity.RequestCode} chờ phê duyệt",
        Body = $"{entity.CreatedByName ?? "Kế toán"} đề xuất đổi giá bán {entity.SkuCode} "
            + $"({entity.ProductName} - {entity.VariantName}) từ {entity.CurrentRetailPrice:N0} "
            + $"thành {entity.RequestedRetailPrice:N0}.",
        Link = $"/products/retail-price-requests/{entity.Id}",
        ReferenceId = entity.Id,
        ReferenceType = nameof(RetailPriceChangeRequest),
        CreatedAt = DateTime.UtcNow
    };

    private static Notification BuildDecisionNotification(RetailPriceChangeRequest entity, bool approved) => new()
    {
        Id = Guid.NewGuid(),
        RecipientUserId = entity.CreatedBy,
        Type = approved ? "retail_price_change_request_approved" : "retail_price_change_request_rejected",
        Title = approved
            ? $"Yêu cầu đổi giá bán {entity.RequestCode} đã được duyệt"
            : $"Yêu cầu đổi giá bán {entity.RequestCode} bị từ chối",
        Body = approved
            ? $"Giá bán {entity.SkuCode} đã đổi thành {entity.RequestedRetailPrice:N0}."
            : $"Lý do: {entity.RejectReason}",
        Link = $"/products/retail-price-requests/{entity.Id}",
        ReferenceId = entity.Id,
        ReferenceType = nameof(RetailPriceChangeRequest),
        CreatedAt = DateTime.UtcNow
    };

    private static string BuildAdminEmailBody(RetailPriceChangeRequest entity) => $"""
        <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;border-top:5px solid #356647;padding:24px;color:#1b1c17">
          <h2 style="color:#356647;margin:0 0 16px">Yêu cầu đổi giá bán chờ phê duyệt</h2>
          <p style="margin:0 0 8px"><strong>Mã yêu cầu:</strong> {entity.RequestCode}</p>
          <p style="margin:0 0 8px"><strong>Hàng hóa:</strong> {entity.SkuCode} — {entity.ProductName} ({entity.VariantName})</p>
          <p style="margin:0 0 8px"><strong>Giá bán hiện tại:</strong> {entity.CurrentRetailPrice:N0}</p>
          <p style="margin:0 0 8px"><strong>Giá bán đề xuất:</strong> {entity.RequestedRetailPrice:N0}</p>
          <p style="margin:0 0 8px"><strong>Giá vốn trung bình:</strong> {(entity.AverageCostPriceAtRequest.HasValue ? entity.AverageCostPriceAtRequest.Value.ToString("N0") : "Chưa có dữ liệu")}</p>
          <p style="margin:0 0 8px"><strong>Người đề xuất:</strong> {entity.CreatedByName ?? "Không rõ"} ({entity.CreatedByRoleName ?? "Không rõ"})</p>
          <p style="margin:0 0 16px"><strong>Lý do:</strong> {entity.Reason ?? "Không có"}</p>
          <p style="margin:0;color:#717971;font-size:13px">Giá bán chỉ thay đổi sau khi Admin phê duyệt yêu cầu này.</p>
        </div>
        """;

    private static RetailPriceChangeRequestResponse MapToResponse(RetailPriceChangeRequest entity) => new(
        entity.Id,
        entity.RequestCode,
        entity.Status.ToString(),
        entity.SkuId,
        entity.SkuCode,
        entity.ProductName,
        entity.VariantName,
        entity.CurrentRetailPrice,
        entity.RequestedRetailPrice,
        entity.AverageCostPriceAtRequest,
        entity.Reason,
        entity.CreatedBy,
        entity.CreatedByName,
        entity.CreatedByRoleName,
        entity.CreatedAt,
        entity.UpdatedAt,
        entity.ReviewedBy,
        entity.ReviewedByName,
        entity.ReviewedByRoleName,
        entity.ReviewedAt,
        entity.AdminNote,
        entity.RejectReason,
        entity.AppliedRetailPrice,
        entity.AppliedAt);

    private async Task<string> GenerateRequestCodeAsync(CancellationToken ct)
    {
        for (var i = 0; i < 20; i++)
        {
            var code = $"RPC-{DateTime.UtcNow:yyyyMMdd}-{RandomNumberGenerator.GetInt32(100000, 999999)}";
            if (!await _db.RetailPriceChangeRequests.AnyAsync(x => x.RequestCode == code, ct))
                return code;
        }

        throw new ProductValidationException("Không thể tạo mã yêu cầu duy nhất. Vui lòng thử lại.");
    }

    private static void EnsureAdminCanDecide(RetailPriceChangeRequest entity)
    {
        if (entity.Status != RetailPriceChangeRequestStatus.PendingApproval)
            throw new ProductValidationException("Chỉ yêu cầu đang chờ phê duyệt mới được Admin xử lý.");
    }

    private static RetailPriceChangeRequestStatus ParseStatus(string? value)
    {
        if (Enum.TryParse<RetailPriceChangeRequestStatus>(value, ignoreCase: true, out var status))
            return status;

        throw new ProductValidationException("Trạng thái yêu cầu đổi giá bán không hợp lệ.");
    }

    private static Guid? NormalizeActorId(ProductApprovalActorSnapshot actor) =>
        actor.UserId.HasValue && actor.UserId.Value != Guid.Empty ? actor.UserId.Value : null;

    private static string? NormalizeText(string? value)
    {
        var text = value?.Trim();
        return string.IsNullOrWhiteSpace(text) ? null : text;
    }

    private static string NormalizeRequired(string? value, string message) =>
        NormalizeText(value) ?? throw new ProductValidationException(message);

    private static string? MergeNote(string? current, string? addition)
    {
        var next = NormalizeText(addition);
        if (next is null) return current;
        var existing = NormalizeText(current);
        return existing is null ? next : $"{existing}\n{next}";
    }
}
