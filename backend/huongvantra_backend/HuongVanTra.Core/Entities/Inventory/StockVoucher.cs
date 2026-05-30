using HuongVanTra.Core.Entities.Identity;

namespace HuongVanTra.Core.Entities.Inventory {
    public class StockVoucher {
        public int Id { get; set; }
        public string VoucherCode { get; set; } = null!;
        public string VoucherType { get; set; } = "IN";
        public int WarehouseId { get; set; }
        public int CreatedById { get; set; }
        public int? ApprovedById { get; set; }
        public string Status { get; set; } = "DRAFT";

        // Navigation properties
        public Warehouse Warehouse { get; set; } = null!;
        public Employee CreatedBy { get; set; } = null!;
        public Employee? ApprovedBy { get; set; }
    }
}