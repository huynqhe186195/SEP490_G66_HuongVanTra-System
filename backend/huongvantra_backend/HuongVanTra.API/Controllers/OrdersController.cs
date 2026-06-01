using HuongVanTra.Core.Authorization;
using HuongVanTra.Service.Orders;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HuongVanTra.API.Controllers {
    [Authorize(Policy = AppPolicies.ManageOrders)]
    [Route("api/[controller]")]
    public class OrdersController : ApiControllerBase {
        private readonly IOrderService _orderService;

        public OrdersController(IOrderService orderService) {
            _orderService = orderService;
        }

        [HttpGet]
        public async Task<ActionResult<PagedResult<OrderListItemDto>>> GetOrders(
            [FromQuery] string? search,
            [FromQuery] string? orderStatus,
            [FromQuery] string? paymentStatus,
            [FromQuery] DateTime? fromDate,
            [FromQuery] DateTime? toDate,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 20,
            CancellationToken cancellationToken = default) {
            var result = await _orderService.GetOrdersAsync(new OrderQuery {
                Search = search,
                OrderStatus = orderStatus,
                PaymentStatus = paymentStatus,
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
    }
}
