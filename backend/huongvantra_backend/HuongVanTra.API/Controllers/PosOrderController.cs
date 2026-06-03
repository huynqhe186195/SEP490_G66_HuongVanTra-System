using HuongVanTra.API.Extensions;
using HuongVanTra.API.Models.Sales;
using HuongVanTra.Core.Authorization;
using HuongVanTra.Infrastructure.Data;
using HuongVanTra.Service.Customers;
using HuongVanTra.Service.Sales;
using HuongVanTra.Service.Sales.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;

namespace HuongVanTra.API.Controllers {
    [Authorize(Policy = AppPolicies.PosAccess)]
    [ApiController]
    [Route("api/[controller]")]
    public class PosOrderController : ControllerBase {
        private readonly IPosOrderService _posOrderService;
        private readonly AppDbContext _dbContext;
        private readonly ICustomerService _customerService;
        private readonly IOrderConfirmationService _orderConfirmationService;
        private readonly IPaymentWebhookService _paymentWebhookService;
        private readonly SepaySettings _sepaySettings;
        private readonly ISepayOrderVaService _sepayOrderVaService;
        private readonly IConfiguration _configuration;
        private readonly IWebHostEnvironment _environment;

        public PosOrderController(
            IPosOrderService posOrderService,
            AppDbContext dbContext,
            ICustomerService customerService,
            IOrderConfirmationService orderConfirmationService,
            IPaymentWebhookService paymentWebhookService,
            ISepayOrderVaService sepayOrderVaService,
            IOptions<SepaySettings> sepayOptions,
            IConfiguration configuration,
            IWebHostEnvironment environment) {
            _posOrderService = posOrderService;
            _dbContext = dbContext;
            _customerService = customerService;
            _orderConfirmationService = orderConfirmationService;
            _paymentWebhookService = paymentWebhookService;
            _sepayOrderVaService = sepayOrderVaService;
            _sepaySettings = sepayOptions.Value;
            _configuration = configuration;
            _environment = environment;
        }

        [HttpGet("payment/sepay-setup")]
        public async Task<ActionResult<SepaySetupDiagnostics>> GetSepaySetupStatus(
            CancellationToken cancellationToken = default) {
            var diagnostics = await _sepayOrderVaService.GetSetupDiagnosticsAsync(cancellationToken);
            return Ok(diagnostics);
        }

