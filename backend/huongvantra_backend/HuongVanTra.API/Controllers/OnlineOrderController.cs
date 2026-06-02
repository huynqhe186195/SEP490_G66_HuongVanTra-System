using HuongVanTra.API.Extensions;
using HuongVanTra.API.Models.Sales;
using HuongVanTra.Service.Sales;
using HuongVanTra.Service.Sales.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HuongVanTra.API.Controllers {
    [Authorize]
    [ApiController]
    [Route("api/online-orders")]
    public class OnlineOrderController : ControllerBase {
        private readonly IOnlineOrderService _onlineOrderService;
        private readonly IOrderConfirmationService _orderConfirmationService;

        public OnlineOrderController(
            IOnlineOrderService onlineOrderService,
            IOrderConfirmationService orderConfirmationService) {
            _onlineOrderService = onlineOrderService;
            _orderConfirmationService = orderConfirmationService;
        }

        /// <summary>
        /// Tạo đơn online thanh toán VietQR/chuyển khoản.
        /// Response trả qr_payload để khách quét thanh toán.
        /// Nội dung chuyển khoản bắt buộc là order_code.
        /// </summary>
        [HttpPost("vietqr")]
        public async Task<ActionResult<OnlineOrderResponse>> CreateVietQrOrder(
            [FromBody] CreateOnlineOrderRequest request) {

            var cashierId = User.GetEmployeeId();
            if (cashierId is null)
                return Unauthorized("Employee ID not found in token.");

            var command = MapToCommand(request, cashierId.Value, "VIETQR");

            try {
                var result = await _onlineOrderService.CreateVietQrOrderAsync(command);
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
        /// Tạo đơn online thanh toán COD.
        /// Nhân sự COD phụ trách theo dõi và tick thủ công khi giao thành công.
        /// </summary>
        [HttpPost("cod")]
        public async Task<ActionResult<OnlineOrderResponse>> CreateCodOrder(
            [FromBody] CreateOnlineOrderRequest request) {

            var cashierId = User.GetEmployeeId();
            if (cashierId is null)
                return Unauthorized("Employee ID not found in token.");

            var command = MapToCommand(request, cashierId.Value, "COD");

            try {
                var result = await _onlineOrderService.CreateCodOrderAsync(command);
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
        /// Nhân sự COD tick thủ công "Đã giao hàng và Đã nhận tiền".
        /// Cập nhật payment_status = paid, order_status = completed, ghi audit log.
        /// </summary>
        [HttpPatch("{id:int}/cod/mark-delivered-and-paid")]
        public Task<ActionResult<OrderConfirmationResponse>> MarkCodDeliveredAndPaid(int id) {
            return ConfirmCodCompletedInternal(id);
        }

        /// <summary>
        /// Xác nhận COD đã giao và đã thu tiền (alias rõ nghĩa hơn).
        /// </summary>
        [HttpPatch("{id:int}/cod/confirm-completed")]
        public Task<ActionResult<OrderConfirmationResponse>> ConfirmCodCompleted(int id) {
            return ConfirmCodCompletedInternal(id);
        }

        /// <summary>
        /// Xác nhận khách đã chuyển khoản / VietQR (đơn online không phải COD).
        /// </summary>
        [HttpPatch("{id:int}/confirm-payment")]
        public async Task<ActionResult<OrderConfirmationResponse>> ConfirmPayment(
            int id,
            [FromBody] ConfirmPaymentRequest? request) {
            var employeeId = User.GetEmployeeId();
            if (employeeId is null) {
                return Unauthorized("Employee ID not found in token.");
            }

            try {
                var result = await _orderConfirmationService.ConfirmPaymentAsync(new ConfirmPaymentCommand {
                    OrderId = id,
                    EmployeeId = employeeId.Value,
                    PaymentReference = request?.PaymentReference,
                    Note = request?.Note,
                });

                return Ok(ToConfirmationResponse(result));
            }
            catch (ArgumentException ex) {
                return NotFound(ex.Message);
            }
            catch (InvalidOperationException ex) {
                return BadRequest(ex.Message);
            }
        }

        private async Task<ActionResult<OrderConfirmationResponse>> ConfirmCodCompletedInternal(int id) {
            var employeeId = User.GetEmployeeId();
            if (employeeId is null) {
                return Unauthorized("Employee ID not found in token.");
            }

            try {
                var result = await _orderConfirmationService.ConfirmCodCompletedAsync(id, employeeId.Value);
                return Ok(ToConfirmationResponse(result));
            }
            catch (ArgumentException ex) {
                return NotFound(ex.Message);
            }
            catch (InvalidOperationException ex) {
                return BadRequest(ex.Message);
            }
        }

        private static OrderConfirmationResponse ToConfirmationResponse(OrderConfirmationResult result) => new() {
            OrderId = result.OrderId,
            OrderCode = result.OrderCode,
            PaymentMethod = result.PaymentMethod,
            PaymentStatus = result.PaymentStatus,
            OrderStatus = result.OrderStatus,
            ConfirmedAt = result.ConfirmedAt,
        };

        /// <summary>
        /// Danh sách đơn COD treo: chưa giao thành công, chưa hủy,
        /// và đã quá 7 ngày kể từ ngày tạo hoặc lần nhắc gần nhất.
        /// </summary>
        [HttpGet("cod/overdue")]
        public async Task<ActionResult> GetOverdueCodOrders() {
            var results = await _onlineOrderService.GetOverdueCodOrdersAsync();
            return Ok(results);
        }

        private static CreateOnlineOrderCommand MapToCommand(
            CreateOnlineOrderRequest request, int cashierId, string paymentMethod) => new() {
            StoreId         = request.StoreId,
            CashierId       = cashierId,
            CustomerId      = request.CustomerId,
            PromotionId     = request.PromotionId,
            PaymentMethod   = paymentMethod,
            ShippingAddress = request.ShippingAddress,
            Items           = request.Items.Select(i => new OrderItemCommand {
                ProductId = i.ProductId,
                Quantity  = i.Quantity,
                IsGift    = i.IsGift
            }).ToList(),
            Payments        = request.Payments.Select(p => new PaymentCommand {
                PaymentMethod = p.PaymentMethod,
                Amount        = p.Amount
            }).ToList()
        };

        private static OnlineOrderResponse ToResponse(OnlineOrderResult result) => new() {
            OrderId       = result.OrderId,
            OrderCode     = result.OrderCode,
            TotalAmount   = result.TotalAmount,
            PaymentMethod = result.PaymentMethod,
            PaymentStatus = result.PaymentStatus,
            StockStatus   = result.StockStatus,
            OrderStatus   = result.OrderStatus,
            QrPayload     = result.QrPayload,
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
