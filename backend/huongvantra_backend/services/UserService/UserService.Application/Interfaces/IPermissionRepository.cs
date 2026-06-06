namespace UserService.Application.Interfaces;

public interface IPermissionRepository
{
    Task<Domain.Entities.Permission?> GetByIdAsync(int id);
    Task<Domain.Entities.Permission?> GetByNameAsync(string name);
    Task<IEnumerable<Domain.Entities.Permission>> GetAllAsync(bool onlyDeleted = false);
    Task AddAsync(Domain.Entities.Permission permission);
    Task SaveChangesAsync();
    Task SoftDeleteAsync(int id);
    Task RestoreAsync(int id);
}
