namespace HuongVanTra.Service.Orders {
    public interface IOrderService {
        Task<PagedResult<OrderListItemDto>> GetOrdersAsync(OrderQuery query, CancellationToken cancellationToken = default);
        Task<OrderDetailDto?> GetOrderAsync(string idOrCode, CancellationToken cancellationToken = default);
        Task<OrderDetailDto?> UpdateOrderStatusAsync(int id, UpdateOrderStatusRequest request, CancellationToken cancellationToken = default);
        Task<OrderDetailDto?> ApplyCouponAsync(int id, ApplyCouponRequest request, CancellationToken cancellationToken = default);
        Task<OrderDetailDto?> AddGiftItemAsync(int id, AddGiftItemRequest request, CancellationToken cancellationToken = default);
        Task<OrderDetailDto?> UpdateAdjustmentsAsync(int id, UpdateOrderAdjustmentsRequest request, CancellationToken cancellationToken = default);
    }
}
