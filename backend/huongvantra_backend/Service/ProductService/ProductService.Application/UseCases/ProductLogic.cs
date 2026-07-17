using System.Globalization;
using System.Text;
using ProductService.Application;
using ProductService.Application.DTOs.Requests;
using ProductService.Application.DTOs.Responses;
using ProductService.Application.Interfaces;
using ProductService.Application.Validation;
using ProductService.Domain.Entities;
using ProductService.Domain.Enums;
using ProductService.Domain.Exceptions;

namespace ProductService.Application.UseCases;

public class ProductLogic(IProductRepository _productRepository, ICategoryRepository _categoryRepository)
{
    public async Task<PagedResponse<ProductResponse>> GetPagedAsync(
        GetProductsRequest request,
        CatalogViewScope scope = CatalogViewScope.Store)
    {
        if (request is null)
            throw new ProductValidationException("Request là bắt buộc.");

        ProductInputValidator.ValidatePagination(request.Page, request.PageSize);

        var (items, total) = await _productRepository.GetPagedAsync(
            request.Search, request.CategoryId, request.IsActive, request.IsDeleted,
            request.Page, request.PageSize, scope,
            ParseProductTypeFilter(request.ProductType));

        return new PagedResponse<ProductResponse>(
            items.Select(p => MapToResponse(p, scope)).ToList(),
            request.Page,
            request.PageSize,
            total,
            (int)Math.Ceiling((double)total / request.PageSize));
    }

    public async Task<List<ProductResponse>> GetAllAsync(
        bool includeInactive = false,
        CatalogViewScope scope = CatalogViewScope.Store)
    {
        var products = await _productRepository.GetAllAsync(includeInactive, scope);
        return products.Select(p => MapToResponse(p, scope)).ToList();
    }

    public async Task<ProductResponse> GetByIdAsync(Guid id, CatalogViewScope scope = CatalogViewScope.Store)
    {
        var product = await _productRepository.GetByIdAsync(id)
            ?? throw new ProductNotFoundException(id);

        if (scope == CatalogViewScope.Store && product.SyncedToStoreAt == null)
            throw new ProductNotFoundException(id);

        return MapToResponse(product, scope);
    }

    public async Task<List<BomLineResponse>> GetVariantBomAsync(Guid variantId)
    {
        var variant = await _productRepository.GetVariantByIdAsync(variantId)
            ?? throw new ProductValidationException("Không tìm thấy SKU/ProductVariant.");

        return variant.BomLines
            .Where(line => !line.IsDeleted)
            .Select(MapBomLineResponse)
            .ToList();
    }

    public async Task<List<BomLineResponse>> UpdateVariantBomAsync(Guid variantId, UpdateVariantBomRequest request)
    {
        if (request is null)
            throw new ProductValidationException("Request body là bắt buộc.");

        var variant = await _productRepository.GetVariantByIdAsync(variantId)
            ?? throw new ProductValidationException("Không tìm thấy SKU/ProductVariant.");

        if (variant.Product.ProductType != ProductType.THANH_PHAM)
            throw new ProductValidationException("Chỉ SKU Sản phẩm kệ mới được cấu hình BOM.");

        var lines = request.Lines ?? [];
        var normalized = lines
            .Select(line => new BomLineRequest(line.MaterialId, line.Quantity))
            .ToList();

        if (normalized.Any(line => line.MaterialId == variant.ProductId))
            throw new ProductValidationException("BOM component không được tham chiếu chính sản phẩm đầu ra.");

        var duplicate = normalized
            .GroupBy(line => line.MaterialId)
            .FirstOrDefault(group => group.Count() > 1);
        if (duplicate is not null)
            throw new ProductValidationException("Không được chọn trùng component trong một BOM.");

        var materialIds = normalized.Select(line => line.MaterialId).ToHashSet();
        var materials = await _productRepository.GetProductsByIdsAsync(materialIds);
        if (materials.Count != materialIds.Count)
            throw new ProductValidationException("Có component BOM không tồn tại hoặc đã bị xóa.");

        var nonMaterial = materials.FirstOrDefault(product =>
            product.ProductType != ProductType.NGUYEN_LIEU && product.ProductType != ProductType.BAO_BI);
        if (nonMaterial is not null)
            throw new ProductValidationException($"'{nonMaterial.Name}' không phải là Nguyên liệu hoặc Bao bì.");

        var normalizedBomLines = NormalizeBomQuantities(normalized, materials);

        var updated = await _productRepository.ReplaceVariantBomAsync(
            variantId,
            normalizedBomLines.Select(line => new ProductVariantBomLine
            {
                MaterialId = line.MaterialId,
                Quantity = line.Quantity
            }).ToList());

        return updated.BomLines
            .Where(line => !line.IsDeleted)
            .Select(MapBomLineResponse)
            .ToList();
    }

