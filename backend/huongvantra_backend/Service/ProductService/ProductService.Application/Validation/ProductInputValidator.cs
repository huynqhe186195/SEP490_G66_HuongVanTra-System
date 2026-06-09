using System.Text.RegularExpressions;
using ProductService.Domain.Exceptions;

namespace ProductService.Application.Validation;

public static class ProductInputValidator
{
    private static readonly Regex SafeTextRegex = new(
        @"^[\p{L}\p{N}\s\-_\(\)\.\,\/\#\&\'\""]+$",
        RegexOptions.Compiled | RegexOptions.IgnoreCase);

    private static readonly Regex SkuCodeRegex = new(
        @"^[A-Z0-9\-_]{3,50}$",
        RegexOptions.Compiled);

    private static readonly Regex UrlRegex = new(
        @"^https?://[^\s/$.?#].[^\s]*$",
        RegexOptions.Compiled | RegexOptions.IgnoreCase);

    // ── Category ─────────────────────────────────────────────────────────────

    public static ValidatedCategoryInput ValidateCategory(
        string? nameValue,
        string? descriptionValue,
        int? parentId)
    {
        var errors = new List<string>();

        var name = nameValue?.Trim();
        if (string.IsNullOrWhiteSpace(name))
            errors.Add("Tên danh mục là bắt buộc.");
        else if (name.Length < 2)
            errors.Add("Tên danh mục phải có ít nhất 2 ký tự.");
        else if (name.Length > 100)
            errors.Add("Tên danh mục tối đa 100 ký tự.");

        var description = descriptionValue?.Trim();
        if (!string.IsNullOrWhiteSpace(description) && description.Length > 500)
            errors.Add("Mô tả danh mục tối đa 500 ký tự.");
        if (string.IsNullOrWhiteSpace(description)) description = null;

        if (parentId.HasValue && parentId.Value <= 0)
            errors.Add("ParentId phải là số nguyên dương.");

        if (errors.Count > 0) throw new ProductValidationException(errors);

        return new ValidatedCategoryInput(name!, description, parentId);
    }

    // ── Product ───────────────────────────────────────────────────────────────

    public static ValidatedProductInput ValidateProduct(
        int categoryId,
        string? nameValue,
        string? originValue,
        string? flavorProfileValue,
        string? brewingGuideValue,
        string? descriptionValue,
        bool? isActive = null)
    {
        var errors = new List<string>();

        if (categoryId <= 0)
            errors.Add("CategoryId phải là số nguyên dương.");

        var name = nameValue?.Trim();
        if (string.IsNullOrWhiteSpace(name))
            errors.Add("Tên sản phẩm là bắt buộc.");
        else if (name.Length < 2)
            errors.Add("Tên sản phẩm phải có ít nhất 2 ký tự.");
        else if (name.Length > 200)
            errors.Add("Tên sản phẩm tối đa 200 ký tự.");

        var origin = originValue?.Trim();
        if (!string.IsNullOrWhiteSpace(origin) && origin.Length > 100)
            errors.Add("Xuất xứ tối đa 100 ký tự.");
        if (string.IsNullOrWhiteSpace(origin)) origin = null;

        var flavorProfile = flavorProfileValue?.Trim();
        if (!string.IsNullOrWhiteSpace(flavorProfile) && flavorProfile.Length > 500)
            errors.Add("Hương vị tối đa 500 ký tự.");
        if (string.IsNullOrWhiteSpace(flavorProfile)) flavorProfile = null;

        var brewingGuide = brewingGuideValue?.Trim();
        if (!string.IsNullOrWhiteSpace(brewingGuide) && brewingGuide.Length > 1000)
            errors.Add("Hướng dẫn pha chế tối đa 1000 ký tự.");
        if (string.IsNullOrWhiteSpace(brewingGuide)) brewingGuide = null;

        var description = descriptionValue?.Trim();
        if (!string.IsNullOrWhiteSpace(description) && description.Length > 2000)
            errors.Add("Mô tả sản phẩm tối đa 2000 ký tự.");
        if (string.IsNullOrWhiteSpace(description)) description = null;

        if (errors.Count > 0) throw new ProductValidationException(errors);

        return new ValidatedProductInput(categoryId, name!, origin, flavorProfile, brewingGuide, description, isActive);
    }

    // ── ProductSku ────────────────────────────────────────────────────────────

    public static ValidatedProductSkuInput ValidateProductSku(
        Guid productId,
        string? skuCodeValue,
        string? packagingTypeValue,
        int weightInGrams,
        decimal basePrice,
        string? imageUrlValue,
        bool? isActive = null)
    {
        var errors = new List<string>();

        if (productId == Guid.Empty)
            errors.Add("ProductId không hợp lệ.");

        var skuCode = skuCodeValue?.Trim().ToUpperInvariant();
        if (string.IsNullOrWhiteSpace(skuCode))
            errors.Add("Mã SKU là bắt buộc.");
        else if (!SkuCodeRegex.IsMatch(skuCode))
            errors.Add("Mã SKU chỉ được chứa chữ in hoa, chữ số, dấu gạch ngang hoặc gạch dưới (3–50 ký tự). Ví dụ: TEA-001, CF_500G.");

        var packagingType = packagingTypeValue?.Trim();
        if (string.IsNullOrWhiteSpace(packagingType))
            errors.Add("Loại đóng gói là bắt buộc.");
        else if (packagingType.Length > 50)
            errors.Add("Loại đóng gói tối đa 50 ký tự.");

        if (weightInGrams <= 0)
            errors.Add("Khối lượng phải lớn hơn 0 gram.");
        else if (weightInGrams > 100_000)
            errors.Add("Khối lượng tối đa 100,000 gram (100 kg).");

        if (basePrice <= 0)
            errors.Add("Giá bán phải lớn hơn 0.");
        else if (basePrice > 1_000_000_000)
            errors.Add("Giá bán tối đa 1,000,000,000 VNĐ.");
        else if (decimal.Round(basePrice, 2) != basePrice)
            errors.Add("Giá bán chỉ được có tối đa 2 chữ số thập phân.");

        var imageUrl = imageUrlValue?.Trim();
        if (!string.IsNullOrWhiteSpace(imageUrl))
        {
            if (imageUrl.Length > 500)
                errors.Add("URL ảnh tối đa 500 ký tự.");
            else if (!UrlRegex.IsMatch(imageUrl))
                errors.Add("URL ảnh không hợp lệ. Phải bắt đầu bằng http:// hoặc https://.");
        }
        if (string.IsNullOrWhiteSpace(imageUrl)) imageUrl = null;

        if (errors.Count > 0) throw new ProductValidationException(errors);

        return new ValidatedProductSkuInput(productId, skuCode!, packagingType!, weightInGrams, basePrice, imageUrl, isActive);
    }

    // ── Pagination ────────────────────────────────────────────────────────────

    public const int MaxPageSize = 100;

    public static void ValidatePagination(int page, int pageSize)
    {
        var errors = new List<string>();
        if (page < 1) errors.Add("Page phải lớn hơn hoặc bằng 1.");
        if (pageSize < 1) errors.Add("PageSize phải lớn hơn hoặc bằng 1.");
        else if (pageSize > MaxPageSize) errors.Add($"PageSize tối đa là {MaxPageSize}.");
        if (errors.Count > 0) throw new ProductValidationException(errors);
    }
}

public record ValidatedCategoryInput(string Name, string? Description, int? ParentId);

public record ValidatedProductInput(
    int CategoryId,
    string Name,
    string? Origin,
    string? FlavorProfile,
    string? BrewingGuide,
    string? Description,
    bool? IsActive);

public record ValidatedProductSkuInput(
    Guid ProductId,
    string SkuCode,
    string PackagingType,
    int WeightInGrams,
    decimal BasePrice,
    string? ImageUrl,
    bool? IsActive);
