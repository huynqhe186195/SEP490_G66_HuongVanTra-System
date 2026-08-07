namespace OrderService.Domain.Entities;

public class OrderDetail : BaseEntity
{
    public Guid Id { get; set; }
    public Guid OrderId { get; set; }
    public Guid SkuId { get; set; }
    public string SkuSnapshotName { get; set; } = string.Empty;
    public string? SkuSnapshotCode { get; set; }
    public string? CategorySnapshotName { get; set; }

    /// <summary>
    /// Đơn vị tính gốc của SKU tại thời điểm bán ("Gram" hoặc "Piece").
    /// Báo cáo phải tách số lượng theo đơn vị; cộng chung Gram với Piece là vô nghĩa.
    /// Null với các dòng đơn tạo trước khi có cột này.
    /// </summary>
    public string? UnitSnapshot { get; set; }

    public int Quantity { get; set; }
    public decimal CostPrice { get; set; }
    public int ReturnedQuantity { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal SubTotal { get; set; }
    public bool IsGift { get; set; }
    public int ImmediateFulfilledQuantity { get; set; }
    public int ReservedFinishedQuantity { get; set; }
    public int BackorderQuantity { get; set; }

    public Order Order { get; set; } = null!;
}