        [HttpGet("payment/transfer-info")]
        public ActionResult<PosTransferPaymentInfoResponse> GetTransferPaymentInfo() {
            var section = _configuration.GetSection("PosTransferPayment");
            var bankCode = section["BankCode"];
            var bankBin = section["BankBin"];
            var bankName = section["BankName"];
            var accountNumber = section["AccountNumber"];
            var accountHolder = section["AccountHolder"];

            if (string.IsNullOrWhiteSpace(bankCode) && string.IsNullOrWhiteSpace(bankBin)) {
                return BadRequest("PosTransferPayment: BankCode or BankBin is required.");
            }

            if (string.IsNullOrWhiteSpace(bankName) ||
                string.IsNullOrWhiteSpace(accountNumber)) {
                return BadRequest("PosTransferPayment is not configured (BankName, AccountNumber).");
            }

            return Ok(new PosTransferPaymentInfoResponse {
                BankCode = (bankCode ?? bankBin)!.Trim(),
                BankBin = (bankBin ?? bankCode)!.Trim(),
                BankName = bankName.Trim(),
                AccountNumber = accountNumber.Trim(),
                AccountHolder = accountHolder.Trim(),
                PaymentMode = _sepayOrderVaService.PaymentMode,
                SepayOrderVaEnabled = _sepaySettings.IsOrderVaApiEnabled,
                SepayWebhookEnabled = _sepaySettings.EnableWebhook,
            });
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

            var limited = customers.Take(queryLimit).ToList();

            return Ok(limited.Select(c => new PosCustomerSearchItemResponse {
                CustomerId = c.CustomerId,
                CustomerCode = c.CustomerCode,
                FullName = c.FullName,
                Phone = c.Phone,
                TierCode = c.TierCode,
                TierDiscountPercent = c.TierDiscountPercent,
                CurrentDebt = c.CurrentDebt,
            }).ToList());
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
                TierCode = result.Customer.Tier?.TierCode,
                TierDiscountPercent = result.Customer.Tier?.DiscountPercent ?? 0,
                CurrentDebt = result.Customer.CurrentDebt,
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

            var shippingAddresses = BuildCustomerShippingAddresses(customer, orders);

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
                TierId = customer.TierId,
                TierDiscountPercent = customer.Tier?.DiscountPercent ?? 0,
                TotalSpend = customer.TotalSpend,
                CurrentDebt = customer.CurrentDebt,
                OutstandingBalance = outstandingBalance,
                RecentOrders = recentOrders,
                UnpaidOrders = unpaidOrders,
                ShippingAddresses = shippingAddresses,
            });
        }

        private static List<PosCustomerShippingAddressResponse> BuildCustomerShippingAddresses(
            HuongVanTra.Core.Entities.Customers.Customer customer,
            IReadOnlyList<HuongVanTra.Core.Entities.Sales.Order> orders) {
            var lastUsedByAddress = new Dictionary<string, DateTime>(StringComparer.OrdinalIgnoreCase);

            foreach (var order in orders) {
                var address = order.ShippingAddress?.Trim();
                if (string.IsNullOrWhiteSpace(address)) {
                    continue;
                }

                if (!lastUsedByAddress.TryGetValue(address, out var lastUsed) || order.CreatedAt > lastUsed) {
                    lastUsedByAddress[address] = order.CreatedAt;
                }
            }

            var profileAddress = customer.Address?.Trim();
            var hasProfileInOrders = !string.IsNullOrWhiteSpace(profileAddress)
                && lastUsedByAddress.ContainsKey(profileAddress);

            if (!string.IsNullOrWhiteSpace(profileAddress) && !hasProfileInOrders) {
                lastUsedByAddress[profileAddress] = DateTime.MinValue;
            }

            return lastUsedByAddress
                .OrderByDescending(kv => kv.Value == DateTime.MinValue ? DateTime.MinValue : kv.Value)
                .Take(20)
                .Select(kv => new PosCustomerShippingAddressResponse {
                    Address = kv.Key,
                    LastUsedAt = kv.Value == DateTime.MinValue ? null : kv.Value,
                    IsProfileAddress = !string.IsNullOrWhiteSpace(profileAddress)
                        && string.Equals(kv.Key, profileAddress, StringComparison.OrdinalIgnoreCase),
                })
                .ToList();
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

            var warehouse = await _dbContext.Warehouses
                .AsNoTracking()
                .FirstOrDefaultAsync(w => w.StoreId == storeId, cancellationToken);

            if (warehouse is null) {
                return BadRequest($"No warehouse found for store {storeId}.");
            }

            var productIds = products.Select(p => p.Id).ToList();

            var balanceByProductId = await _dbContext.InventoryBalances
                .AsNoTracking()
                .Where(b => b.WarehouseId == warehouse.Id)
                .ToDictionaryAsync(b => b.ProductId, b => b.Quantity, cancellationToken);

            var bomByFinishedGoodId = await _dbContext.BomHeaders
                .AsNoTracking()
                .Include(b => b.BomLines)
                .Where(b => productIds.Contains(b.FinishedGoodId))
                .ToDictionaryAsync(b => b.FinishedGoodId, cancellationToken);

            return Ok(products.Select(p => new PosProductSearchItemResponse {
                ProductId = p.Id,
                Sku = p.Sku,
                Name = p.Name,
                Price = p.Price,
                StockQuantity = PosStockCalculator.CalculateSellableQuantity(
                    p.Id,
                    balanceByProductId,
                    bomByFinishedGoodId),
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
                ManualDiscount = request.ManualDiscount,
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
                return BadRequest(new { message = ex.Message });
            }
            catch (SepayVaSetupException ex) {
                return BadRequest(new { message = ex.Message });
            }
            catch (InvalidOperationException ex) {
                return BadRequest(new { message = ex.Message });
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
                ManualDiscount = request.ManualDiscount,
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
                return BadRequest(new { message = ex.Message });
            }
            catch (SepayVaSetupException ex) {
                return BadRequest(new { message = ex.Message });
            }
            catch (InvalidOperationException ex) {
                return BadRequest(new { message = ex.Message });
            }
        }

        /// <summary>Poll trạng thái thanh toán (POS QR chờ webhook / simulate).</summary>
        [HttpGet("orders/{orderId:int}/payment-status")]
        public async Task<ActionResult<PosOrderPaymentStatusResponse>> GetPaymentStatus(
            int orderId,
            CancellationToken cancellationToken = default) {
            var order = await _dbContext.Orders
                .AsNoTracking()
                .Where(o => o.Id == orderId)
                .Select(o => new {
                    o.Id,
                    o.OrderCode,
                    o.PaymentStatus,
                    o.OrderStatus,
                    o.TotalAmount,
                    InvoiceCode = _dbContext.Invoices
                        .Where(i => i.OrderId == o.Id)
                        .OrderByDescending(i => i.Id)
                        .Select(i => i.InvoiceCode)
                        .FirstOrDefault(),
                })
                .FirstOrDefaultAsync(cancellationToken);

            if (order is null) {
                return NotFound("Order not found.");
            }

            var isPaid = string.Equals(order.PaymentStatus, "paid", StringComparison.OrdinalIgnoreCase);
            var expectedContent = BuildExpectedTransferContent(order.OrderCode);
            return Ok(new PosOrderPaymentStatusResponse {
                OrderId = order.Id,
                OrderCode = order.OrderCode,
                PaymentStatus = order.PaymentStatus,
                OrderStatus = order.OrderStatus,
                IsPaid = isPaid,
                InvoiceCode = order.InvoiceCode,
                ExpectedTransferContent = expectedContent,
                ExpectedAmount = order.TotalAmount,
            });
        }

        private static string BuildExpectedTransferContent(string orderCode) {
            var cleaned = orderCode.Trim().ToUpperInvariant();
            cleaned = new string(cleaned.Where(ch => char.IsLetterOrDigit(ch) || ch == '-').ToArray());
            return cleaned.Length <= 25 ? cleaned : cleaned[..25];
        }

        /// <summary>
        /// Mô phỏng webhook ngân hàng/VietQR: tự xác nhận thanh toán đơn CK.
        /// Chỉ bật khi Development hoặc PosTransferPayment:AllowSimulateWebhook = true.
        /// </summary>
        [HttpPost("webhooks/simulate-payment")]
        public async Task<ActionResult<PosOrderPaymentStatusResponse>> SimulatePaymentWebhook(
            [FromBody] SimulatePaymentWebhookRequest request,
            CancellationToken cancellationToken = default) {
            if (!IsSimulateWebhookEnabled()) {
                return NotFound("Simulate webhook is disabled.");
            }

            if (!ValidateSimulateWebhookSecret(request.Secret)) {
                return Unauthorized("Invalid webhook secret.");
            }

            if (request.OrderId <= 0) {
                return BadRequest("OrderId is required.");
            }

            var order = await _dbContext.Orders
                .AsNoTracking()
                .Where(o => o.Id == request.OrderId)
                .Select(o => new { o.Id, o.OrderCode, o.TotalAmount, o.PaymentStatus })
                .FirstOrDefaultAsync(cancellationToken);

            if (order is null) {
                return NotFound("Order not found.");
            }

            if (string.Equals(order.PaymentStatus, "paid", StringComparison.OrdinalIgnoreCase)) {
                return await GetPaymentStatus(request.OrderId, cancellationToken);
            }

            var transferContent = BuildExpectedTransferContent(order.OrderCode);
            var webhookResult = await _paymentWebhookService.ProcessSepayWebhookAsync(
                new SepayWebhookCommand {
                    TransactionId = DateTimeOffset.UtcNow.ToUnixTimeSeconds(),
                    TransferType = "in",
                    TransferAmount = order.TotalAmount,
                    Content = transferContent,
                    Code = order.OrderCode,
                    AccountNumber = _sepaySettings.AccountNumber,
                    ReferenceCode = request.PaymentReference ?? $"SIM-{order.OrderCode}",
                },
                cancellationToken);

            if (!webhookResult.Success || webhookResult.Skipped) {
                return BadRequest(new {
                    message = webhookResult.Message,
                    webhookResult.Skipped,
                });
            }

            return await GetPaymentStatus(request.OrderId, cancellationToken);
        }

        private bool IsSimulateWebhookEnabled() {
            if (_environment.IsDevelopment()) {
                return true;
            }

            return _configuration.GetValue<bool>($"{VietQrTransferSettings.SectionName}:AllowSimulateWebhook");
        }

        private bool ValidateSimulateWebhookSecret(string? providedSecret) {
            var expected = _configuration[$"{VietQrTransferSettings.SectionName}:SimulateWebhookSecret"];
            if (string.IsNullOrWhiteSpace(expected)) {
                return true;
            }

            return string.Equals(expected.Trim(), providedSecret?.Trim(), StringComparison.Ordinal);
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
            QrPayload     = result.QrPayload,
            QrImageUrl    = result.QrImageUrl,
            TransferContent = result.TransferContent,
            TransferAccountNumber = result.TransferAccountNumber,
            PaymentMode = result.PaymentMode,
            QrExpiresAtUtc = result.QrExpiresAtUtc,
            InvoiceCode     = result.InvoiceCode,
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
