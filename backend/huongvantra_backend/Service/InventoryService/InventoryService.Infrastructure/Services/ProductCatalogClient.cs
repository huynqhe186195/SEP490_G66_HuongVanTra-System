using System.Net.Http.Json;
using InventoryService.Application.Interfaces;
using InventoryService.Domain.Exceptions;
using Microsoft.Extensions.Logging;

namespace InventoryService.Infrastructure.Services;

public class ProductCatalogClient(HttpClient httpClient, ILogger<ProductCatalogClient> logger) : IProductCatalogClient
{
    public async Task<ProductCatalogSnapshot> GetCatalogAsync(CancellationToken ct = default)
    {
        const int pageSize = 1000;
        var page = 1;
        var products = new List<CatalogProduct>();
        var totalPages = 1;

        do
        {
            var path = $"api/v1/products?isActive=true&page={page}&pageSize={pageSize}";
            ProductPagedResponse? data;
            try
            {
                data = await httpClient.GetFromJsonAsync<ProductPagedResponse>(path, ct);
            }
            catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
            {
                logger.LogError(ex, "Failed to load ProductService catalog for inventory stock handling.");
                throw new InventoryValidationException("Không tải được dữ liệu sản phẩm/BOM để kiểm tra bán trước, trừ sau.");
            }

            if (data?.Items is null)
                throw new InventoryValidationException("ProductService không trả về dữ liệu sản phẩm/BOM hợp lệ.");

            products.AddRange(data.Items.Select(MapProduct));
            totalPages = Math.Max(1, data.TotalPages);
            page += 1;
        } while (page <= totalPages && page <= 20);

        return new ProductCatalogSnapshot(products);
    }

    private static CatalogProduct MapProduct(ProductResponse product) => new(
        product.Id,
        product.Name ?? string.Empty,
        product.ProductType ?? string.Empty,
        product.InventoryUnit ?? string.Empty,
        product.BaseUnit,
        product.IsActive,
        (product.Variants ?? []).Select(v => new CatalogVariant(
            v.Id,
            v.ProductId,
            v.SkuCode ?? string.Empty,
            v.VariantName ?? string.Empty,
            v.IsActive,
            v.IsSellable,
            v.HasBom,
            v.BomLineCount,
            (v.BomLines ?? []).Select(b => new CatalogBomLine(
                b.MaterialId,
                b.MaterialName ?? string.Empty,
                b.MaterialUnitName,
                b.Quantity,
                b.ComponentVariantId,
                b.ComponentSkuCode,
                b.ComponentVariantName,
                b.IsRequiredBaseComponent)).ToList())).ToList());

    private sealed record ProductPagedResponse(
        List<ProductResponse> Items,
        int Page,
        int PageSize,
        int TotalCount,
        int TotalPages);

    private sealed record ProductResponse(
        Guid Id,
        string? Name,
        string? BaseUnit,
        string? InventoryUnit,
        bool IsActive,
        string? ProductType,
        List<ProductVariantResponse>? Variants);

    private sealed record ProductVariantResponse(
        Guid Id,
        Guid ProductId,
        string? SkuCode,
        string? VariantName,
        bool IsActive,
        bool IsSellable,
        bool HasBom,
        int BomLineCount,
        List<BomLineResponse>? BomLines);

    private sealed record BomLineResponse(
        Guid MaterialId,
        string? MaterialName,
        string? MaterialUnitName,
        decimal Quantity,
        Guid? ComponentVariantId,
        string? ComponentSkuCode,
        string? ComponentVariantName,
        bool IsRequiredBaseComponent);
}
