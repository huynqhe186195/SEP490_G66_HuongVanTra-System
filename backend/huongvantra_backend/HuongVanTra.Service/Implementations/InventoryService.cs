using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using HuongVanTra.Core.Entities.Inventory;
using HuongVanTra.Core.Interfaces;
using HuongVanTra.Service.DTOs.Inventory;
using HuongVanTra.Service.Interfaces;

namespace HuongVanTra.Service.Implementations {
    public class InventoryService : IInventoryService {
        private readonly IUnitOfWork _unitOfWork;

        public InventoryService(IUnitOfWork unitOfWork) {
            _unitOfWork = unitOfWork;
        }

        // post: create goods receipt (import)
        public async Task<string> CreateGoodsReceiptAsync(CreateReceiptDto dto) {
            await _unitOfWork.BeginTransactionAsync();

            try {
                var voucherCode = "GRN-" + DateTime.UtcNow.AddHours(7).ToString("yyMMddHHmmss"); // shift to UTC/GMT +7
                var voucher = new StockVoucher {
                    VoucherCode = voucherCode,
                    VoucherType = "IN",
                    WarehouseId = dto.WarehouseId,
                    CreatedById = dto.CreatedById,
                    Status = "COMPLETED"
                };

                await _unitOfWork.Repository<StockVoucher>().AddAsync(voucher);
                await _unitOfWork.SaveChangesAsync();

                var balanceRepo = _unitOfWork.Repository<InventoryBalance>();
                var transactionRepo = _unitOfWork.Repository<InventoryTransaction>();

                foreach (var item in dto.Items) {
                    var balances = await balanceRepo.FindAsync(b => b.WarehouseId == dto.WarehouseId && b.ProductId == item.ProductId);
                    var currentBalance = balances.FirstOrDefault();

                    decimal quantityBefore = 0;

                    if (currentBalance == null) {
                        currentBalance = new InventoryBalance {
                            WarehouseId = dto.WarehouseId,
                            ProductId = item.ProductId,
                            Quantity = item.Quantity
                        };
                        await balanceRepo.AddAsync(currentBalance);
                    } else {
                        quantityBefore = currentBalance.Quantity;
                        currentBalance.Quantity += item.Quantity;
                        balanceRepo.Update(currentBalance);
                    }

                    var txn = new InventoryTransaction {
                        TxnCode = $"TXN-{Guid.NewGuid().ToString().Substring(0, 8).ToUpper()}",
                        WarehouseId = dto.WarehouseId,
                        ProductId = item.ProductId,
                        TxnType = "IN_RECEIPT",
                        Quantity = item.Quantity,
                        QuantityBefore = quantityBefore,
                        QuantityAfter = currentBalance.Quantity,
                        RefType = "STOCK_VOUCHER",
                        RefId = voucher.Id,
                        CreatedById = dto.CreatedById,
                        CreatedAt = DateTime.UtcNow.AddHours(7), // shift to UTC/GMT +7
                    };
                    await transactionRepo.AddAsync(txn);
                }

                await _unitOfWork.CommitTransactionAsync();

                return voucherCode;
            }
            catch (Exception ex) {
                await _unitOfWork.RollbackTransactionAsync();
                throw new Exception($"Lỗi tạo phiếu nhập kho: {ex.Message}");
            }
        }

        // post: create goods issue (export)
        public async Task<string> CreateGoodsIssueAsync(CreateIssueDto dto) {
            await _unitOfWork.BeginTransactionAsync();

            try {
                var voucherCode = "GIN-" + DateTime.UtcNow.AddHours(7).ToString("yyMMddHHmmss"); // shift to UTC/GMT +7
                var voucher = new StockVoucher {
                    VoucherCode = voucherCode,
                    VoucherType = "OUT",
                    WarehouseId = dto.WarehouseId,
                    CreatedById = dto.CreatedById,
                    Status = "COMPLETED"
                };

                await _unitOfWork.Repository<StockVoucher>().AddAsync(voucher);
                await _unitOfWork.SaveChangesAsync();

                var balanceRepo = _unitOfWork.Repository<InventoryBalance>();
                var transactionRepo = _unitOfWork.Repository<InventoryTransaction>();

                foreach (var item in dto.Items) {
                    var balances = await balanceRepo.FindAsync(b => b.WarehouseId == dto.WarehouseId && b.ProductId == item.ProductId);
                    var currentBalance = balances.FirstOrDefault();

                    if (currentBalance == null || currentBalance.Quantity < item.Quantity) {
                        throw new Exception($"Sản phẩm ID {item.ProductId} không đủ tồn kho để xuất!");
                    }

                    decimal quantityBefore = currentBalance.Quantity;
                    currentBalance.Quantity -= item.Quantity;
                    balanceRepo.Update(currentBalance);

                    var txn = new InventoryTransaction {
                        TxnCode = $"TXN-{Guid.NewGuid().ToString().Substring(0, 8).ToUpper()}",
                        WarehouseId = dto.WarehouseId,
                        ProductId = item.ProductId,
                        TxnType = "OUT_ISSUE",
                        Quantity = item.Quantity,
                        QuantityBefore = quantityBefore,
                        QuantityAfter = currentBalance.Quantity,
                        RefType = "STOCK_VOUCHER",
                        RefId = voucher.Id,
                        CreatedById = dto.CreatedById,
                        CreatedAt = DateTime.UtcNow.AddHours(7), // shift to UTC/GMT +7
                    };
                    await transactionRepo.AddAsync(txn);
                }

                await _unitOfWork.CommitTransactionAsync();
                return voucherCode;
            }
            catch (Exception ex) {
                await _unitOfWork.RollbackTransactionAsync();
                throw new Exception($"Lỗi tạo phiếu xuất kho: {ex.Message}");
            }
        }

        // get: get current stock by warehouseId
        public async Task<List<StockResponseDto>> GetCurrentStockAsync(int warehouseId) {
            var stocks = await _unitOfWork.Repository<InventoryBalance>()
                .GetQueryable()
                .Where(b => b.WarehouseId == warehouseId)
                .Include(b => b.Product)
                .Select(b => new StockResponseDto {
                    ProductId = b.ProductId,
                    Sku = b.Product.Sku,
                    ProductName = b.Product.ProductType,
                    Quantity = b.Quantity
                })
                .ToListAsync();

            return stocks;
        }

        // get: get inventory transactions history by warehouseId
        public async Task<List<TransactionResponseDto>> GetInventoryTransactionsAsync(int warehouseId) {
            var transactions = await _unitOfWork.Repository<InventoryTransaction>()
                .GetQueryable()
                .Where(t => t.WarehouseId == warehouseId)
                .Include(t => t.Product)
                .OrderByDescending(t => t.CreatedAt) // new to old
                .Select(t => new TransactionResponseDto {
                    TxnCode = t.TxnCode,
                    TxnType = t.TxnType,
                    ProductName = t.Product.Sku,
                    QuantityBefore = t.QuantityBefore,
                    Quantity = t.Quantity,
                    QuantityAfter = t.QuantityAfter,
                    CreatedAt = t.CreatedAt
                })
                .ToListAsync();

            return transactions;
        }
    }
}