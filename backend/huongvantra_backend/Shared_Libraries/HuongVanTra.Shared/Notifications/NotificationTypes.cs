namespace HuongVanTra.Shared.Notifications;

public static class NotificationTypes
{
    // Phase 1: Critical Operational Notifications (8 types)
    public const string OrderWaitingTransfer = "order_waiting_transfer";
    public const string OrderWaitingProduction = "order_waiting_production";
    public const string OrderWaitingMaterials = "order_waiting_materials";
    public const string StockQueuePendingConfirm = "stock_queue_pending_confirm";
    public const string TransferSlipPendingConfirm = "transfer_slip_pending_confirm";
    public const string ProductionOrderPendingApproval = "production_order_pending_approval";
    public const string OrderCancellationPendingApproval = "order_cancellation_pending_approval";
    public const string ReturnRequestPendingApproval = "return_request_pending_approval";
    public const string LowStockAlert = "low_stock_alert";
    public const string ProductionOrderApproved = "production_order_approved";

    // Phase 2A: Manager feedback → Sale
    public const string OrderCancellationApproved = "order_cancellation_approved";
    public const string OrderCancellationRejected = "order_cancellation_rejected";
    public const string ReturnRequestApproved = "return_request_approved";
    public const string ReturnRequestRejected = "return_request_rejected";

    // Phase 2B: Warehouse done → Sale
    public const string StockQueueConfirmed = "stock_queue_confirmed";
    public const string OrderReadyForPickup = "order_ready_for_pickup";

    // Phase 2C: Stock adjustment request flow
    public const string StockAdjustmentRequestCreated = "stock_adjustment_request_created";
    public const string StockAdjustmentRequestReviewed = "stock_adjustment_request_reviewed";
    public const string StockAdjustmentRequestRejected = "stock_adjustment_request_rejected";
    public const string StockAdjustmentRequestClosed = "stock_adjustment_request_closed";

    // Reserved for future
    public const string ProductionOrderRejected = "production_order_rejected";
    public const string CodOrderReadyToShip = "cod_order_ready_to_ship";
    public const string BackorderItemAvailable = "backorder_item_available";
    public const string ReturnInspectionCompleted = "return_inspection_completed";
    public const string OutboxRetryFailed = "outbox_retry_failed";
    public const string OutboxStuckMessages = "outbox_stuck_messages";
}
