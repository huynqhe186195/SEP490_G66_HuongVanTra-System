using HuongVanTra.Service.DTOs.Production;
using System.Threading.Tasks;

namespace HuongVanTra.Service.Interfaces {
    public interface IProductionService {
        Task<int> CreateBomAsync(CreateBomDto dto);
    }
}