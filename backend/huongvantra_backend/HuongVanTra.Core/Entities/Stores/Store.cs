namespace HuongVanTra.Core.Entities.Stores {
    public class Store {
        public int Id { get; set; }
        public string Name { get; set; } = null!;
        public string? Address { get; set; }
        public string? Phone { get; set; }
        public bool IsActive { get; set; } = true;

        public StoreSetting? Setting { get; set; }
    }
}