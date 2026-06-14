namespace ProductService.Domain.Exceptions;

public class ProductNotFoundException(Guid id)
    : Exception($"Product with id '{id}' was not found.");

public class ProductSkuNotFoundException(Guid id)
    : Exception($"ProductSKU with id '{id}' was not found.");

public class ProductSkuNotFoundByCodeException(string skuCode)
    : Exception($"ProductSKU with code '{skuCode}' was not found.");

public class CategoryNotFoundException(int id)
    : Exception($"Category with id '{id}' was not found.");

public class BrandNotFoundException(int id)
    : Exception($"Brand with id '{id}' was not found.");

public class AttributeNameNotFoundException(int id)
    : Exception($"AttributeName with id '{id}' was not found.");

public class DuplicateSkuCodeException(string skuCode)
    : Exception($"SKU code '{skuCode}' already exists.");

public class ProductValidationException : Exception
{
    public ProductValidationException(IEnumerable<string> errors)
        : base("One or more validation errors occurred.")
    {
        Errors = errors.ToArray();
    }

    public ProductValidationException(string error)
        : base("One or more validation errors occurred.")
    {
        Errors = [error];
    }

    public IReadOnlyCollection<string> Errors { get; }
}
