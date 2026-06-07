using ProductService.Application.DTOs.Requests;
using ProductService.Domain.Entities;

namespace ProductService.Application.Interfaces;

public interface ICategoryRepository
{
    Task<List<Category>> GetAllAsync();
    Task<Category?> GetByIdAsync(int id);
    Task<bool> ExistsNameAsync(string name, int? excludeId = null);
    Task<Category> CreateAsync(Category category);
    Task<Category> UpdateAsync(Category category);
    Task DeleteAsync(Category category);
}
