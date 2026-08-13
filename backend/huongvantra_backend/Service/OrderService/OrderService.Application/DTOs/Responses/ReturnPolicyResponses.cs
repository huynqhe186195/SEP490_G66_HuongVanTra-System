namespace OrderService.Application.DTOs.Responses;

public record ReturnPolicyChecklistItemResponse(
    string Id,
    string Label,
    bool Required);

public record ReturnPolicyResponse(
    Guid Id,
    string Code,
    string Name,
    int Version,
    int ReturnWindowDays,
    IReadOnlyList<string> AllowedReasonCodes,
    IReadOnlyList<ReturnPolicyChecklistItemResponse> Checklist,
    int MinEvidenceImages,
    bool AllowPosChannel,
    bool AllowCodChannel,
    bool AllowCustomBundleReturns,
    bool AutoAcceptOnPolicyPass,
    bool PendingRefundUntilAccept,
    string SummaryText);

/// <summary>
/// Policy + ngữ cảnh đơn (Phase 1: chỉ cảnh báo FE, chưa chặn BE).
/// </summary>
public record ReturnPolicyForOrderResponse(
    ReturnPolicyResponse Policy,
    string OrderCode,
    string OrderChannel,
    DateTime? PolicyAnchorAtUtc,
    string PolicyAnchorSource,
    int? DaysElapsed,
    int? DaysRemaining,
    bool IsWithinReturnWindow,
    bool ChannelAllowed,
    bool HasCustomBundlesOnly,
    bool CustomReturnBlocked,
    IReadOnlyList<string> SoftWarnings);
