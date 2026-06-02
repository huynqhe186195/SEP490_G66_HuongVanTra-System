using HuongVanTra.Service.DTOs.Inventory;
using System.Threading.Tasks;

namespace HuongVanTra.Service.Interfaces {
    public interface IInventoryService {
        Task<string> CreateGoodsReceiptAsync(CreateReceiptDto dto);
        Task<string> CreateGoodsIssueAsync(CreateIssueDto dto);
        Task<List<StockResponseDto>> GetCurrentStockAsync(int warehouseId);
        Task<List<TransactionResponseDto>> GetInventoryTransactionsAsync(int warehouseId);
    }
}