using HuongVanTra.Service.DTOs.Production;
using HuongVanTra.Service.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace HuongVanTra.API.Controllers {
    [Route("api/[controller]")]
    [ApiController]
    public class ProductionController : ControllerBase {
        private readonly IProductionService _productionService;

        public ProductionController(IProductionService productionService) {
            _productionService = productionService;
        }

        // post: create bom formula
        [HttpPost("bom")]
        public async Task<IActionResult> CreateBom([FromBody] CreateBomDto dto) {
            try {
                var bomId = await _productionService.CreateBomAsync(dto);
                return Ok(new { message = "Tạo định mức nguyên vật liệu (BOM) thành công!", bomId = bomId });
            }
            catch (Exception ex) {
                return BadRequest(new { message = ex.Message });
            }
        }
    }
}