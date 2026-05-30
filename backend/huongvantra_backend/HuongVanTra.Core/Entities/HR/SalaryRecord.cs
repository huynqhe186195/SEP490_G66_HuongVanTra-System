using HuongVanTra.Core.Entities.Identity;

namespace HuongVanTra.Core.Entities.HR {
    public class SalaryRecord {
        public int Id { get; set; }
        public int EmployeeId { get; set; }
        public byte PeriodMonth { get; set; }
        public decimal NetSalary { get; set; }
        public string PaymentStatus { get; set; } = "UNPAID";

        public Employee Employee { get; set; } = null!;
    }
}