using HuongVanTra.Shared.Messages;

namespace OrderService.Infrastructure.Messaging;

/// <summary>
/// G5.3 — allowlist ánh xạ tên EventType (OutboxMessage.EventType, chính là
/// <c>Type.FullName</c> của contract) sang CLR type để deserialize + publish.
///
/// Chỉ những type nằm trong allowlist mới được xử lý. Không dùng
/// <c>Type.GetType</c> hay nạp type tuỳ ý lúc runtime để tránh rủi ro bảo mật.
/// </summary>
public static class OutboxEventTypeRegistry
{
    private static readonly IReadOnlyDictionary<string, Type> Map = BuildMap(
        typeof(OrderPlacedEvent),
        typeof(OrderCompletedEvent),
        typeof(OrderCancelledEvent),
        typeof(OrderReturnedEvent),
        typeof(OrderShippedEvent));

    private static Dictionary<string, Type> BuildMap(params Type[] types)
    {
        var map = new Dictionary<string, Type>(StringComparer.Ordinal);
        foreach (var type in types)
        {
            var key = type.FullName ?? type.Name;
            map[key] = type;
        }

        return map;
    }

    /// <summary>Trả về CLR type nếu EventType nằm trong allowlist.</summary>
    public static bool TryResolve(string eventType, out Type type)
    {
        if (!string.IsNullOrWhiteSpace(eventType) && Map.TryGetValue(eventType, out var resolved))
        {
            type = resolved;
            return true;
        }

        type = typeof(object);
        return false;
    }

    /// <summary>Danh sách EventType được phép dispatch (phục vụ chẩn đoán).</summary>
    public static IReadOnlyCollection<string> KnownEventTypes => (IReadOnlyCollection<string>)Map.Keys;
}
