using System.Security.Cryptography;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using ProductService.Application;
using ProductService.Application.DTOs.Requests;
using ProductService.Application.DTOs.Responses;
using ProductService.Application.Interfaces;
using ProductService.Application.UseCases;
using ProductService.Application.Validation;
using ProductService.Domain.Entities;
using ProductService.Domain.Enums;
using ProductService.Domain.Exceptions;
using ProductService.Infrastructure.Data;

namespace ProductService.Infrastructure.UseCases;

public class ProductCreationRequestLogic(ProductDbContext _db, ProductLogic _productLogic, ICloudinaryImageService _cloudinaryImageService)
{
    private static readonly Regex SkuCodeRegex = new(@"^[A-Z0-9\-_]{3,50}$", RegexOptions.Compiled);

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    public async Task<PagedResponse<ProductCreationRequestResponse>> GetPagedAsync(
        GetProductCreationRequestsRequest request,
        ProductApprovalActorSnapshot actor,
        CancellationToken ct = default)
    {
        request ??= new GetProductCreationRequestsRequest(null, null);
        ProductInputValidator.ValidatePagination(request.Page, request.PageSize);

        var query = IncludeAggregate(_db.ProductCreationRequests.AsNoTracking());

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
                || (x.WarehouseNote != null && x.WarehouseNote.ToLower().Contains(search))
                || x.Items.Any(i => i.ProductName.ToLower().Contains(search)));
        }

        var total = await query.CountAsync(ct);
        var items = await query
            .OrderByDescending(x => x.CreatedAt)
            .ThenByDescending(x => x.RevisionNumber)
            .Skip((request.Page - 1) * request.PageSize)
            .Take(request.PageSize)
            .ToListAsync(ct);

        return new PagedResponse<ProductCreationRequestResponse>(
            items.Select(MapToResponse).ToList(),
            request.Page,
            request.PageSize,
            total,
            (int)Math.Ceiling((double)total / request.PageSize));
    }

    public async Task<ProductCreationRequestResponse> GetByIdAsync(
        Guid id,
        ProductApprovalActorSnapshot actor,
        CancellationToken ct = default)
    {
        var request = await IncludeAggregate(_db.ProductCreationRequests.AsNoTracking())
            .FirstOrDefaultAsync(x => x.Id == id, ct)
            ?? throw new ProductValidationException("Không tìm thấy yêu cầu tạo hàng hóa.");

        EnsureCanView(request, actor);
        return MapToResponse(request);
    }

    public async Task<ProductCreationRequestResponse> CreateAsync(
        CreateProductCreationRequest input,
        ProductApprovalActorSnapshot actor,
        CancellationToken ct = default)
    {
        var title = NormalizeRequired(input?.Title, "Tiêu đề yêu cầu là bắt buộc.");
        var items = NormalizeItemInputs(input?.Items);
        var now = DateTime.UtcNow;

        var request = new ProductCreationRequest
        {
            RequestCode = await GenerateRequestCodeAsync(ct),
            Title = title,
            Status = ProductCreationRequestStatus.Draft,
            CreatedBy = NormalizeActorId(actor),
            CreatedByName = NormalizeText(actor.FullName),
            CreatedByRoleName = NormalizeText(actor.RoleName),
            WarehouseNote = NormalizeText(input?.WarehouseNote),
            CreatedAt = now,
            UpdatedAt = now,
            Items = BuildEntities(items, now)
        };

        _db.ProductCreationRequests.Add(request);
        await _db.SaveChangesAsync(ct);
        return await GetByIdAsync(request.Id, actor, ct);
    }

    public async Task<ProductCreationRequestResponse> UpdateAsync(
        Guid id,
        UpdateProductCreationRequest input,
        ProductApprovalActorSnapshot actor,
        CancellationToken ct = default)
    {
        var request = await GetTrackedAsync(id, ct);
        EnsureOwnerCanEdit(request, actor);

        var title = NormalizeRequired(input?.Title, "Tiêu đề yêu cầu là bắt buộc.");
        var items = NormalizeItemInputs(input?.Items);
        var now = DateTime.UtcNow;

        request.Title = title;
        request.WarehouseNote = NormalizeText(input?.WarehouseNote);
        request.UpdatedAt = now;
        request.RejectReason = request.Status == ProductCreationRequestStatus.Rejected ? request.RejectReason : null;
        request.Items.Clear();
        foreach (var item in BuildEntities(items, now))
            request.Items.Add(item);

        await _db.SaveChangesAsync(ct);
        return await GetByIdAsync(request.Id, actor, ct);
    }

    public async Task<ProductCreationRequestResponse> SubmitAsync(
        Guid id,
        SubmitProductCreationRequest input,
        ProductApprovalActorSnapshot actor,
        CancellationToken ct = default)
    {
        var request = await GetTrackedAsync(id, ct);
        EnsureOwnerCanEdit(request, actor);

        var itemInputs = request.Items
            .OrderBy(x => x.SortOrder)
            .Select(x => new ProductCreationRequestItemInput(
                x.ClientKey,
                ProductRequestCapabilityNormalizer.Normalize(DeserializeProduct(x.ProductSnapshotJson))))
            .ToList();
        await ValidateProductsAsync(itemInputs, ct);

        var now = DateTime.UtcNow;
        var nextRevision = request.RevisionNumber + 1;
        request.Status = ProductCreationRequestStatus.PendingApproval;
        request.RevisionNumber = nextRevision;
        request.SubmittedAt = now;
        request.UpdatedAt = now;
        request.WarehouseNote = MergeNote(request.WarehouseNote, input?.WarehouseNote);
        request.RejectReason = null;
        request.CancelReason = null;
        foreach (var item in request.Items)
        {
            item.ValidationStatus = "valid";
            item.ValidationMessage = null;
            item.UpdatedAt = now;
        }

        request.Revisions.Add(new ProductCreationRequestRevision
        {
            RevisionNumber = nextRevision,
            SubmittedSnapshotJson = SerializeItems(itemInputs),
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

    public async Task<ProductCreationRequestResponse> ApproveAsync(
        Guid id,
        ApproveProductCreationRequest input,
        ProductApprovalActorSnapshot actor,
        CancellationToken ct = default)
    {
        var strategy = _db.Database.CreateExecutionStrategy();

        return await strategy.ExecuteAsync(async () =>
        {
            _db.ChangeTracker.Clear();
            await using var tx = await _db.Database.BeginTransactionAsync(ct);

            var request = await GetTrackedAsync(id, ct);
            EnsureAdminCanDecide(request, actor);
            var itemInputs = request.Items
                .OrderBy(x => x.SortOrder)
                .Select(x => new ProductCreationRequestItemInput(
                    x.ClientKey,
                    ProductRequestCapabilityNormalizer.Normalize(DeserializeProduct(x.ProductSnapshotJson))))
                .ToList();

            await ValidateProductsAsync(itemInputs, ct);
            var attributeNameCache = await ProductAttributeNameResolver.LoadAsync(_db, ct);
            var createdIds = new List<Guid>();
            foreach (var item in itemInputs)
            {
                var product = await ProductAttributeNameResolver.ResolveAsync(_db, item.Product, attributeNameCache, ct);
                var created = await _productLogic.CreateAsync(product);
                createdIds.Add(created.Id);
            }

            var now = DateTime.UtcNow;
            request.Status = ProductCreationRequestStatus.Completed;
            request.ReviewedBy = NormalizeActorId(actor);
            request.ReviewedByName = NormalizeText(actor.FullName);
            request.ReviewedByRoleName = NormalizeText(actor.RoleName);
            request.ReviewedAt = now;
            request.CompletedAt = now;
            request.AdminNote = MergeNote(request.AdminNote, input?.AdminNote);
            request.CreatedProductIdsJson = JsonSerializer.Serialize(createdIds, JsonOptions);
            request.UpdatedAt = now;
            MarkLatestRevision(request, "Approved", input?.AdminNote, actor, now);

            await _db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);

            return await GetByIdAsync(request.Id, actor, ct);
        });
    }

    public async Task<ProductCreationRequestResponse> RejectAsync(
        Guid id,
        RejectProductCreationRequest input,
        ProductApprovalActorSnapshot actor,
        CancellationToken ct = default)
    {
        var reason = NormalizeRequired(input?.Reason, "Lý do từ chối là bắt buộc.");
        var request = await GetTrackedAsync(id, ct);
        EnsureAdminCanDecide(request, actor);

        var now = DateTime.UtcNow;
        request.Status = ProductCreationRequestStatus.Rejected;
        request.ReviewedBy = NormalizeActorId(actor);
        request.ReviewedByName = NormalizeText(actor.FullName);
        request.ReviewedByRoleName = NormalizeText(actor.RoleName);
        request.ReviewedAt = now;
        request.RejectReason = reason;
        request.AdminNote = MergeNote(request.AdminNote, input?.AdminNote);
        request.UpdatedAt = now;
        MarkLatestRevision(request, "Rejected", reason, actor, now);

        var imageUrls = StripSnapshotImages(request);

        await _db.SaveChangesAsync(ct);
        await _cloudinaryImageService.DeleteByUrlsAsync(imageUrls, ct);
        return await GetByIdAsync(request.Id, actor, ct);
    }

    public async Task<ProductCreationRequestResponse> CancelAsync(
        Guid id,
        CancelProductCreationRequest input,
        ProductApprovalActorSnapshot actor,
        CancellationToken ct = default)
    {
        var reason = NormalizeRequired(input?.Reason, "Lý do hủy là bắt buộc.");
        var request = await GetTrackedAsync(id, ct);
        if (request.Status == ProductCreationRequestStatus.Completed)
            throw new ProductValidationException("Không thể hủy yêu cầu đã hoàn tất.");

        var now = DateTime.UtcNow;
        request.Status = ProductCreationRequestStatus.Cancelled;
        request.ReviewedBy = NormalizeActorId(actor);
        request.ReviewedByName = NormalizeText(actor.FullName);
        request.ReviewedByRoleName = NormalizeText(actor.RoleName);
        request.ReviewedAt = now;
        request.CancelReason = reason;
        request.AdminNote = MergeNote(request.AdminNote, input?.AdminNote);
        request.UpdatedAt = now;
        MarkLatestRevision(request, "Cancelled", reason, actor, now);

        var imageUrls = StripSnapshotImages(request);

        await _db.SaveChangesAsync(ct);
        await _cloudinaryImageService.DeleteByUrlsAsync(imageUrls, ct);
        return await GetByIdAsync(request.Id, actor, ct);
    }

    // Thu thập tất cả imageUrl từ snapshot của mỗi item rồi xóa khỏi snapshot,
    // để nếu yêu cầu bị từ chối được mở lại chỉnh sửa thì không còn URL ảnh chết.
    private static List<string> StripSnapshotImages(ProductCreationRequest request)
    {
        var urls = new List<string>();
        foreach (var item in request.Items)
        {
            var product = TryDeserializeProduct(item.ProductSnapshotJson);
            if (product is null) continue;

            product = ProductRequestCapabilityNormalizer.Normalize(product);

            if (product.Images is { Count: > 0 })
                urls.AddRange(product.Images
                    .Select(i => i.ImageUrl)
                    .Where(u => !string.IsNullOrWhiteSpace(u)));

            var variants = product.Variants;
            if (variants is { Count: > 0 })
                urls.AddRange(variants
                    .Select(v => v.ImageUrl)
                    .Where(u => !string.IsNullOrWhiteSpace(u))!);

            var strippedVariants = variants?
                .Select(v => v with { ImageUrl = null })
                .ToList();
            item.ProductSnapshotJson = SerializeProduct(
                product with { Images = [], Variants = strippedVariants });
        }

        return urls
            .Where(u => !string.IsNullOrWhiteSpace(u))
            .Distinct()
            .ToList();
    }

    private async Task<ProductCreationRequest> GetTrackedAsync(Guid id, CancellationToken ct)
    {
        return await IncludeAggregate(_db.ProductCreationRequests)
            .FirstOrDefaultAsync(x => x.Id == id, ct)
            ?? throw new ProductValidationException("Không tìm thấy yêu cầu tạo hàng hóa.");
    }

    private static IQueryable<ProductCreationRequest> IncludeAggregate(IQueryable<ProductCreationRequest> query) =>
        query
            .Include(x => x.Items.OrderBy(i => i.SortOrder))
            .Include(x => x.Revisions.OrderBy(r => r.RevisionNumber));

    private static void EnsureCanView(ProductCreationRequest request, ProductApprovalActorSnapshot actor)
    {
        if (!IsWarehouseActor(actor)) return;
    }

    private static void EnsureOwnerCanEdit(ProductCreationRequest request, ProductApprovalActorSnapshot actor)
    {
        var actorId = NormalizeActorId(actor);
        if (!actorId.HasValue || request.CreatedBy != actorId.Value)
            throw new ProductValidationException("Chỉ Warehouse tạo yêu cầu mới được chỉnh sửa.");

        if (request.Status is not (ProductCreationRequestStatus.Draft or ProductCreationRequestStatus.Rejected))
            throw new ProductValidationException("Chỉ được chỉnh sửa yêu cầu ở trạng thái Draft hoặc Rejected.");
    }

    private static void EnsureAdminCanDecide(ProductCreationRequest request, ProductApprovalActorSnapshot actor)
    {
        if (request.Status != ProductCreationRequestStatus.PendingApproval)
            throw new ProductValidationException("Chỉ yêu cầu PendingApproval mới được Admin xử lý.");

        var actorId = NormalizeActorId(actor);
        if (actorId.HasValue && request.CreatedBy == actorId.Value)
            throw new ProductValidationException("Người tạo yêu cầu không được tự duyệt yêu cầu của mình.");
    }

    private async Task ValidateProductsAsync(List<ProductCreationRequestItemInput> items, CancellationToken ct)
    {
        var errors = new List<string>();
        if (items.Count == 0)
            errors.Add("Yêu cầu cần ít nhất một sản phẩm.");

        var requestSkuCodes = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var requestSkuKeys = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var requestProductNames = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var requestBarcodes = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var categoryIds = new HashSet<int>();
        var materialIds = new HashSet<Guid>();
        var componentVariantIds = new HashSet<Guid>();
        var componentSkuCodes = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var (item, itemIndex) in items.Select((value, index) => (value, index)))
        {
            var prefix = $"Sản phẩm {itemIndex + 1}";
            var product = item.Product;
            var productName = NormalizeText(product?.Name);
            if (productName is null)
            {
                errors.Add($"{prefix}: Tên sản phẩm là bắt buộc.");
            }
            else if (!requestProductNames.Add(productName))
            {
                errors.Add($"{prefix}: Tên sản phẩm '{productName}' bị trùng trong cùng yêu cầu.");
            }

            if (product?.CategoryId > 0)
                categoryIds.Add(product.CategoryId);
            else
                errors.Add($"{prefix}: Danh mục là bắt buộc.");

            var productType = ProductType.THANH_PHAM;
            var productTypeText = NormalizeText(product?.ProductType);
            if (productTypeText is null
                || !ProductTypeValidation.TryParseDefined(productTypeText, out productType))
                errors.Add($"{prefix}: Loại hàng không hợp lệ.");

            try
            {
                ProductInputValidator.ValidateProduct(
                    product?.CategoryId ?? 0,
                    product?.Name ?? string.Empty,
                    product?.Origin,
                    product?.FlavorProfile,
                    product?.BrewingGuide,
                    product?.Description,
                    product?.BaseUnit,
                    product?.WeightValue,
                    product?.WeightUnit,
                    product?.InventoryUnit,
                    product?.IsVariantParent ?? false);
                ProductInputValidator.ValidateUnits(product?.Units);
                ProductInputValidator.ValidateVariants(product?.Variants);
                ProductInputValidator.ValidateDerivedSkuRetailPrices(product, prefix);
                ProductInputValidator.ValidateAttributes(product?.Attributes, prefix);
            }
            catch (ProductValidationException ex)
            {
                errors.AddRange(ex.Errors.Select(error => $"{prefix}: {error}"));
            }

            var variants = product?.Variants ?? [];
            if (variants.Count == 0)
                errors.Add($"{prefix}: Cần ít nhất một SKU.");

            if (productType == ProductType.THANH_PHAM)
            {
                var baseVariant = variants.FirstOrDefault(variant => variant.IsBaseUnitVariant == true)
                    ?? variants.FirstOrDefault();
                var hasBom = baseVariant?.BomLines?.Any(line =>
                    line.MaterialId != Guid.Empty
                    || (line.ComponentVariantId.HasValue && line.ComponentVariantId.Value != Guid.Empty)
                    || NormalizeText(line.ComponentSkuCode) is not null
                    || NormalizeText(line.ComponentRequestSkuKey) is not null) == true;
                if (!hasBom)
                    errors.Add($"{prefix}: Sản phẩm kệ bắt buộc phải có BOM trước khi gửi duyệt.");
            }

            foreach (var (variant, variantIndex) in variants.Select((value, index) => (value, index)))
            {
                var row = $"{prefix}, SKU {variantIndex + 1}";
                var skuCode = NormalizeText(variant.SkuCode)?.ToUpperInvariant();
                if (skuCode is null)
                    errors.Add($"{row}: Mã SKU là bắt buộc.");
                else
                {
                    if (!SkuCodeRegex.IsMatch(skuCode))
                        errors.Add($"{row}: Mã SKU chỉ được chứa chữ in hoa, số, dấu gạch ngang hoặc gạch dưới (3-50 ký tự).");
                    if (!requestSkuCodes.Add(skuCode))
                        errors.Add($"{row}: Mã SKU '{skuCode}' bị trùng trong cùng yêu cầu.");
                }

                var requestSkuKey = NormalizeText(variant.RequestSkuKey);
                if (requestSkuKey is not null && !requestSkuKeys.Add(requestSkuKey))
                    errors.Add($"{row}: RequestSkuKey '{requestSkuKey}' bi trung trong cung yeu cau.");

                var barcode = NormalizeText(variant.Barcode);
                if (barcode is not null && !requestBarcodes.Add(barcode))
                    errors.Add($"{row}: Barcode '{barcode}' bị trùng trong cùng yêu cầu.");

                var bomLines = variant.BomLines ?? [];
                if (bomLines.Count > 0
                    && !BomCapabilityRules.CanOwnBom(productType, variant.CanHaveBom ?? false, variant.IsActive))
                    errors.Add($"{row}: BOM chỉ áp dụng cho Sản phẩm kệ.");

                var usedMaterials = new HashSet<Guid>();
                var usedComponents = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                foreach (var (bomLine, bomIndex) in bomLines.Select((value, index) => (value, index)))
                {
                    var componentKey = GetBomLineDedupKey(bomLine);
                    if (componentKey is not null && !usedComponents.Add(componentKey))
                        errors.Add($"{row}: Khong duoc chon trung component trong mot BOM.");

                    if (bomLine.ComponentVariantId.HasValue && bomLine.ComponentVariantId.Value != Guid.Empty)
                        componentVariantIds.Add(bomLine.ComponentVariantId.Value);

                    var componentSkuCode = NormalizeText(bomLine.ComponentSkuCode)?.ToUpperInvariant();
                    if (componentSkuCode is not null)
                        componentSkuCodes.Add(componentSkuCode);

                    if (bomLine.MaterialId == Guid.Empty && componentKey is null)
                        errors.Add($"{row}, BOM {bomIndex + 1}: Chưa chọn Nguyên liệu/Bao bì.");
                    else if (bomLine.MaterialId != Guid.Empty && !usedMaterials.Add(bomLine.MaterialId))
                        errors.Add($"{row}: Không được chọn trùng component trong một BOM.");
                    else if (bomLine.MaterialId != Guid.Empty)
                        materialIds.Add(bomLine.MaterialId);

                    if (bomLine.Quantity <= 0 || !BomUnitRules.IsIntegerQuantity(bomLine.Quantity))
                        errors.Add($"{row}, BOM {bomIndex + 1}: Định mức phải là số nguyên dương.");
                }
            }
        }

        if (categoryIds.Count > 0)
        {
            var existingCategoryIds = await _db.Categories.AsNoTracking()
                .Where(x => categoryIds.Contains(x.Id) && !x.IsDeleted)
                .Select(x => x.Id)
                .ToListAsync(ct);
            foreach (var categoryId in categoryIds.Except(existingCategoryIds))
                errors.Add($"Danh mục '{categoryId}' không hợp lệ.");
        }

        if (requestProductNames.Count > 0)
        {
            var existingNames = await _db.Products.IgnoreQueryFilters().AsNoTracking()
                .Where(x => requestProductNames.Contains(x.Name))
                .Select(x => x.Name)
                .ToListAsync(ct);
            foreach (var name in existingNames.Distinct(StringComparer.OrdinalIgnoreCase))
                errors.Add($"Sản phẩm '{name}' đã tồn tại.");
        }

        if (requestSkuCodes.Count > 0)
        {
            var existingSkuCodes = await _db.ProductVariants.AsNoTracking()
                .Where(x => !x.IsDeleted && requestSkuCodes.Contains(x.SkuCode))
                .Select(x => x.SkuCode)
                .ToListAsync(ct);
            foreach (var skuCode in existingSkuCodes.Distinct(StringComparer.OrdinalIgnoreCase))
                errors.Add($"Mã SKU '{skuCode}' đã tồn tại.");
        }

        if (requestBarcodes.Count > 0)
        {
            var existingVariantBarcodes = await _db.ProductVariants.AsNoTracking()
                .Where(x => !x.IsDeleted && x.Barcode != null && requestBarcodes.Contains(x.Barcode))
                .Select(x => x.Barcode!)
                .ToListAsync(ct);
            var existingUnitBarcodes = await _db.ProductUnits.AsNoTracking()
                .Where(x => x.Barcode != null && requestBarcodes.Contains(x.Barcode))
                .Select(x => x.Barcode!)
                .ToListAsync(ct);
            foreach (var barcode in existingVariantBarcodes
                .Concat(existingUnitBarcodes)
                .Distinct(StringComparer.OrdinalIgnoreCase))
                errors.Add($"Barcode '{barcode}' đã tồn tại.");
        }

        if (materialIds.Count > 0)
        {
            var materials = await _db.Products.AsNoTracking()
                .Where(x => materialIds.Contains(x.Id) && !x.IsDeleted)
                .Select(x => new { x.Id, x.Name, x.ProductType })
                .ToListAsync(ct);
            var materialById = materials.ToDictionary(x => x.Id);

            foreach (var materialId in materialIds)
            {
                if (!materialById.TryGetValue(materialId, out var material))
                {
                    errors.Add("BOM có component không tồn tại hoặc đã bị xóa.");
                    continue;
                }

                if (material.ProductType != ProductType.NGUYEN_LIEU
                    && material.ProductType != ProductType.BAO_BI
                    && material.ProductType != ProductType.THANH_PHAM)
                    errors.Add($"'{material.Name}' không được phép dùng làm component BOM.");
            }
        }

        if (componentVariantIds.Count > 0)
        {
            var components = await _db.ProductVariants.AsNoTracking()
                .Include(x => x.Product)
                .Where(x => componentVariantIds.Contains(x.Id) && !x.IsDeleted && x.IsActive)
                .Select(x => new { x.Id, x.SkuCode, x.IsActive, x.CanBeBomComponent, ProductType = x.Product.ProductType })
                .ToListAsync(ct);
            var componentById = components.ToDictionary(x => x.Id);

            foreach (var componentVariantId in componentVariantIds)
            {
                if (!componentById.TryGetValue(componentVariantId, out var component))
                {
                    errors.Add($"Component SKU '{componentVariantId}' khong ton tai hoac da bi khoa.");
                    continue;
                }

                if (!BomCapabilityRules.CanBeComponent(component.ProductType, component.CanBeBomComponent, component.IsActive))
                    errors.Add($"SKU component '{component.SkuCode}' khong hop le cho BOM.");
            }
        }

        var externalComponentSkuCodes = componentSkuCodes
            .Where(code => !requestSkuCodes.Contains(code))
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
        if (externalComponentSkuCodes.Count > 0)
        {
            var components = await _db.ProductVariants.AsNoTracking()
                .Include(x => x.Product)
                .Where(x => externalComponentSkuCodes.Contains(x.SkuCode) && !x.IsDeleted && x.IsActive)
                .Select(x => new { x.SkuCode, x.IsActive, x.CanBeBomComponent, ProductType = x.Product.ProductType })
                .ToListAsync(ct);
            var componentBySku = components.ToDictionary(x => x.SkuCode, StringComparer.OrdinalIgnoreCase);

            foreach (var componentSkuCode in externalComponentSkuCodes)
            {
                if (!componentBySku.TryGetValue(componentSkuCode, out var component))
                {
                    errors.Add($"Component SKU '{componentSkuCode}' khong ton tai hoac da bi khoa.");
                    continue;
                }

                if (!BomCapabilityRules.CanBeComponent(component.ProductType, component.CanBeBomComponent, component.IsActive))
                    errors.Add($"SKU component '{component.SkuCode}' khong hop le cho BOM.");
            }
        }

        if (errors.Count > 0)
            throw new ProductValidationException(errors.Distinct());
    }

    private static string? GetBomLineDedupKey(BomLineRequest line)
    {
        if (line.ComponentVariantId.HasValue && line.ComponentVariantId.Value != Guid.Empty)
            return $"variant:{line.ComponentVariantId.Value}";

        var componentSkuCode = NormalizeText(line.ComponentSkuCode)?.ToUpperInvariant();
        if (componentSkuCode is not null)
            return $"sku:{componentSkuCode}";

        var componentRequestSkuKey = NormalizeText(line.ComponentRequestSkuKey);
        if (componentRequestSkuKey is not null)
            return $"request:{componentRequestSkuKey}";

        return line.MaterialId == Guid.Empty ? null : $"material:{line.MaterialId}";
    }

    private static List<ProductCreationRequestItemInput> NormalizeItemInputs(List<ProductCreationRequestItemInput>? items)
    {
        if (items is null || items.Count == 0)
            throw new ProductValidationException("Yêu cầu cần ít nhất một sản phẩm.");

        return items.Select((item, index) =>
        {
            if (item.Product is null)
                throw new ProductValidationException($"Sản phẩm {index + 1}: dữ liệu sản phẩm là bắt buộc.");

            if (!ProductTypeValidation.TryParseDefined(item.Product.ProductType, out _))
                throw new ProductValidationException($"Sản phẩm {index + 1}: Loại hàng không hợp lệ.");

            ProductRequestLegacyBomValidator.RejectLegacyRequiredBaseComponents(item.Product);

            var clientKey = NormalizeText(item.ClientKey) ?? $"item-{index + 1}";
            var normalizedProduct = ProductRequestCapabilityNormalizer.Normalize(item.Product);
            var product = normalizedProduct with
            {
                Attributes = ProductInputValidator.ValidateAttributes(normalizedProduct.Attributes, $"Sản phẩm {index + 1}")
            };
            return new ProductCreationRequestItemInput(clientKey, product);
        }).ToList();
    }

    private static List<ProductCreationRequestItem> BuildEntities(List<ProductCreationRequestItemInput> items, DateTime now) =>
        items.Select((item, index) =>
        {
            var product = ProductRequestCapabilityNormalizer.Normalize(item.Product);
            return new ProductCreationRequestItem
            {
                ClientKey = item.ClientKey!,
                SortOrder = index,
                ProductSnapshotJson = SerializeProduct(product),
                ProductName = NormalizeText(product.Name) ?? $"Sản phẩm {index + 1}",
                ProductType = ResolveProductTypeText(product.ProductType),
                CategoryId = product.CategoryId > 0 ? product.CategoryId : null,
                BaseUnit = NormalizeText(product.BaseUnit),
                InventoryUnit = NormalizeText(product.InventoryUnit),
                VariantCount = product.Variants?.Count ?? 0,
                BomLineCount = product.Variants?.Sum(v => v.BomLines?.Count ?? 0) ?? 0,
                ValidationStatus = "not_validated",
                CreatedAt = now,
                UpdatedAt = now
            };
        }).ToList();

    private static void MarkLatestRevision(
        ProductCreationRequest request,
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

    private async Task<string> GenerateRequestCodeAsync(CancellationToken ct)
    {
        for (var i = 0; i < 20; i++)
        {
            var code = $"PCR-{DateTime.UtcNow:yyyyMMdd}-{RandomNumberGenerator.GetInt32(100000, 999999)}";
            if (!await _db.ProductCreationRequests.AnyAsync(x => x.RequestCode == code, ct))
                return code;
        }

        throw new ProductValidationException("Không thể tạo mã yêu cầu duy nhất. Vui lòng thử lại.");
    }

    private static ProductCreationRequestStatus ParseStatus(string? value)
    {
        if (Enum.TryParse<ProductCreationRequestStatus>(value, ignoreCase: true, out var status))
            return status;

        throw new ProductValidationException("Trạng thái yêu cầu tạo hàng hóa không hợp lệ.");
    }

    private static bool IsWarehouseActor(ProductApprovalActorSnapshot actor) =>
        string.Equals(NormalizeText(actor.RoleName), "Warehouse", StringComparison.OrdinalIgnoreCase);

    private static Guid? NormalizeActorId(ProductApprovalActorSnapshot actor) =>
        actor.UserId.HasValue && actor.UserId.Value != Guid.Empty ? actor.UserId.Value : null;

    private static string? NormalizeText(string? value)
    {
        var text = value?.Trim();
        return string.IsNullOrWhiteSpace(text) ? null : text;
    }

    private static string NormalizeRequired(string? value, string message) =>
        NormalizeText(value) ?? throw new ProductValidationException(message);

    private static string ResolveProductTypeText(string? value) =>
        ProductTypeValidation.TryParseDefined(NormalizeText(value), out var productType)
            ? productType.ToString()
            : throw new ProductValidationException("Loại hàng không hợp lệ.");

    private static string? MergeNote(string? current, string? addition)
    {
        var next = NormalizeText(addition);
        if (next is null) return current;
        var existing = NormalizeText(current);
        return existing is null ? next : $"{existing}\n{next}";
    }

    private static string SerializeProduct(CreateProductRequest product) =>
        JsonSerializer.Serialize(product, JsonOptions);

    private static CreateProductRequest DeserializeProduct(string json) =>
        JsonSerializer.Deserialize<CreateProductRequest>(json, JsonOptions)
        ?? throw new ProductValidationException("Snapshot sản phẩm trong yêu cầu không hợp lệ.");

    private static string SerializeItems(List<ProductCreationRequestItemInput> items) =>
        JsonSerializer.Serialize(items, JsonOptions);

    private static List<ProductCreationRequestItemInput> DeserializeItems(string json) =>
        JsonSerializer.Deserialize<List<ProductCreationRequestItemInput>>(json, JsonOptions) ?? [];

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

    private static ProductCreationRequestItemResponse MapItem(ProductCreationRequestItem item) => new(
        item.Id,
        item.ClientKey,
        item.SortOrder,
        TryDeserializeProduct(item.ProductSnapshotJson),
        item.ProductName,
        item.ProductType,
        item.CategoryId,
        item.BaseUnit,
        item.InventoryUnit,
        item.VariantCount,
        item.BomLineCount,
        item.ValidationStatus,
        item.ValidationMessage);

    private static ProductCreationRequestItemResponse MapSubmittedItem(ProductCreationRequestItemInput item, int index) => new(
        Guid.Empty,
        item.ClientKey ?? $"item-{index + 1}",
        index,
        item.Product,
        NormalizeText(item.Product.Name) ?? $"Sản phẩm {index + 1}",
        NormalizeText(item.Product.ProductType),
        item.Product.CategoryId > 0 ? item.Product.CategoryId : null,
        NormalizeText(item.Product.BaseUnit),
        NormalizeText(item.Product.InventoryUnit),
        item.Product.Variants?.Count ?? 0,
        item.Product.Variants?.Sum(v => v.BomLines?.Count ?? 0) ?? 0,
        "submitted",
        null);

    private static ProductCreationRequestRevisionResponse MapRevision(ProductCreationRequestRevision revision)
    {
        var items = DeserializeItems(revision.SubmittedSnapshotJson)
            .Select(MapSubmittedItem)
            .ToList();

        return new ProductCreationRequestRevisionResponse(
            revision.Id,
            revision.RevisionNumber,
            items,
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
    }

    private static ProductCreationRequestResponse MapToResponse(ProductCreationRequest request) => new(
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
        request.WarehouseNote,
        request.AdminNote,
        request.CompletedAt,
        ParseGuidList(request.CreatedProductIdsJson),
        request.Items.OrderBy(x => x.SortOrder).Select(MapItem).ToList(),
        request.Revisions.OrderBy(x => x.RevisionNumber).Select(MapRevision).ToList());
}
