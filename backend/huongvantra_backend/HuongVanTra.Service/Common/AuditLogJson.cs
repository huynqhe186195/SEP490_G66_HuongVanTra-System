using System.Text.Json;

namespace HuongVanTra.Service.Common {
    /// <summary>MySQL cột audit_logs.NewValues/OldValues kiểu JSON — phải là chuỗi JSON hợp lệ.</summary>
    public static class AuditLogJson {
        public static string? Serialize(object? payload) {
            if (payload is null) {
                return null;
            }

            return JsonSerializer.Serialize(payload);
        }
    }
}
