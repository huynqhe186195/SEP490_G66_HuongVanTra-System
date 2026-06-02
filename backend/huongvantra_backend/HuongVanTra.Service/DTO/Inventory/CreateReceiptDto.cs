using System.Collections.Generic;

namespace HuongVanTra.Service.DTOs.Inventory {
    public class CreateReceiptDto {
        public int WarehouseId { get; set; }
        public int CreatedById { get; set; }
        public List<ReceiptItemDto> Items { get; set; } = new List<ReceiptItemDto>();
    }
}