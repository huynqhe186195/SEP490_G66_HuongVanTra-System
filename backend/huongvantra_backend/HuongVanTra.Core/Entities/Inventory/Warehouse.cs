using HuongVanTra.Core.Entities.Identity;
using HuongVanTra.Core.Entities.Stores;
using System.Collections.Generic;

namespace HuongVanTra.Core.Entities.Inventory {
    public class Warehouse {
        public int Id { get; set; }
        public int StoreId { get; set; }
        public string Name { get; set; } = null!;
        public int? ManagerId { get; set; }

        public Store Store { get; set; } = null!;
        public Employee? Manager { get; set; }

        public ICollection<InventoryBalance> Balances { get; set; } = new List<InventoryBalance>();
    }
}