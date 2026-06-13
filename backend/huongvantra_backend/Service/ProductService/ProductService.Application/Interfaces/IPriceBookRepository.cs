using ProductService.Application;
using ProductService.Domain.Entities;

namespace ProductService.Application.Interfaces;

public interface IPriceBookRepository
{
    Task<(List<PriceBook> Items, int TotalCount)> GetPagedAsync(string? search, bool? isActive, int page, int pageSize);
    Task<PriceBook?> GetByIdAsync(Guid id, bool includeDeleted = false);
    Task<bool> ExistsCodeAsync(string code, Guid? excludeId = null);
    Task<PriceBook> CreateAsync(PriceBook priceBook);
    Task<PriceBook> UpdateAsync(PriceBook priceBook);
    Task DeleteAsync(PriceBook priceBook);
}
