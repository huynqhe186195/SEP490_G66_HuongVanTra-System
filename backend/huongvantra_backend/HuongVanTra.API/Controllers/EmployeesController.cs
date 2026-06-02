using HuongVanTra.Core.Authorization;
using HuongVanTra.Service.Employees;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HuongVanTra.API.Controllers {
    [Route("api/[controller]")]
    [Authorize(Policy = AppPolicies.ManageStaff)]
    public class EmployeesController : ApiControllerBase {
        private readonly IEmployeeService _employeeService;

        public EmployeesController(IEmployeeService employeeService) {
            _employeeService = employeeService;
        }

        [HttpGet]
        public async Task<ActionResult<List<EmployeeListItemResponse>>> GetEmployees(
            [FromQuery] string? keyword,
            [FromQuery] string? status,
            [FromQuery] int? storeId,
            [FromQuery] int? departmentId) {
            var employees = await _employeeService.GetEmployeesAsync(keyword, status, storeId, departmentId);
            return Ok(employees);
        }

        [HttpGet("{id:int}")]
        public async Task<ActionResult<EmployeeDetailResponse>> GetEmployee(int id) {
            var employee = await _employeeService.GetEmployeeByIdAsync(id);
            if (employee is null) {
                return NotFound("Employee not found.");
            }

            return Ok(employee);
        }

        [HttpPut("{id:int}")]
        public async Task<ActionResult<EmployeeDetailResponse>> UpdateEmployee(int id, [FromBody] UpdateEmployeeRequest request) {
            if (string.IsNullOrWhiteSpace(request.FullName)) {
                return BadRequest("FullName is required.");
            }

            if (string.IsNullOrWhiteSpace(request.Status)) {
                return BadRequest("Status is required.");
            }

            var result = await _employeeService.UpdateEmployeeAsync(id, request);
            if (result.IsSuccess && result.Employee is not null) {
                return Ok(result.Employee);
            }

            if (string.Equals(result.ErrorMessage, "Employee not found.", StringComparison.Ordinal)) {
                return NotFound(result.ErrorMessage);
            }

            return BadRequest(result.ErrorMessage);
        }
    }
}
