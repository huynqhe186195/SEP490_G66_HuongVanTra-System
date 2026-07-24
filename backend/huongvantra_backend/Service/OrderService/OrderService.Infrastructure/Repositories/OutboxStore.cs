using Microsoft.EntityFrameworkCore;
using OrderService.Application.Interfaces;
using OrderService.Domain.Entities;
using OrderService.Domain.Enums;
using OrderService.Infrastructure.Data;

namespace OrderService.Infrastructure.Repositories;

/// <summary>
/// G5.2 — triển khai <see cref="IOutboxStore"/> trên MySQL bằng EF Core.
///
/// Claim nguyên tử an toàn cho nhiều instance theo 2 bước:
/// 1. <c>UPDATE ... SET Status=Processing, LockedBy=claimToken, LockedUntilUtc=now+lease</c>
///    với điều kiện message đang eligible và giới hạn <c>LIMIT batchSize</c>.
///    UPDATE trên MySQL khoá theo hàng nên hai worker không thể claim trùng.
/// 2. <c>SELECT</c> các hàng vừa được gán đúng <c>claimToken</c> duy nhất của lần claim này.
///
/// <c>claimToken</c> gồm workerId + GUID để mỗi lần claim đọc lại chính xác lô của mình,
/// tránh phụ thuộc vào so khớp mốc thời gian (vốn dễ trùng/không ổn định).
///
/// Publish RabbitMQ diễn ra ngoài repository, không giữ transaction DB mở.
/// </summary>
public sealed class OutboxStore(OrderDbContext _db) : IOutboxStore
{
    private const int LockedByMaxLength = 200;

    public async Task<IReadOnlyList<OutboxMessage>> ClaimBatchAsync(
        string workerId,
        int batchSize,
        DateTime nowUtc,
        TimeSpan leaseDuration,
        CancellationToken ct = default)
    {
        var lockedUntil = nowUtc.Add(leaseDuration);
        var claimToken = BuildClaimToken(workerId);

        var pending = OutboxMessageStatus.Pending.ToString();
        var processing = OutboxMessageStatus.Processing.ToString();

        // Bước 1: claim nguyên tử. Eligible =
        //   (Pending && NextAttempt<=now)  → message tới hạn publish/retry, hoặc
        //   (Processing && lease đã hết hạn) → phục hồi message worker khác bỏ lại khi crash.
        // Sắp theo OccurredAtUtc để giữ thứ tự phát sinh; giới hạn LIMIT batchSize.
        var affected = await _db.Database.ExecuteSqlRawAsync(
            @"UPDATE `OutboxMessages`
                 SET `Status` = {0}, `LockedBy` = {1}, `LockedUntilUtc` = {2}, `LastAttemptAtUtc` = {3}
               WHERE (
                       (`Status` = {4} AND `NextAttemptAtUtc` <= {3})
                    OR (`Status` = {0} AND `LockedUntilUtc` IS NOT NULL AND `LockedUntilUtc` <= {3})
                     )
               ORDER BY `OccurredAtUtc` ASC
               LIMIT {5};",
            new object[] { processing, claimToken, lockedUntil, nowUtc, pending, batchSize },
            ct);

        if (affected == 0)
            return Array.Empty<OutboxMessage>();

        // Bước 2: đọc lại đúng các message của lần claim này qua claimToken duy nhất.
        var claimed = await _db.OutboxMessages
            .AsNoTracking()
            .Where(m => m.Status == OutboxMessageStatus.Processing && m.LockedBy == claimToken)
            .OrderBy(m => m.OccurredAtUtc)
            .ToListAsync(ct);

        return claimed;
    }

    public async Task MarkPublishedAsync(Guid id, DateTime nowUtc, CancellationToken ct = default) =>
        await _db.Database.ExecuteSqlRawAsync(
            @"UPDATE `OutboxMessages`
                 SET `Status` = {0}, `PublishedAtUtc` = {1}, `LastAttemptAtUtc` = {1},
                     `LockedBy` = NULL, `LockedUntilUtc` = NULL, `LastError` = NULL
               WHERE `Id` = {2};",
            new object[] { OutboxMessageStatus.Published.ToString(), nowUtc, id },
            ct);

    public async Task ScheduleRetryAsync(
        Guid id,
        int retryCount,
        DateTime nextAttemptUtc,
        string error,
        DateTime nowUtc,
        CancellationToken ct = default) =>
        await _db.Database.ExecuteSqlRawAsync(
            @"UPDATE `OutboxMessages`
                 SET `Status` = {0}, `RetryCount` = {1}, `NextAttemptAtUtc` = {2},
                     `LastError` = {3}, `LastAttemptAtUtc` = {4},
                     `LockedBy` = NULL, `LockedUntilUtc` = NULL
               WHERE `Id` = {5};",
            new object[] { OutboxMessageStatus.Pending.ToString(), retryCount, nextAttemptUtc, error, nowUtc, id },
            ct);

    public async Task MarkFailedAsync(
        Guid id,
        int retryCount,
        string error,
        DateTime nowUtc,
        CancellationToken ct = default) =>
        await _db.Database.ExecuteSqlRawAsync(
            @"UPDATE `OutboxMessages`
                 SET `Status` = {0}, `RetryCount` = {1}, `LastError` = {2}, `LastAttemptAtUtc` = {3},
                     `LockedBy` = NULL, `LockedUntilUtc` = NULL
               WHERE `Id` = {4};",
            new object[] { OutboxMessageStatus.Failed.ToString(), retryCount, error, nowUtc, id },
            ct);

    private static string BuildClaimToken(string workerId)
    {
        var safeWorker = string.IsNullOrWhiteSpace(workerId) ? "worker" : workerId.Trim();
        var token = $"{safeWorker}:{Guid.NewGuid():N}";
        return token.Length <= LockedByMaxLength ? token : token[^LockedByMaxLength..];
    }
}
