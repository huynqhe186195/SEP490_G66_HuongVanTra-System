using HuongVanTra.Core.Entities.Products;

namespace HuongVanTra.Core.Entities.Inventory {
    public class InventoryBalance {
        public int Id { get; set; }
        public int WarehouseId { get; set; }
        public int ProductId { get; set; }
        public decimal Quantity { get; set; } = 0;

        public Warehouse Warehouse { get; set; } = null!;
        public Product Product { get; set; } = null!;
    }
}