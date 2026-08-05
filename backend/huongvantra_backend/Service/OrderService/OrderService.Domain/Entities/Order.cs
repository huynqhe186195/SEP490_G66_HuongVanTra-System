using OrderService.Domain.Enums;

namespace OrderService.Domain.Entities;

public class Order : BaseEntity
{
    public Guid Id { get; set; }
    public string OrderCode { get; set; } = string.Empty;
    public Guid? CustomerId { get; set; }
    public string? CustomerSnapshotName { get; set; }
    public Guid? EmployeeId { get; set; }
    /// <summary>Snapshot tên người bán tại thời điểm tạo đơn.</summary>
    public string? EmployeeSnapshotName { get; set; }
    public OrderChannel OrderChannel { get; set; }
    public OrderKind OrderKind { get; set; } = OrderKind.Sale;
    public OrderStatus OrderStatus { get; set; }
    public InventorySyncStatus InventorySyncStatus { get; set; }
    public decimal TotalAmount { get; set; }
    public decimal DiscountAmount { get; set; }
    public Guid? PromotionId { get; set; }
    public string? PromotionCode { get; set; }
    public decimal PromotionDiscountAmount { get; set; }
    public decimal FinalAmount { get; set; }
    public string? ShippingAddress { get; set; }
    public string? Note { get; set; }
    public string? IdempotencyKey { get; set; }

    public DateTime? BackorderAcceptedAt { get; set; }
    public int? BackorderMinLeadDaysSnapshot { get; set; }
    public int? BackorderMaxLeadDaysSnapshot { get; set; }
    public DateTime? EstimatedReadyFrom { get; set; }
    public DateTime? EstimatedReadyTo { get; set; }
    public FulfillmentPreference? FulfillmentPreference { get; set; }
    public BackorderRefundStatus RefundStatus { get; set; } = BackorderRefundStatus.NotRequired;
    public decimal? RefundAmount { get; set; }
    public string? RefundMethod { get; set; }
    public string? RefundEvidence { get; set; }
    public string? CancellationReason { get; set; }
    public DateTime? CancellationRequestedAt { get; set; }
    public Guid? CancellationRequestedBy { get; set; }
    public string? CancellationRequestedByName { get; set; }
    public DateTime? RefundApprovedAt { get; set; }
    public Guid? RefundApprovedBy { get; set; }
    public string? RefundApprovedByName { get; set; }
    public DateTime? RefundedAt { get; set; }
    public Guid? RefundedBy { get; set; }
    public string? RefundedByName { get; set; }

    /// <summary>POS-06 (KB4): ngày hẹn khách quay lại lấy hàng, do thu ngân nhập lúc chấp nhận backorder.</summary>
    public DateTime? PickupDate { get; set; }
    /// <summary>POS-06 (KB4): ghi chú kèm hẹn lấy hàng.</summary>
    public string? PickupNote { get; set; }
    /// <summary>POS-06 (KB4): tên người sẽ tới nhận hàng, dùng đối chiếu khi khách quay lại.</summary>
    public string? PickupContactName { get; set; }
    /// <summary>POS-06 (KB4): số điện thoại đối chiếu người nhận hàng.</summary>
    public string? PickupContactPhone { get; set; }
    /// <summary>POS-06 (KB4): mã nhận hàng 6 ký tự in trên hoá đơn cho khách giữ.</summary>
    public string? PickupCode { get; set; }
    /// <summary>POS-06 (KB4): mốc Sale xác nhận đã giao hàng cho khách.</summary>
    public DateTime? DeliveredAt { get; set; }
    public Guid? DeliveredBy { get; set; }
    public string? DeliveredByName { get; set; }

    public Guid? ContractId { get; set; }
    public string? ContractCodeSnapshot { get; set; }
    public decimal? ContractDiscountPercentSnapshot { get; set; }
    public int? ContractPaymentTermDaysSnapshot { get; set; }
    public DateTime? DueDate { get; set; }

    public ICollection<OrderDetail> OrderDetails { get; set; } = new List<OrderDetail>();
    public ICollection<Payment> Payments { get; set; } = new List<Payment>();
    public ICollection<ReturnOrder> ReturnOrders { get; set; } = new List<ReturnOrder>();
    public ICollection<CustomBundle> CustomBundles { get; set; } = new List<CustomBundle>();
}
