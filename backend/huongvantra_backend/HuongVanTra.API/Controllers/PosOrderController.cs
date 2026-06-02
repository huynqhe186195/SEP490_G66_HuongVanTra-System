using HuongVanTra.API.Extensions;
using HuongVanTra.API.Models.Sales;
using HuongVanTra.Infrastructure.Data;
using HuongVanTra.Service.Customers;
using HuongVanTra.Service.Sales;
using HuongVanTra.Service.Sales.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Mvc;

namespace HuongVanTra.API.Controllers {
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class PosOrderController : ControllerBase {
        private readonly IPosOrderService _posOrderService;
        private readonly AppDbContext _dbContext;
        private readonly ICustomerService _customerService;

        public PosOrderController(
            IPosOrderService posOrderService,
            AppDbContext dbContext,
            ICustomerService customerService) {
            _posOrderService = posOrderService;
            _dbContext = dbContext;
            _customerService = customerService;
        }

        [HttpGet("customers")]
        public async Task<ActionResult<List<PosCustomerSearchItemResponse>>> SearchCustomers(
            [FromQuery] string? search,
            [FromQuery] int limit = 20,
            CancellationToken cancellationToken = default) {
            var userId = User.GetUserId();
            if (userId is null) {
                return Unauthorized("User not found in token.");
            }

            var accessContext = await _customerService.GetAccessContextAsync(userId.Value);
            if (accessContext is null) {
                return Unauthorized("User not found.");
            }

            var queryLimit = Math.Clamp(limit, 1, 50);
            var customers = await _customerService.GetCustomersAsync(
                search,
                customerType: null,
                status: "ACTIVE",
                tierId: null,
                assignedEmployeeId: null,
                accessContext,
                forPos: true);

            return Ok(customers
                .Take(queryLimit)
                .Select(c => new PosCustomerSearchItemResponse {
                    CustomerId = c.CustomerId,
                    CustomerCode = c.CustomerCode,
                    FullName = c.FullName,
                    Phone = c.Phone,
                })
                .ToList());
        }

        [HttpPost("customers")]
        public async Task<ActionResult<PosCustomerSearchItemResponse>> CreateCustomer(
            [FromBody] CreateCustomerRequest request,
            CancellationToken cancellationToken = default) {
            var userId = User.GetUserId();
            if (userId is null) {
                return Unauthorized("User not found in token.");
            }

            if (string.IsNullOrWhiteSpace(request.FullName)) {
                return BadRequest("FullName is required.");
            }

            if (string.IsNullOrWhiteSpace(request.Phone)) {
                return BadRequest("Phone is required.");
            }

            var accessContext = await _customerService.GetAccessContextAsync(userId.Value);
            if (accessContext is null) {
                return Unauthorized("User not found.");
            }

            if (string.IsNullOrWhiteSpace(request.CustomerCode)) {
                request.CustomerCode = await GenerateCustomerCodeAsync(cancellationToken);
            }

            var result = await _customerService.CreateCustomerAsync(request, accessContext);
            if (!result.IsSuccess || result.Customer is null) {
                return BadRequest(result.ErrorMessage ?? "Could not create customer.");
            }

            return StatusCode(201, new PosCustomerSearchItemResponse {
                CustomerId = result.Customer.CustomerId,
                CustomerCode = result.Customer.CustomerCode,
                FullName = result.Customer.FullName,
                Phone = result.Customer.Phone,
            });
        }

        [HttpGet("customers/{customerId:int}/context")]
        public async Task<ActionResult<PosCustomerContextResponse>> GetCustomerContext(
            int customerId,
            CancellationToken cancellationToken = default) {
            var customer = await _dbContext.Customers
                .AsNoTracking()
                .Include(c => c.Tier)
                .FirstOrDefaultAsync(c => c.Id == customerId, cancellationToken);

            if (customer is null) {
                return NotFound("Customer not found.");
            }

            var orders = await _dbContext.Orders
                .AsNoTracking()
                .Include(o => o.PaymentTransactions)
                .Include(o => o.Cashier)
                    .ThenInclude(c => c.EmployeeRoles)
                    .ThenInclude(er => er.Role)
                .Where(o => o.CustomerId == customerId)
                .OrderByDescending(o => o.CreatedAt)
                .Take(50)
                .ToListAsync(cancellationToken);

            var unpaidOrders = new List<PosCustomerDebtOrderItemResponse>();
            decimal outstandingBalance = 0;

            foreach (var order in orders) {
                if (string.Equals(order.OrderStatus, "cancelled", StringComparison.OrdinalIgnoreCase)) {
                    continue;
                }

                if (string.Equals(order.PaymentStatus, "paid", StringComparison.OrdinalIgnoreCase)) {
                    continue;
                }

                var paidAmount = order.PaymentTransactions
                    .Where(t => string.Equals(t.Status, "paid", StringComparison.OrdinalIgnoreCase))
                    .Sum(t => t.Amount);

                var remaining = Math.Max(0, order.TotalAmount - paidAmount);
                if (remaining <= 0) {
                    continue;
                }

                outstandingBalance += remaining;
                unpaidOrders.Add(new PosCustomerDebtOrderItemResponse {
                    OrderCode = order.OrderCode,
                    TotalAmount = order.TotalAmount,
                    PaidAmount = paidAmount,
                    RemainingAmount = remaining,
                    PaymentStatus = order.PaymentStatus,
                    CreatedAt = order.CreatedAt,
                });
            }

            var recentOrders = orders
                .Take(20)
                .Select(o => {
                    var cashierRoles = o.Cashier.EmployeeRoles
                        .Select(er => er.Role.Name)
                        .Where(name => !string.IsNullOrWhiteSpace(name))
                        .Distinct()
                        .ToList();

                    return new PosCustomerOrderHistoryItemResponse {
                        OrderCode = o.OrderCode,
                        EntryType = string.Equals(o.OrderStatus, "cancelled", StringComparison.OrdinalIgnoreCase)
                            ? "Trả / hủy"
                            : "Bán hàng",
                        Amount = string.Equals(o.OrderStatus, "cancelled", StringComparison.OrdinalIgnoreCase)
                            ? -o.TotalAmount
                            : o.TotalAmount,
                        PaymentStatus = o.PaymentStatus,
                        OrderStatus = o.OrderStatus,
                        CashierName = o.Cashier.FullName,
                        CashierRole = string.Join(", ", cashierRoles),
                        CreatedAt = o.CreatedAt,
                    };
                })
                .ToList();

            return Ok(new PosCustomerContextResponse {
                CustomerId = customer.Id,
                CustomerCode = customer.CustomerCode,
                FullName = customer.FullName,
                CustomerType = customer.CustomerType,
                Phone = customer.Phone,
                Email = customer.Email,
                Address = customer.Address,
                TierCode = customer.Tier?.TierCode,
                OutstandingBalance = outstandingBalance,
                RecentOrders = recentOrders,
                UnpaidOrders = unpaidOrders,
            });
        }

        [HttpGet("products")]
        public async Task<ActionResult<List<PosProductSearchItemResponse>>> SearchProducts(
            [FromQuery] int storeId,
            [FromQuery] string? search,
            [FromQuery] int limit = 30,
            CancellationToken cancellationToken = default) {
            if (storeId <= 0) {
                return BadRequest("storeId is required.");
            }

            var queryLimit = Math.Clamp(limit, 1, 100);
            var query = _dbContext.Products.AsNoTracking();

            if (!string.IsNullOrWhiteSpace(search)) {
                var term = $"%{search.Trim()}%";
                query = query.Where(p =>
                    EF.Functions.Like(p.Name, term) ||
                    EF.Functions.Like(p.Sku, term));
            }

            var products = await query
                .OrderBy(p => p.Name)
                .Take(queryLimit)
                .Select(p => new {
                    p.Id,
                    p.Sku,
                    p.Name,
                    p.Price
                })
                .ToListAsync(cancellationToken);

            var productIds = products.Select(p => p.Id).ToList();
            var stockByProductId = await _dbContext.InventoryBalances
                .AsNoTracking()
                .Where(b => productIds.Contains(b.ProductId) && b.Warehouse.StoreId == storeId)
                .GroupBy(b => b.ProductId)
                .Select(g => new { ProductId = g.Key, Quantity = g.Sum(x => x.Quantity) })
                .ToDictionaryAsync(x => x.ProductId, x => x.Quantity, cancellationToken);

            return Ok(products.Select(p => new PosProductSearchItemResponse {
                ProductId = p.Id,
                Sku = p.Sku,
                Name = p.Name,
                Price = p.Price,
                StockQuantity = stockByProductId.TryGetValue(p.Id, out var qty) ? qty : 0
            }).ToList());
        }

        /// <summary>
        /// Create POS order in online mode: order is created with StockStatus = PENDING.
        /// Inventory deduction is queued and processed later.
        /// </summary>
        [HttpPost("online")]
        public async Task<ActionResult<PosOrderResponse>> CreateOnlineOrder([FromBody] CreatePosOrderRequest request) {
            var cashierId = User.GetEmployeeId();
            if (cashierId is null) {
                return Unauthorized("Employee ID not found in token.");
            }

            var command = new CreatePosOrderCommand {
                StoreId = request.StoreId,
                CashierId = cashierId.Value,
                CustomerId = request.CustomerId,
                PromotionId = request.PromotionId,
                Items = request.Items.Select(i => new OrderItemCommand {
                    ProductId = i.ProductId,
                    Quantity = i.Quantity,
                    IsGift = i.IsGift
                }).ToList(),
                Payments = request.Payments.Select(p => new PaymentCommand {
                    PaymentMethod = p.PaymentMethod,
                    Amount = p.Amount
                }).ToList()
            };

            try {
                var result = await _posOrderService.CreateOnlineOrderAsync(command);
                return StatusCode(201, ToResponse(result));
            }
            catch (ArgumentException ex) {
                return BadRequest(ex.Message);
            }
            catch (InvalidOperationException ex) {
                return BadRequest(ex.Message);
            }
        }

        /// <summary>
        /// Create POS order in offline mode: order is created and inventory is deducted immediately.
        /// StockStatus = DEDUCTED.
        /// </summary>
        [HttpPost("offline")]
        public async Task<ActionResult<PosOrderResponse>> CreateOfflineOrder([FromBody] CreatePosOrderRequest request) {
            var cashierId = User.GetEmployeeId();
            if (cashierId is null) {
                return Unauthorized("Employee ID not found in token.");
            }

            var command = new CreatePosOrderCommand {
                StoreId = request.StoreId,
                CashierId = cashierId.Value,
                CustomerId = request.CustomerId,
                PromotionId = request.PromotionId,
                Items = request.Items.Select(i => new OrderItemCommand {
                    ProductId = i.ProductId,
                    Quantity = i.Quantity,
                    IsGift = i.IsGift
                }).ToList(),
                Payments = request.Payments.Select(p => new PaymentCommand {
                    PaymentMethod = p.PaymentMethod,
                    Amount = p.Amount
                }).ToList()
            };

            try {
                var result = await _posOrderService.CreateOfflineOrderAsync(command);
                return StatusCode(201, ToResponse(result));
            }
            catch (ArgumentException ex) {
                return BadRequest(ex.Message);
            }
            catch (InvalidOperationException ex) {
                return BadRequest(ex.Message);
            }
        }

        private async Task<string> GenerateCustomerCodeAsync(CancellationToken cancellationToken) {
            var today = DateTime.UtcNow.ToString("yyyyMMdd");
            var prefix = $"KH{today}";

            var lastCode = await _dbContext.Customers
                .AsNoTracking()
                .Where(c => c.CustomerCode.StartsWith(prefix))
                .OrderByDescending(c => c.CustomerCode)
                .Select(c => c.CustomerCode)
                .FirstOrDefaultAsync(cancellationToken);

            var nextNumber = 1;
            if (!string.IsNullOrWhiteSpace(lastCode) && lastCode.Length > prefix.Length) {
                var suffix = lastCode[prefix.Length..];
                if (int.TryParse(suffix, out var current)) {
                    nextNumber = current + 1;
                }
            }

            return $"{prefix}{nextNumber:D3}";
        }

        private static PosOrderResponse ToResponse(PosOrderResult result) => new() {
            OrderId       = result.OrderId,
            OrderCode     = result.OrderCode,
            TotalAmount   = result.TotalAmount,
            PaymentStatus = result.PaymentStatus,
            StockStatus   = result.StockStatus,
            OrderStatus   = result.OrderStatus,
            CreatedAt     = result.CreatedAt,
            Items         = result.Items.Select(i => new PosOrderItemResponse {
                ProductId   = i.ProductId,
                ProductName = i.ProductName,
                Sku         = i.Sku,
                UnitPrice   = i.UnitPrice,
                Quantity    = i.Quantity,
                LineTotal   = i.LineTotal,
                IsGift      = i.IsGift
            }).ToList()
        };
    }
}
