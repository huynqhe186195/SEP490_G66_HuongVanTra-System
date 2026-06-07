namespace ProductService.Domain.Exceptions;

public class ProductNotFoundException(Guid id)
    : Exception($"Product with id '{id}' was not found.");

public class ProductSkuNotFoundException(Guid id)
    : Exception($"ProductSKU with id '{id}' was not found.");

public class ProductSkuNotFoundByCodeException(string skuCode)
    : Exception($"ProductSKU with code '{skuCode}' was not found.");

public class CategoryNotFoundException(int id)
    : Exception($"Category with id '{id}' was not found.");

public class DuplicateSkuCodeException(string skuCode)
    : Exception($"SKU code '{skuCode}' already exists.");
