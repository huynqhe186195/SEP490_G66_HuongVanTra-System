using HuongVanTra.Core.Entities.Products;

namespace HuongVanTra.Core.Entities.Sales {
    public class OrderItem {
        public int Id { get; set; }
        public int OrderId { get; set; }
        public int ProductId { get; set; }
        public decimal Quantity { get; set; }
        public decimal LineTotal { get; set; }
        public byte IsGift { get; set; } = 0;

        public Order Order { get; set; } = null!;
        public Product Product { get; set; } = null!;
    }
}