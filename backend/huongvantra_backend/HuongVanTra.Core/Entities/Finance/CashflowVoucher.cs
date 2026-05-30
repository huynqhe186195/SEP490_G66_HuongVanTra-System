using HuongVanTra.Core.Entities.Stores;
using HuongVanTra.Core.Entities.Identity;

namespace HuongVanTra.Core.Entities.Finance {
    public class CashflowVoucher {
        public int Id { get; set; }
        public int StoreId { get; set; }
        public string FlowType { get; set; } = "IN";
        public decimal Amount { get; set; }
        public int CreatedById { get; set; }

        public Store Store { get; set; } = null!;
        public Employee CreatedBy { get; set; } = null!;
    }
}