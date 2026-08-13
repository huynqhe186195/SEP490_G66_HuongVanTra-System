namespace OrderService.Domain.Entities;

/// <summary>
/// Chính sách trả/đổi hàng (Phase 1). Version snapshot sẽ gắn vào ReturnRequest ở phase sau.
/// </summary>
public class ReturnPolicy : BaseEntity
{
    public Guid Id { get; set; }
    public string Code { get; set; } = "DEFAULT";
    public string Name { get; set; } = string.Empty;
    public int Version { get; set; } = 1;
    public bool IsActive { get; set; } = true;

    /// <summary>Số ngày được trả kể từ mốc giao/hoàn tất.</summary>
    public int ReturnWindowDays { get; set; } = 7;

    /// <summary>JSON array mã lý do được phép, vd ["DAMAGED","WRONG_ITEM"].</summary>
    public string AllowedReasonCodesJson { get; set; } = "[]";

    /// <summary>JSON array checklist: [{ "id","label","required" }].</summary>
    public string ChecklistJson { get; set; } = "[]";

    /// <summary>Số ảnh minh chứng tối thiểu (Phase 1 chỉ khai báo; upload ở phase sau).</summary>
    public int MinEvidenceImages { get; set; } = 1;

    public bool AllowPosChannel { get; set; } = true;
    public bool AllowCodChannel { get; set; } = true;

    /// <summary>Đơn chỉ gói custom / hàng đã mở gói custom — mặc định cấm trả.</summary>
    public bool AllowCustomBundleReturns { get; set; }

    /// <summary>System auto-accept khi Pass policy (phase 3); Phase 1 chỉ hiển thị.</summary>
    public bool AutoAcceptOnPolicyPass { get; set; } = true;

    /// <summary>Hoàn tiền chỉ sau khi System Accept (phase 3); Phase 1 chỉ hiển thị.</summary>
    public bool PendingRefundUntilAccept { get; set; } = true;

    public string SummaryText { get; set; } = string.Empty;
}
