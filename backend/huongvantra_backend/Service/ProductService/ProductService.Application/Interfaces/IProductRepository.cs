using ProductService.Domain.Entities;

namespace ProductService.Application.Interfaces;

public interface IProductRepository
{
    Task<(List<Product> Items, int TotalCount)> GetPagedAsync(
        string? search, int? categoryId, bool? isActive,
        int page, int pageSize);
    Task<List<Product>> GetAllAsync(bool includeInactive = false);
    Task<Product?> GetByIdAsync(Guid id);
    Task<Product> CreateAsync(Product product);
    Task<Product> UpdateAsync(Product product);
    Task DeleteAsync(Product product);
}
