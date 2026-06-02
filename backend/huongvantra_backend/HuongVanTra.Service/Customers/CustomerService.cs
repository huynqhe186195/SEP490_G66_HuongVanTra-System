using HuongVanTra.Core.Entities.Customers;
using HuongVanTra.Core.Entities.Identity;
using HuongVanTra.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace HuongVanTra.Service.Customers {
    public class CustomerService : ICustomerService {
        private readonly AppDbContext _dbContext;

        public CustomerService(AppDbContext dbContext) {
            _dbContext = dbContext;
        }

        public async Task<CustomerAccessContext?> GetAccessContextAsync(int currentUserId) {
            var user = await _dbContext.Users
                .AsNoTracking()
                .Include(u => u.Employee)
                    .ThenInclude(e => e.EmployeeRoles)
                        .ThenInclude(er => er.Role)
                .FirstOrDefaultAsync(u => u.Id == currentUserId);

            if (user is null) {
                return null;
            }

            var roleNames = user.Employee?.EmployeeRoles
                .Select(er => er.Role.Name)
                .Where(role => !string.IsNullOrWhiteSpace(role))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList() ?? new List<string>();

            var isSalesStaff = roleNames.Any(IsSalesStaffRole);
            var isAdmin = roleNames.Any(role => string.Equals(role, "Admin", StringComparison.OrdinalIgnoreCase));
            var isAgencyManager = roleNames.Any(role => string.Equals(role, "Agency Manager", StringComparison.OrdinalIgnoreCase));

            return new CustomerAccessContext {
                IsSalesStaff = isSalesStaff,
                IsAdmin = isAdmin,
                IsAgencyManager = isAgencyManager,
                CanManageAllCustomers = isAdmin || isAgencyManager,
                EmployeeId = user.EmployeeId > 0 ? user.EmployeeId : null
            };
        }

        public async Task<List<CustomerListItemResponse>> GetCustomersAsync(
            string? keyword,
            string? customerType,
            string? status,
            int? tierId,
            int? assignedEmployeeId,
            CustomerAccessContext accessContext,
            bool forPos = false) {
            var query = _dbContext.Customers
                .AsNoTracking()
                .Include(c => c.Tier)
                .Include(c => c.AssignedEmployee)
                .AsQueryable();

            // POS: nhân viên bán cần tìm mọi khách ACTIVE để lên đơn, không giới hạn NV phụ trách
            if (accessContext.IsSalesStaff && !forPos) {
                if (!accessContext.EmployeeId.HasValue) {
                    return new List<CustomerListItemResponse>();
                }

                query = query.Where(c => c.AssignedEmployeeId == accessContext.EmployeeId);
            }

            if (!string.IsNullOrWhiteSpace(keyword)) {
                var keywordValue = keyword.Trim();
                query = query.Where(c =>
                    c.FullName.Contains(keywordValue) ||
                    c.CustomerCode.Contains(keywordValue) ||
                    (c.Phone != null && c.Phone.Contains(keywordValue)) ||
                    (c.Email != null && c.Email.Contains(keywordValue)));
            }

            if (!string.IsNullOrWhiteSpace(customerType)) {
                var customerTypeValue = customerType.Trim();
                query = query.Where(c => c.CustomerType == customerTypeValue);
            }

            if (!string.IsNullOrWhiteSpace(status)) {
                var statusValue = status.Trim();
                query = query.Where(c => c.Status == statusValue);
            }

            if (tierId.HasValue) {
                query = query.Where(c => c.TierId == tierId.Value);
            }

            if (assignedEmployeeId.HasValue) {
                query = query.Where(c => c.AssignedEmployeeId == assignedEmployeeId.Value);
            }

            return await query
                .OrderBy(c => c.FullName)
                .Select(c => new CustomerListItemResponse {
                    CustomerId = c.Id,
                    CustomerCode = c.CustomerCode,
                    FullName = c.FullName,
                    CustomerType = c.CustomerType,
                    Phone = c.Phone,
                    Email = c.Email,
                    Status = c.Status,
                    TierId = c.TierId,
                    TierCode = c.Tier != null ? c.Tier.TierCode : null,
                    AssignedEmployeeId = c.AssignedEmployeeId,
                    AssignedEmployeeName = c.AssignedEmployee != null ? c.AssignedEmployee.FullName : null,
                    TotalSpend = c.TotalSpend
                })
                .ToListAsync();
        }

        public async Task<CustomerResult> GetCustomerByIdAsync(int id, CustomerAccessContext accessContext) {
            var customer = await _dbContext.Customers
                .AsNoTracking()
                .Include(c => c.Tier)
                .Include(c => c.AssignedEmployee)
                .FirstOrDefaultAsync(c => c.Id == id);

            if (customer is null) {
                return CustomerResult.Failure("Customer not found.");
            }

            if (!CanAccessCustomer(customer, accessContext)) {
                return CustomerResult.Forbidden("You do not have permission to access this customer.");
            }

            return CustomerResult.Success(MapDetail(customer));
        }

        public async Task<CustomerResult> CreateCustomerAsync(CreateCustomerRequest request, CustomerAccessContext accessContext) {
            var customerCode = request.CustomerCode!.Trim();
            if (await _dbContext.Customers.AnyAsync(c => c.CustomerCode == customerCode)) {
                return CustomerResult.Failure("CustomerCode already exists.");
            }

            var customerType = accessContext.IsSalesStaff
                ? "GENERAL"
                : NormalizeOptional(request.CustomerType) ?? "GENERAL";
            var assignedEmployeeId = accessContext.IsSalesStaff
                ? accessContext.EmployeeId
                : request.AssignedEmployeeId;

            if (accessContext.IsSalesStaff && assignedEmployeeId is null) {
                return CustomerResult.Failure("Current user employee id is required to create customers.");
            }

            var tierResolution = await ResolveTierIdForCustomerTypeAsync(customerType, request.TierId);
            if (!tierResolution.Success) {
                return CustomerResult.Failure(tierResolution.ErrorMessage!);
            }

            var referenceValidation = await ValidateReferencesAsync(tierResolution.TierId, assignedEmployeeId);
            if (referenceValidation is not null) {
                return CustomerResult.Failure(referenceValidation);
            }

            var customer = new Customer {
                CustomerCode = customerCode,
                FullName = request.FullName!.Trim(),
                CustomerType = customerType,
                Phone = NormalizeOptional(request.Phone),
                Email = NormalizeOptional(request.Email),
                Address = NormalizeOptional(request.Address),
                Status = "ACTIVE",
                TierId = tierResolution.TierId,
                AssignedEmployeeId = assignedEmployeeId,
                TotalSpend = 0
            };

            _dbContext.Customers.Add(customer);
            await _dbContext.SaveChangesAsync();

            var createdCustomer = await GetCustomerEntityAsync(customer.Id);
            return CustomerResult.Success(MapDetail(createdCustomer!));
        }

        public async Task<CustomerResult> UpdateCustomerAsync(int id, UpdateCustomerRequest request, CustomerAccessContext accessContext) {
            var customer = await _dbContext.Customers.FirstOrDefaultAsync(c => c.Id == id);
            if (customer is null) {
                return CustomerResult.Failure("Customer not found.");
            }

            if (!CanAccessCustomer(customer, accessContext)) {
                return CustomerResult.Forbidden("You do not have permission to access this customer.");
            }

            var customerType = request.CustomerType!.Trim();
            var tierResolution = await ResolveTierIdForCustomerTypeAsync(customerType, request.TierId);
            if (!tierResolution.Success) {
                return CustomerResult.Failure(tierResolution.ErrorMessage!);
            }

            var referenceValidation = await ValidateReferencesAsync(tierResolution.TierId, request.AssignedEmployeeId);
            if (referenceValidation is not null) {
                return CustomerResult.Failure(referenceValidation);
            }

            customer.FullName = request.FullName!.Trim();
            customer.CustomerType = customerType;
            customer.Phone = NormalizeOptional(request.Phone);
            customer.Email = NormalizeOptional(request.Email);
            customer.Address = NormalizeOptional(request.Address);
            customer.TierId = tierResolution.TierId;
            customer.AssignedEmployeeId = request.AssignedEmployeeId;

            await _dbContext.SaveChangesAsync();

            var updatedCustomer = await GetCustomerEntityAsync(customer.Id);
            return CustomerResult.Success(MapDetail(updatedCustomer!));
        }

        public async Task<CustomerResult> ChangeStatusAsync(int id, ChangeCustomerStatusRequest request) {
            var customer = await _dbContext.Customers.FirstOrDefaultAsync(c => c.Id == id);
            if (customer is null) {
                return CustomerResult.Failure("Customer not found.");
            }

            var status = request.Status!.Trim().ToUpperInvariant();
            if (string.Equals(status, "INACTIVE", StringComparison.Ordinal)) {
                var hasUnfinishedOrders = await _dbContext.Orders.AnyAsync(o =>
                    o.CustomerId == id &&
                    o.OrderStatus != "COMPLETED" &&
                    o.OrderStatus != "CANCELLED");

                if (hasUnfinishedOrders) {
                    return CustomerResult.Failure("Cannot deactivate customer because there are unfinished orders.");
                }
            }

            customer.Status = status;
            await _dbContext.SaveChangesAsync();

            var updatedCustomer = await GetCustomerEntityAsync(customer.Id);
            return CustomerResult.Success(MapDetail(updatedCustomer!));
        }

        public async Task<CustomerPurchaseHistoryResult> GetPurchaseHistoryAsync(int id, CustomerAccessContext accessContext) {
            var customer = await _dbContext.Customers
                .AsNoTracking()
                .FirstOrDefaultAsync(c => c.Id == id);

            if (customer is null) {
                return CustomerPurchaseHistoryResult.Failure("Customer not found.");
            }

            if (!CanAccessCustomer(customer, accessContext)) {
                return CustomerPurchaseHistoryResult.Forbidden("You do not have permission to access this customer.");
            }

            var orders = await _dbContext.Orders
                .AsNoTracking()
                .Where(o => o.CustomerId == id)
                .Include(o => o.OrderItems)
                    .ThenInclude(oi => oi.Product)
                .OrderByDescending(o => o.CreatedAt)
                .Select(o => new CustomerPurchaseHistoryItemResponse {
                    OrderId = o.Id,
                    OrderCode = o.OrderCode,
                    TotalAmount = o.TotalAmount,
                    PaymentStatus = o.PaymentStatus,
                    StockStatus = o.StockStatus,
                    OrderStatus = o.OrderStatus,
                    CreatedAt = o.CreatedAt,
                    ItemCount = o.OrderItems.Count,
                    Items = o.OrderItems.Select(oi => new CustomerPurchaseHistoryOrderItemResponse {
                        ProductId = oi.ProductId,
                        ProductSku = oi.Product != null ? oi.Product.Sku : null,
                        Quantity = oi.Quantity,
                        LineTotal = oi.LineTotal,
                        IsGift = oi.IsGift == 1
                    }).ToList()
                })
                .ToListAsync();

            return CustomerPurchaseHistoryResult.Success(new CustomerPurchaseHistoryResponse {
                CustomerId = customer.Id,
                CustomerCode = customer.CustomerCode,
                FullName = customer.FullName,
                Orders = orders
            });
        }

        private async Task<Customer?> GetCustomerEntityAsync(int id) {
            return await _dbContext.Customers
                .AsNoTracking()
                .Include(c => c.Tier)
                .Include(c => c.AssignedEmployee)
                .FirstOrDefaultAsync(c => c.Id == id);
        }

        private async Task<string?> ValidateReferencesAsync(int? tierId, int? assignedEmployeeId) {
            if (tierId.HasValue && !await _dbContext.MembershipTiers.AnyAsync(t => t.Id == tierId.Value)) {
                return "MembershipTier not found.";
            }

            if (assignedEmployeeId.HasValue &&
                !await _dbContext.Set<Employee>().AnyAsync(e => e.Id == assignedEmployeeId.Value)) {
                return "Assigned employee not found.";
            }

            return null;
        }

        private static bool CanAccessCustomer(Customer customer, CustomerAccessContext accessContext) {
            if (accessContext.CanManageAllCustomers) {
                return true;
            }

            return accessContext.IsSalesStaff &&
                accessContext.EmployeeId.HasValue &&
                customer.AssignedEmployeeId == accessContext.EmployeeId.Value;
        }

        private static CustomerDetailResponse MapDetail(Customer customer) {
            return new CustomerDetailResponse {
                CustomerId = customer.Id,
                CustomerCode = customer.CustomerCode,
                FullName = customer.FullName,
                CustomerType = customer.CustomerType,
                Phone = customer.Phone,
                Email = customer.Email,
                Address = customer.Address,
                Status = customer.Status,
                Tier = customer.Tier is null
                    ? null
                    : new CustomerTierResponse {
                        TierId = customer.Tier.Id,
                        TierCode = customer.Tier.TierCode,
                        MinTotalSpend = customer.Tier.MinTotalSpend,
                        DiscountPercent = customer.Tier.DiscountPercent
                    },
                AssignedEmployee = customer.AssignedEmployee is null
                    ? null
                    : new CustomerAssignedEmployeeResponse {
                        EmployeeId = customer.AssignedEmployee.Id,
                        EmployeeCode = customer.AssignedEmployee.EmployeeCode,
                        FullName = customer.AssignedEmployee.FullName
                    },
                TotalSpend = customer.TotalSpend
            };
        }

        private static string? NormalizeOptional(string? value) {
            return string.IsNullOrWhiteSpace(value) ? null : value.Trim();
        }

        private static bool IsSalesStaffRole(string role) {
            return string.Equals(role, "Sales Staff", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(role, "Sale", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(role, "Sales", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(role, "Staff", StringComparison.OrdinalIgnoreCase);
        }

        private static bool SupportsMembershipTier(string customerType) {
            var normalized = customerType.Trim().ToUpperInvariant();
            return normalized is "GENERAL" or "RETAIL";
        }

        private async Task<(bool Success, int? TierId, string? ErrorMessage)> ResolveTierIdForCustomerTypeAsync(
            string customerType,
            int? tierId) {
            if (!SupportsMembershipTier(customerType)) {
                if (tierId.HasValue) {
                    return (false, null, "Chỉ khách phổ thông mới được gán hạng thành viên.");
                }

                return (true, null, null);
            }

            if (tierId.HasValue) {
                return (true, tierId, null);
            }

            var defaultTierId = await _dbContext.MembershipTiers
                .AsNoTracking()
                .OrderBy(t => t.MinTotalSpend)
                .Select(t => (int?)t.Id)
                .FirstOrDefaultAsync();

            if (!defaultTierId.HasValue) {
                return (false, null, "Chưa cấu hình hạng thành viên (Bronze/Silver/Gold).");
            }

            return (true, defaultTierId, null);
        }
    }
}
