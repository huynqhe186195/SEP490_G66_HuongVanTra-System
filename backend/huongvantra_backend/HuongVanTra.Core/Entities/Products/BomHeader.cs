using System.Collections.Generic;

namespace HuongVanTra.Core.Entities.Products {
    public class BomHeader {
        public int Id { get; set; }
        public int FinishedGoodId { get; set; }
        public decimal QuantityOutput { get; set; }

        public Product FinishedGood { get; set; } = null!;
        public ICollection<BomLine> BomLines { get; set; } = new List<BomLine>();
    }
}