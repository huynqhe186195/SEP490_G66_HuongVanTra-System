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
            ParseProductType(request.ProductType));

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

    public async Task<ProductResponse> CreateAsync(CreateProductRequest request)
    {
        if (request is null)
            throw new ProductValidationException("Request body là bắt buộc.");

        var input = ProductInputValidator.ValidateProduct(
            request.CategoryId, request.Name, request.Origin,
            request.FlavorProfile, request.BrewingGuide, request.Description,
            request.BaseUnit, request.WeightValue, request.WeightUnit, request.IsVariantParent);
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
            request.BaseUnit, request.WeightValue, request.WeightUnit, request.IsVariantParent,
            request.IsActive);
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
        for (var i = 0; i < inputs.Count; i++)
        {
            var input = inputs[i];
            var skuCode = string.IsNullOrWhiteSpace(input.SkuCode)
                ? await GenerateUniqueVariantSkuAsync(productName, input.VariantName)
                : input.SkuCode;
            if (await _productRepository.ExistsVariantSkuCodeAsync(skuCode))
                throw new DuplicateSkuCodeException(skuCode);

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

    private async Task<string> GenerateUniqueVariantSkuAsync(string productName, string variantName)
    {
        var prefix = BuildSkuPrefix($"{productName} {variantName}");
        for (var i = 1; i <= 999; i++)
        {
            var candidate = $"{prefix}-{i:000}";
            if (!await _productRepository.ExistsVariantSkuCodeAsync(candidate))
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
        p.BaseUnit, p.WeightValue, p.WeightUnit, p.IsVariantParent,
        p.IsActive, p.IsDeleted, p.CreatedAt, p.SyncedToStoreAt,
        p.ProductType.ToString(),
        FilterSkus(p.Skus, scope).Select(s => MapSku(s, p)).ToList(),
        p.Images.Where(i => !i.IsDeleted).OrderBy(i => i.SortOrder).Select(MapImageResponse).ToList(),
        p.Units.Where(u => !u.IsDeleted).Select(MapUnitResponse).ToList(),
        p.Variants.Where(v => !v.IsDeleted).Select(MapVariantResponse).ToList());

    private static IEnumerable<ProductSku> FilterSkus(IEnumerable<ProductSku> skus, CatalogViewScope scope)
    {
        var items = skus.Where(s => !s.IsDeleted);
        return scope == CatalogViewScope.Store
            ? items.Where(s => s.SyncedToStoreAt != null)
            : items;
    }

    private static ProductSkuResponse MapSku(ProductSku s, Product p) => new(
        s.Id, s.ProductId, p.Name, p.CategoryId, p.Category?.Name ?? string.Empty,
        s.SkuCode, s.Barcode, s.PackagingType,
        s.WeightInGrams, s.BasePrice, s.CostPrice, s.RetailPrice,
        s.MinStock, s.MaxStock, s.IsSellable, s.AllowRewardPoints,
        s.ImageUrl, s.IsActive, s.CreatedAt, s.SyncedToStoreAt);

    private static ProductImageResponse MapImageResponse(ProductImage i) => new(
        i.Id, i.ProductId, i.ImageUrl, i.AltText, i.SortOrder, i.IsThumbnail);

    private static ProductUnitResponse MapUnitResponse(ProductUnit u) => new(
        u.Id, u.ProductId, u.VariantId, u.UnitName, u.ConversionRate,
        u.Price, u.Barcode, u.IsDirectSell, u.IsBaseUnit);

    private static ProductVariantResponse MapVariantResponse(ProductVariant v) => new(
        v.Id, v.ProductId, v.SkuCode, v.Barcode, v.VariantName,
        v.OptionValuesJson, v.CostPrice, v.RetailPrice, v.MinStock, v.MaxStock,
        v.IsSellable, v.AllowRewardPoints, v.IsActive, v.ImageUrl,
        v.Units.Where(u => !u.IsDeleted).Select(MapUnitResponse).ToList(),
        v.BomLines.Where(b => !b.IsDeleted).Select(b => new BomLineResponse(
            b.MaterialId, b.Material?.Name ?? string.Empty, b.Quantity)).ToList());

    private static ProductType ParseProductType(string? value) =>
        Enum.TryParse<ProductType>(value, ignoreCase: true, out var result)
            ? result
            : ProductType.THANH_PHAM;
}
