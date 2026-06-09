using ProductService.Domain.Entities;

namespace ProductService.Application.Interfaces;

public interface IProductRepository
{
    Task<(List<Product> Items, int TotalCount)> GetPagedAsync(
        string? search, int? categoryId, bool? isActive, bool? isDeleted,
        int page, int pageSize);
    Task<List<Product>> GetAllAsync(bool includeInactive = false);
    Task<Product?> GetByIdAsync(Guid id, bool includeDeleted = false);
    Task<bool> ExistsNameAsync(string name, Guid? excludeProductId = null, bool includeDeleted = true);
    Task<Product> CreateAsync(Product product);
    Task<Product> UpdateAsync(Product product);
    Task DeleteAsync(Product product);
    Task RestoreAsync(Product product);
}