    public async Task<ProductResponse> CreateAsync(CreateProductRequest request)
    {
        if (request is null)
            throw new ProductValidationException("Request body là bắt buộc.");

        var input = ProductInputValidator.ValidateProduct(
            request.CategoryId, request.Name, request.Origin,
            request.FlavorProfile, request.BrewingGuide, request.Description,
            baseUnitValue: request.BaseUnit,
            weightValue: request.WeightValue,
            weightUnitValue: request.WeightUnit,
            inventoryUnitValue: request.InventoryUnit,
            isVariantParent: request.IsVariantParent);
        var images = ProductInputValidator.ValidateImages(request.Images);
        var units = ProductInputValidator.ValidateUnits(request.Units);
        var variants = MergeVariants(
            ProductInputValidator.ValidateVariants(request.Variants),
            ProductInputValidator.ValidateVariantGenerator(request.VariantGenerator));

        _ = await _categoryRepository.GetByIdAsync(input.CategoryId)
            ?? throw new CategoryNotFoundException(input.CategoryId);

        if (await _productRepository.ExistsNameAsync(input.Name))
            throw new ProductValidationException(
                $"Sản phẩm '{input.Name}' đã tồn tại (kể cả đang ngừng kinh doanh hoặc đã xóa mềm). Hãy kích hoạt lại bản cũ thay vì tạo mới.");

        var product = new Product
        {
            CategoryId = input.CategoryId,
            Name = input.Name,
            Origin = input.Origin,
            FlavorProfile = input.FlavorProfile,
            BrewingGuide = input.BrewingGuide,
            Description = input.Description,
            BaseUnit = input.BaseUnit,
            InventoryUnit = input.InventoryUnit,
            WeightValue = input.WeightValue,
            WeightUnit = input.WeightUnit,
            IsVariantParent = input.IsVariantParent || variants.Count > 0,
            ProductType = ParseProductType(request.ProductType),
            Images = images.Select(MapImage).ToList(),
            Units = units.Select(MapUnit).ToList(),
            Variants = await MapVariantsAsync(input.Name, variants, request.Variants)
        };

        var created = await _productRepository.CreateAsync(product);
        return MapToResponse(created, CatalogViewScope.Warehouse);
    }

    public async Task<ProductResponse> UpdateAsync(Guid id, UpdateProductRequest request)
    {
        if (request is null)
            throw new ProductValidationException("Request body là bắt buộc.");

        var product = await _productRepository.GetByIdAsync(id)
            ?? throw new ProductNotFoundException(id);
        if (product.IsDeleted)
            throw new ProductValidationException("Không thể sửa sản phẩm đã xóa mềm. Hãy kích hoạt lại trước.");

        var input = ProductInputValidator.ValidateProduct(
            request.CategoryId, request.Name, request.Origin,
            request.FlavorProfile, request.BrewingGuide, request.Description,
            baseUnitValue: request.BaseUnit,
            weightValue: request.WeightValue,
            weightUnitValue: request.WeightUnit,
            inventoryUnitValue: request.InventoryUnit,
            isVariantParent: request.IsVariantParent,
            isActive: request.IsActive);
        var images = ProductInputValidator.ValidateImages(request.Images);
        var units = ProductInputValidator.ValidateUnits(request.Units);
        var variants = MergeVariants(
            ProductInputValidator.ValidateVariants(request.Variants),
            ProductInputValidator.ValidateVariantGenerator(request.VariantGenerator));

        _ = await _categoryRepository.GetByIdAsync(input.CategoryId)
            ?? throw new CategoryNotFoundException(input.CategoryId);

        if (await _productRepository.ExistsNameAsync(input.Name, excludeProductId: id))
            throw new ProductValidationException($"Sản phẩm với tên '{input.Name}' đã tồn tại.");

        product.CategoryId = input.CategoryId;
        product.Name = input.Name;
        product.Origin = input.Origin;
        product.FlavorProfile = input.FlavorProfile;
        product.BrewingGuide = input.BrewingGuide;
        product.Description = input.Description;
        product.BaseUnit = input.BaseUnit;
        product.InventoryUnit = input.InventoryUnit;
        product.WeightValue = input.WeightValue;
        product.WeightUnit = input.WeightUnit;
        product.IsVariantParent = input.IsVariantParent || variants.Count > 0;
        product.IsActive = input.IsActive ?? product.IsActive;
        product.ProductType = ParseProductType(request.ProductType);
        product.UpdatedAt = DateTime.UtcNow;

        Replace(product.Images, images.Select(MapImage));
        Replace(product.Units, units.Select(MapUnit));
        Replace(product.Variants, await MapVariantsAsync(input.Name, variants, request.Variants));

        var updated = await _productRepository.UpdateAsync(product);
        return MapToResponse(updated, CatalogViewScope.Warehouse);
    }

