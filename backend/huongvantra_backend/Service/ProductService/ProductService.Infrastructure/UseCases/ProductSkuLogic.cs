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

// Serves the legacy /api/v1/skus route using ProductVariant data so that
// store, POS, and OrderService continue working without URL changes.
public class ProductSkuLogic(
    IProductRepository _productRepository,
    ProductDbContext _db)
{
    public async Task<PagedResponse<ProductSkuResponse>> GetPagedAsync(
        GetProductSkusRequest request,
        CatalogViewScope scope = CatalogViewScope.Store)
    {
        if (request is null)
            throw new ProductValidationException("Request là bắt buộc.");

        ProductInputValidator.ValidatePagination(request.Page, request.PageSize);

        var query = BuildVariantQuery(scope);

        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            var s = request.Search.Trim().ToLower();
            query = query.Where(v =>
                v.SkuCode.ToLower().Contains(s) ||
                (v.Barcode != null && v.Barcode.ToLower().Contains(s)) ||
                v.VariantName.ToLower().Contains(s) ||
                v.Product.Name.ToLower().Contains(s) ||
                (v.Product.Category != null && v.Product.Category.Name.ToLower().Contains(s)));
        }

        if (request.ProductId.HasValue)
            query = query.Where(v => v.ProductId == request.ProductId.Value);

        if (request.IsActive == true)
            query = query.Where(v => v.IsActive);
        else if (request.IsActive == false)
            query = query.Where(v => !v.IsActive);

        if (!string.IsNullOrWhiteSpace(request.ProductType)
            && Enum.TryParse<ProductType>(request.ProductType, ignoreCase: true, out var productTypeFilter))
        {
            query = query.Where(v => v.Product.ProductType == productTypeFilter);
        }

        var totalCount = await query.CountAsync();
        var items = await query
            .OrderBy(v => v.SkuCode)
            .Skip((request.Page - 1) * request.PageSize)
            .Take(request.PageSize)
            .ToListAsync();

        return new PagedResponse<ProductSkuResponse>(
            items.Select(MapToResponse).ToList(),
            request.Page,
            request.PageSize,
            totalCount,
            (int)Math.Ceiling((double)totalCount / request.PageSize));
    }

    public async Task<List<ProductSkuResponse>> GetAllAsync(
        bool includeInactive = false,
        CatalogViewScope scope = CatalogViewScope.Store)
    {
        var query = BuildVariantQuery(scope);
        if (!includeInactive) query = query.Where(v => v.IsActive);
        var items = await query.OrderBy(v => v.SkuCode).ToListAsync();
        return items.Select(MapToResponse).ToList();
    }

    public async Task<ProductSkuResponse> GetByIdAsync(Guid id, CatalogViewScope scope = CatalogViewScope.Store)
    {
        var variant = await BuildVariantQuery(scope).FirstOrDefaultAsync(v => v.Id == id)
            ?? throw new ProductSkuNotFoundException(id);
        return MapToResponse(variant);
    }

    public async Task<ProductSkuResponse> GetBySkuCodeAsync(string skuCode, CatalogViewScope scope = CatalogViewScope.Store)
    {
        if (string.IsNullOrWhiteSpace(skuCode))
            throw new ProductValidationException("Mã SKU không được để trống.");

        var normalized = skuCode.Trim().ToUpperInvariant();
        var variant = await BuildVariantQuery(scope).FirstOrDefaultAsync(v => v.SkuCode == normalized)
            ?? throw new ProductSkuNotFoundByCodeException(skuCode);
        return MapToResponse(variant);
    }

    public async Task<List<ProductSkuResponse>> GetByProductIdAsync(
        Guid productId,
        CatalogViewScope scope = CatalogViewScope.Store)
    {
        if (productId == Guid.Empty)
            throw new ProductValidationException("ProductId không hợp lệ.");

        _ = await _productRepository.GetByIdAsync(productId)
            ?? throw new ProductNotFoundException(productId);

        var items = await BuildVariantQuery(scope)
            .Where(v => v.ProductId == productId)
            .OrderBy(v => v.SkuCode)
            .ToListAsync();
        return items.Select(MapToResponse).ToList();
    }

    public async Task<ProductBomCatalogResponse> GetBomCatalogBySkuIdsAsync(
        List<Guid>? skuIds,
        CatalogViewScope scope = CatalogViewScope.Store,
        CancellationToken ct = default)
    {
        var targetIds = (skuIds ?? [])
            .Where(id => id != Guid.Empty)
            .Distinct()
            .ToHashSet();
        if (targetIds.Count == 0)
            return new ProductBomCatalogResponse([]);

        var targetQuery = _db.ProductVariants
            .Include(v => v.Product)
            .Include(v => v.BomLines)
                .ThenInclude(b => b.Material)
                    .ThenInclude(m => m.Units)
            .Include(v => v.BomLines)
                .ThenInclude(b => b.ComponentVariant)
            .Where(v => targetIds.Contains(v.Id));

        if (scope == CatalogViewScope.Store)
            targetQuery = targetQuery.Where(v =>
                v.SyncedToStoreAt != null ||
                v.Product.SyncedToStoreAt != null ||
                v.Product.ProductType == ProductService.Domain.Enums.ProductType.NGUYEN_LIEU);

        var targetVariants = await targetQuery.ToListAsync(ct);
        var activeBomLines = targetVariants
            .SelectMany(v => v.BomLines)
            .Where(line => !line.IsDeleted)
            .ToList();

        var componentVariantIds = activeBomLines
            .Where(line => line.ComponentVariantId.HasValue)
            .Select(line => line.ComponentVariantId!.Value)
            .Where(id => id != Guid.Empty)
            .ToHashSet();

        var legacyMaterialProductIds = activeBomLines
            .Where(line => !line.ComponentVariantId.HasValue)
            .Select(line => line.MaterialId)
            .Where(id => id != Guid.Empty)
            .ToHashSet();

        List<ProductVariant> componentVariants = componentVariantIds.Count == 0 && legacyMaterialProductIds.Count == 0
            ? []
            : await _db.ProductVariants
                .Include(v => v.Product)
                .Where(v =>
                    componentVariantIds.Contains(v.Id) ||
                    legacyMaterialProductIds.Contains(v.ProductId))
                .ToListAsync(ct);

        var variants = targetVariants
            .Concat(componentVariants)
            .GroupBy(v => v.Id)
            .Select(group => group.First())
            .ToList();

        var products = variants
            .Where(v => v.Product != null)
            .GroupBy(v => v.ProductId)
            .Select(group =>
            {
                var product = group.First().Product;
                return new ProductBomCatalogProductResponse(
                    product.Id,
                    product.Name,
                    product.ProductType.ToString(),
                    product.InventoryUnit.ToString(),
                    product.BaseUnit,
                    product.IsActive,
                    group
                        .OrderBy(v => v.SkuCode)
                        .Select(v => MapBomCatalogVariant(v, targetIds.Contains(v.Id)))
                        .ToList());
            })
            .ToList();

        return new ProductBomCatalogResponse(products);
    }

    public async Task<List<ProductSkuOrderCatalogResponse>> GetOrderCatalogBySkuIdsAsync(
        List<Guid>? skuIds,
        CancellationToken ct = default)
    {
        var targetIds = (skuIds ?? [])
            .Where(id => id != Guid.Empty)
            .Distinct()
            .ToHashSet();
        if (targetIds.Count == 0)
            return [];

        return await _db.ProductVariants
            .Include(v => v.Product)
            .Where(v =>
                targetIds.Contains(v.Id) &&
                v.IsActive &&
                v.IsSellable &&
                v.Product.IsActive)
            .Select(v => new ProductSkuOrderCatalogResponse(
                v.Id,
                v.Product.CategoryId,
                v.Product.InventoryUnit.ToString(),
                v.Product.ProductType.ToString(),
                v.IsPurchasable,
                v.CanBeBomComponent,
                v.CanUseInCustom,
                v.CanHaveBom))
            .ToListAsync(ct);
    }

    public async Task<List<ProductSkuSupplierReceiptCatalogResponse>> GetSupplierReceiptCatalogBySkuIdsAsync(
        List<Guid>? skuIds,
        CancellationToken ct = default)
    {
        var targetIds = (skuIds ?? [])
            .Where(id => id != Guid.Empty)
            .Distinct()
            .ToHashSet();
        var query = _db.ProductVariants
            .AsNoTracking()
            .Include(v => v.Product)
            .Where(v =>
                !v.IsDeleted &&
                !v.Product.IsDeleted &&
                v.IsActive &&
                v.Product.IsActive &&
                v.IsPurchasable &&
                (v.Product.ProductType == ProductService.Domain.Enums.ProductType.THANH_PHAM ||
                 v.Product.ProductType == ProductService.Domain.Enums.ProductType.NGUYEN_LIEU ||
                 v.Product.ProductType == ProductService.Domain.Enums.ProductType.BAO_BI));

        if (targetIds.Count > 0)
        {
            query = query.Where(v => targetIds.Contains(v.Id));
        }

        return await query
            .OrderBy(v => v.Product.ProductType)
            .ThenBy(v => v.Product.Name)
            .ThenBy(v => v.SkuCode)
            .Select(v => new ProductSkuSupplierReceiptCatalogResponse(
                v.Id,
                v.ProductId,
                v.Product.Name,
                v.SkuCode,
                v.VariantName,
                v.UnitName,
                v.Product.ProductType.ToString(),
                v.Product.InventoryUnit.ToString(),
                v.Product.IsActive && v.IsActive,
                v.IsPurchasable))
            .ToListAsync(ct);
    }

    public async Task<List<ProductSkuContractCatalogResponse>> GetContractCatalogBySkuIdsAsync(
        List<Guid>? skuIds,
        CancellationToken ct = default)
    {
        var targetIds = (skuIds ?? [])
            .Where(id => id != Guid.Empty)
            .Distinct()
            .ToHashSet();
        if (targetIds.Count == 0)
            return [];

        return await _db.ProductVariants
            .AsNoTracking()
            .Include(v => v.Product)
            .Where(v =>
                targetIds.Contains(v.Id) &&
                !v.IsDeleted &&
                !v.Product.IsDeleted &&
                v.IsActive &&
                v.Product.IsActive)
            .Select(v => new ProductSkuContractCatalogResponse(
                v.Id,
                v.SkuCode,
                v.Product.Name,
                v.UnitName,
                v.RetailPrice))
            .ToListAsync(ct);
    }

    public async Task<List<ProductSkuAccountingResponse>> GetAccountingCostProfitAsync(
        CancellationToken ct = default)
    {
        var variants = await BuildVariantQuery(CatalogViewScope.Warehouse)
            .AsNoTracking()
            .Where(variant => variant.IsActive && variant.Product.IsActive)
            .OrderBy(variant => variant.SkuCode)
            .ToListAsync(ct);

        var skuIds = variants.Select(variant => variant.Id).ToHashSet();
        var histories = skuIds.Count == 0
            ? new List<ProductCostPriceHistory>()
            : await _db.ProductCostPriceHistories
                .AsNoTracking()
                .Where(history => skuIds.Contains(history.SkuId) && history.WasApplied)
                .OrderByDescending(history => history.SourceApprovedAt)
                .ThenByDescending(history => history.ReceiptLineOrder)
                .ThenByDescending(history => history.UpdatedAt)
                .ToListAsync(ct);
        var latestBySku = histories
            .GroupBy(history => history.SkuId)
            .ToDictionary(group => group.Key, group => group.First());

        return variants.Select(variant =>
        {
            latestBySku.TryGetValue(variant.Id, out var latest);
            return new ProductSkuAccountingResponse(
                variant.Id,
                variant.SkuCode,
                variant.Product.Name,
                variant.VariantName,
                variant.UnitName,
                variant.RetailPrice,
                variant.CostPrice,
                latest?.IncomingUnitCost,
                latest?.SourceReceiptId,
                latest?.SourceReceiptCode,
                latest?.SourceApprovedAt,
                latest?.UpdatedAt);
        }).ToList();
    }

    public async Task<ProductSkuAccountingResponse> UpdateRetailPriceAsync(
        Guid skuId,
        UpdateProductVariantRetailPriceRequest request,
        ProductApprovalActorSnapshot actor,
        CancellationToken ct = default)
    {
        if (skuId == Guid.Empty)
            throw new ProductValidationException("SkuId không hợp lệ.");
        if (request is null)
            throw new ProductValidationException("Request body là bắt buộc.");
        if (request.RetailPrice <= 0)
            throw new ProductValidationException("Giá bán phải lớn hơn 0.");

        var normalizedRetailPrice = Math.Round(
            request.RetailPrice,
            2,
            MidpointRounding.AwayFromZero);
        ProductVariant? variant = null;
        ProductCostPriceHistory? latest = null;

        var strategy = _db.Database.CreateExecutionStrategy();
        await strategy.ExecuteAsync(async () =>
        {
            await using var transaction = await _db.Database.BeginTransactionAsync(ct);
            try
            {
                variant = await _db.ProductVariants
                    .Include(item => item.Product)
                    .FirstOrDefaultAsync(item => item.Id == skuId, ct)
                    ?? throw new ProductSkuNotFoundException(skuId);

                var oldRetailPrice = variant.RetailPrice;
                if (oldRetailPrice != normalizedRetailPrice)
                {
                    var changedAt = DateTime.UtcNow;
                    // Accounting owns only RetailPrice. CostPrice is never copied
                    // from the client and remains owned by the receipt consumer.
                    variant.RetailPrice = normalizedRetailPrice;
                    variant.UpdatedAt = changedAt;
                    var history = RetailPriceHistoryFactory.TryCreate(
                        skuId,
                        oldRetailPrice,
                        normalizedRetailPrice,
                        actor.UserId,
                        actor.FullName,
                        RetailPriceHistoryFactory.SourceManualAccounting,
                        note: null,
                        changedAtUtc: changedAt);
                    if (history is not null)
                        _db.ProductRetailPriceHistories.Add(history);
                    await _db.SaveChangesAsync(ct);
                }

                latest = await _db.ProductCostPriceHistories
                    .AsNoTracking()
                    .Where(history => history.SkuId == skuId && history.WasApplied)
                    .OrderByDescending(history => history.SourceApprovedAt)
                    .ThenByDescending(history => history.ReceiptLineOrder)
                    .ThenByDescending(history => history.UpdatedAt)
                    .FirstOrDefaultAsync(ct);
                await transaction.CommitAsync(ct);
            }
            catch
            {
                await transaction.RollbackAsync(ct);
                throw;
            }
        });

        return new ProductSkuAccountingResponse(
            variant!.Id,
            variant.SkuCode,
            variant.Product.Name,
            variant.VariantName,
            variant.UnitName,
            variant.RetailPrice,
            variant.CostPrice,
            latest?.IncomingUnitCost,
            latest?.SourceReceiptId,
            latest?.SourceReceiptCode,
            latest?.SourceApprovedAt,
            latest?.UpdatedAt);
    }

    public async Task<PagedResponse<ProductPriceHistoryResponse>> GetPriceHistoryAsync(
        Guid skuId,
        int page,
        int pageSize,
        CancellationToken ct = default)
    {
        if (skuId == Guid.Empty)
            throw new ProductValidationException("SkuId không hợp lệ.");

        if (!await _db.ProductVariants.AsNoTracking().AnyAsync(variant => variant.Id == skuId && !variant.IsDeleted, ct))
            throw new ProductSkuNotFoundException(skuId);

        var safePage = Math.Max(1, page);
        var safePageSize = Math.Clamp(pageSize, 1, 100);
        var costHistory = await _db.ProductCostPriceHistories
            .AsNoTracking()
            .Where(history => history.SkuId == skuId)
            .Select(history => new ProductPriceHistoryResponse(
                history.Id,
                "AverageCost",
                history.OldCostPrice,
                history.NewCostPrice,
                history.IncomingUnitCost,
                history.IncomingQuantity,
                history.SourceType,
                history.SourceReceiptId,
                history.SourceReceiptCode,
                history.UpdatedBy,
                history.SourceApprovedAt,
                history.WasApplied,
                history.ProcessingResult,
                history.SourceApprovedAt,
                history.UpdatedAt))
            .ToListAsync(ct);
        var retailHistory = await _db.ProductRetailPriceHistories
            .AsNoTracking()
            .Where(history => history.SkuId == skuId)
            .Select(history => new ProductPriceHistoryResponse(
                history.Id,
                "RetailPrice",
                history.OldRetailPrice,
                history.NewRetailPrice,
                null,
                null,
                history.SourceType,
                null,
                null,
                history.ChangedByName,
                history.ChangedAt,
                null,
                null,
                null,
                history.ChangedAt))
            .ToListAsync(ct);

        var unified = costHistory
            .Concat(retailHistory)
            .OrderByDescending(history => history.ChangedAt)
            .ThenByDescending(history => history.Id)
            .ToList();
        var items = unified
            .Skip((safePage - 1) * safePageSize)
            .Take(safePageSize)
            .ToList();

        return new PagedResponse<ProductPriceHistoryResponse>(
            items,
            safePage,
            safePageSize,
            unified.Count,
            Math.Max(1, (int)Math.Ceiling(unified.Count / (double)safePageSize)));
    }

    public Task<ProductSkuResponse> CreateAsync(CreateProductSkuRequest request) =>
        throw new ProductValidationException("Quản lý biến thể phải thực hiện qua API sản phẩm (/api/v1/products).");

    public Task<ProductSkuResponse> UpdateAsync(Guid id, UpdateProductSkuRequest request) =>
        throw new ProductValidationException("Quản lý biến thể phải thực hiện qua API sản phẩm (/api/v1/products).");

    public Task DeleteAsync(Guid id) =>
        throw new ProductValidationException("Quản lý biến thể phải thực hiện qua API sản phẩm (/api/v1/products).");

    private IQueryable<ProductVariant> BuildVariantQuery(CatalogViewScope scope)
    {
        var query = _db.ProductVariants
            .Include(v => v.Product)
                .ThenInclude(p => p.Category)
            .Include(v => v.Product)
                .ThenInclude(p => p.Images)
            .AsQueryable();

        if (scope == CatalogViewScope.Store)
            query = query.Where(v => v.SyncedToStoreAt != null);

        return query;
    }

    private static ProductSkuResponse MapToResponse(ProductVariant v) =>
        new(
            v.Id,
            v.ProductId,
            v.Product?.Name ?? string.Empty,
            v.Product?.CategoryId,
            v.Product?.Category?.Name ?? string.Empty,
            v.SkuCode,
            v.Barcode,
            v.VariantName,
            v.WeightInGrams,
            v.RetailPrice,
            v.CostPrice,
            v.RetailPrice,
            v.MinStock,
            v.MaxStock,
            v.IsSellable,
            v.AllowRewardPoints,
            ResolveSkuImageUrl(v),
            v.IsActive,
            v.CreatedAt,
            v.SyncedToStoreAt,
            v.UnitName,
            v.ConversionRate,
            v.BaseVariantId,
            v.IsBaseUnitVariant,
            v.IsAutoGeneratedSku,
            v.IsPurchasable,
            v.CanBeBomComponent,
            v.CanUseInCustom,
            v.CanHaveBom,
            v.Product?.ProductType.ToString() ?? string.Empty,
            v.Product?.InventoryUnit.ToString() ?? string.Empty);

    private static string? ResolveSkuImageUrl(ProductVariant variant)
    {
        if (!string.IsNullOrWhiteSpace(variant.ImageUrl))
            return variant.ImageUrl;

        var images = variant.Product?.Images;
        if (images is null || images.Count == 0) return null;

        return images
            .Where(image => !image.IsDeleted && !string.IsNullOrWhiteSpace(image.ImageUrl))
            .OrderByDescending(image => image.IsThumbnail)
            .ThenBy(image => image.SortOrder)
            .Select(image => image.ImageUrl)
            .FirstOrDefault();
    }

    private static ProductBomCatalogVariantResponse MapBomCatalogVariant(ProductVariant v, bool includeBomLines)
    {
        var activeBomLines = includeBomLines
            ? v.BomLines.Where(b => !b.IsDeleted && !b.IsRequiredBaseComponent).ToList()
            : [];

        return new ProductBomCatalogVariantResponse(
            v.Id,
            v.ProductId,
            v.SkuCode,
            v.VariantName,
            v.IsActive,
            v.IsSellable,
            v.IsPurchasable,
            v.CanBeBomComponent,
            v.CanUseInCustom,
            v.CanHaveBom,
            v.IsBaseUnitVariant,
            v.BaseVariantId,
            v.ConversionRate,
            activeBomLines.Count > 0,
            activeBomLines.Count,
            activeBomLines.Select(MapBomLineResponse).ToList());
    }

    private static BomLineResponse MapBomLineResponse(ProductVariantBomLine b) => new(
        b.MaterialId,
        b.Material?.Name ?? string.Empty,
        b.Material is null ? null : InventoryUnitConverter.GetDisplayUnit(b.Material.InventoryUnit),
        b.Quantity,
        b.ComponentVariantId,
        b.ComponentVariant?.SkuCode,
        b.ComponentVariant?.VariantName,
        b.IsRequiredBaseComponent);
}
