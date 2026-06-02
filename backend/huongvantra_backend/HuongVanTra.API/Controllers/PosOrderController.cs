using HuongVanTra.API.Extensions;
using HuongVanTra.API.Models.Sales;
using HuongVanTra.Infrastructure.Data;
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

        public PosOrderController(IPosOrderService posOrderService, AppDbContext dbContext) {
            _posOrderService = posOrderService;
            _dbContext = dbContext;
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
