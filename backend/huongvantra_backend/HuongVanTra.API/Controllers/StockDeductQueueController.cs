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
                QueueId = i.QueueId,
                OrderId = i.OrderId,
                OrderCode = i.OrderCode,
                QueueStatus = i.QueueStatus,
                OrderPaymentStatus = i.OrderPaymentStatus,
                OrderStockStatus = i.OrderStockStatus,
                TotalAmount = i.TotalAmount,
                CreatedAt = i.CreatedAt,
            }).ToList());
        }

        /// <summary>
        /// Xác nhận trừ kho cho một online order.
        /// Chỉ confirm được queue có status = "waiting".
        /// Trừ kho theo bom_snapshot tại thời điểm bán, không dùng BOM hiện tại.
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
            catch (ArgumentException ex) {
                return NotFound(ex.Message);
            }
            catch (InvalidOperationException ex) {
                return BadRequest(ex.Message);
            }
        }
    }
}
