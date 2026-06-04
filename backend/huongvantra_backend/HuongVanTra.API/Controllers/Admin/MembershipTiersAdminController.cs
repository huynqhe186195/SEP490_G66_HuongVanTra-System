using HuongVanTra.Core.Authorization;
using HuongVanTra.Service.Admin;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HuongVanTra.API.Controllers.Admin {
    [Authorize(Policy = AppPolicies.AdminOnly)]
    [ApiController]
    [Route("api/admin/membership-tiers")]
    public class MembershipTiersAdminController : ControllerBase {
        private readonly IMembershipTierAdminService _service;

        public MembershipTiersAdminController(IMembershipTierAdminService service) {
            _service = service;
        }

        [HttpGet]
        public async Task<ActionResult<IReadOnlyList<MembershipTierAdminItemDto>>> List(
            CancellationToken cancellationToken) {
            var items = await _service.ListAsync(cancellationToken);
            return Ok(items);
        }

        [HttpGet("{id:int}")]
        public async Task<ActionResult<MembershipTierAdminItemDto>> Get(
            int id, CancellationToken cancellationToken) {
            var item = await _service.GetAsync(id, cancellationToken);
            return item is null ? NotFound() : Ok(item);
        }

        [HttpPost]
        public async Task<ActionResult<MembershipTierAdminItemDto>> Create(
            [FromBody] UpsertMembershipTierRequest request,
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
        public async Task<ActionResult<MembershipTierAdminItemDto>> Update(
            int id,
            [FromBody] UpsertMembershipTierRequest request,
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
        public async Task<ActionResult<MembershipTierAdminItemDto>> Deactivate(
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
        public async Task<ActionResult<MembershipTierAdminItemDto>> Reactivate(
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
