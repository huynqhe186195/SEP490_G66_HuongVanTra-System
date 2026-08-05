using OrderService.Application.Authorization;
using OrderService.Application.DTOs.Requests;
using OrderService.Application.DTOs.Responses;
using OrderService.Application.Interfaces;
using OrderService.Domain.Entities;
using OrderService.Domain.Enums;
using OrderService.Domain.Exceptions;

namespace OrderService.Application.UseCases;

/// <summary>
/// Quản lý ca quỹ tiền mặt tại quầy POS: mở/đóng ca, và ghi nhận thu/hoàn tiền mặt
/// khi có đơn/trả hàng thanh toán bằng tiền mặt.
/// </summary>
public class PosCashSessionLogic(
    IPosCashSessionRepository _repo,
    IShiftCatalogClient _shifts,
    StaffShiftGuard _shiftGuard)
{
    private const decimal VarianceNoteRequiredThreshold = 1000m;
    private const string DefaultOpenedByName = "Nhân viên POS";

    public async Task<CurrentPosCashSessionResponse> GetCurrentAsync(CancellationToken ct = default)
    {
        var session = await _repo.GetOpenAsync(ct);
        if (session is null)
            return new CurrentPosCashSessionResponse(null);

        var onDuty = await _shifts.GetMyOnDutyAsync("Shelf", ct);
        if (onDuty is not null
            && session.ShiftSlotId.HasValue
            && session.ShiftSlotId.Value != onDuty.SlotId)
        {
            return new CurrentPosCashSessionResponse(
                MapToResponse(session),
                RequiresCloseForNewShift: true,
                PreviousShiftLabel: session.ShiftLabel);
        }

        return new CurrentPosCashSessionResponse(MapToResponse(session));
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
            var label = string.IsNullOrWhiteSpace(existing.ShiftLabel)
                ? "ca trước"
                : existing.ShiftLabel;
            throw new OrderValidationException(
                $"Quỹ «{label}» vẫn đang mở. Hãy đóng quỹ ca đó trước khi mở quỹ cho ca hiện tại.");
        }

        // Nhân viên bán hàng phải đang trong ca quầy đã duyệt; Manager/Admin được bỏ qua.
        var onDuty = await _shifts.GetMyOnDutyAsync("Shelf", ct);
        if (onDuty is null && !canBypassShiftRequirement)
            throw new OrderValidationException(
                "Chỉ mở ca quỹ khi bạn đã được duyệt ca quầy và đang trong giờ làm. Hãy đăng ký / chờ duyệt ca trên «Lịch làm việc».");

        if (onDuty is not null && request.ShiftSlotId.HasValue && request.ShiftSlotId.Value != onDuty.SlotId)
            throw new OrderValidationException("Ca quỹ phải gắn đúng ca quầy bạn đang được xếp.");

        var openingCash = Math.Max(0, request.OpeningCash);
        var openedByName = FirstNonEmpty(request.OpenedByName, actorName) ?? DefaultOpenedByName;
        var now = DateTime.UtcNow;

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
            ShiftSlotId = onDuty?.SlotId,
            // Chỉ lưu tên ca (không kèm giờ) — FE/POS hiển thị «Ca đang mở · {tên}».
            ShiftLabel = FirstNonEmpty(
                request.ShiftLabel,
                onDuty?.TemplateName,
                StripShiftHours(onDuty?.Label)),
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

        var expected = ComputeExpectedCash(session);
        var counted = Math.Max(0, request.CountedCash);
        var variance = counted - expected;
        var varianceNote = NormalizeOptional(request.VarianceNote);

        if (Math.Abs(variance) >= VarianceNoteRequiredThreshold && varianceNote is null)
            throw new OrderValidationException("Có chênh lệch quỹ — vui lòng nhập lý do lệch trước khi đóng ca.");

        session.Status = PosCashSessionStatus.Closed;
        session.CountedCash = counted;
        session.ExpectedCash = expected;
        session.Variance = variance;
        session.VarianceNote = varianceNote;
        session.ClosedByUserId = userId == Guid.Empty ? null : userId;
        session.ClosedByName = FirstNonEmpty(actorName, session.OpenedByName);
        session.ClosedAt = DateTime.UtcNow;
        session.UpdatedAt = DateTime.UtcNow;

        await _repo.SaveChangesAsync(ct);
        return MapToResponse(session);
    }

    /// <summary>Cộng doanh thu tiền mặt vào ca đang mở (nếu có). Không làm gì nếu chưa mở ca.</summary>
    public async Task RecordCashSaleAsync(decimal amount, CancellationToken ct = default)
    {
        if (amount <= 0) return;

        var session = await RequireOpenSessionForCurrentShiftAsync(ct);
        if (session is null) return;

        session.CashSalesTotal += amount;
        session.OrderCount += 1;
        session.UpdatedAt = DateTime.UtcNow;
        await _repo.SaveChangesAsync(ct);
    }

    /// <summary>Cộng số tiền mặt đã hoàn vào ca đang mở (nếu có). Không làm gì nếu chưa mở ca.</summary>
    public async Task RecordCashRefundAsync(decimal amount, CancellationToken ct = default)
    {
        if (amount <= 0) return;

        var session = await RequireOpenSessionForCurrentShiftAsync(ct);
        if (session is null) return;

        session.CashRefundTotal += amount;
        session.UpdatedAt = DateTime.UtcNow;
        await _repo.SaveChangesAsync(ct);
    }

    /// <summary>
    /// Trả về quỹ Open khớp ca on-duty hiện tại.
    /// Nếu quỹ Open thuộc ca khác → báo lỗi để buộc đóng/mở lại đúng ca.
    /// Nếu không có on-duty (Manager bypass) → dùng quỹ Open bất kỳ.
    /// </summary>
    private async Task<PosCashSession?> RequireOpenSessionForCurrentShiftAsync(CancellationToken ct)
    {
        var session = await _repo.GetOpenAsync(ct);
        if (session is null) return null;

        var onDuty = await _shifts.GetMyOnDutyAsync("Shelf", ct);
        if (onDuty is not null
            && session.ShiftSlotId.HasValue
            && session.ShiftSlotId.Value != onDuty.SlotId)
        {
            var previous = string.IsNullOrWhiteSpace(session.ShiftLabel) ? "ca trước" : session.ShiftLabel;
            throw new OrderValidationException(
                $"Quỹ «{previous}» vẫn đang mở — không ghi tiền vào quỹ ca khác. Hãy đóng quỹ ca đó rồi mở quỹ cho ca hiện tại.");
        }

        return session;
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
            s.ClosedAt);
    }

    private static string? NormalizeOptional(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    /// <summary>Bỏ phần giờ trong nhãn ca ("Ca 1 · 08:00–12:00" → "Ca 1").</summary>
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
