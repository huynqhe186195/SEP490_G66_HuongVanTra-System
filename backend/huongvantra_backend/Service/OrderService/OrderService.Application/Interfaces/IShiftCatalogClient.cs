namespace OrderService.Application.Interfaces;

public interface IShiftCatalogClient
{
    /// <summary>Ca đã duyệt đang trong giờ của user (JWT forwarded). Null nếu không có.</summary>
    Task<OnDutyShiftInfo?> GetMyOnDutyAsync(string? area = "Shelf", CancellationToken ct = default);
}

public sealed record OnDutyShiftInfo(
    Guid SlotId,
    Guid TemplateId,
    string TemplateName,
    string Area,
    string WorkDate,
    string Start,
    string End,
    string Label);
