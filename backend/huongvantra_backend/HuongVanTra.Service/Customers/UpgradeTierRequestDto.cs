namespace HuongVanTra.Service.Customers {
    public class UpgradeTierRequestDto {
        public int CustomerId { get; set; }
        public int NewTierId { get; set; }
        public int UpdatedByEmpId { get; set; }
    }
}