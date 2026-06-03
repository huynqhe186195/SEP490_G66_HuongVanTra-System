using HuongVanTra.Core.Entities.Identity;
using HuongVanTra.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace HuongVanTra.Service.Orders {
    public class OrderAccessResolver : IOrderAccessResolver {
        private readonly AppDbContext _dbContext;

        public OrderAccessResolver(AppDbContext dbContext) {
            _dbContext = dbContext;
        }

        public async Task<OrderAccessScope> ResolveAsync(
            IEnumerable<string> roles,
            int? employeeId,
            CancellationToken cancellationToken = default) {
            var roleList = roles.ToList();

            if (OrderAccessScope.IsAdmin(roleList)) {
                return OrderAccessScope.AllOrders();
            }

            if (!employeeId.HasValue || employeeId.Value <= 0) {
                return OrderAccessScope.AllOrders();
            }

            if (OrderAccessScope.IsAgencyManager(roleList)) {
                var storeId = await _dbContext.Set<Employee>()
                    .AsNoTracking()
                    .Where(e => e.Id == employeeId.Value)
                    .Select(e => (int?)e.StoreId)
                    .FirstOrDefaultAsync(cancellationToken);

                if (!storeId.HasValue) {
                    return new OrderAccessScope {
                        Mode = OrderAccessMode.Own,
                        EmployeeId = employeeId,
                    };
                }

                return new OrderAccessScope {
                    Mode = OrderAccessMode.Store,
                    StoreId = storeId,
                    EmployeeId = employeeId,
                    CanEdit = false,
                };
            }

            if (OrderAccessScope.IsSalesStaff(roleList)) {
                return new OrderAccessScope {
                    Mode = OrderAccessMode.Own,
                    EmployeeId = employeeId,
                    CanEdit = true,
                };
            }

            return OrderAccessScope.AllOrders();
        }
    }
}
