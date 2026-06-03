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
        private readonly IOrderAccessResolver _orderAccessResolver;

        public OrdersController(
            IOrderService orderService,
            IOrderConfirmationService orderConfirmationService,
            IOrderAccessResolver orderAccessResolver) {
            _orderService = orderService;
            _orderConfirmationService = orderConfirmationService;
            _orderAccessResolver = orderAccessResolver;
        }

        [HttpGet]
        public async Task<ActionResult<PagedResult<OrderListItemDto>>> GetOrders(
            [FromQuery] string? search,
            [FromQuery] string? orderStatus,
            [FromQuery] string? paymentStatus,
            [FromQuery] string? paymentMethod,
            [FromQuery] int? cashierId,
            [FromQuery] DateTime? fromDate,
            [FromQuery] DateTime? toDate,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 20,
            CancellationToken cancellationToken = default) {
            var access = await ResolveOrderAccessAsync(cancellationToken);

            var result = await _orderService.GetOrdersAsync(new OrderQuery {
                Search = search,
                OrderStatus = orderStatus,
                PaymentStatus = paymentStatus,
                PaymentMethod = paymentMethod,
                CashierId = cashierId,
                FromDate = fromDate,
                ToDate = toDate,
                Page = page,
                PageSize = pageSize,
                Access = access,
            }, cancellationToken);

            return Ok(result);
        }

        [HttpGet("creators")]
        public async Task<ActionResult<List<OrderCreatorOptionDto>>> GetOrderCreators(
            CancellationToken cancellationToken) {
            var access = await ResolveOrderAccessAsync(cancellationToken);
            var creators = await _orderService.GetOrderCreatorsAsync(access, cancellationToken);
            return Ok(creators);
        }

        [HttpGet("access")]
        public async Task<ActionResult<object>> GetOrderAccessInfo(CancellationToken cancellationToken) {
            var access = await ResolveOrderAccessAsync(cancellationToken);
            return Ok(new {
                mode = access.Mode.ToString(),
                canEdit = access.CanEdit,
                storeId = access.StoreId,
                employeeId = access.EmployeeId,
            });
        }

        [HttpGet("{idOrCode}")]
        public async Task<ActionResult<OrderDetailDto>> GetOrder(string idOrCode, CancellationToken cancellationToken) {
            var access = await ResolveOrderAccessAsync(cancellationToken);
            var order = await _orderService.GetOrderAsync(idOrCode, access, cancellationToken);
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
            var access = await ResolveOrderAccessAsync(cancellationToken);

            try {
                var order = await _orderService.UpdateOrderStatusAsync(id, request, access, cancellationToken);
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

        [HttpPost("{id:int}/coupon")]
        public async Task<ActionResult<OrderDetailDto>> ApplyCoupon(
            int id,
            [FromBody] ApplyCouponRequest request,
            CancellationToken cancellationToken) {
            var access = await ResolveOrderAccessAsync(cancellationToken);

            try {
                var order = await _orderService.ApplyCouponAsync(id, request, access, cancellationToken);
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

        [HttpPost("{id:int}/gift-items")]
        public async Task<ActionResult<OrderDetailDto>> AddGiftItem(
            int id,
            [FromBody] AddGiftItemRequest request,
            CancellationToken cancellationToken) {
            var access = await ResolveOrderAccessAsync(cancellationToken);

            try {
                var order = await _orderService.AddGiftItemAsync(id, request, access, cancellationToken);
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

        [HttpGet("{id:int}/payment-qr")]
        public async Task<ActionResult<OrderPaymentQrDto>> GetPaymentQr(
            int id,
            [FromQuery] bool force = false,
            CancellationToken cancellationToken = default) {
            var access = await ResolveOrderAccessAsync(cancellationToken);

            try {
                var qr = await _orderService.GetOrderPaymentQrAsync(id, access, force, cancellationToken);
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
            var access = await ResolveOrderAccessAsync(cancellationToken);

            try {
                var order = await _orderService.UpdateOrderItemsAsync(id, request, access, cancellationToken);
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
            var access = await ResolveOrderAccessAsync(cancellationToken);

            try {
                var order = await _orderService.UpdateAdjustmentsAsync(id, request, access, cancellationToken);
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

        [HttpPatch("{id:int}/confirm-payment")]
        public async Task<ActionResult<OrderConfirmationResponse>> ConfirmPayment(
            int id,
            [FromBody] ConfirmPaymentRequest? request,
            CancellationToken cancellationToken) {
            var access = await ResolveOrderAccessAsync(cancellationToken);

            try {
                access.EnsureCanEdit();
            }
            catch (InvalidOperationException ex) {
                return BadRequest(ex.Message);
            }

            var existing = await _orderService.GetOrderAsync(id.ToString(), access, cancellationToken);
            if (existing is null) {
                return NotFound("Order not found.");
            }

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

        [Authorize(Policy = AppPolicies.ManageCodOps)]
        [HttpPatch("{id:int}/confirm-cod")]
        public async Task<ActionResult<OrderConfirmationResponse>> ConfirmCodCompleted(
            int id,
            CancellationToken cancellationToken) {
            var access = await ResolveOrderAccessAsync(cancellationToken);

            var existing = await _orderService.GetOrderAsync(id.ToString(), access, cancellationToken);
            if (existing is null) {
                return NotFound("Order not found.");
            }

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

        private Task<OrderAccessScope> ResolveOrderAccessAsync(CancellationToken cancellationToken) {
            return _orderAccessResolver.ResolveAsync(
                User.GetRoles(),
                User.GetEmployeeId(),
                cancellationToken);
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
