using HuongVanTra.Core.Entities.Identity;

namespace HuongVanTra.Core.Entities.Identity {
    public class EmployeeRole {
        public int EmployeeId { get; set; }
        public int RoleId { get; set; }
        public int StoreId { get; set; }
        public DateTime AssignedAt { get; set; } = DateTime.UtcNow;

        public Employee Employee { get; set; } = null!;
        public Role Role { get; set; } = null!;
    }
}