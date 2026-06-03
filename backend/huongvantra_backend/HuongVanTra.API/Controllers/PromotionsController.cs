using HuongVanTra.Infrastructure.Data;
using HuongVanTra.Service.Orders;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HuongVanTra.API.Controllers {
    [Route("api/[controller]")]
    [ApiController]
    public class PromotionsController : ControllerBase {
        private readonly AppDbContext _db;

        public PromotionsController(AppDbContext db) {
            _db = db;
        }

        /// <summary>Tra cứu mã giảm giá (POS / quầy).</summary>
        [HttpGet("lookup")]
        public async Task<ActionResult<OrderPromotionDto>> Lookup(
            [FromQuery] string code,
            CancellationToken cancellationToken = default) {
            if (string.IsNullOrWhiteSpace(code)) {
                return BadRequest(new { message = "Vui lòng nhập mã giảm giá." });
            }

            var normalized = code.Trim().ToUpperInvariant();
            var promotion = await _db.OrderPromotions
                .AsNoTracking()
                .FirstOrDefaultAsync(p => p.PromoCode.ToUpper() == normalized, cancellationToken);

            if (promotion is null) {
                return NotFound(new { message = "Mã giảm giá không tồn tại hoặc không hợp lệ." });
            }

            return Ok(new OrderPromotionDto {
                Id = promotion.Id,
                PromoCode = promotion.PromoCode,
                DiscountType = promotion.DiscountType,
                DiscountValue = promotion.DiscountValue,
            });
        }
    }
}
