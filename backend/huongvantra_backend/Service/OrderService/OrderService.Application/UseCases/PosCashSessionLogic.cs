using OrderService.Application.Authorization;
using OrderService.Application.DTOs.Requests;
using OrderService.Application.DTOs.Responses;
using OrderService.Application.Interfaces;
using OrderService.Domain.Entities;
using OrderService.Domain.Enums;
using OrderService.Domain.Exceptions;

namespace OrderService.Application.UseCases;

/// <summary>
/// Quỹ tiền mặt POS:
/// - Chỉ người mở hoặc Manager/Admin được đóng.
/// - Sale ca sau không đóng hộ; Manager đóng hộ được (POS hoặc Lịch làm việc).
/// - Không tự đóng khi hết giờ ca — QL mở/đóng quỹ gắn ô ca trên lịch.
/// - Không khóa «cần QL mở lại» sau khi đóng — Sale ca sau mở quỹ bình thường.
/// </summary>
public class PosCashSessionLogic(
    IPosCashSessionRepository _repo,
    IShiftCatalogClient _shifts,
    StaffShiftGuard _shiftGuard)
{
    private const decimal VarianceNoteRequiredThreshold = 1000m;
    private const string DefaultOpenedByName = "Nhân viên POS";

    public async Task<CurrentPosCashSessionResponse> GetCurrentAsync(
        Guid userId,
        bool canBypassShiftRequirement,
        CancellationToken ct = default)
    {
        var session = await _repo.GetOpenAsync(ct);
        if (session is null)
            return new CurrentPosCashSessionResponse(null);

        var mapped = MapToResponse(session);
        var previousLabel = string.IsNullOrWhiteSpace(session.ShiftLabel) ? null : session.ShiftLabel;
        var opener = string.IsNullOrWhiteSpace(session.OpenedByName) ? "Sale ca trước" : session.OpenedByName;
        var isOpener = IsSessionOpener(session, userId);

        if (isOpener)
            return new CurrentPosCashSessionResponse(mapped, CanCloseSession: true);

        if (canBypassShiftRequirement)
        {
            return new CurrentPosCashSessionResponse(
                mapped,
                RequiresCloseForNewShift: true,
                PreviousShiftLabel: previousLabel,
                CanCloseSession: true);
        }

        var closeBlocked = previousLabel is not null
            ? $"Quỹ «{previousLabel}» vẫn đang mở (do {opener}). Báo họ đóng quỹ hoặc nhờ Quản lý đóng trên «Lịch làm việc» / POS."
            : $"Quỹ vẫn đang mở (do {opener}). Báo họ đóng quỹ hoặc nhờ Quản lý đóng trên «Lịch làm việc» / POS.";

        return new CurrentPosCashSessionResponse(
            mapped,
            RequiresCloseForNewShift: true,
            PreviousShiftLabel: previousLabel,
            CanCloseSession: false,
            CloseBlockedMessage: closeBlocked);
    }

    public async Task<PagedResponse<PosCashSessionResponse>> GetHistoryAsync(
        DateTime? fromUtc,
        DateTime? toUtcExclusive,
        string? status,
        string? search,
        int page,
        int pageSize,
        CancellationToken ct = default)
    {
        PosCashSessionStatus? parsedStatus = null;
        if (!string.IsNullOrWhiteSpace(status)
            && Enum.TryParse<PosCashSessionStatus>(status.Trim(), ignoreCase: true, out var st))
        {
            parsedStatus = st;
        }

        var safePage = Math.Max(1, page);
        var safePageSize = Math.Clamp(pageSize, 1, 100);
        var (items, total) = await _repo.GetPagedAsync(
            fromUtc, toUtcExclusive, parsedStatus, search, safePage, safePageSize, ct);

        return new PagedResponse<PosCashSessionResponse>(
            items.Select(MapToResponse).ToList(),
            safePage,
            safePageSize,
            total,
            (int)Math.Ceiling(total / (double)safePageSize));
    }

    public async Task<PosCashSessionResponse> OpenAsync(
        OpenPosCashSessionRequest request,
        Guid userId,
        string? actorName,
        bool canBypassShiftRequirement,
        CancellationToken ct = default)
    {
        var existing = await _repo.GetOpenAsync(ct);
        if (existing is not null)
        {
            var label = string.IsNullOrWhiteSpace(existing.ShiftLabel) ? "quỹ đang mở" : existing.ShiftLabel;
            var opener = string.IsNullOrWhiteSpace(existing.OpenedByName) ? "người mở trước" : existing.OpenedByName;
            throw new OrderValidationException(
                $"Quỹ «{label}» vẫn đang mở (do {opener}). Nhờ đóng quỹ trước khi mở quỹ ca bạn.");
        }

        var onDuty = await _shifts.GetMyOnDutyAsync("Shelf", ct);
        if (onDuty is null && !canBypassShiftRequirement)
            throw new OrderValidationException(
                "Chỉ mở ca quỹ khi bạn đã được duyệt ca quầy và đang trong giờ làm. Hãy đăng ký / chờ duyệt ca trên «Lịch làm việc».");

        if (onDuty is not null && request.ShiftSlotId.HasValue && request.ShiftSlotId.Value != onDuty.SlotId)
            throw new OrderValidationException("Ca quỹ phải gắn đúng ca quầy bạn đang được xếp.");

        // Manager mở từ Lịch: bắt buộc chọn ô ca để biết đang mở quỹ ca nào.
        if (canBypassShiftRequirement && onDuty is null && !request.ShiftSlotId.HasValue)
            throw new OrderValidationException(
                "Quản lý mở quỹ phải chọn ô ca trên «Lịch làm việc» (thiếu shiftSlotId).");

        var openingCash = Math.Max(0, request.OpeningCash);
        var openedByName = FirstNonEmpty(request.OpenedByName, actorName) ?? DefaultOpenedByName;
        var now = DateTime.UtcNow;

        var shiftSlotId = onDuty?.SlotId
            ?? (canBypassShiftRequirement ? request.ShiftSlotId : null);
        var shiftLabel = FirstNonEmpty(
            request.ShiftLabel,
            onDuty?.TemplateName,
            StripShiftHours(onDuty?.Label));

        var shiftEndsAtUtc = ComputeShiftEndsAtUtc(onDuty)
            ?? ComputeShiftEndsAtUtcFromParts(request.WorkDate, request.ShiftEnd);

        var session = new PosCashSession
        {
            Id = Guid.NewGuid(),
            Status = PosCashSessionStatus.Open,
            OpeningCash = openingCash,
            CashSalesTotal = 0m,
            CashRefundTotal = 0m,
            OrderCount = 0,
            Note = NormalizeOptional(request.Note),
            OpenedByUserId = userId,
            OpenedByName = openedByName,
            OpenedByRole = NormalizeOptional(request.OpenedByRole),
            ShiftSlotId = shiftSlotId,
            ShiftLabel = shiftLabel,
            ShiftEndsAtUtc = shiftEndsAtUtc,
            OpenedAt = now,
            CreatedAt = now,
            UpdatedAt = now
        };

        await _repo.AddAsync(session, ct);
        await _repo.SaveChangesAsync(ct);
        return MapToResponse(session);
    }

    public async Task<PosCashSessionResponse> CloseAsync(
        ClosePosCashSessionRequest request,
        Guid userId,
        string? actorName,
        bool canBypassShiftRequirement,
        CancellationToken ct = default)
    {
        await _shiftGuard.EnsureShelfOnDutyAsync(canBypassShiftRequirement, ct);

        var session = await _repo.GetOpenAsync(ct)
            ?? throw new OrderValidationException("Không có ca quỹ đang mở để đóng.");

        if (request.ExpectedShiftSlotId.HasValue)
        {
            if (!session.ShiftSlotId.HasValue
                || session.ShiftSlotId.Value != request.ExpectedShiftSlotId.Value)
            {
                var openLabel = string.IsNullOrWhiteSpace(session.ShiftLabel)
                    ? "quỹ đang mở"
                    : session.ShiftLabel;
                throw new OrderValidationException(
                    $"Quỹ đang mở là «{openLabel}», không khớp ô ca bạn chọn trên lịch. "
                    + "Chọn đúng ô ca đó rồi đóng, hoặc đóng hộ từ POS.");
            }
        }

        if (!canBypassShiftRequirement && !IsSessionOpener(session, userId))
        {
            var label = string.IsNullOrWhiteSpace(session.ShiftLabel) ? "quỹ đang mở" : session.ShiftLabel;
            var opener = string.IsNullOrWhiteSpace(session.OpenedByName) ? "người mở trước" : session.OpenedByName;
            throw new OrderValidationException(
                $"Không đóng được quỹ «{label}» (do {opener}). Báo họ đóng quỹ hoặc nhờ Quản lý đóng trên «Lịch làm việc» / POS.");
        }

        ApplyClose(
            session,
            Math.Max(0, request.CountedCash),
            NormalizeOptional(request.VarianceNote),
            userId == Guid.Empty ? null : userId,
            FirstNonEmpty(actorName, DefaultOpenedByName)!);

        await _repo.SaveChangesAsync(ct);
        return MapToResponse(session);
    }

    public async Task RecordCashSaleAsync(decimal amount, CancellationToken ct = default)
    {
        if (amount <= 0) return;

        var session = await _repo.GetOpenAsync(ct);
        if (session is null) return;

        session.CashSalesTotal += amount;
        session.OrderCount += 1;
        session.UpdatedAt = DateTime.UtcNow;
        await _repo.SaveChangesAsync(ct);
    }

    public async Task RecordCashRefundAsync(decimal amount, CancellationToken ct = default)
    {
        if (amount <= 0) return;

        var session = await _repo.GetOpenAsync(ct);
        if (session is null) return;

        session.CashRefundTotal += amount;
        session.UpdatedAt = DateTime.UtcNow;
        await _repo.SaveChangesAsync(ct);
    }

    private void ApplyClose(
        PosCashSession session,
        decimal counted,
        string? varianceNote,
        Guid? closedByUserId,
        string closedByName)
    {
        var expected = ComputeExpectedCash(session);
        var variance = counted - expected;

        if (Math.Abs(variance) >= VarianceNoteRequiredThreshold && varianceNote is null)
        {
            throw new OrderValidationException("Có chênh lệch quỹ — vui lòng nhập lý do lệch trước khi đóng ca.");
        }

        session.Status = PosCashSessionStatus.Closed;
        session.CountedCash = counted;
        session.ExpectedCash = expected;
        session.Variance = variance;
        session.VarianceNote = varianceNote;
        session.ClosedByUserId = closedByUserId;
        session.ClosedByName = closedByName;
        session.ClosedAt = DateTime.UtcNow;
        session.UpdatedAt = DateTime.UtcNow;
    }

    private static bool IsSessionOpener(PosCashSession session, Guid userId) =>
        session.OpenedByUserId != Guid.Empty && session.OpenedByUserId == userId;

    /// <summary>WorkDate + End (giờ VN) → UTC — lưu tham chiếu giờ kết thúc ca (không dùng để tự đóng).</summary>
    private static DateTime? ComputeShiftEndsAtUtc(OnDutyShiftInfo? onDuty)
    {
        if (onDuty is null) return null;
        return ComputeShiftEndsAtUtcFromParts(onDuty.WorkDate, onDuty.End);
    }

    private static DateTime? ComputeShiftEndsAtUtcFromParts(string? workDateRaw, string? endRaw)
    {
        if (!DateOnly.TryParse(workDateRaw, out var workDate)) return null;
        if (!TimeOnly.TryParse(endRaw, out var endTime)) return null;

        var endsVn = workDate.ToDateTime(endTime);
        return DateTime.SpecifyKind(endsVn.AddHours(-7), DateTimeKind.Utc);
    }

    private static decimal ComputeExpectedCash(PosCashSession session) =>
        session.OpeningCash + session.CashSalesTotal - session.CashRefundTotal;

    private static PosCashSessionResponse MapToResponse(PosCashSession s)
    {
        var expectedCash = s.Status == PosCashSessionStatus.Open
            ? ComputeExpectedCash(s)
            : s.ExpectedCash;

        return new PosCashSessionResponse(
            s.Id,
            s.Status.ToString(),
            s.OpeningCash,
            s.CashSalesTotal,
            s.CashRefundTotal,
            s.OrderCount,
            s.Note,
            s.OpenedByName,
            s.OpenedByRole,
            s.ShiftLabel,
            s.ShiftSlotId,
            s.OpenedAt,
            s.UpdatedAt,
            s.CountedCash,
            expectedCash,
            s.Variance,
            s.VarianceNote,
            s.ClosedByName,
            s.ClosedAt,
            s.OpenedByUserId,
            s.ShiftEndsAtUtc);
    }

    private static string? NormalizeOptional(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static string? StripShiftHours(string? label)
    {
        var text = NormalizeOptional(label);
        if (text is null) return null;
        var idx = text.LastIndexOf('·');
        if (idx < 0) idx = text.LastIndexOf('•');
        if (idx <= 0) return text;
        var left = text[..idx].Trim();
        return string.IsNullOrEmpty(left) ? text : left;
    }

    private static string? FirstNonEmpty(params string?[] values) =>
        values.Select(NormalizeOptional).FirstOrDefault(v => v is not null);
}
