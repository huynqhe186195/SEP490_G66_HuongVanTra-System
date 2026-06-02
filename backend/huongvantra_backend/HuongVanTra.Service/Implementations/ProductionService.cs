using HuongVanTra.Core.Entities.Products;
using HuongVanTra.Core.Interfaces;
using HuongVanTra.Service.DTOs.Production;
using HuongVanTra.Service.Interfaces;

namespace HuongVanTra.Service.Implementations {
    public class ProductionService : IProductionService {
        private readonly IUnitOfWork _unitOfWork;

        public ProductionService(IUnitOfWork unitOfWork) {
            _unitOfWork = unitOfWork;
        }

        // post: create bom formula
        public async Task<int> CreateBomAsync(CreateBomDto dto) {
            await _unitOfWork.BeginTransactionAsync();

            try {
                var bomRepo = _unitOfWork.Repository<BomHeader>();

                var existingBoms = await bomRepo.FindAsync(b => b.FinishedGoodId == dto.FinishedGoodId);
                if (existingBoms.Any()) {
                    throw new Exception("Sản phẩm này đã được thiết lập công thức (BOM).");
                }

                var bomHeader = new BomHeader {
                    FinishedGoodId = dto.FinishedGoodId,
                    QuantityOutput = dto.QuantityOutput
                };

                await bomRepo.AddAsync(bomHeader);
                await _unitOfWork.SaveChangesAsync();

                var bomLineRepo = _unitOfWork.Repository<BomLine>();
                foreach (var line in dto.Lines) {
                    var bomLine = new BomLine {
                        BomId = bomHeader.Id,
                        MaterialId = line.MaterialId,
                        Quantity = line.Quantity
                    };
                    await bomLineRepo.AddAsync(bomLine);
                }

                await _unitOfWork.CommitTransactionAsync();
                return bomHeader.Id;
            }
            catch (Exception ex) {
                await _unitOfWork.RollbackTransactionAsync();
                throw new Exception($"Lỗi tạo cấu trúc BOM: {ex.Message}");
            }
        }
    }
}