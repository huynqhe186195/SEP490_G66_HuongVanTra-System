using HuongVanTra.Service.Sales.Models;

namespace HuongVanTra.Service.Sales {
    public class InsufficientStockException : Exception {
        public InsufficientStockResult Result { get; }

        public InsufficientStockException(InsufficientStockResult result)
            : base("Insufficient stock to fulfill the order.") {
            Result = result;
        }
    }
}
