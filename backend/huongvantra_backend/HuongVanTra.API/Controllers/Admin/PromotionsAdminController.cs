using HuongVanTra.Core.Authorization;
using HuongVanTra.Service.Admin;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HuongVanTra.API.Controllers.Admin {
    [Authorize(Policy = AppPolicies.AdminOnly)]
    [ApiController]
    [Route("api/admin/promotions")]
    public class PromotionsAdminController : ControllerBase {
        private readonly IPromotionAdminService _service;

        public PromotionsAdminController(IPromotionAdminService service) {
            _service = service;
        }

        [HttpGet]
        public async Task<ActionResult<IReadOnlyList<PromotionAdminItemDto>>> List(
            CancellationToken cancellationToken) {
            var items = await _service.ListAsync(cancellationToken);
            return Ok(items);
        }

        [HttpGet("{id:int}")]
        public async Task<ActionResult<PromotionAdminItemDto>> Get(
            int id, CancellationToken cancellationToken) {
            var item = await _service.GetAsync(id, cancellationToken);
            return item is null ? NotFound() : Ok(item);
        }

        [HttpPost]
        public async Task<ActionResult<PromotionAdminItemDto>> Create(
            [FromBody] UpsertPromotionRequest request,
            CancellationToken cancellationToken) {
            try {
                var created = await _service.CreateAsync(request, cancellationToken);
                return CreatedAtAction(nameof(Get), new { id = created.Id }, created);
            }
            catch (ArgumentException ex) {
                return BadRequest(new { message = ex.Message });
            }
            catch (InvalidOperationException ex) {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpPut("{id:int}")]
        public async Task<ActionResult<PromotionAdminItemDto>> Update(
            int id,
            [FromBody] UpsertPromotionRequest request,
            CancellationToken cancellationToken) {
            try {
                var updated = await _service.UpdateAsync(id, request, cancellationToken);
                return updated is null ? NotFound() : Ok(updated);
            }
            catch (ArgumentException ex) {
                return BadRequest(new { message = ex.Message });
            }
            catch (InvalidOperationException ex) {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpDelete("{id:int}")]
        public async Task<ActionResult<PromotionAdminItemDto>> Deactivate(
            int id, CancellationToken cancellationToken) {
            try {
                var item = await _service.DeactivateAsync(id, cancellationToken);
                return Ok(item);
            }
            catch (ArgumentException ex) {
                return NotFound(new { message = ex.Message });
            }
        }

        [HttpPost("{id:int}/reactivate")]
        public async Task<ActionResult<PromotionAdminItemDto>> Reactivate(
            int id, CancellationToken cancellationToken) {
            try {
                var item = await _service.ReactivateAsync(id, cancellationToken);
                return Ok(item);
            }
            catch (ArgumentException ex) {
                return NotFound(new { message = ex.Message });
            }
            catch (InvalidOperationException ex) {
                return BadRequest(new { message = ex.Message });
            }
        }
    }
}
