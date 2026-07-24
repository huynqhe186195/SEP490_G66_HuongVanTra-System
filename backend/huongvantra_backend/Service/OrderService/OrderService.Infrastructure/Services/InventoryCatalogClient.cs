using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using OrderService.Application.Interfaces;

namespace OrderService.Infrastructure.Services;

public class InventoryCatalogClient(HttpClient httpClient, ILogger<InventoryCatalogClient> logger) : IInventoryCatalogClient
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        PropertyNameCaseInsensitive = true,
    };

    public async Task DeductMaterialsAsync(
        IEnumerable<(Guid SkuId, string? SkuCode, string? SkuName, int Quantity)> items,
        string? referenceType,
        Guid? referenceId,
        string? referenceCode,
        string? note,
        CancellationToken ct = default)
    {
        var body = new DeductMaterialsRequest(
            items.Select(i => new DeductMaterialItem(i.SkuId, i.Quantity, i.SkuCode, i.SkuName)).ToList(),
            referenceType,
            referenceId,
            referenceCode,
            note);

        var response = await httpClient.PostAsJsonAsync("api/v1/inventory/deduct-materials", body, ct);

        if (!response.IsSuccessStatusCode)
        {
            var error = await response.Content.ReadAsStringAsync(ct);
            logger.LogError("Inventory deduct-materials failed {Status}: {Error}", response.StatusCode, error);
            response.EnsureSuccessStatusCode();
        }
    }

    public async Task<InventoryStockHandlingResponse> PreparePosStockDeductionAsync(
        InventoryStockHandlingRequest request,
        CancellationToken ct = default)
    {
        var response = await httpClient.PostAsJsonAsync("api/v1/inventory/pos-stock-handling", request, ct);
        var raw = await response.Content.ReadAsStringAsync(ct);

        if (!response.IsSuccessStatusCode)
        {
            var message = ExtractErrorMessage(raw)
                ?? "Không xử lý được tồn POS. Vui lòng kiểm tra tồn quầy/BOM/nguyên liệu.";
            logger.LogWarning("Inventory POS stock handling failed {Status}: {Error}", response.StatusCode, raw);
            throw new InventoryStockHandlingException(message);
        }

        var result = JsonSerializer.Deserialize<InventoryStockHandlingResponse>(raw, JsonOptions);
        if (result == null)
            throw new InventoryStockHandlingException("InventoryService không trả về kết quả xử lý tồn POS hợp lệ.");

        return result;
    }

    public async Task<InventoryReservationReplaceResponse> ReplaceCodReservationAsync(
        InventoryReservationReplaceRequest request,
        CancellationToken ct = default)
    {
        var response = await httpClient.PostAsJsonAsync("api/v1/inventory/cod-reservation-replace", request, ct);
        var raw = await response.Content.ReadAsStringAsync(ct);

        if (!response.IsSuccessStatusCode)
        {
            var message = ExtractErrorMessage(raw)
                ?? "Không thay được giữ chỗ tồn Kệ Hàng cho đơn COD. Vui lòng kiểm tra tồn khả bán.";
            logger.LogWarning("Inventory COD reservation replace failed {Status}: {Error}", response.StatusCode, raw);
            throw new InventoryStockHandlingException(message);
        }

        var result = JsonSerializer.Deserialize<InventoryReservationReplaceResponse>(raw, JsonOptions);
        if (result == null)
            throw new InventoryStockHandlingException("InventoryService không trả về kết quả thay giữ chỗ COD hợp lệ.");

        return result;
    }

    private static string? ExtractErrorMessage(string raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
            return null;

        try
        {
            using var doc = JsonDocument.Parse(raw);
            var root = doc.RootElement;
            if (root.TryGetProperty("message", out var message) && message.ValueKind == JsonValueKind.String)
                return message.GetString();
            if (root.TryGetProperty("error", out var error) && error.ValueKind == JsonValueKind.String)
                return error.GetString();
            if (root.TryGetProperty("detail", out var detail) && detail.ValueKind == JsonValueKind.String)
                return detail.GetString();
            if (root.TryGetProperty("title", out var title) && title.ValueKind == JsonValueKind.String)
                return title.GetString();
        }
        catch (JsonException)
        {
            return raw.Trim();
        }

        return raw.Trim();
    }

    private sealed record DeductMaterialsRequest(
        List<DeductMaterialItem> Items,
        string? ReferenceType,
        Guid? ReferenceId,
        string? ReferenceCode,
        string? Note);

    private sealed record DeductMaterialItem(
        Guid SkuId,
        int Quantity,
        string? SkuCode,
        string? SkuName);
}
