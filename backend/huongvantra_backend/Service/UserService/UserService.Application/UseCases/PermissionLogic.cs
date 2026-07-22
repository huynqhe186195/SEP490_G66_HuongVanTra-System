using UserService.Application.DTOs.Requests;
using UserService.Application.DTOs.Responses;
using UserService.Application.Interfaces;
using UserService.Domain.Entities;
using UserService.Domain.Exceptions;

namespace UserService.Application.UseCases;

public class PermissionLogic(IPermissionRepository permissionRepo)
{
    public async Task<PermissionResponse> CreateAsync(CreatePermissionRequest request)
    {
        if (await permissionRepo.GetByNameAsync(request.PermissionName) is not null)
            throw new DuplicatePermissionException(request.PermissionName);

        var permission = new Permission 
        { 
            PermissionCode = request.PermissionCode, 
            PermissionName = request.PermissionName 
        };
        await permissionRepo.AddAsync(permission);
        await permissionRepo.SaveChangesAsync();

        return new PermissionResponse(permission.Id, permission.PermissionCode, permission.PermissionName, permission.IsDeleted);
    }

    public async Task<IEnumerable<PermissionResponse>> GetAllAsync(bool onlyDeleted = false)
    {
        var permissions = await permissionRepo.GetAllAsync(onlyDeleted);
        return permissions.Select(p => new PermissionResponse(p.Id, p.PermissionCode, p.PermissionName, p.IsDeleted));
    }

    public async Task SoftDeleteAsync(int id)
    {
        _ = await permissionRepo.GetByIdAsync(id) ?? throw new PermissionNotFoundException(id);
        await permissionRepo.SoftDeleteAsync(id);
    }

    public async Task RestoreAsync(int id)
    {
        await permissionRepo.RestoreAsync(id);
        _ = await permissionRepo.GetByIdAsync(id) ?? throw new PermissionNotFoundException(id);
    }
}
