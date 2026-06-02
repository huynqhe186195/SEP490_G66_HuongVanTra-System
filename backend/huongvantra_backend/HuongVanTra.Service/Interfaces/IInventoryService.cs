using HuongVanTra.Service.DTOs.Inventory;

namespace HuongVanTra.Service.Interfaces {
    public interface IInventoryService {
        Task<string> CreateGoodsReceiptAsync(CreateReceiptDto dto);
        Task<string> CreateGoodsIssueAsync(CreateIssueDto dto);
        Task<List<StockResponseDto>> GetCurrentStockAsync(int warehouseId);
        Task<List<TransactionResponseDto>> GetInventoryTransactionsAsync(int warehouseId);
    }
}