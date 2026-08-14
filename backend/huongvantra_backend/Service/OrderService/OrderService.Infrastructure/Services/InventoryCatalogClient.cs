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
            var message = ExtractErrorMessage(error)
                ?? "Không trừ được nguyên liệu Kho. Vui lòng kiểm tra tồn Kho rồi thử lại.";
            logger.LogWarning("Inventory deduct-materials failed {Status}: {Error}", response.StatusCode, error);
            throw new InventoryStockHandlingException(message);
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

    public async Task<InventoryStockHandlingResponse> PrepareCustomMaterialsAsync(
        InventoryCustomMaterialsRequest request,
        CancellationToken ct = default)
    {
        var response = await httpClient.PostAsJsonAsync("api/v1/inventory/prepare-custom-materials", request, ct);
        var raw = await response.Content.ReadAsStringAsync(ct);

        if (!response.IsSuccessStatusCode)
        {
            var message = ExtractErrorMessage(raw)
                ?? "Không kiểm tra được tồn nguyên liệu gói custom. Vui lòng thử lại.";
            logger.LogWarning("Inventory prepare-custom-materials failed {Status}: {Error}", response.StatusCode, raw);
            throw new InventoryStockHandlingException(message);
        }

        var result = JsonSerializer.Deserialize<InventoryStockHandlingResponse>(raw, JsonOptions);
        if (result == null)
            throw new InventoryStockHandlingException("InventoryService không trả về kết quả kiểm tra nguyên liệu custom hợp lệ.");

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

    public async Task<HashSet<Guid>> GetOrderIdsWithActiveReservationAsync(
        IReadOnlyCollection<Guid> orderIds,
        CancellationToken ct = default)
    {
        try
        {
            var response = await httpClient.PostAsJsonAsync(
                "api/stock-deduct-queue/reservations/active-order-ids",
                orderIds.ToList(),
                ct);

            var raw = await response.Content.ReadAsStringAsync(ct);
            if (!response.IsSuccessStatusCode)
            {
                logger.LogWarning(
                    "Inventory active reservation lookup failed {Status}: {Error}", response.StatusCode, raw);
                return [];
            }

            var result = JsonSerializer.Deserialize<List<Guid>>(raw, JsonOptions);
            return result == null ? [] : [.. result];
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException)
        {
            // Badge giữ chỗ là thông tin phụ trợ — không chặn danh sách đơn khi Inventory không phản hồi.
            logger.LogWarning(ex, "Không lấy được danh sách đơn đang giữ chỗ từ InventoryService.");
            return [];
        }
    }

    public async Task CancelStockQueuesForOrderAsync(
        Guid orderId,
        string? reason,
        string? previousOrderStatus,
        CancellationToken ct = default)
    {
        var body = new
        {
            orderId,
            reason,
            previousOrderStatus,
        };
        var response = await httpClient.PostAsJsonAsync(
            "api/v1/inventory/cancel-stock-queues-for-order",
            body,
            ct);
        if (!response.IsSuccessStatusCode)
        {
            var error = await response.Content.ReadAsStringAsync(ct);
            var message = ExtractErrorMessage(error)
                ?? "Không hủy được lệnh chờ trừ kho liên kết với đơn.";
            logger.LogWarning(
                "Inventory cancel-stock-queues-for-order failed {Status}: {Error}",
                response.StatusCode,
                error);
            throw new InventoryStockHandlingException(message);
        }
    }

    public async Task FreezeStockQueuesForOrderCancellationAsync(
        Guid orderId,
        string? reason,
        CancellationToken ct = default)
    {
        try
        {
            var response = await httpClient.PostAsJsonAsync(
                "api/v1/inventory/freeze-stock-queues-for-order-cancellation",
                new { orderId, reason },
                ct);
            if (!response.IsSuccessStatusCode)
            {
                var error = await response.Content.ReadAsStringAsync(ct);
                logger.LogWarning(
                    "Inventory freeze-stock-queues failed {Status}: {Error}",
                    response.StatusCode,
                    error);
            }
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
        {
            logger.LogWarning(ex, "Không đóng băng được lệnh chờ trừ kho cho đơn {OrderId}.", orderId);
        }
    }

    public async Task UnfreezeStockQueuesForOrderCancellationAsync(
        Guid orderId,
        CancellationToken ct = default)
    {
        try
        {
            var response = await httpClient.PostAsJsonAsync(
                "api/v1/inventory/unfreeze-stock-queues-for-order-cancellation",
                new { orderId },
                ct);
            if (!response.IsSuccessStatusCode)
            {
                var error = await response.Content.ReadAsStringAsync(ct);
                logger.LogWarning(
                    "Inventory unfreeze-stock-queues failed {Status}: {Error}",
                    response.StatusCode,
                    error);
            }
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
        {
            logger.LogWarning(ex, "Không gỡ đóng băng lệnh chờ trừ kho cho đơn {OrderId}.", orderId);
        }
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
