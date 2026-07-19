using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using ProductService.Application;
using ProductService.Application.DTOs.Requests;
using ProductService.Application.DTOs.Responses;
using ProductService.Application.Interfaces;
using ProductService.Application.Validation;
using ProductService.Domain.Entities;
using ProductService.Domain.Enums;
using ProductService.Domain.Exceptions;
using ProductService.Infrastructure.Data;

namespace ProductService.Infrastructure.UseCases;

public class ProductDeletionRequestLogic(
    ProductDbContext _db,
    IInventoryProductDeletionValidationClient _inventoryValidationClient)
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    public async Task<PagedResponse<ProductDeletionRequestResponse>> GetPagedAsync(
        GetProductDeletionRequestsRequest request,
        ProductApprovalActorSnapshot actor,
        CancellationToken ct = default)
    {
        request ??= new GetProductDeletionRequestsRequest(null, null);
        ProductInputValidator.ValidatePagination(request.Page, request.PageSize);

        var query = IncludeAggregate(_db.ProductDeletionRequests.AsNoTracking());

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
                || x.Title.ToLower().Contains(search)
                || (x.Reason != null && x.Reason.ToLower().Contains(search))
                || x.Items.Any(i => i.ProductName.ToLower().Contains(search)));
        }

        var total = await query.CountAsync(ct);
        var items = await query
            .OrderByDescending(x => x.CreatedAt)
            .ThenByDescending(x => x.RevisionNumber)
            .Skip((request.Page - 1) * request.PageSize)
            .Take(request.PageSize)
            .ToListAsync(ct);

        return new PagedResponse<ProductDeletionRequestResponse>(
            items.Select(MapToResponse).ToList(),
            request.Page,
            request.PageSize,
            total,
            (int)Math.Ceiling((double)total / request.PageSize));
    }

    public async Task<ProductDeletionRequestResponse> GetByIdAsync(
        Guid id,
        ProductApprovalActorSnapshot actor,
        CancellationToken ct = default)
    {
        var request = await IncludeAggregate(_db.ProductDeletionRequests.AsNoTracking())
            .FirstOrDefaultAsync(x => x.Id == id, ct)
            ?? throw new ProductValidationException("Không tìm thấy yêu cầu xóa hàng hóa.");

        return MapToResponse(request);
    }

    public async Task<ProductDeletionRequestResponse> CreateAsync(
        CreateProductDeletionRequest input,
        ProductApprovalActorSnapshot actor,
        string? bearerToken,
        CancellationToken ct = default)
    {
        var title = NormalizeRequired(input?.Title, "Tiêu đề yêu cầu là bắt buộc.");
        var items = NormalizeItemInputs(input?.Items);
        var products = await LoadProductsAsync(items.Select(item => item.ProductId), ct);
        ValidateSelectedProducts(items, products);
        var now = DateTime.UtcNow;

        var request = new ProductDeletionRequest
        {
            RequestCode = await GenerateRequestCodeAsync(ct),
            Title = title,
            Status = ProductDeletionRequestStatus.Draft,
            CreatedBy = NormalizeActorId(actor),
            CreatedByName = NormalizeText(actor.FullName),
            CreatedByRoleName = NormalizeText(actor.RoleName),
            Reason = NormalizeText(input?.Reason),
            CreatedAt = now,
            UpdatedAt = now,
            Items = BuildEntities(items, products, now)
        };

        _db.ProductDeletionRequests.Add(request);
        await _db.SaveChangesAsync(ct);
        await RefreshValidationStatusesAsync(request.Id, bearerToken, ct);
        return await GetByIdAsync(request.Id, actor, ct);
    }

    public async Task<ProductDeletionRequestResponse> UpdateAsync(
        Guid id,
        UpdateProductDeletionRequest input,
        ProductApprovalActorSnapshot actor,
        string? bearerToken,
        CancellationToken ct = default)
    {
        var request = await GetTrackedAsync(id, ct);
        EnsureOwnerCanEdit(request, actor);

        var title = NormalizeRequired(input?.Title, "Tiêu đề yêu cầu là bắt buộc.");
        var items = NormalizeItemInputs(input?.Items);
        var products = await LoadProductsAsync(items.Select(item => item.ProductId), ct);
        ValidateSelectedProducts(items, products);
        var now = DateTime.UtcNow;

        request.Title = title;
        request.Reason = NormalizeText(input?.Reason);
        request.UpdatedAt = now;
        request.RejectReason = request.Status == ProductDeletionRequestStatus.Rejected ? request.RejectReason : null;
        request.Items.Clear();
        foreach (var item in BuildEntities(items, products, now))
            request.Items.Add(item);

        await _db.SaveChangesAsync(ct);
        await RefreshValidationStatusesAsync(request.Id, bearerToken, ct);
        return await GetByIdAsync(request.Id, actor, ct);
    }

    public async Task<ProductDeletionRequestResponse> SubmitAsync(
        Guid id,
        SubmitProductDeletionRequest input,
        ProductApprovalActorSnapshot actor,
        string? bearerToken,
        CancellationToken ct = default)
    {
        var request = await GetTrackedAsync(id, ct);
        EnsureOwnerCanEdit(request, actor);
        await RefreshValidationStatusesAsync(request.Id, bearerToken, ct);
        request = await GetTrackedAsync(id, ct);

        var now = DateTime.UtcNow;
        var nextRevision = request.RevisionNumber + 1;
        request.Status = ProductDeletionRequestStatus.PendingApproval;
        request.RevisionNumber = nextRevision;
        request.SubmittedAt = now;
        request.UpdatedAt = now;
        request.Reason = MergeNote(request.Reason, input?.Reason);
        request.RejectReason = null;
        request.CancelReason = null;

        request.Revisions.Add(new ProductDeletionRequestRevision
        {
            RevisionNumber = nextRevision,
            SubmittedSnapshotJson = SerializeSubmittedItems(request.Items.OrderBy(x => x.ProductName).Select(MapItem).ToList()),
            SubmittedBy = NormalizeActorId(actor),
            SubmittedByName = NormalizeText(actor.FullName),
            SubmittedByRoleName = NormalizeText(actor.RoleName),
            SubmittedAt = now,
            CreatedAt = now,
            UpdatedAt = now
        });

        await _db.SaveChangesAsync(ct);
        return await GetByIdAsync(request.Id, actor, ct);
    }

    public async Task<ProductDeletionRequestResponse> ApproveAsync(
        Guid id,
        ApproveProductDeletionRequest input,
        ProductApprovalActorSnapshot actor,
        string? bearerToken,
        CancellationToken ct = default)
    {
        var requestForValidation = await GetTrackedAsync(id, ct);
        EnsureAdminCanDecide(requestForValidation);
        var blockingReasons = await BuildBlockingReasonsAsync(requestForValidation, bearerToken, ct);
        if (blockingReasons.Count > 0)
        {
            var productNameById = requestForValidation.Items
                .GroupBy(item => item.ProductId)
                .ToDictionary(group => group.Key, group => group.First().ProductName);
            throw new ProductValidationException(blockingReasons.SelectMany(entry =>
            {
                var productName = productNameById.TryGetValue(entry.Key, out var name)
                    ? name
                    : entry.Key.ToString();
                return entry.Value.Select(reason => $"{productName}: {reason}");
            }));
        }

        var strategy = _db.Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync(async () =>
        {
            _db.ChangeTracker.Clear();
            await using var tx = await _db.Database.BeginTransactionAsync(ct);

            var request = await GetTrackedAsync(id, ct);
            EnsureAdminCanDecide(request);
            var productIds = request.Items.Select(item => item.ProductId).Distinct().ToList();
            var products = await LoadProductsAsync(productIds, ct);
            var now = DateTime.UtcNow;

            foreach (var product in products)
            {
                product.IsDeleted = true;
                product.IsActive = false;
                product.UpdatedAt = now;
                foreach (var variant in product.Variants.Where(variant => !variant.IsDeleted))
                {
                    variant.IsActive = false;
                    variant.UpdatedAt = now;
                }
            }

            request.Status = ProductDeletionRequestStatus.Completed;
            request.ReviewedBy = NormalizeActorId(actor);
            request.ReviewedByName = NormalizeText(actor.FullName);
            request.ReviewedByRoleName = NormalizeText(actor.RoleName);
            request.ReviewedAt = now;
            request.CompletedAt = now;
            request.AdminNote = MergeNote(request.AdminNote, input?.AdminNote);
            request.DeletedProductIdsJson = JsonSerializer.Serialize(productIds, JsonOptions);
            request.UpdatedAt = now;
            foreach (var item in request.Items)
            {
                item.ValidationStatus = "deleted";
                item.ValidationMessage = null;
                item.UpdatedAt = now;
            }
            MarkLatestRevision(request, "Approved", input?.AdminNote, actor, now);

            await _db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
            return await GetByIdAsync(request.Id, actor, ct);
        });
    }

    public async Task<ProductDeletionRequestResponse> RejectAsync(
        Guid id,
        RejectProductDeletionRequest input,
        ProductApprovalActorSnapshot actor,
        CancellationToken ct = default)
    {
        var reason = NormalizeRequired(input?.Reason, "Lý do từ chối là bắt buộc.");
        var request = await GetTrackedAsync(id, ct);
        EnsureAdminCanDecide(request);

        var now = DateTime.UtcNow;
        request.Status = ProductDeletionRequestStatus.Rejected;
        request.ReviewedBy = NormalizeActorId(actor);
        request.ReviewedByName = NormalizeText(actor.FullName);
        request.ReviewedByRoleName = NormalizeText(actor.RoleName);
        request.ReviewedAt = now;
        request.RejectReason = reason;
        request.AdminNote = MergeNote(request.AdminNote, input?.AdminNote);
        request.UpdatedAt = now;
        MarkLatestRevision(request, "Rejected", reason, actor, now);

        await _db.SaveChangesAsync(ct);
        return await GetByIdAsync(request.Id, actor, ct);
    }

    public async Task<ProductDeletionRequestResponse> CancelAsync(
        Guid id,
        CancelProductDeletionRequest input,
        ProductApprovalActorSnapshot actor,
        CancellationToken ct = default)
    {
        var reason = NormalizeRequired(input?.Reason, "Lý do hủy là bắt buộc.");
        var request = await GetTrackedAsync(id, ct);
        if (request.Status == ProductDeletionRequestStatus.Completed)
            throw new ProductValidationException("Không thể hủy yêu cầu đã hoàn tất.");

        var now = DateTime.UtcNow;
        request.Status = ProductDeletionRequestStatus.Cancelled;
        request.ReviewedBy = NormalizeActorId(actor);
        request.ReviewedByName = NormalizeText(actor.FullName);
        request.ReviewedByRoleName = NormalizeText(actor.RoleName);
        request.ReviewedAt = now;
        request.CancelReason = reason;
        request.AdminNote = MergeNote(request.AdminNote, input?.AdminNote);
        request.UpdatedAt = now;
        MarkLatestRevision(request, "Cancelled", reason, actor, now);

        await _db.SaveChangesAsync(ct);
        return await GetByIdAsync(request.Id, actor, ct);
    }

    private async Task RefreshValidationStatusesAsync(Guid requestId, string? bearerToken, CancellationToken ct)
    {
        var request = await GetTrackedAsync(requestId, ct);
        var blockingReasons = await BuildBlockingReasonsAsync(request, bearerToken, ct);
        var now = DateTime.UtcNow;
        foreach (var item in request.Items)
        {
            if (blockingReasons.TryGetValue(item.ProductId, out var reasons) && reasons.Count > 0)
            {
                item.ValidationStatus = "blocked";
                item.ValidationMessage = string.Join(" ", reasons);
            }
            else
            {
                item.ValidationStatus = "valid";
                item.ValidationMessage = null;
            }

            item.UpdatedAt = now;
        }

        await _db.SaveChangesAsync(ct);
    }

    private async Task<Dictionary<Guid, List<string>>> BuildBlockingReasonsAsync(
        ProductDeletionRequest request,
        string? bearerToken,
        CancellationToken ct)
    {
        var result = request.Items
            .GroupBy(item => item.ProductId)
            .ToDictionary(group => group.Key, _ => new List<string>());
        var productIds = request.Items.Select(item => item.ProductId).Distinct().ToList();
        var products = await LoadProductsAsync(productIds, ct, includeDeleted: true);
        var productById = products.ToDictionary(product => product.Id);

        foreach (var item in request.Items)
        {
            if (!result.TryGetValue(item.ProductId, out var itemReasons))
            {
                itemReasons = [];
                result[item.ProductId] = itemReasons;
            }

            if (!productById.TryGetValue(item.ProductId, out var product))
            {
                itemReasons.Add("Product không tồn tại.");
                continue;
            }

            if (product.IsDeleted)
                itemReasons.Add("Product đã bị xóa mềm.");
        }

        var selectedSkuIds = products
            .Where(product => !product.IsDeleted)
            .SelectMany(product => product.Variants.Where(variant => !variant.IsDeleted).Select(variant => variant.Id))
            .Distinct()
            .ToList();

        var inventoryValidation = await _inventoryValidationClient.ValidateAsync(selectedSkuIds, bearerToken, ct);
        var productIdBySkuId = products
            .SelectMany(product => product.Variants.Select(variant => new { variant.Id, ProductId = product.Id }))
            .ToDictionary(row => row.Id, row => row.ProductId);

        foreach (var skuValidation in inventoryValidation.Items)
        {
            if (!productIdBySkuId.TryGetValue(skuValidation.SkuId, out var productId)) continue;
            if (!result.TryGetValue(productId, out var itemReasons)) continue;
            foreach (var reason in skuValidation.BlockingReasons)
                itemReasons.Add($"{skuValidation.SkuCode ?? skuValidation.SkuId.ToString()}: {reason}");
        }

        var bomDependencies = await _db.ProductVariantBomLines.AsNoTracking()
            .Where(line => (productIds.Contains(line.MaterialId)
                    || (line.ComponentVariantId.HasValue && selectedSkuIds.Contains(line.ComponentVariantId.Value)))
                && !productIds.Contains(line.Variant.ProductId)
                && !line.Variant.Product.IsDeleted
                && line.Variant.Product.IsActive)
            .Select(line => new
            {
                MaterialId = line.MaterialId,
                ComponentVariantId = line.ComponentVariantId,
                ComponentSkuCode = line.ComponentVariant != null ? line.ComponentVariant.SkuCode : null,
                ProductName = line.Variant.Product.Name,
                SkuCode = line.Variant.SkuCode
            })
            .ToListAsync(ct);

        var selectedProductIds = products.Select(product => product.Id).ToHashSet();
        foreach (var dependency in bomDependencies)
        {
            var targetProductId = dependency.ComponentVariantId.HasValue
                && productIdBySkuId.TryGetValue(dependency.ComponentVariantId.Value, out var productId)
                    ? productId
                    : dependency.MaterialId;
            var componentLabel = string.IsNullOrWhiteSpace(dependency.ComponentSkuCode)
                ? string.Empty
                : $" SKU {dependency.ComponentSkuCode}";
            if (!selectedProductIds.Contains(targetProductId)) continue;
            result[targetProductId].Add($"Đang là component BOM{componentLabel} của {dependency.ProductName} ({dependency.SkuCode}).");
        }

        return result
            .Where(entry => entry.Value.Count > 0)
            .ToDictionary(entry => entry.Key, entry => entry.Value.Distinct().ToList());
    }

    private async Task<ProductDeletionRequest> GetTrackedAsync(Guid id, CancellationToken ct)
    {
        return await IncludeAggregate(_db.ProductDeletionRequests)
            .FirstOrDefaultAsync(x => x.Id == id, ct)
            ?? throw new ProductValidationException("Không tìm thấy yêu cầu xóa hàng hóa.");
    }

    private static IQueryable<ProductDeletionRequest> IncludeAggregate(IQueryable<ProductDeletionRequest> query) =>
        query
            .Include(x => x.Items.OrderBy(i => i.ProductName))
            .Include(x => x.Revisions.OrderBy(r => r.RevisionNumber));

    private async Task<List<Product>> LoadProductsAsync(IEnumerable<Guid> productIds, CancellationToken ct, bool includeDeleted = false)
    {
        var ids = productIds.Distinct().ToList();
        var query = includeDeleted
            ? _db.Products.IgnoreQueryFilters()
            : _db.Products;

        return await query
            .Include(product => product.Category)
            .Include(product => product.Variants)
                .ThenInclude(variant => variant.BomLines)
                    .ThenInclude(line => line.Material)
            .Where(product => ids.Contains(product.Id))
            .ToListAsync(ct);
    }

    private static void ValidateSelectedProducts(List<ProductDeletionRequestItemInput> items, List<Product> products)
    {
        var errors = new List<string>();
        if (items.Count == 0)
            errors.Add("Yêu cầu cần ít nhất một Product.");

        var duplicate = items.GroupBy(item => item.ProductId).FirstOrDefault(group => group.Count() > 1);
        if (duplicate is not null)
            errors.Add("Không được chọn trùng Product trong một yêu cầu xóa.");

        var foundIds = products.Select(product => product.Id).ToHashSet();
        foreach (var productId in items.Select(item => item.ProductId))
        {
            if (!foundIds.Contains(productId))
                errors.Add($"Product '{productId}' không tồn tại hoặc đã bị xóa mềm.");
        }

        if (errors.Count > 0)
            throw new ProductValidationException(errors.Distinct());
    }

    private static List<ProductDeletionRequestItemInput> NormalizeItemInputs(List<ProductDeletionRequestItemInput>? items)
    {
        if (items is null || items.Count == 0)
            throw new ProductValidationException("Yêu cầu cần ít nhất một Product.");

        return items.Select(item =>
        {
            if (item.ProductId == Guid.Empty)
                throw new ProductValidationException("ProductId không hợp lệ.");
            return new ProductDeletionRequestItemInput(item.ProductId, NormalizeText(item.Reason));
        }).ToList();
    }

    private static List<ProductDeletionRequestItem> BuildEntities(
        List<ProductDeletionRequestItemInput> items,
        List<Product> products,
        DateTime now)
    {
        var productById = products.ToDictionary(product => product.Id);
        return items.Select(item =>
        {
            var product = productById[item.ProductId];
            return new ProductDeletionRequestItem
            {
                ProductId = product.Id,
                ProductSnapshotJson = SerializeProductSnapshot(product),
                ProductName = product.Name,
                ProductType = product.ProductType.ToString(),
                CategoryName = product.Category?.Name,
                VariantCount = product.Variants.Count(variant => !variant.IsDeleted),
                Reason = NormalizeText(item.Reason),
                ValidationStatus = "not_validated",
                CreatedAt = now,
                UpdatedAt = now
            };
        }).ToList();
    }

    private static string SerializeProductSnapshot(Product product)
    {
        var snapshot = new
        {
            product.Id,
            product.Name,
            ProductType = product.ProductType.ToString(),
            product.CategoryId,
            CategoryName = product.Category?.Name,
            product.IsActive,
            product.IsDeleted,
            Variants = product.Variants
                .Where(variant => !variant.IsDeleted)
                .Select(variant => new
                {
                    variant.Id,
                    variant.SkuCode,
                    variant.VariantName,
                    variant.CostPrice,
                    variant.RetailPrice,
                    variant.IsActive,
                    BomLines = variant.BomLines
                        .Where(line => !line.IsDeleted)
                        .Select(line => new
                        {
                            line.MaterialId,
                            MaterialName = line.Material?.Name,
                            line.Quantity
                        })
                        .ToList()
                })
                .ToList()
        };
        return JsonSerializer.Serialize(snapshot, JsonOptions);
    }

    private async Task<string> GenerateRequestCodeAsync(CancellationToken ct)
    {
        for (var i = 0; i < 20; i++)
        {
            var code = $"PDR-{DateTime.UtcNow:yyyyMMdd}-{RandomNumberGenerator.GetInt32(100000, 999999)}";
            if (!await _db.ProductDeletionRequests.AnyAsync(x => x.RequestCode == code, ct))
                return code;
        }

        throw new ProductValidationException("Không thể tạo mã yêu cầu duy nhất. Vui lòng thử lại.");
    }

    private static void EnsureOwnerCanEdit(ProductDeletionRequest request, ProductApprovalActorSnapshot actor)
    {
        var actorId = NormalizeActorId(actor);
        if (!actorId.HasValue || request.CreatedBy != actorId.Value)
            throw new ProductValidationException("Chỉ Warehouse tạo yêu cầu mới được chỉnh sửa.");

        if (request.Status is not (ProductDeletionRequestStatus.Draft or ProductDeletionRequestStatus.Rejected))
            throw new ProductValidationException("Chỉ được chỉnh sửa yêu cầu ở trạng thái Draft hoặc Rejected.");
    }

    private static void EnsureAdminCanDecide(ProductDeletionRequest request)
    {
        if (request.Status != ProductDeletionRequestStatus.PendingApproval)
            throw new ProductValidationException("Chỉ yêu cầu PendingApproval mới được Admin xử lý.");
    }

    private static ProductDeletionRequestStatus ParseStatus(string? value)
    {
        if (Enum.TryParse<ProductDeletionRequestStatus>(value, ignoreCase: true, out var status))
            return status;

        throw new ProductValidationException("Trạng thái yêu cầu xóa hàng hóa không hợp lệ.");
    }

    private static void MarkLatestRevision(
        ProductDeletionRequest request,
        string decision,
        string? reason,
        ProductApprovalActorSnapshot actor,
        DateTime now)
    {
        var revision = request.Revisions
            .OrderByDescending(x => x.RevisionNumber)
            .FirstOrDefault();
        if (revision is null) return;

        revision.Decision = decision;
        revision.DecisionReason = NormalizeText(reason);
        revision.DecidedBy = NormalizeActorId(actor);
        revision.DecidedByName = NormalizeText(actor.FullName);
        revision.DecidedByRoleName = NormalizeText(actor.RoleName);
        revision.DecidedAt = now;
        revision.UpdatedAt = now;
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

    private static string SerializeSubmittedItems(List<ProductDeletionRequestItemResponse> items) =>
        JsonSerializer.Serialize(items, JsonOptions);

    private static List<ProductDeletionRequestItemResponse> DeserializeSubmittedItems(string json) =>
        JsonSerializer.Deserialize<List<ProductDeletionRequestItemResponse>>(json, JsonOptions) ?? [];

    private static List<Guid> ParseGuidList(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return [];
        return JsonSerializer.Deserialize<List<Guid>>(json, JsonOptions) ?? [];
    }

    private static ProductDeletionRequestItemResponse MapItem(ProductDeletionRequestItem item) => new(
        item.Id,
        item.ProductId,
        item.ProductName,
        item.ProductType,
        item.CategoryName,
        item.VariantCount,
        item.Reason,
        item.ValidationStatus,
        item.ValidationMessage);

    private static ProductDeletionRequestRevisionResponse MapRevision(ProductDeletionRequestRevision revision) => new(
        revision.Id,
        revision.RevisionNumber,
        DeserializeSubmittedItems(revision.SubmittedSnapshotJson),
        revision.SubmittedBy,
        revision.SubmittedByName,
        revision.SubmittedByRoleName,
        revision.SubmittedAt,
        revision.Decision,
        revision.DecisionReason,
        revision.DecidedBy,
        revision.DecidedByName,
        revision.DecidedByRoleName,
        revision.DecidedAt);

    private static ProductDeletionRequestResponse MapToResponse(ProductDeletionRequest request) => new(
        request.Id,
        request.RequestCode,
        request.Title,
        request.Status.ToString(),
        request.RevisionNumber,
        request.CreatedBy,
        request.CreatedByName,
        request.CreatedByRoleName,
        request.CreatedAt,
        request.UpdatedAt,
        request.SubmittedAt,
        request.ReviewedBy,
        request.ReviewedByName,
        request.ReviewedByRoleName,
        request.ReviewedAt,
        request.RejectReason,
        request.CancelReason,
        request.Reason,
        request.AdminNote,
        request.CompletedAt,
        ParseGuidList(request.DeletedProductIdsJson),
        request.Items.OrderBy(x => x.ProductName).Select(MapItem).ToList(),
        request.Revisions.OrderBy(x => x.RevisionNumber).Select(MapRevision).ToList());
}
