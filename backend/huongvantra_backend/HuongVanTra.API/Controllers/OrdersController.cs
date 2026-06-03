using HuongVanTra.API.Extensions;
using HuongVanTra.API.Models.Sales;
using HuongVanTra.Core.Authorization;
using HuongVanTra.Service.Orders;
using HuongVanTra.Service.Sales;
using HuongVanTra.Service.Sales.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HuongVanTra.API.Controllers {
    [Authorize(Policy = AppPolicies.ManageOrders)]
    [Route("api/[controller]")]
    public class OrdersController : ApiControllerBase {
        private readonly IOrderService _orderService;
        private readonly IOrderConfirmationService _orderConfirmationService;

        public OrdersController(IOrderService orderService, IOrderConfirmationService orderConfirmationService) {
            _orderService = orderService;
            _orderConfirmationService = orderConfirmationService;
        }

        [HttpGet]
        public async Task<ActionResult<PagedResult<OrderListItemDto>>> GetOrders(
            [FromQuery] string? search,
            [FromQuery] string? orderStatus,
            [FromQuery] string? paymentStatus,
            [FromQuery] string? paymentMethod,
            [FromQuery] DateTime? fromDate,
            [FromQuery] DateTime? toDate,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 20,
            CancellationToken cancellationToken = default) {
            var result = await _orderService.GetOrdersAsync(new OrderQuery {
                Search = search,
                OrderStatus = orderStatus,
                PaymentStatus = paymentStatus,
                PaymentMethod = paymentMethod,
                FromDate = fromDate,
                ToDate = toDate,
                Page = page,
                PageSize = pageSize,
            }, cancellationToken);

            return Ok(result);
        }

        [HttpGet("{idOrCode}")]
        public async Task<ActionResult<OrderDetailDto>> GetOrder(string idOrCode, CancellationToken cancellationToken) {
            var order = await _orderService.GetOrderAsync(idOrCode, cancellationToken);
            if (order is null) {
                return NotFound("Order not found.");
            }

            return Ok(order);
        }

        [HttpPatch("{id:int}/status")]
        public async Task<ActionResult<OrderDetailDto>> UpdateStatus(
            int id,
            [FromBody] UpdateOrderStatusRequest request,
            CancellationToken cancellationToken) {
            try {
                var order = await _orderService.UpdateOrderStatusAsync(id, request, cancellationToken);
                if (order is null) {
                    return NotFound("Order not found.");
                }

                return Ok(order);
            }
            catch (ArgumentException ex) {
                return BadRequest(ex.Message);
            }
        }

        [HttpPost("{id:int}/coupon")]
        public async Task<ActionResult<OrderDetailDto>> ApplyCoupon(
            int id,
            [FromBody] ApplyCouponRequest request,
            CancellationToken cancellationToken) {
            try {
                var order = await _orderService.ApplyCouponAsync(id, request, cancellationToken);
                if (order is null) {
                    return NotFound("Order not found.");
                }

                return Ok(order);
            }
            catch (ArgumentException ex) {
                return BadRequest(ex.Message);
            }
        }

        [HttpPost("{id:int}/gift-items")]
        public async Task<ActionResult<OrderDetailDto>> AddGiftItem(
            int id,
            [FromBody] AddGiftItemRequest request,
            CancellationToken cancellationToken) {
            try {
                var order = await _orderService.AddGiftItemAsync(id, request, cancellationToken);
                if (order is null) {
                    return NotFound("Order not found.");
                }

                return Ok(order);
            }
            catch (ArgumentException ex) {
                return BadRequest(ex.Message);
            }
        }

        /// <summary>
        /// Tạo QR/VietQR theo tổng tiền hiện tại (sau khi sửa sản phẩm).
        /// </summary>
        [HttpGet("{id:int}/payment-qr")]
        public async Task<ActionResult<OrderPaymentQrDto>> GetPaymentQr(
            int id,
            [FromQuery] bool force = false,
            CancellationToken cancellationToken = default) {
            try {
                var qr = await _orderService.GetOrderPaymentQrAsync(id, force, cancellationToken);
                if (qr is null) {
                    return NotFound("Order not found.");
                }

                return Ok(qr);
            }
            catch (InvalidOperationException ex) {
                return BadRequest(ex.Message);
            }
        }

        [HttpPut("{id:int}/items")]
        public async Task<ActionResult<OrderDetailDto>> UpdateItems(
            int id,
            [FromBody] UpdateOrderItemsRequest request,
            CancellationToken cancellationToken) {
            try {
                var order = await _orderService.UpdateOrderItemsAsync(id, request, cancellationToken);
                if (order is null) {
                    return NotFound("Order not found.");
                }

                return Ok(order);
            }
            catch (ArgumentException ex) {
                return BadRequest(ex.Message);
            }
            catch (InvalidOperationException ex) {
                return BadRequest(ex.Message);
            }
        }

        [HttpPatch("{id:int}/adjustments")]
        public async Task<ActionResult<OrderDetailDto>> UpdateAdjustments(
            int id,
            [FromBody] UpdateOrderAdjustmentsRequest request,
            CancellationToken cancellationToken) {
            try {
                var order = await _orderService.UpdateAdjustmentsAsync(id, request, cancellationToken);
                if (order is null) {
                    return NotFound("Order not found.");
                }

                return Ok(order);
            }
            catch (ArgumentException ex) {
                return BadRequest(ex.Message);
            }
        }

        /// <summary>
        /// Xác nhận đã nhận tiền (VietQR, chuyển khoản, POS chờ thanh toán...).
        /// </summary>
        [HttpPatch("{id:int}/confirm-payment")]
        public async Task<ActionResult<OrderConfirmationResponse>> ConfirmPayment(
            int id,
            [FromBody] ConfirmPaymentRequest? request,
            CancellationToken cancellationToken) {
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
                }, cancellationToken);

                return Ok(ToConfirmationResponse(result));
            }
            catch (ArgumentException ex) {
                return NotFound(ex.Message);
            }
            catch (InvalidOperationException ex) {
                return BadRequest(ex.Message);
            }
        }

        /// <summary>
        /// Xác nhận COD đã giao và đã thu tiền (hoàn tất đơn).
        /// </summary>
        [HttpPatch("{id:int}/confirm-cod")]
        public async Task<ActionResult<OrderConfirmationResponse>> ConfirmCodCompleted(
            int id,
            CancellationToken cancellationToken) {
            var employeeId = User.GetEmployeeId();
            if (employeeId is null) {
                return Unauthorized("Employee ID not found in token.");
            }

            try {
                var result = await _orderConfirmationService.ConfirmCodCompletedAsync(
                    id,
                    employeeId.Value,
                    cancellationToken);

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
            InvoiceCode = result.InvoiceCode,
        };
    }
}
