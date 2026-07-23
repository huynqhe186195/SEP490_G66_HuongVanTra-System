using Microsoft.EntityFrameworkCore;
using UserService.Application.UseCases;
using UserService.Infrastructure.Data;
using UserService.Infrastructure.Repositories;

namespace UserService.Application.Tests;

internal static class UserServiceTestContext
{
    public static UserDbContext CreateDb() =>
        new(new DbContextOptionsBuilder<UserDbContext>()
            .UseInMemoryDatabase($"user-service-tests-{Guid.NewGuid():N}")
            .Options);

    public static UserLogic CreateUserLogic(UserDbContext db) =>
        new(new UserRepository(db), new RoleRepository(db), new EmployeeRepository(db));

    public static EmployeeLogic CreateEmployeeLogic(UserDbContext db) =>
        new(new UserRepository(db), new RoleRepository(db), new EmployeeRepository(db));
}
