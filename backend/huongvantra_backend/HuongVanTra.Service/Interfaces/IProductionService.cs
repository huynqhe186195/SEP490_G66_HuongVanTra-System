using HuongVanTra.Service.DTOs.Production;

namespace HuongVanTra.Service.Interfaces {
    public interface IProductionService {
        Task<int> CreateBomAsync(CreateBomDto dto);
    }
}