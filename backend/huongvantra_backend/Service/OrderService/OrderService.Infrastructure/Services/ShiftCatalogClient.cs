using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using OrderService.Application.Interfaces;
using OrderService.Domain.Exceptions;

namespace OrderService.Infrastructure.Services;

public class ShiftCatalogClient(HttpClient httpClient, ILogger<ShiftCatalogClient> logger) : IShiftCatalogClient
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    public async Task<OnDutyShiftInfo?> GetMyOnDutyAsync(string? area = "Shelf", CancellationToken ct = default)
    {
        var qs = string.IsNullOrWhiteSpace(area) ? "" : $"?area={Uri.EscapeDataString(area)}";
        using var response = await httpClient.GetAsync($"api/shifts/me/on-duty{qs}", ct);

        if (response.StatusCode == HttpStatusCode.Unauthorized || response.StatusCode == HttpStatusCode.Forbidden)
            throw new OrderValidationException(
                "Không xác thực được ca làm việc. Vui lòng đăng nhập lại rồi thử mở ca quỹ.");

        if (!response.IsSuccessStatusCode)
        {
            logger.LogWarning("UserService on-duty returned {Status}", response.StatusCode);
            throw new OrderValidationException(
                "Không kiểm tra được ca làm việc. Thử lại sau hoặc liên hệ quản trị.");
        }

        try
        {
            var envelope = await response.Content.ReadFromJsonAsync<OnDutyEnvelope>(JsonOptions, ct);
            var d = envelope?.OnDuty;
            if (d is null || d.SlotId == Guid.Empty) return null;

            return new OnDutyShiftInfo(
                d.SlotId,
                d.TemplateId,
                d.TemplateName ?? "",
                d.Area ?? "",
                d.WorkDate ?? "",
                d.Start ?? "",
                d.End ?? "",
                d.Label ?? $"{d.TemplateName} · {d.Start}–{d.End}");
        }
        catch (JsonException ex)
        {
            logger.LogWarning(ex, "Unable to parse on-duty shift from UserService");
            throw new OrderValidationException(
                "Không đọc được thông tin ca làm việc. Thử lại sau.");
        }
    }

    private sealed class OnDutyEnvelope
    {
        public OnDutyDto? OnDuty { get; set; }
    }

    private sealed class OnDutyDto
    {
        public Guid SlotId { get; set; }
        public Guid TemplateId { get; set; }
        public string? TemplateName { get; set; }
        public string? Area { get; set; }
        public string? WorkDate { get; set; }
        public string? Start { get; set; }
        public string? End { get; set; }
        public string? Label { get; set; }
    }
}
