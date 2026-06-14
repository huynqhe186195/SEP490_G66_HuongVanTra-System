namespace ProductService.Domain.Entities;

public class Brand : BaseEntity
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;

}
