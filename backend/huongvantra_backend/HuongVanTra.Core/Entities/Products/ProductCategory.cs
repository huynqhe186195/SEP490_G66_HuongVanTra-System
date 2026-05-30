using System.Collections.Generic;

namespace HuongVanTra.Core.Entities.Products {
    public class ProductCategory {
        public int Id { get; set; }
        public string Name { get; set; } = null!;
        public int? ParentId { get; set; }

        // Navigation properties
        public ProductCategory? ParentCategory { get; set; }
        public ICollection<ProductCategory> SubCategories { get; set; } = new List<ProductCategory>();
        public ICollection<Product> Products { get; set; } = new List<Product>();
    }
}