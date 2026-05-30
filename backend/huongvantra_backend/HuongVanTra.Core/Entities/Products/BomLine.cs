namespace HuongVanTra.Core.Entities.Products {
    public class BomLine {
        public int Id { get; set; }
        public int BomId { get; set; }
        public int MaterialId { get; set; }
        public decimal Quantity { get; set; }

        public BomHeader Bom { get; set; } = null!;
        public Product Material { get; set; } = null!;
    }
}