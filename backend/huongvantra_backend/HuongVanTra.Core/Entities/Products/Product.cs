using System.Reflection.PortableExecutable;

namespace HuongVanTra.Core.Entities.Products {
    public class Product {
        public int Id { get; set; }
        public string Sku { get; set; } = null!;
        public string ProductType { get; set; } = "FINISHED_GOOD";
        public decimal Price { get; set; }
        public decimal MinStockAlert { get; set; }

        public int? CategoryId { get; set; }

        // Navigation properties
        public ProductCategory? Category { get; set; }
        public BomHeader? BomHeader { get; set; }
    }
}