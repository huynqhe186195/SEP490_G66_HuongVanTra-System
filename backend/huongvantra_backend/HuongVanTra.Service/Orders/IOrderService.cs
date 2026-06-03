namespace HuongVanTra.Service.Orders {
    public interface IOrderService {
        Task<PagedResult<OrderListItemDto>> GetOrdersAsync(OrderQuery query, CancellationToken cancellationToken = default);
        Task<List<OrderCreatorOptionDto>> GetOrderCreatorsAsync(
            OrderAccessScope access,
            CancellationToken cancellationToken = default);
        Task<OrderDetailDto?> GetOrderAsync(
            string idOrCode,
            OrderAccessScope access,
            CancellationToken cancellationToken = default);
        Task<OrderDetailDto?> UpdateOrderStatusAsync(
            int id,
            UpdateOrderStatusRequest request,
            OrderAccessScope access,
            CancellationToken cancellationToken = default);
        Task<OrderDetailDto?> ApplyCouponAsync(
            int id,
            ApplyCouponRequest request,
            OrderAccessScope access,
            CancellationToken cancellationToken = default);
        Task<OrderDetailDto?> AddGiftItemAsync(
            int id,
            AddGiftItemRequest request,
            OrderAccessScope access,
            CancellationToken cancellationToken = default);
        Task<OrderDetailDto?> UpdateAdjustmentsAsync(
            int id,
            UpdateOrderAdjustmentsRequest request,
            OrderAccessScope access,
            CancellationToken cancellationToken = default);
        Task<OrderDetailDto?> UpdateOrderItemsAsync(
            int id,
            UpdateOrderItemsRequest request,
            OrderAccessScope access,
            CancellationToken cancellationToken = default);
        Task<OrderPaymentQrDto?> GetOrderPaymentQrAsync(
            int id,
            OrderAccessScope access,
            bool forceRegenerate = false,
            CancellationToken cancellationToken = default);
        Task<OrderPaymentStatusDto?> GetOrderPaymentStatusAsync(
            int id,
            OrderAccessScope access,
            CancellationToken cancellationToken = default);
    }
}