    public async Task DeleteAsync(Guid id)
    {
        var product = await _productRepository.GetByIdAsync(id)
            ?? throw new ProductNotFoundException(id);
        if (product.IsDeleted)
            throw new ProductValidationException("Sản phẩm đã được xóa mềm.");
        await _productRepository.DeleteAsync(product);
    }

    public async Task<ProductResponse> RestoreAsync(Guid id)
    {
        var product = await _productRepository.GetByIdAsync(id, includeDeleted: true)
            ?? throw new ProductNotFoundException(id);
        if (!product.IsDeleted)
            throw new ProductValidationException("Sản phẩm chưa bị xóa mềm.");

        if (await _productRepository.ExistsNameAsync(product.Name, excludeProductId: id, includeDeleted: false))
            throw new ProductValidationException(
                $"Không thể kích hoạt lại — đã có sản phẩm khác tên '{product.Name}'. Đổi tên bản mới hoặc xóa bản trùng trước.");

        await _productRepository.RestoreAsync(product);
        return MapToResponse((await _productRepository.GetByIdAsync(id))!, CatalogViewScope.Warehouse);
    }

    private async Task<List<ProductVariant>> MapVariantsAsync(
        string productName,
        List<ValidatedProductVariantInput> inputs,
        List<ProductVariantRequest>? rawRequests = null)
    {
        var variants = new List<ProductVariant>();
        var usedInBatch = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        for (var i = 0; i < inputs.Count; i++)
        {
            var input = inputs[i];
            var skuCode = string.IsNullOrWhiteSpace(input.SkuCode)
                ? await GenerateUniqueVariantSkuAsync(productName, input.VariantName, usedInBatch)
                : input.SkuCode;
            if (await _productRepository.ExistsVariantSkuCodeAsync(skuCode))
                throw new DuplicateSkuCodeException(skuCode);
            usedInBatch.Add(skuCode);

            var bomLines = rawRequests != null && i < rawRequests.Count
                ? (rawRequests[i].BomLines ?? [])
                    .Where(b => b.Quantity > 0)
                    .Select(b => new ProductVariantBomLine
                    {
                        MaterialId = b.MaterialId,
                        Quantity = b.Quantity
                    }).ToList()
                : new List<ProductVariantBomLine>();

            variants.Add(new ProductVariant
            {
                SkuCode = skuCode,
                Barcode = input.Barcode,
                VariantName = input.VariantName,
                OptionValuesJson = input.OptionValuesJson,
                CostPrice = input.CostPrice,
                RetailPrice = input.RetailPrice,
                MinStock = input.MinStock,
                MaxStock = input.MaxStock,
                IsSellable = input.IsSellable,
                AllowRewardPoints = input.AllowRewardPoints,
                IsActive = input.IsActive,
                ImageUrl = input.ImageUrl,
                Units = input.Units.Select(MapUnit).ToList(),
                BomLines = bomLines
            });
        }

        return variants;
    }

    private async Task<string> GenerateUniqueVariantSkuAsync(string productName, string variantName, HashSet<string>? usedInBatch = null)
    {
        // variantName already contains product name (built on frontend as "productName - unitName - attrs")
        // so use variantName alone to avoid doubling the product name in the prefix
        var skuSource = variantName.StartsWith(productName, StringComparison.OrdinalIgnoreCase)
            ? variantName
            : $"{productName} {variantName}";
        var prefix = BuildSkuPrefix(skuSource);
        for (var i = 1; i <= 999; i++)
        {
            var candidate = $"{prefix}-{i:000}";
            if ((usedInBatch == null || !usedInBatch.Contains(candidate))
                && !await _productRepository.ExistsVariantSkuCodeAsync(candidate))
                return candidate;
        }

        throw new ProductValidationException("Không thể tự sinh SKU biến thể duy nhất. Vui lòng nhập SKU thủ công.");
    }

    private static string BuildSkuPrefix(string value)
    {
        var normalized = value.Normalize(NormalizationForm.FormD);
        var chars = normalized
            .Where(c => CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark)
            .Select(c => char.IsLetterOrDigit(c) ? char.ToUpperInvariant(c) : '-')
            .ToArray();
        var prefix = string.Join('-', new string(chars).Split('-', StringSplitOptions.RemoveEmptyEntries));
        return prefix.Length switch
        {
            0 => "SKU",
            > 20 => prefix[..20].Trim('-'),
            _ => prefix
        };
    }

    private static List<ValidatedProductVariantInput> MergeVariants(
        List<ValidatedProductVariantInput> explicitVariants,
        List<ValidatedProductVariantInput> generatedVariants)
    {
        explicitVariants.AddRange(generatedVariants);
        return explicitVariants;
    }

