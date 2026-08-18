using UserService.Application.Authorization;
using UserService.Application.DTOs.Requests;
using UserService.Application.DTOs.Responses;
using UserService.Application.Interfaces;
using UserService.Application.Validation;
using UserService.Domain.Entities;
using UserService.Domain.Exceptions;

namespace UserService.Application.UseCases;

public class RoleLogic(IRoleRepository roleRepo, IPermissionRepository permissionRepo)
{
    public async Task<RoleResponse> CreateAsync(CreateRoleRequest request)
    {
        var roleName = RoleInputValidator.NormalizeAndValidateName(request.RoleName);
        var permissionIds = RoleInputValidator.NormalizePermissionIds(request.PermissionIds);
        await ValidatePermissionIdsAsync(permissionIds);

        if (await roleRepo.ExistsByNameAsync(roleName))
            throw new DuplicateRoleException(roleName);

        var role = new Role
        {
            RoleName = roleName,
            Description = request.Description,
            RolePermissions = permissionIds
                .Select(pid => new RolePermission { PermissionId = pid })
                .ToList()
        };

        await roleRepo.AddAsync(role);
        await roleRepo.SaveChangesAsync();
        var created = await roleRepo.GetByIdAsync(role.Id) ?? role;
        return MapToResponse(created);
    }

    private static readonly HashSet<string> RetiredRoleNames = new(StringComparer.OrdinalIgnoreCase)
    {
        "CooperativeOwner",
    };

    public async Task<IEnumerable<RoleResponse>> GetAllAsync(bool onlyDeleted = false)
    {
        var roles = await roleRepo.GetAllAsync(onlyDeleted);
        return roles
            .Where(r => !RetiredRoleNames.Contains(r.RoleName))
            .Select(MapToResponse);
    }

    public async Task<IEnumerable<RoleResponse>> GetAssignableAsync(IReadOnlyList<string> actorPermissions)
    {
        var assignableNames = StaffManagementScope.GetAssignableRoleNames(actorPermissions).ToHashSet(StringComparer.OrdinalIgnoreCase);
        if (assignableNames.Count == 0)
            return [];

        var roles = await roleRepo.GetAllAsync();
        return roles
            .Where(r => !r.IsDeleted && assignableNames.Contains(r.RoleName))
            .Select(MapToResponse);
    }

    public async Task<RoleResponse> GetByIdAsync(int id)
    {
        var role = await roleRepo.GetByIdAsync(id) ?? throw new RoleNotFoundException(id);
        return MapToResponse(role);
    }

    public async Task UpdateAsync(int id, UpdateRoleRequest request)
    {
        var role = await roleRepo.GetByIdAsync(id) ?? throw new RoleNotFoundException(id);
        var roleName = RoleInputValidator.NormalizeAndValidateName(request.RoleName);
        var permissionIds = RoleInputValidator.NormalizePermissionIds(request.PermissionIds);
        await ValidatePermissionIdsAsync(permissionIds);

        if (await roleRepo.ExistsByNameAsync(roleName, excludeId: id))
            throw new DuplicateRoleException(roleName);

        role.RoleName = roleName;
        role.Description = request.Description;
        role.UpdatedAt = DateTime.UtcNow;
        role.RolePermissions = permissionIds
            .Select(pid => new RolePermission { RoleId = id, PermissionId = pid })
            .ToList();

        roleRepo.Update(role);
        await roleRepo.SaveChangesAsync();
    }

    public async Task DeleteAsync(int id)
    {
        var role = await roleRepo.GetByIdIncludingDeletedAsync(id)
            ?? throw new RoleNotFoundException(id);
        if (role.IsDeleted)
            throw new RoleAlreadyDeactivatedException(id);

        await roleRepo.SoftDeleteAsync(id);
    }

    public async Task RestoreAsync(int id)
    {
        var role = await roleRepo.GetByIdIncludingDeletedAsync(id)
            ?? throw new RoleNotFoundException(id);

        if (!role.IsDeleted)
            return;

        if (RetiredRoleNames.Contains(role.RoleName))
            throw new UserValidationException("Vai trò này đã ngừng dùng và không thể khôi phục.");

        await roleRepo.RestoreAsync(id);
    }

    public async Task AssignPermissionsAsync(int roleId, List<int> permissionIds)
    {
        var role = await roleRepo.GetByIdAsync(roleId) ?? throw new RoleNotFoundException(roleId);
        var normalizedIds = (permissionIds ?? []).Distinct().ToList();
        await ValidatePermissionIdsAsync(normalizedIds);

        foreach (var permissionId in normalizedIds)
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
            .Select(rp => new PermissionResponse(
                rp.Permission!.Id,
                rp.Permission.PermissionName,
                rp.Permission.AuthorizationCode,
                rp.Permission.IsDeleted));
    }

    private async Task ValidatePermissionIdsAsync(IReadOnlyList<int> permissionIds)
    {
        var missing = new List<int>();
        foreach (var permissionId in permissionIds)
        {
            if (await permissionRepo.GetByIdAsync(permissionId) is null)
                missing.Add(permissionId);
        }

        if (missing.Count > 0)
            throw new UserValidationException(RoleInputValidator.MissingPermissionsMessage(missing));
    }

    private static RoleResponse MapToResponse(Role role) => new(
        role.Id,
        role.RoleName,
        role.Description,
        role.RolePermissions
            .Where(rp => rp.Permission is not null && !rp.Permission.IsDeleted)
            .Select(rp => rp.Permission!.AuthorizationCode)
            .ToList(),
        role.IsDeleted);
}
