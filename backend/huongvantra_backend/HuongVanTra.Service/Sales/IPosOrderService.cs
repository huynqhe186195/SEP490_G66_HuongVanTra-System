using HuongVanTra.Service.Sales.Models;

namespace HuongVanTra.Service.Sales {
    public interface IPosOrderService {
        /// <summary>
        /// Online mode: create order with StockStatus = PENDING, enqueue a StockDeductQueue entry.
        /// Actual inventory deduction happens later when the queue is processed.
        /// </summary>
        Task<PosOrderResult> CreateOnlineOrderAsync(CreatePosOrderCommand command);

        /// <summary>
        /// Offline mode: create order and immediately deduct inventory from the store warehouse.
        /// </summary>
        Task<PosOrderResult> CreateOfflineOrderAsync(CreatePosOrderCommand command);
    }
}
