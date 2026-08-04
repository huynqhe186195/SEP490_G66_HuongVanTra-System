namespace UserService.Application.Interfaces;

public interface ISmsSender
{
    /// <summary>Gửi SMS. phoneDigits: 0xxxxxxxxx (chỉ số).</summary>
    Task SendAsync(string phoneDigits, string message, CancellationToken ct = default);

    /// <summary>True khi đang gửi qua nhà cung cấp thật (không chỉ log).</summary>
    bool IsEnabled { get; }
}
