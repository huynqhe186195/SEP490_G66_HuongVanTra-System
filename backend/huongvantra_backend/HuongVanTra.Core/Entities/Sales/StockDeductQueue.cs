using HuongVanTra.Core.Entities.Identity;
using System;

namespace HuongVanTra.Core.Entities.Sales {
    public class StockDeductQueue {
        public int Id { get; set; }
        public int OrderId { get; set; }
        public string Status { get; set; } = "PENDING";
        public string BomSnapshot { get; set; } = "{}";
        public int? ConfirmedById { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public Order Order { get; set; } = null!;
        public Employee? ConfirmedBy { get; set; }
    }
}