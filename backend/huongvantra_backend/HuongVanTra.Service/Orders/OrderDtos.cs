namespace HuongVanTra.Service.Orders {
    public class PagedResult<T> {
        public List<T> Items { get; set; } = new();
        public int TotalCount { get; set; }
        public int Page { get; set; }
        public int PageSize { get; set; }
    }

    public class OrderListItemDto {
        public int Id { get; set; }
        public string OrderCode { get; set; } = string.Empty;
        public string? CustomerName { get; set; }
        public string? CustomerPhone { get; set; }
        public string? PaymentMethod { get; set; }
        public string OrderStatus { get; set; } = string.Empty;
        public string PaymentStatus { get; set; } = string.Empty;
        public string? ShippingAddress { get; set; }
        public decimal TotalAmount { get; set; }
        public int CashierId { get; set; }
        public string CashierName { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
    }

    public class OrderCreatorOptionDto {
        public int Id { get; set; }
        public string FullName { get; set; } = string.Empty;
    }

    public class OrderItemDto {
        public int Id { get; set; }
        public int ProductId { get; set; }
        public string ProductName { get; set; } = string.Empty;
        public string ProductSku { get; set; } = string.Empty;
        public decimal UnitPrice { get; set; }
        public decimal Quantity { get; set; }
        public decimal LineTotal { get; set; }
        public bool IsGift { get; set; }
    }

    public class UpdateOrderItemLineRequest {
        public int ProductId { get; set; }
        public decimal Quantity { get; set; }
        public byte IsGift { get; set; }
    }

    public class UpdateOrderItemsRequest {
        public List<UpdateOrderItemLineRequest> Items { get; set; } = new();
    }

    public class OrderPaymentStatusDto {
        public int OrderId { get; set; }
        public string OrderCode { get; set; } = string.Empty;
        public string PaymentStatus { get; set; } = string.Empty;
        public string OrderStatus { get; set; } = string.Empty;
        public bool IsPaid { get; set; }
        public string? InvoiceCode { get; set; }
        public string? ExpectedTransferContent { get; set; }
        public decimal ExpectedAmount { get; set; }
    }

    public class OrderPaymentQrDto {
        public int OrderId { get; set; }
        public string OrderCode { get; set; } = string.Empty;
        public decimal TotalAmount { get; set; }
        public string PaymentMethod { get; set; } = string.Empty;
        public string? QrPayload { get; set; }
        public string? QrImageUrl { get; set; }
        public string? TransferContent { get; set; }
        public string? TransferAccountNumber { get; set; }
        public string PaymentMode { get; set; } = "vietqr_main";
        public bool ReusedExistingVa { get; set; }
        public bool CreatedNewVa { get; set; }
        public string? Hint { get; set; }
        public DateTime? QrExpiresAtUtc { get; set; }
    }

    public class OrderPromotionDto {
        public int Id { get; set; }
        public string PromoCode { get; set; } = string.Empty;
        public string DiscountType { get; set; } = string.Empty;
        public decimal DiscountValue { get; set; }
        public DateTime? ValidFromUtc { get; set; }
        public DateTime? ValidToUtc { get; set; }
    }

    public class PaymentTransactionDto {
        public int Id { get; set; }
        public string PaymentMethod { get; set; } = string.Empty;
        public decimal Amount { get; set; }
        public DateTime TransactionDate { get; set; }
    }

    public class StockDeductQueueDto {
        public int Id { get; set; }
        public string Status { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
    }

    public class OrderStockShortageDto {
        public int MaterialId { get; set; }
        public string? MaterialName { get; set; }
        public decimal RequiredQuantity { get; set; }
        public decimal AvailableQuantity { get; set; }
        public decimal ShortageQuantity { get; set; }
        public string Status { get; set; } = string.Empty;
    }

    public class OrderDetailDto {
        public int Id { get; set; }
        public string OrderCode { get; set; } = string.Empty;
        public int StoreId { get; set; }
        public int? CustomerId { get; set; }
        public string? CustomerName { get; set; }
        public string? CustomerPhone { get; set; }
        public string CashierName { get; set; } = string.Empty;
        public string OrderStatus { get; set; } = string.Empty;
        public string PaymentStatus { get; set; } = string.Empty;
        public string PaymentMethod { get; set; } = string.Empty;
        public string? ShippingAddress { get; set; }
        public string StockStatus { get; set; } = string.Empty;
        public decimal SubTotal { get; set; }
        public decimal CouponDiscount { get; set; }
        public decimal ManualDiscount { get; set; }
        public decimal DeductAmount { get; set; }
        public decimal TotalAmount { get; set; }
        public string? Notes { get; set; }
        public OrderPromotionDto? Promotion { get; set; }
        public List<OrderItemDto> Items { get; set; } = new();
        public List<PaymentTransactionDto> Payments { get; set; } = new();
        public StockDeductQueueDto? StockDeductQueue { get; set; }
        public List<OrderStockShortageDto> StockShortages { get; set; } = new();
        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
    }

    public class UpdateOrderStatusRequest {
        public string OrderStatus { get; set; } = string.Empty;
        public string? PaymentStatus { get; set; }
        public string? StockStatus { get; set; }
    }

    public class ApplyCouponRequest {
        public string PromoCode { get; set; } = string.Empty;
    }

    public class AddGiftItemRequest {
        public int ProductId { get; set; }
        public decimal Quantity { get; set; } = 1;
    }

    public class UpdateOrderAdjustmentsRequest {
        public decimal? ManualDiscount { get; set; }
        public decimal? DeductAmount { get; set; }
        public string? Notes { get; set; }
        public string? ShippingAddress { get; set; }
        public bool RequestStockDeduct { get; set; }
    }
}
