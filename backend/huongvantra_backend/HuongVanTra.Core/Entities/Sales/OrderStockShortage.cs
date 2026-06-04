namespace HuongVanTra.Core.Entities.Sales {
    public class OrderStockShortage {
        public int Id { get; set; }
        public int QueueId { get; set; }
        public int OrderId { get; set; }
        public int? OrderItemId { get; set; }
        public int? ProductId { get; set; }
        public int MaterialId { get; set; }
        public int WarehouseId { get; set; }
        public decimal RequiredQuantity { get; set; }
        public decimal AvailableQuantity { get; set; }
        public decimal ShortageQuantity { get; set; }
        public string Status { get; set; } = "waiting_stock";
        public string? Note { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? ResolvedAt { get; set; }

        public StockDeductQueue Queue { get; set; } = null!;
        public Order Order { get; set; } = null!;
    }
}
