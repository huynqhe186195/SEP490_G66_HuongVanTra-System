using HuongVanTra.Core.Entities.Identity;
using HuongVanTra.Core.Entities.Products;
using System;

namespace HuongVanTra.Core.Entities.Inventory {
    public class InventoryTransaction {
        public long Id { get; set; }
        public string TxnCode { get; set; } = null!;
        public int WarehouseId { get; set; }
        public int ProductId { get; set; }
        public string TxnType { get; set; } = null!;

        public decimal Quantity { get; set; }
        public decimal QuantityBefore { get; set; }
        public decimal QuantityAfter { get; set; }

        public string? RefType { get; set; }
        public int? RefId { get; set; }

        public int CreatedById { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public Warehouse Warehouse { get; set; } = null!;
        public Product Product { get; set; } = null!;
        public Employee CreatedBy { get; set; } = null!;
    }
}