namespace UserService.Domain.Entities;

public class User : BaseEntity
{
    public Guid Id { get; set; }
    public string Username { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public DateTime? LastLoginAt { get; set; }
    /// <summary>Tăng mỗi lần đăng nhập mới — dùng để invalidate phiên client cũ.</summary>
    public int SessionVersion { get; set; }

    public Employee? Employee { get; set; }
    public ICollection<UserRole> UserRoles { get; set; } = new List<UserRole>();
}
