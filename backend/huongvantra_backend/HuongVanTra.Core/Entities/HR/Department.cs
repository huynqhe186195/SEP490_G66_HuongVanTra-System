using HuongVanTra.Core.Entities.Identity;
using HuongVanTra.Core.Entities.Stores;
using System.Collections.Generic;

namespace HuongVanTra.Core.Entities.HR {
    public class Department {
        public int Id { get; set; }
        public int StoreId { get; set; }
        public string Name { get; set; } = null!;

        public Store Store { get; set; } = null!;
        public ICollection<Employee> Employees { get; set; } = new List<Employee>();
    }
}