using UserService.Application.DTOs.Requests;
using UserService.Application.DTOs.Responses;
using UserService.Application.Interfaces;
using UserService.Domain.Entities;
using UserService.Domain.Exceptions;

namespace UserService.Application.UseCases;

public class RoleLogic(IRoleRepository roleRepo, IPermissionRepository permissionRepo)
{
    public async Task<RoleResponse> CreateAsync(CreateRoleRequest request)
    {
        await ValidatePermissionIdsAsync(request.PermissionIds);

        var role = new Role
        {
            RoleName = request.RoleName,
            Description = request.Description,
            RolePermissions = request.PermissionIds
                .Select(pid => new RolePermission { PermissionId = pid })
                .ToList()
        };

        await roleRepo.AddAsync(role);
        await roleRepo.SaveChangesAsync();
        var created = await roleRepo.GetByIdAsync(role.Id) ?? role;
        return MapToResponse(created);
    }

    public async Task<IEnumerable<RoleResponse>> GetAllAsync(bool onlyDeleted = false)
    {
        var roles = await roleRepo.GetAllAsync(onlyDeleted);
        return roles.Select(MapToResponse);
    }

    public async Task<RoleResponse> GetByIdAsync(int id)
    {
        var role = await roleRepo.GetByIdAsync(id) ?? throw new RoleNotFoundException(id);
        return MapToResponse(role);
    }

    public async Task UpdateAsync(int id, UpdateRoleRequest request)
    {
        var role = await roleRepo.GetByIdAsync(id) ?? throw new RoleNotFoundException(id);
        await ValidatePermissionIdsAsync(request.PermissionIds);

        role.RoleName = request.RoleName;
        role.Description = request.Description;
        role.UpdatedAt = DateTime.UtcNow;
        role.RolePermissions = request.PermissionIds
            .Select(pid => new RolePermission { RoleId = id, PermissionId = pid })
            .ToList();

        roleRepo.Update(role);
        await roleRepo.SaveChangesAsync();
    }

    public async Task DeleteAsync(int id)
    {
        _ = await roleRepo.GetByIdAsync(id) ?? throw new RoleNotFoundException(id);
        await roleRepo.SoftDeleteAsync(id);
    }

    public async Task RestoreAsync(int id)
    {
        await roleRepo.RestoreAsync(id);
        _ = await roleRepo.GetByIdAsync(id) ?? throw new RoleNotFoundException(id);
    }

    public async Task AssignPermissionsAsync(int roleId, List<int> permissionIds)
    {
        var role = await roleRepo.GetByIdAsync(roleId) ?? throw new RoleNotFoundException(roleId);
        await ValidatePermissionIdsAsync(permissionIds);

        foreach (var permissionId in permissionIds)
        {
            if (role.RolePermissions.Any(rp => rp.PermissionId == permissionId)) continue;
            role.RolePermissions.Add(new RolePermission { RoleId = roleId, PermissionId = permissionId });
        }

        role.UpdatedAt = DateTime.UtcNow;
        roleRepo.Update(role);
        await roleRepo.SaveChangesAsync();
    }

    public async Task RevokePermissionAsync(int roleId, int permissionId)
    {
        var role = await roleRepo.GetByIdAsync(roleId) ?? throw new RoleNotFoundException(roleId);
        var rolePermission = role.RolePermissions.FirstOrDefault(rp => rp.PermissionId == permissionId)
            ?? throw new PermissionNotFoundException(permissionId);

        role.RolePermissions.Remove(rolePermission);
        role.UpdatedAt = DateTime.UtcNow;
        roleRepo.Update(role);
        await roleRepo.SaveChangesAsync();
    }

    public async Task<IEnumerable<PermissionResponse>> GetPermissionsAsync(int roleId)
    {
        var role = await roleRepo.GetByIdAsync(roleId) ?? throw new RoleNotFoundException(roleId);
        return role.RolePermissions
            .Where(rp => rp.Permission is not null)
            .Select(rp => new PermissionResponse(rp.Permission!.Id, rp.Permission.PermissionName, rp.Permission.IsDeleted));
    }

    private async Task ValidatePermissionIdsAsync(IEnumerable<int> permissionIds)
    {
        foreach (var permissionId in permissionIds)
        {
            _ = await permissionRepo.GetByIdAsync(permissionId)
                ?? throw new PermissionNotFoundException(permissionId);
        }
    }

    private static RoleResponse MapToResponse(Role role) => new(
        role.Id,
        role.RoleName,
        role.Description,
        role.RolePermissions
            .Where(rp => rp.Permission is not null && !rp.Permission.IsDeleted)
            .Select(rp => rp.Permission!.PermissionName)
            .ToList(),
        role.IsDeleted);
}
