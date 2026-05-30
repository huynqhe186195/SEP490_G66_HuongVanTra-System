using System;

namespace HuongVanTra.Core.Entities.System {
    public class AuditLog {
        public long Id { get; set; }
        public int? UserId { get; set; }
        public int? StoreId { get; set; }
        public string Action { get; set; } = null!;
        public string EntityType { get; set; } = null!;
        public int EntityId { get; set; }

        public string? OldValues { get; set; }
        public string? NewValues { get; set; }

        public string Status { get; set; } = "SUCCESS";
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}