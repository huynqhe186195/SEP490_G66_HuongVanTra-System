using HuongVanTra.Core.Entities.Identity;
using HuongVanTra.Core.Entities.Customers;
using HuongVanTra.Core.Entities.HR;
using System.Collections.Generic;

namespace HuongVanTra.Core.Entities.Identity {
    public class Employee {
        public int Id { get; set; }
        public string EmployeeCode { get; set; } = null!;
        public string FullName { get; set; } = null!;
        public int DepartmentId { get; set; }
        public int StoreId { get; set; }
        public string Status { get; set; } = "ACTIVE";

        public User? User { get; set; }
        public ICollection<EmployeeRole> EmployeeRoles { get; set; } = new List<EmployeeRole>();

        public ICollection<Customer> AssignedCustomers { get; set; } = new List<Customer>();

        public Department? Department { get; set; }
        public ICollection<SalaryRecord> SalaryRecords { get; set; } = new List<SalaryRecord>();
    }
}