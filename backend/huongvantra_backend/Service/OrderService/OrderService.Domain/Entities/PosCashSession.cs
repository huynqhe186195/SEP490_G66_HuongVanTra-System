using OrderService.Domain.Enums;

namespace OrderService.Domain.Entities;

/// <summary>
/// Ca quỹ tiền mặt tại quầy POS. Chỉ tối đa một bản ghi có Status = Open tại một thời điểm
/// (ràng buộc được kiểm tra ở PosCashSessionLogic vì MySQL không hỗ trợ filtered unique index dễ dàng).
/// </summary>
public class PosCashSession : BaseEntity
{
    public Guid Id { get; set; }
    public PosCashSessionStatus Status { get; set; }

    public decimal OpeningCash { get; set; }
    public decimal CashSalesTotal { get; set; }
    public decimal CashRefundTotal { get; set; }
    public int OrderCount { get; set; }
    public string? Note { get; set; }

    public Guid OpenedByUserId { get; set; }
    public string OpenedByName { get; set; } = string.Empty;
    public string? OpenedByRole { get; set; }
    public Guid? ShiftSlotId { get; set; }
    public string? ShiftLabel { get; set; }
    /// <summary>UTC — giờ kết thúc ca gắn quỹ (tham chiếu; không tự đóng).</summary>
    public DateTime? ShiftEndsAtUtc { get; set; }
    public DateTime OpenedAt { get; set; }

    public decimal? CountedCash { get; set; }
    public decimal? ExpectedCash { get; set; }
    public decimal? Variance { get; set; }
    public string? VarianceNote { get; set; }

    public Guid? ClosedByUserId { get; set; }
    public string? ClosedByName { get; set; }
    public DateTime? ClosedAt { get; set; }
}
