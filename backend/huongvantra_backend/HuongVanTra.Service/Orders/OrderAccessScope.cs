using HuongVanTra.Core.Authorization;
using HuongVanTra.Core.Constants;
using HuongVanTra.Core.Entities.Sales;

namespace HuongVanTra.Service.Orders {
    public enum OrderAccessMode {
        All,
        Store,
        Own,
    }

    public sealed class OrderAccessScope {
        public OrderAccessMode Mode { get; init; } = OrderAccessMode.All;
        public int? EmployeeId { get; init; }
        public int? StoreId { get; init; }
        public bool CanEdit { get; init; } = true;

        public static OrderAccessScope AllOrders() => new() { Mode = OrderAccessMode.All, CanEdit = true };

        public void EnsureCanEdit() {
            if (!CanEdit) {
                throw new InvalidOperationException("Bạn chỉ được xem đơn hàng, không được chỉnh sửa.");
            }
        }

        public static bool IsLockedForEditing(Order order) {
            if (order is null) {
                return true;
            }

            var orderStatus = order.OrderStatus.Trim().ToLowerInvariant();
            if (orderStatus == OrderStatus.Cancelled) {
                return true;
            }

            var paymentStatus = order.PaymentStatus.Trim().ToLowerInvariant();
            var stockStatus = order.StockStatus.Trim().ToLowerInvariant();

            return orderStatus == OrderStatus.Completed
                && paymentStatus == PaymentStatus.Paid
                && stockStatus == OrderStockStatus.Deducted;
        }

        public static void EnsureEditable(Order order) {
            if (IsLockedForEditing(order)) {
                throw new InvalidOperationException(
                    "Đơn đã hoàn tất, đã thu tiền và đã xuất kho — không thể chỉnh sửa.");
            }
        }

        public static bool CanAccess(Order order, OrderAccessScope scope) {
            if (scope.Mode == OrderAccessMode.All) {
                return true;
            }

            if (scope.Mode == OrderAccessMode.Own) {
                return scope.EmployeeId.HasValue && order.CashierId == scope.EmployeeId.Value;
            }

            if (scope.Mode == OrderAccessMode.Store) {
                return scope.StoreId.HasValue && order.StoreId == scope.StoreId.Value;
            }

            return false;
        }

        public static IQueryable<Order> ApplyFilter(IQueryable<Order> query, OrderAccessScope scope) {
            if (scope.Mode == OrderAccessMode.Own && scope.EmployeeId.HasValue) {
                return query.Where(o => o.CashierId == scope.EmployeeId.Value);
            }

            if (scope.Mode == OrderAccessMode.Store && scope.StoreId.HasValue) {
                return query.Where(o => o.StoreId == scope.StoreId.Value);
            }

            return query;
        }

        public static bool IsAdmin(IEnumerable<string> roles) {
            return roles.Any(role => string.Equals(role, AppRoles.Admin, StringComparison.OrdinalIgnoreCase));
        }

        public static bool IsAgencyManager(IEnumerable<string> roles) {
            return roles.Any(role =>
                string.Equals(role, AppRoles.AgencyManager, StringComparison.OrdinalIgnoreCase) ||
                string.Equals(role, "Agency Manager", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(role, "Manager", StringComparison.OrdinalIgnoreCase));
        }

        public static bool IsSalesStaff(IEnumerable<string> roles) {
            return roles.Any(role =>
                string.Equals(role, AppRoles.SalesStaff, StringComparison.OrdinalIgnoreCase) ||
                string.Equals(role, "Sale", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(role, "Sales", StringComparison.OrdinalIgnoreCase));
        }
    }
}
