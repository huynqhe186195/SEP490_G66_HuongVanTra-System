using HuongVanTra.API.Extensions;
using HuongVanTra.API.Models.Sales;
using HuongVanTra.Service.Sales;
using HuongVanTra.Service.Sales.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HuongVanTra.API.Controllers {
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class PosOrderController : ControllerBase {
        private readonly IPosOrderService _posOrderService;

        public PosOrderController(IPosOrderService posOrderService) {
            _posOrderService = posOrderService;
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
