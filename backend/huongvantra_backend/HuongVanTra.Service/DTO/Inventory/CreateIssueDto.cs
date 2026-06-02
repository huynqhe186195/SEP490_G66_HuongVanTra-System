namespace HuongVanTra.Service.DTOs.Inventory {
    public class IssueItemDto {
        public int ProductId { get; set; }
        public decimal Quantity { get; set; }
    }

    public class CreateIssueDto {
        public int WarehouseId { get; set; }
        public int CreatedById { get; set; }
        public List<IssueItemDto> Items { get; set; } = new List<IssueItemDto>();
    }
}