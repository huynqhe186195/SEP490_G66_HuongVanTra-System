using ProductService.Domain.Entities;

namespace ProductService.Application.Interfaces;

public interface IAttributeNameRepository
{
    Task<List<AttributeName>> GetAllAsync(bool? isDeleted = null);
    Task<AttributeName?> GetByIdAsync(int id, bool includeDeleted = false);
    Task<bool> ExistsNameAsync(string name, int? excludeId = null, bool includeDeleted = true);
    Task<AttributeName> CreateAsync(AttributeName attributeName);
    Task<AttributeName> UpdateAsync(AttributeName attributeName);
    Task DeleteAsync(AttributeName attributeName);
    Task RestoreAsync(AttributeName attributeName);
}
