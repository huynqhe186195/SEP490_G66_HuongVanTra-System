using HuongVanTra.Core.Entities.Products;
using HuongVanTra.Core.Entities.Inventory;

namespace HuongVanTra.Core.Entities.Production {
    public class ProductionOrder {
        public int Id { get; set; }
        public string PoCode { get; set; } = null!;
        public int BomId { get; set; }
        public int WarehouseId { get; set; }
        public string Status { get; set; } = "PENDING";

        public BomHeader Bom { get; set; } = null!;
        public Warehouse Warehouse { get; set; } = null!;
    }
}