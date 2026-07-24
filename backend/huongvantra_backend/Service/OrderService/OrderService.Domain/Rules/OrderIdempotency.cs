using OrderService.Domain.Exceptions;

namespace OrderService.Domain.Rules;

public static class OrderIdempotency
{
    public const int MaxClientKeyLength = 64;
    public const int MaxPersistedKeyLength = 100;

    public static string? BuildActorScopedKey(string? clientKey, Guid? actorId)
    {
        if (string.IsNullOrWhiteSpace(clientKey))
            return null;

        var value = clientKey.Trim();
        if (value.Length > MaxClientKeyLength
            || !Guid.TryParseExact(value, "D", out var parsedClientKey))
        {
            throw new OrderValidationException(
                "X-Idempotency-Key phải là UUID hợp lệ theo định dạng xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx.");
        }

        if (!actorId.HasValue || actorId.Value == Guid.Empty)
            throw new OrderValidationException(
                "Không xác định được người dùng cho X-Idempotency-Key.");

        var effectiveKey = $"{actorId.Value:N}:{parsedClientKey:N}";
        if (effectiveKey.Length > MaxPersistedKeyLength)
            throw new OrderValidationException("X-Idempotency-Key vượt quá độ dài lưu trữ an toàn.");

        return effectiveKey;
    }
}
