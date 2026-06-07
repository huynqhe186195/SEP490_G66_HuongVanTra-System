using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace UserService.Infrastructure.Data;

public class UserDbContextFactory : IDesignTimeDbContextFactory<UserDbContext>
{
    public UserDbContext CreateDbContext(string[] args)
    {
        var optionsBuilder = new DbContextOptionsBuilder<UserDbContext>();
        optionsBuilder.UseMySql(
            "Server=localhost;Port=3306;Database=hvt_user_db;User=root;Password=root;",
            new MySqlServerVersion(new Version(8, 0, 0)));

        return new UserDbContext(optionsBuilder.Options);
    }
}
