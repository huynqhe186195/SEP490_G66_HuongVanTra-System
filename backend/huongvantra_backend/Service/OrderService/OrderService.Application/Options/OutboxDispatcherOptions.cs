namespace OrderService.Application.Options;

/// <summary>
/// G5 — cấu hình cho Outbox Dispatcher (background publisher).
/// Ràng buộc thời gian dùng đơn vị giây/mili-giây để dễ cấu hình qua appsettings.
/// </summary>
public sealed class OutboxDispatcherOptions
{
    public const string SectionName = "OutboxDispatcher";

    /// <summary>Bật/tắt dispatcher. Mặc định bật.</summary>
    public bool Enabled { get; set; } = true;

    /// <summary>Chu kỳ poll khi không có việc, tính bằng mili-giây.</summary>
    public int PollingIntervalMs { get; set; } = 2000;

    /// <summary>Số message tối đa claim mỗi vòng.</summary>
    public int BatchSize { get; set; } = 20;

    /// <summary>Số lần retry tối đa trước khi chuyển Failed.</summary>
    public int MaxRetryCount { get; set; } = 10;

    /// <summary>Độ trễ nền tảng cho exponential backoff, tính bằng giây.</summary>
    public int BaseRetryDelaySeconds { get; set; } = 5;

    /// <summary>Trần độ trễ backoff, tính bằng giây.</summary>
    public int MaxRetryDelaySeconds { get; set; } = 300;

    /// <summary>Thời gian giữ lease khi một worker đang publish, tính bằng giây.</summary>
    public int LockDurationSeconds { get; set; } = 60;

    /// <summary>Định danh worker; nếu trống sẽ tự sinh theo máy chủ + GUID.</summary>
    public string? WorkerId { get; set; }
}
