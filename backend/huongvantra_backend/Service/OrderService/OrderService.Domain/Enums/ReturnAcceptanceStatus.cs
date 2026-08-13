namespace OrderService.Domain.Enums;

/// <summary>
/// Phase 4: Request tạo phiếu Pending; Accept mới hoàn tiền + OrderReturned + ReturnInspection.
/// </summary>
public enum ReturnAcceptanceStatus
{
    Pending = 0,
    Accepted = 1,
    Rejected = 2,
}
