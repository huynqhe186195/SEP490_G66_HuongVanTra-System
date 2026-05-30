using HuongVanTra.Core.Entities.Stores;
using HuongVanTra.Core.Entities.Identity;

namespace HuongVanTra.Core.Entities.Documents {
    public class Document {
        public int Id { get; set; }
        public string DocCode { get; set; } = null!;
        public int StoreId { get; set; }
        public string Status { get; set; } = "DRAFT";
        public int CreatedById { get; set; }
        public int? ReviewedById { get; set; }
        public short Version { get; set; } = 1;

        public Store Store { get; set; } = null!;
        public Employee CreatedBy { get; set; } = null!;
        public Employee? ReviewedBy { get; set; }
    }
}