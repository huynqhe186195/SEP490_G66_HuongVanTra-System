namespace HuongVanTra.Core.Entities.Identity {
    public class Role {
        public int Id { get; set; }
        public string Name { get; set; } = null!;

        public ICollection<EmployeeRole> EmployeeRoles { get; set; } = new List<EmployeeRole>();
    }
}