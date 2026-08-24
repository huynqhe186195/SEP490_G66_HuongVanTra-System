using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace UserService.Infrastructure.Data;

public class UserDbContextFactory : IDesignTimeDbContextFactory<UserDbContext>
{
    public UserDbContext CreateDbContext(string[] args)
    {
        // SEC-01: khong hardcode mat khau DB. Dat USER_DB_CONNECTION truoc khi chay dotnet ef.
        var connectionString = Environment.GetEnvironmentVariable("USER_DB_CONNECTION")
            ?? throw new InvalidOperationException(
                "Chua dat bien moi truong USER_DB_CONNECTION. Vi du (PowerShell): " +
                "$env:USER_DB_CONNECTION = 'Server=localhost;Port=3306;Database=hvt_user_db;User=root;Password=<mat_khau>;'");

        var optionsBuilder = new DbContextOptionsBuilder<UserDbContext>();
        optionsBuilder.UseMySql(connectionString, new MySqlServerVersion(new Version(8, 0, 0)));

        return new UserDbContext(optionsBuilder.Options);
    }
}
