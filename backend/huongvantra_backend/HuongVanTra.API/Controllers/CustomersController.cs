using HuongVanTra.API.Extensions;
using HuongVanTra.Core.Authorization;
using HuongVanTra.Service.Customers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HuongVanTra.API.Controllers {
    [Route("api/[controller]")]
    [Authorize(Policy = AppPolicies.ManageCustomers)]
    public class CustomersController : ApiControllerBase {
        private readonly ICustomerService _customerService;

        public CustomersController(ICustomerService customerService) {
            _customerService = customerService;
        }

        [HttpGet]
        public async Task<ActionResult<List<CustomerListItemResponse>>> GetCustomers(
            [FromQuery] string? keyword,
            [FromQuery] string? customerType,
            [FromQuery] string? status,
            [FromQuery] int? tierId,
            [FromQuery] int? assignedEmployeeId) {
            var accessContext = await GetAccessContextAsync();
            if (accessContext is null) {
                return Unauthorized("User not found.");
            }

            var customers = await _customerService.GetCustomersAsync(
                keyword,
                customerType,
                status,
                tierId,
                assignedEmployeeId,
                accessContext);

            return Ok(customers);
        }

        [HttpGet("{id:int}")]
        public async Task<ActionResult<CustomerDetailResponse>> GetCustomer(int id) {
            var accessContext = await GetAccessContextAsync();
            if (accessContext is null) {
                return Unauthorized("User not found.");
            }

            var result = await _customerService.GetCustomerByIdAsync(id, accessContext);
            if (result.IsSuccess && result.Customer is not null) {
                return Ok(result.Customer);
            }

            if (result.IsForbidden) {
                return Forbid();
            }

            return NotFound(result.ErrorMessage);
        }

        [HttpPost]
        public async Task<ActionResult<CustomerDetailResponse>> CreateCustomer([FromBody] CreateCustomerRequest request) {
            if (string.IsNullOrWhiteSpace(request.CustomerCode)) {
                return BadRequest("CustomerCode is required.");
            }

            if (string.IsNullOrWhiteSpace(request.FullName)) {
                return BadRequest("FullName is required.");
            }

            var accessContext = await GetAccessContextAsync();
            if (accessContext is null) {
                return Unauthorized("User not found.");
            }

            if (!accessContext.IsSalesStaff && string.IsNullOrWhiteSpace(request.CustomerType)) {
                request.CustomerType = "GENERAL";
            }

            if (accessContext.IsSalesStaff && accessContext.EmployeeId is null) {
                return Forbid();
            }

            if (!accessContext.IsSalesStaff && string.IsNullOrWhiteSpace(request.CustomerType)) {
                return BadRequest("CustomerType is required.");
            }

            var result = await _customerService.CreateCustomerAsync(request, accessContext);
            if (result.IsSuccess && result.Customer is not null) {
                return CreatedAtAction(nameof(GetCustomer), new { id = result.Customer.CustomerId }, result.Customer);
            }

            return BadRequest(result.ErrorMessage);
        }

        [HttpPut("{id:int}")]
        public async Task<ActionResult<CustomerDetailResponse>> UpdateCustomer(int id, [FromBody] UpdateCustomerRequest request) {
            if (string.IsNullOrWhiteSpace(request.FullName)) {
                return BadRequest("FullName is required.");
            }

            if (string.IsNullOrWhiteSpace(request.CustomerType)) {
                return BadRequest("CustomerType is required.");
            }

            var accessContext = await GetAccessContextAsync();
            if (accessContext is null) {
                return Unauthorized("User not found.");
            }

            var result = await _customerService.UpdateCustomerAsync(id, request, accessContext);
            if (result.IsSuccess && result.Customer is not null) {
                return Ok(result.Customer);
            }

            if (result.IsForbidden) {
                return Forbid();
            }

            if (string.Equals(result.ErrorMessage, "Customer not found.", StringComparison.Ordinal)) {
                return NotFound(result.ErrorMessage);
            }

            return BadRequest(result.ErrorMessage);
        }

        [HttpPatch("{id:int}/status")]
        public async Task<ActionResult<CustomerDetailResponse>> ChangeStatus(int id, [FromBody] ChangeCustomerStatusRequest request) {
            var accessContext = await GetAccessContextAsync();
            if (accessContext is null) {
                return Unauthorized("User not found.");
            }

            if (!CanManageCustomerStatus(accessContext)) {
                return Forbid();
            }

            if (string.IsNullOrWhiteSpace(request.Status)) {
                return BadRequest("Status is required.");
            }

            var status = request.Status.Trim().ToUpperInvariant();
            if (status is not ("ACTIVE" or "INACTIVE")) {
                return BadRequest("Status must be either ACTIVE or INACTIVE.");
            }

            request.Status = status;
            var result = await _customerService.ChangeStatusAsync(id, request);
            if (result.IsSuccess && result.Customer is not null) {
                return Ok(result.Customer);
            }

            if (string.Equals(result.ErrorMessage, "Customer not found.", StringComparison.Ordinal)) {
                return NotFound(result.ErrorMessage);
            }

            return BadRequest(result.ErrorMessage);
        }

        [HttpGet("{id:int}/purchase-history")]
        public async Task<ActionResult<CustomerPurchaseHistoryResponse>> GetPurchaseHistory(int id) {
            var accessContext = await GetAccessContextAsync();
            if (accessContext is null) {
                return Unauthorized("User not found.");
            }

            var result = await _customerService.GetPurchaseHistoryAsync(id, accessContext);
            if (result.IsSuccess && result.PurchaseHistory is not null) {
                return Ok(result.PurchaseHistory);
            }

            if (result.IsForbidden) {
                return Forbid();
            }

            return NotFound(result.ErrorMessage);
        }

        private async Task<CustomerAccessContext?> GetAccessContextAsync() {
            var currentUserId = User.GetUserId();
            if (currentUserId is null) {
                return null;
            }

            return await _customerService.GetAccessContextAsync(currentUserId.Value);
        }

        private static bool CanManageCustomerStatus(CustomerAccessContext accessContext) {
            return accessContext.IsAdmin || accessContext.IsAgencyManager;
        }
    }
}
