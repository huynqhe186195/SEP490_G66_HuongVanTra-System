namespace UserService.Domain.Entities;

/// <summary>
/// Cửa sổ đăng ký ca do Manager mở cho một tuần làm việc (Thứ 2 – Chủ nhật).
/// Sale chỉ tự đăng ký khi cửa sổ đang mở (trong [OpensAt, ClosesAt] và chưa đóng tay).
/// </summary>
public class ShiftRegistrationWindow : BaseEntity
{
    public Guid Id { get; set; }

    /// <summary>Thứ 2 đầu tuần làm việc mà cửa sổ này cho phép đăng ký.</summary>
    public DateOnly WeekStart { get; set; }

    public DateTime OpensAt { get; set; }
    public DateTime ClosesAt { get; set; }

    /// <summary>Manager đóng sớm trước hạn ClosesAt.</summary>
    public bool IsManuallyClosed { get; set; }

    public Guid OpenedByUserId { get; set; }
    public Guid? ClosedByUserId { get; set; }
    public DateTime? ClosedAt { get; set; }
}