    private static ProductImage MapImage(ValidatedProductImageInput input) => new()
    {
        ImageUrl = input.ImageUrl,
        AltText = input.AltText,
        SortOrder = input.SortOrder,
        IsThumbnail = input.IsThumbnail
    };

    private static ProductUnit MapUnit(ValidatedProductUnitInput input) => new()
    {
        VariantId = input.VariantId,
        UnitName = input.UnitName,
        ConversionRate = input.ConversionRate,
        Price = input.Price,
        Barcode = input.Barcode,
        IsDirectSell = input.IsDirectSell,
        IsBaseUnit = input.IsBaseUnit
    };

    private static void Replace<T>(ICollection<T> target, IEnumerable<T> values)
    {
        target.Clear();
        foreach (var value in values)
            target.Add(value);
    }

    private static ProductResponse MapToResponse(Product p, CatalogViewScope scope) => new(
        p.Id, p.CategoryId, p.Category?.Name ?? string.Empty,
        p.Name, p.Origin, p.FlavorProfile, p.BrewingGuide, p.Description,
        p.BaseUnit, p.InventoryUnit.ToString(), p.WeightValue, p.WeightUnit, p.IsVariantParent,
        p.IsActive, p.IsDeleted, p.CreatedAt, p.SyncedToStoreAt,
        p.ProductType.ToString(),
        new List<ProductSkuResponse>(),
        p.Images.Where(i => !i.IsDeleted).OrderBy(i => i.SortOrder).Select(MapImageResponse).ToList(),
        p.Units.Where(u => !u.IsDeleted).Select(MapUnitResponse).ToList(),
        p.Variants.Where(v => !v.IsDeleted).Select(MapVariantResponse).ToList());

    private static ProductImageResponse MapImageResponse(ProductImage i) => new(
        i.Id, i.ProductId, i.ImageUrl, i.AltText, i.SortOrder, i.IsThumbnail);

    private static ProductUnitResponse MapUnitResponse(ProductUnit u) => new(
        u.Id, u.ProductId, u.VariantId, u.UnitName, u.ConversionRate,
        u.Price, u.Barcode, u.IsDirectSell, u.IsBaseUnit);

    private static BomLineResponse MapBomLineResponse(ProductVariantBomLine b) => new(
        b.MaterialId,
        b.Material?.Name ?? string.Empty,
        ResolveMaterialUnit(b.Material),
        b.Quantity);

    private static List<BomLineRequest> NormalizeBomQuantities(List<BomLineRequest> lines, List<Product> materials)
    {
        var materialById = materials.ToDictionary(material => material.Id);
        var errors = new List<string>();
        var result = new List<BomLineRequest>();

        foreach (var line in lines)
        {
            var material = materialById[line.MaterialId];
            var unit = ResolveMaterialUnit(material);
            var unitLabel = string.IsNullOrWhiteSpace(unit) ? "đơn vị" : unit.Trim();

            try
            {
                var normalized = InventoryUnitConverter.NormalizeQuantity(
                    line.Quantity,
                    material.InventoryUnit,
                    unit);
                result.Add(new BomLineRequest(line.MaterialId, normalized));
            }
            catch (ProductValidationException ex)
            {
                errors.AddRange(ex.Errors.Select(error => $"{material.Name} ({unitLabel}): {error}"));
            }
        }

        if (errors.Count > 0)
            throw new ProductValidationException(errors.Distinct());

        return result;
    }

    private static string ResolveMaterialUnit(Product? material)
    {
        if (material is null) return string.Empty;

        return InventoryUnitConverter.GetDisplayUnit(material.InventoryUnit);
    }

    private static ProductVariantResponse MapVariantResponse(ProductVariant v)
    {
        var activeBomLines = v.BomLines.Where(b => !b.IsDeleted).ToList();

        return new ProductVariantResponse(
            v.Id, v.ProductId, v.SkuCode, v.Barcode, v.VariantName,
            v.OptionValuesJson, v.CostPrice, v.RetailPrice, v.MinStock, v.MaxStock,
            v.IsSellable, v.AllowRewardPoints, v.IsActive, v.ImageUrl,
            activeBomLines.Count > 0,
            activeBomLines.Count,
            v.Units.Where(u => !u.IsDeleted).Select(MapUnitResponse).ToList(),
            activeBomLines.Select(MapBomLineResponse).ToList());
    }

    private static ProductType? ParseProductTypeFilter(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        return Enum.TryParse<ProductType>(value, ignoreCase: true, out var result)
            ? result
            : null;
    }

    private static ProductType ParseProductType(string? value) =>
        ParseProductTypeFilter(value) ?? ProductType.THANH_PHAM;
}
