using UserService.Application.DTOs.Requests;
using UserService.Application.DTOs.Responses;
using UserService.Application.Interfaces;
using UserService.Domain.Entities;
using UserService.Domain.Exceptions;

namespace UserService.Application.UseCases;

public class RoleLogic(IRoleRepository roleRepo)
{
    public async Task<RoleResponse> CreateAsync(CreateRoleRequest request)
    {
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
        return MapToResponse(role);
    }

    public async Task<IEnumerable<RoleResponse>> GetAllAsync()
    {
        var roles = await roleRepo.GetAllAsync();
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

        role.RoleName = request.RoleName;
        role.Description = request.Description;
        role.UpdatedAt = DateTime.UtcNow;
        role.RolePermissions = request.PermissionIds
            .Select(pid => new RolePermission { RoleId = id, PermissionId = pid })
            .ToList();

        roleRepo.Update(role);
        await roleRepo.SaveChangesAsync();
    }

    private static RoleResponse MapToResponse(Role role) => new(
        role.Id,
        role.RoleName,
        role.Description,
        role.RolePermissions.Select(rp => rp.Permission?.PermissionName ?? string.Empty).ToList());
}
