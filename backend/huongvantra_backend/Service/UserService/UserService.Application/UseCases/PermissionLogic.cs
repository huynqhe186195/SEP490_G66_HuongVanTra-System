using UserService.Application.DTOs.Requests;
using UserService.Application.DTOs.Responses;
using UserService.Application.Interfaces;
using UserService.Application.Validation;
using UserService.Domain.Entities;
using UserService.Domain.Exceptions;

namespace UserService.Application.UseCases;

public class PermissionLogic(IPermissionRepository permissionRepo)
{
    public async Task<PermissionResponse> CreateAsync(CreatePermissionRequest request)
    {
        var (name, code) = PermissionInputValidator.NormalizeAndValidate(
            request.PermissionName,
            request.PermissionCode);

        if (await permissionRepo.ExistsByCodeAsync(code))
            throw new DuplicatePermissionException(code);

        if (await permissionRepo.GetByNameAsync(name) is not null)
            throw new UserValidationException($"Tên quyền '{name}' đã tồn tại.");

        var permission = new Permission
        {
            PermissionName = name,
            PermissionCode = code,
        };
        await permissionRepo.AddAsync(permission);
        await permissionRepo.SaveChangesAsync();

        return Map(permission);
    }

    public async Task<IEnumerable<PermissionResponse>> GetAllAsync(bool onlyDeleted = false)
    {
        var permissions = await permissionRepo.GetAllAsync(onlyDeleted);
        return permissions.Select(Map);
    }

    public async Task SoftDeleteAsync(int id)
    {
        var permission = await permissionRepo.GetByIdIncludingDeletedAsync(id)
            ?? throw new PermissionNotFoundException(id);
        if (permission.IsDeleted)
            throw new PermissionAlreadyDeactivatedException(id);

        await permissionRepo.SoftDeleteAsync(id);
    }

    public async Task RestoreAsync(int id)
    {
        _ = await permissionRepo.GetByIdIncludingDeletedAsync(id)
            ?? throw new PermissionNotFoundException(id);
        await permissionRepo.RestoreAsync(id);
        _ = await permissionRepo.GetByIdAsync(id) ?? throw new PermissionNotFoundException(id);
    }

    private static PermissionResponse Map(Permission permission) =>
        new(permission.Id, permission.PermissionName, permission.AuthorizationCode, permission.IsDeleted);
}
