namespace HuongVanTra.Service.Employees {
    public class EmployeeUpdateResult {
        public EmployeeDetailResponse? Employee { get; set; }
        public string? ErrorMessage { get; set; }

        public bool IsSuccess => Employee is not null && string.IsNullOrWhiteSpace(ErrorMessage);

        public static EmployeeUpdateResult Success(EmployeeDetailResponse employee) {
            return new EmployeeUpdateResult { Employee = employee };
        }

        public static EmployeeUpdateResult Failure(string errorMessage) {
            return new EmployeeUpdateResult { ErrorMessage = errorMessage };
        }
    }
}
