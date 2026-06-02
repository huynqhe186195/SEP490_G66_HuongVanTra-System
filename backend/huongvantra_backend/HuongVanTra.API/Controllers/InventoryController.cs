using HuongVanTra.Service.DTOs.Inventory;
using HuongVanTra.Service.Interfaces;
using Microsoft.AspNetCore.Mvc;
using System.Threading.Tasks;
using System;

namespace HuongVanTra.API.Controllers {
    [Route("api/[controller]")]
    [ApiController]
    public class InventoryController : ControllerBase {
        private readonly IInventoryService _inventoryService;

        public InventoryController(IInventoryService inventoryService) {
            _inventoryService = inventoryService;
        }

        // post: create goods receipt (import)
        [HttpPost("receipt")]
        public async Task<IActionResult> CreateGoodsReceipt([FromBody] CreateReceiptDto dto) {
            try {
                var voucherCode = await _inventoryService.CreateGoodsReceiptAsync(dto);
                return Ok(new { message = "Nhập kho thành công!", voucherCode = voucherCode });
            }
            catch (Exception ex) {
                return BadRequest(new { message = ex.Message });
            }
        }

        // post: create goods issue (export)
        [HttpPost("issue")]
        public async Task<IActionResult> CreateGoodsIssue([FromBody] CreateIssueDto dto) {
            try {
                var voucherCode = await _inventoryService.CreateGoodsIssueAsync(dto);
                return Ok(new { message = "Xuất kho thành công!", voucherCode = voucherCode });
            }
            catch (Exception ex) {
                return BadRequest(new { message = ex.Message });
            }
        }

        // get: get current stock by warehouseId
        [HttpGet("stock/{warehouseId}")]
        public async Task<IActionResult> GetCurrentStock(int warehouseId) {
            try {
                var data = await _inventoryService.GetCurrentStockAsync(warehouseId);
                return Ok(data);
            }
            catch (Exception ex) {
                return BadRequest(new { message = ex.Message });
            }
        }

        // get: get inventory transactions history by warehouseId
        [HttpGet("transactions/{warehouseId}")]
        public async Task<IActionResult> GetTransactions(int warehouseId) {
            try {
                var data = await _inventoryService.GetInventoryTransactionsAsync(warehouseId);
                return Ok(data);
            }
            catch (Exception ex) {
                return BadRequest(new { message = ex.Message });
            }
        }
    }
}