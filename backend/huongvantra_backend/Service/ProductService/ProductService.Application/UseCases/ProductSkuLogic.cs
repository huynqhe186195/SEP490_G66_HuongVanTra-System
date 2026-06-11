using System.Globalization;
using System.Text;
using ProductService.Application;
using ProductService.Application.DTOs.Requests;
using ProductService.Application.DTOs.Responses;
using ProductService.Application.Interfaces;
using ProductService.Application.Validation;
using ProductService.Domain.Entities;
using ProductService.Domain.Exceptions;

namespace ProductService.Application.UseCases;

public class ProductSkuLogic(
    IProductSkuRepository _skuRepository,
    IProductRepository _productRepository)
{
    public async Task<PagedResponse<ProductSkuResponse>> GetPagedAsync(
        GetProductSkusRequest request,
        CatalogViewScope scope = CatalogViewScope.Store)
    {
        if (request is null)
            throw new ProductValidationException("Request là bắt buộc.");

        ProductInputValidator.ValidatePagination(request.Page, request.PageSize);

        var (items, total) = await _skuRepository.GetPagedAsync(
            request.Search, request.ProductId, request.IsActive,
            request.Page, request.PageSize, scope);

        return new PagedResponse<ProductSkuResponse>(
            items.Select(MapToResponse).ToList(),
            request.Page,
            request.PageSize,
            total,
            (int)Math.Ceiling((double)total / request.PageSize));
    }

    public async Task<List<ProductSkuResponse>> GetAllAsync(
        bool includeInactive = false,
        CatalogViewScope scope = CatalogViewScope.Store)
    {
        var skus = await _skuRepository.GetAllAsync(includeInactive, scope);
        return skus.Select(MapToResponse).ToList();
    }

    public async Task<ProductSkuResponse> GetByIdAsync(Guid id, CatalogViewScope scope = CatalogViewScope.Store)
    {
        var sku = await _skuRepository.GetByIdAsync(id, scope)
            ?? throw new ProductSkuNotFoundException(id);
        return MapToResponse(sku);
    }

    public async Task<ProductSkuResponse> GetBySkuCodeAsync(string skuCode, CatalogViewScope scope = CatalogViewScope.Store)
    {
        if (string.IsNullOrWhiteSpace(skuCode))
            throw new ProductValidationException("Mã SKU không được để trống.");

        var sku = await _skuRepository.GetBySkuCodeAsync(skuCode.Trim().ToUpperInvariant(), scope)
            ?? throw new ProductSkuNotFoundByCodeException(skuCode);
        return MapToResponse(sku);
    }

    public async Task<List<ProductSkuResponse>> GetByProductIdAsync(
        Guid productId,
        CatalogViewScope scope = CatalogViewScope.Store)
    {
        if (productId == Guid.Empty)
            throw new ProductValidationException("ProductId không hợp lệ.");

        _ = await _productRepository.GetByIdAsync(productId)
            ?? throw new ProductNotFoundException(productId);

        var skus = await _skuRepository.GetByProductIdAsync(productId, scope);
        return skus.Select(MapToResponse).ToList();
    }

    public async Task<ProductSkuResponse> CreateAsync(CreateProductSkuRequest request)
    {
        if (request is null)
            throw new ProductValidationException("Request body là bắt buộc.");

        var input = ProductInputValidator.ValidateProductSku(
            request.ProductId, request.SkuCode, request.Barcode, request.PackagingType,
            request.WeightInGrams, request.BasePrice, request.CostPrice, request.RetailPrice,
            request.MinStock, request.MaxStock, request.IsSellable, request.AllowRewardPoints,
            request.ImageUrl, allowBlankSku: true);

        var product = await _productRepository.GetByIdAsync(input.ProductId)
            ?? throw new ProductNotFoundException(input.ProductId);

        var skuCode = string.IsNullOrWhiteSpace(input.SkuCode)
            ? await GenerateUniqueSkuAsync(product.Name, input.PackagingType)
            : input.SkuCode;

        if (await _skuRepository.ExistsSkuCodeAsync(skuCode))
            throw new DuplicateSkuCodeException(skuCode);
        if (!string.IsNullOrWhiteSpace(input.Barcode) && await _skuRepository.ExistsBarcodeAsync(input.Barcode))
            throw new ProductValidationException($"Barcode '{input.Barcode}' đã tồn tại.");

        var sku = new ProductSku
        {
            ProductId = input.ProductId,
            SkuCode = skuCode,
            Barcode = input.Barcode,
            PackagingType = input.PackagingType,
            WeightInGrams = input.WeightInGrams,
            BasePrice = input.BasePrice,
            CostPrice = input.CostPrice,
            RetailPrice = input.RetailPrice,
            MinStock = input.MinStock,
            MaxStock = input.MaxStock,
            IsSellable = input.IsSellable,
            AllowRewardPoints = input.AllowRewardPoints,
            ImageUrl = input.ImageUrl
        };

        var created = await _skuRepository.CreateAsync(sku);
        return MapToResponse(created);
    }

    public async Task<ProductSkuResponse> UpdateAsync(Guid id, UpdateProductSkuRequest request)
    {
        if (request is null)
            throw new ProductValidationException("Request body là bắt buộc.");

        var sku = await _skuRepository.GetByIdAsync(id)
            ?? throw new ProductSkuNotFoundException(id);

        var input = ProductInputValidator.ValidateProductSku(
            sku.ProductId, request.SkuCode, request.Barcode, request.PackagingType,
            request.WeightInGrams, request.BasePrice, request.CostPrice, request.RetailPrice,
            request.MinStock, request.MaxStock, request.IsSellable, request.AllowRewardPoints,
            request.ImageUrl, request.IsActive);

        if (await _skuRepository.ExistsSkuCodeAsync(input.SkuCode!, id))
            throw new DuplicateSkuCodeException(input.SkuCode!);
        if (!string.IsNullOrWhiteSpace(input.Barcode) && await _skuRepository.ExistsBarcodeAsync(input.Barcode, id))
            throw new ProductValidationException($"Barcode '{input.Barcode}' đã tồn tại.");

        sku.SkuCode = input.SkuCode!;
        sku.Barcode = input.Barcode;
        sku.PackagingType = input.PackagingType;
        sku.WeightInGrams = input.WeightInGrams;
        sku.BasePrice = input.BasePrice;
        sku.CostPrice = input.CostPrice;
        sku.RetailPrice = input.RetailPrice;
        sku.MinStock = input.MinStock;
        sku.MaxStock = input.MaxStock;
        sku.IsSellable = input.IsSellable;
        sku.AllowRewardPoints = input.AllowRewardPoints;
        sku.ImageUrl = input.ImageUrl;
        sku.IsActive = input.IsActive ?? sku.IsActive;
        sku.UpdatedAt = DateTime.UtcNow;

        var updated = await _skuRepository.UpdateAsync(sku);
        return MapToResponse(updated);
    }

    public async Task DeleteAsync(Guid id)
    {
        var sku = await _skuRepository.GetByIdAsync(id)
            ?? throw new ProductSkuNotFoundException(id);
        await _skuRepository.DeleteAsync(sku);
    }

    private async Task<string> GenerateUniqueSkuAsync(string productName, string packagingType)
    {
        var prefix = BuildSkuPrefix($"{productName} {packagingType}");
        for (var i = 1; i <= 999; i++)
        {
            var candidate = $"{prefix}-{i:000}";
            if (!await _skuRepository.ExistsSkuCodeAsync(candidate))
                return candidate;
        }

        throw new ProductValidationException("Không thể tự sinh SKU duy nhất. Vui lòng nhập SKU thủ công.");
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

    private static ProductSkuResponse MapToResponse(ProductSku s) =>
        new(
            s.Id,
            s.ProductId,
            s.Product?.Name ?? string.Empty,
            s.Product?.Category?.Name ?? string.Empty,
            s.SkuCode,
            s.Barcode,
            s.PackagingType,
            s.WeightInGrams,
            s.BasePrice,
            s.CostPrice,
            s.RetailPrice,
            s.MinStock,
            s.MaxStock,
            s.IsSellable,
            s.AllowRewardPoints,
            s.ImageUrl,
            s.IsActive,
            s.CreatedAt,
            s.SyncedToStoreAt);
}
