namespace HuongVanTra.Service.Sales.Models {
    public class PreviewStockDeductResult {
        public int QueueId { get; set; }
        public int OrderId { get; set; }
        public string OrderCode { get; set; } = null!;
        public string QueueStatus { get; set; } = null!;
        public string OrderStockStatus { get; set; } = null!;
        public bool CanDeduct { get; set; }
        public List<PreviewStockDeductItem> Items { get; set; } = new();
    }

    public class PreviewStockDeductItem {
        public int ProductId { get; set; }
        public int MaterialId { get; set; }
        public string? MaterialName { get; set; }
        public decimal RequiredQuantity { get; set; }
        public decimal AvailableQuantity { get; set; }
        public decimal ShortageQuantity { get; set; }
        public string Status { get; set; } = null!;
    }

    public class InsufficientStockResult {
        public int QueueId { get; set; }
        public int OrderId { get; set; }
        public string OrderStockStatus { get; set; } = null!;
        public List<ShortageItem> Shortages { get; set; } = new();
    }

    public class ShortageItem {
        public int ProductId { get; set; }
        public int MaterialId { get; set; }
        public decimal RequiredQuantity { get; set; }
        public decimal AvailableQuantity { get; set; }
        public decimal ShortageQuantity { get; set; }
    }

    public class CancelStockDeductResult {
        public int QueueId { get; set; }
        public int OrderId { get; set; }
        public string OrderCode { get; set; } = null!;
        public string QueueStatus { get; set; } = null!;
        public string OrderStockStatus { get; set; } = null!;
        public DateTime CancelledAt { get; set; }
    }
}
