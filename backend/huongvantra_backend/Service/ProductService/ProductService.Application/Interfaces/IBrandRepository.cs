using ProductService.Domain.Entities;

namespace ProductService.Application.Interfaces;

public interface IBrandRepository
{
    Task<List<Brand>> GetAllAsync(bool? isDeleted = null);
    Task<Brand?> GetByIdAsync(int id, bool includeDeleted = false);
    Task<bool> ExistsNameAsync(string name, int? excludeId = null, bool includeDeleted = true);
    Task<Brand> CreateAsync(Brand brand);
    Task<Brand> UpdateAsync(Brand brand);
    Task DeleteAsync(Brand brand);
    Task RestoreAsync(Brand brand);
}
