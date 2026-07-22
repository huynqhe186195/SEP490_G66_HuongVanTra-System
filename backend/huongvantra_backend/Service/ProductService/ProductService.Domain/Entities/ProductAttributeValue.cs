namespace ProductService.Domain.Entities;

public class ProductAttributeValue : BaseEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ProductId { get; set; }
    public int? AttributeNameId { get; set; }
    public string AttributeName { get; set; } = string.Empty;
    public string Value { get; set; } = string.Empty;

    public Product Product { get; set; } = null!;
    public AttributeName? AttributeNameRef { get; set; }
}
