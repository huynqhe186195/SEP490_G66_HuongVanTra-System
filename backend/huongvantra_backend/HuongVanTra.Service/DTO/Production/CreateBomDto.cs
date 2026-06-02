using System.Collections.Generic;

namespace HuongVanTra.Service.DTOs.Production {
    public class CreateBomLineDto {
        public int MaterialId { get; set; }
        public decimal Quantity { get; set; }
    }

    public class CreateBomDto {
        public int FinishedGoodId { get; set; }
        public decimal QuantityOutput { get; set; } = 1;
        public List<CreateBomLineDto> Lines { get; set; } = new List<CreateBomLineDto>();
    }
}