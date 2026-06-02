using HuongVanTra.API.Extensions;
using HuongVanTra.API.Models.Sales;
using HuongVanTra.Service.Sales;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HuongVanTra.API.Controllers {
    [Authorize]
    [ApiController]
    [Route("api/stock-deduct-queue")]
    public class StockDeductQueueController : ControllerBase {
        private readonly IStockDeductQueueService _stockDeductQueueService;

        public StockDeductQueueController(IStockDeductQueueService stockDeductQueueService) {
            _stockDeductQueueService = stockDeductQueueService;
        }

        /// <summary>
        /// Danh sách hàng chờ trừ kho (status = waiting).
        /// </summary>
        [HttpGet("waiting")]
        public async Task<ActionResult<IReadOnlyList<StockDeductQueueListItemResponse>>> GetWaiting(
            CancellationToken cancellationToken) {
            var items = await _stockDeductQueueService.GetWaitingAsync(cancellationToken);
            return Ok(items.Select(i => new StockDeductQueueListItemResponse {
                QueueId            = i.QueueId,
                OrderId            = i.OrderId,
                OrderCode          = i.OrderCode,
                QueueStatus        = i.QueueStatus,
                OrderPaymentStatus = i.OrderPaymentStatus,
                OrderStockStatus   = i.OrderStockStatus,
                TotalAmount        = i.TotalAmount,
                CreatedAt          = i.CreatedAt,
            }).ToList());
        }

        /// <summary>
        /// Xem trước khả năng trừ kho theo BOM snapshot.
        /// Chỉ đọc dữ liệu, không thay đổi tồn kho, không cập nhật queue/order.
        /// </summary>
        [HttpGet("{id:int}/preview")]
        public async Task<ActionResult<PreviewStockDeductResponse>> Preview(
            int id, CancellationToken cancellationToken) {
            try {
                var result = await _stockDeductQueueService.PreviewAsync(id, cancellationToken);
                return Ok(new PreviewStockDeductResponse {
                    QueueId          = result.QueueId,
                    OrderId          = result.OrderId,
                    OrderCode        = result.OrderCode,
                    QueueStatus      = result.QueueStatus,
                    OrderStockStatus = result.OrderStockStatus,
                    CanDeduct        = result.CanDeduct,
                    Items            = result.Items.Select(i => new PreviewStockDeductItemResponse {
                        ProductId         = i.ProductId,
                        MaterialId        = i.MaterialId,
                        MaterialName      = i.MaterialName,
                        RequiredQuantity  = i.RequiredQuantity,
                        AvailableQuantity = i.AvailableQuantity,
                        ShortageQuantity  = i.ShortageQuantity,
                        Status            = i.Status
                    }).ToList()
                });
            }
            catch (ArgumentException ex) {
                return NotFound(ex.Message);
            }
            catch (InvalidOperationException ex) {
                return BadRequest(ex.Message);
            }
        }

        /// <summary>
        /// Xác nhận trừ kho theo BOM snapshot.
        /// - Đủ hàng: trừ kho, queue = confirmed, order.stock_status = deducted.
        /// - Thiếu hàng: không trừ kho, lưu shortage, queue = insufficient, order.stock_status = waiting_stock.
        /// Confirm lần hai sẽ fail.
        /// </summary>
        [HttpPatch("{id:int}/confirm")]
        public async Task<ActionResult<ConfirmStockDeductResponse>> Confirm(int id) {
            var employeeId = User.GetEmployeeId();
            if (employeeId is null)
                return Unauthorized("Employee ID not found in token.");

            try {
                var result = await _stockDeductQueueService.ConfirmAsync(id, employeeId.Value);
                return Ok(new ConfirmStockDeductResponse {
                    QueueId          = result.QueueId,
                    OrderId          = result.OrderId,
                    OrderCode        = result.OrderCode,
                    QueueStatus      = result.QueueStatus,
                    OrderStockStatus = result.OrderStockStatus,
                    ConfirmedAt      = result.ConfirmedAt
                });
            }
            catch (InsufficientStockException ex) {
                return BadRequest(new InsufficientStockResponse {
                    Code             = "INSUFFICIENT_STOCK",
                    Message          = "Không đủ tồn kho để trừ cho đơn hàng.",
                    QueueId          = ex.Result.QueueId,
                    OrderId          = ex.Result.OrderId,
                    OrderStockStatus = ex.Result.OrderStockStatus,
                    Shortages        = ex.Result.Shortages.Select(s => new ShortageItemResponse {
                        ProductId         = s.ProductId,
                        MaterialId        = s.MaterialId,
                        RequiredQuantity  = s.RequiredQuantity,
                        AvailableQuantity = s.AvailableQuantity,
                        ShortageQuantity  = s.ShortageQuantity
                    }).ToList()
                });
            }
            catch (ArgumentException ex) {
                return NotFound(ex.Message);
            }
            catch (InvalidOperationException ex) {
                return BadRequest(ex.Message);
            }
        }

        /// <summary>
        /// Hủy queue trừ kho.
        /// Chỉ hủy được queue chưa confirmed.
        /// Nếu queue đã confirmed thì fail — kho đã trừ thật, cần flow hoàn kho riêng.
        /// </summary>
        [HttpPatch("{id:int}/cancel")]
        public async Task<ActionResult<CancelStockDeductQueueResponse>> Cancel(
            int id, [FromBody] CancelStockDeductQueueRequest? request) {
            var employeeId = User.GetEmployeeId();
            if (employeeId is null)
                return Unauthorized("Employee ID not found in token.");

            try {
                var result = await _stockDeductQueueService.CancelAsync(
                    id, employeeId.Value, request?.Reason);
                return Ok(new CancelStockDeductQueueResponse {
                    QueueId          = result.QueueId,
                    OrderId          = result.OrderId,
                    OrderCode        = result.OrderCode,
                    QueueStatus      = result.QueueStatus,
                    OrderStockStatus = result.OrderStockStatus,
                    CancelledAt      = result.CancelledAt
                });
            }
            catch (ArgumentException ex) {
                return NotFound(ex.Message);
            }
            catch (InvalidOperationException ex) {
                return BadRequest(ex.Message);
            }
        }
    }
}
