using HuongVanTra.Core.Entities.Products;

namespace HuongVanTra.Core.Entities.Sales {
    public class OrderItem {
        public int Id { get; set; }
        public int OrderId { get; set; }
        public int ProductId { get; set; }

        // Snapshot tại thời điểm bán — không thay đổi dù product sau này bị sửa
        public string ProductName { get; set; } = null!;
        public string Sku { get; set; } = null!;
        public decimal UnitPrice { get; set; }

        public decimal Quantity { get; set; }
        public decimal LineTotal { get; set; }
        public byte IsGift { get; set; } = 0;

        public Order Order { get; set; } = null!;
        public Product Product { get; set; } = null!;
    }
}