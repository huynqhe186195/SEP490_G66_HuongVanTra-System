using System.Text.RegularExpressions;
using ProductService.Domain.Exceptions;

namespace ProductService.Application.Validation;

public static class ProductInputValidator
{
    private static readonly Regex SafeTextRegex = new(
        @"^[\p{L}\p{N}\s\-_\(\)\.\,\/\#\&\'" + "\"" + @"]+$",
        RegexOptions.Compiled | RegexOptions.IgnoreCase);

    private static readonly Regex SkuCodeRegex = new(
        @"^[A-Z0-9\-_]{3,50}$",
        RegexOptions.Compiled);

    private static readonly Regex BarcodeRegex = new(
        @"^[A-Z0-9\-_\.]{3,100}$",
        RegexOptions.Compiled | RegexOptions.IgnoreCase);

    private static readonly Regex UrlRegex = new(
        @"^https?://[^\s/$.?#].[^\s]*$",
        RegexOptions.Compiled | RegexOptions.IgnoreCase);

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

    public static ValidatedProductInput ValidateProduct(
        int categoryId,
        string? nameValue,
        string? originValue,
        string? flavorProfileValue,
        string? brewingGuideValue,
        string? descriptionValue,
        string? baseUnitValue = null,
        decimal? weightValue = null,
        string? weightUnitValue = null,
        bool isVariantParent = false,
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

        var origin = TrimMax(originValue, 100, "Xuất xứ tối đa 100 ký tự.", errors);
        var flavorProfile = TrimMax(flavorProfileValue, 500, "Hương vị tối đa 500 ký tự.", errors);
        var brewingGuide = TrimMax(brewingGuideValue, 1000, "Hướng dẫn pha chế tối đa 1000 ký tự.", errors);
        var description = TrimMax(descriptionValue, 2000, "Mô tả sản phẩm tối đa 2000 ký tự.", errors);
        var baseUnit = baseUnitValue?.Trim();
        if (string.IsNullOrWhiteSpace(baseUnit)) baseUnit = "unit";
        if (baseUnit.Length > 50) errors.Add("Đơn vị gốc tối đa 50 ký tự.");

        var weightUnit = TrimMax(weightUnitValue, 50, "Đơn vị khối lượng tối đa 50 ký tự.", errors);
        if (weightValue.HasValue && weightValue.Value < 0)
            errors.Add("Khối lượng không được âm.");

        if (errors.Count > 0) throw new ProductValidationException(errors);

        return new ValidatedProductInput(
            categoryId, name!, origin, flavorProfile, brewingGuide, description,
            baseUnit!, weightValue, weightUnit, isVariantParent, isActive);
    }



    public static List<ValidatedProductImageInput> ValidateImages(IEnumerable<dynamic>? images)
    {
        var result = new List<ValidatedProductImageInput>();
        if (images is null) return result;

        var errors = new List<string>();
        var thumbnailCount = 0;
        foreach (var image in images)
        {
            string? imageUrlValue = image.ImageUrl;
            string? altTextValue = image.AltText;
            int sortOrder = image.SortOrder;
            bool isThumbnail = image.IsThumbnail;

            var imageUrl = NormalizeUrl(imageUrlValue, "URL ảnh", errors);
            var altText = TrimMax(altTextValue, 255, "Alt text ảnh tối đa 255 ký tự.", errors);
            if (sortOrder < 0) errors.Add("Thứ tự ảnh không được âm.");
            if (isThumbnail) thumbnailCount++;
            if (!string.IsNullOrWhiteSpace(imageUrl))
                result.Add(new ValidatedProductImageInput(imageUrl!, altText, sortOrder, isThumbnail));
        }

        if (thumbnailCount > 1)
            errors.Add("Chỉ được chọn một ảnh thumbnail.");

        if (errors.Count > 0) throw new ProductValidationException(errors);
        return result;
    }

    public static List<ValidatedProductUnitInput> ValidateUnits(IEnumerable<dynamic>? units)
    {
        var result = new List<ValidatedProductUnitInput>();
        if (units is null) return result;

        var errors = new List<string>();
        var baseUnitCount = 0;
        var unitNames = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var unit in units)
        {
            Guid? variantId = unit.VariantId;
            string? unitNameValue = unit.UnitName;
            decimal conversionRate = unit.ConversionRate;
            decimal? price = unit.Price;
            string? barcodeValue = unit.Barcode;
            bool isDirectSell = unit.IsDirectSell;
            bool isBaseUnit = unit.IsBaseUnit;

            var unitName = unitNameValue?.Trim();
            if (string.IsNullOrWhiteSpace(unitName))
                errors.Add("Tên đơn vị tính là bắt buộc.");
            else if (unitName.Length > 100)
                errors.Add("Tên đơn vị tính tối đa 100 ký tự.");
            else if (!unitNames.Add(unitName))
                errors.Add($"Đơn vị tính '{unitName}' bị trùng.");

            if (conversionRate <= 0)
                errors.Add("Tỷ lệ quy đổi phải lớn hơn 0.");
            if (price.HasValue)
                ValidatePrice(price.Value, "Giá theo đơn vị", errors, mustBePositive: false);
            var barcode = NormalizeBarcode(barcodeValue, errors);
            if (isBaseUnit) baseUnitCount++;

            if (!string.IsNullOrWhiteSpace(unitName))
                result.Add(new ValidatedProductUnitInput(variantId, unitName!, conversionRate, price, barcode, isDirectSell, isBaseUnit));
        }

        if (baseUnitCount > 1)
            errors.Add("Chỉ được chọn một đơn vị gốc.");

        if (errors.Count > 0) throw new ProductValidationException(errors);
        return result;
    }

    public static List<ValidatedProductVariantInput> ValidateVariants(IEnumerable<dynamic>? variants)
    {
        var result = new List<ValidatedProductVariantInput>();
        if (variants is null) return result;

        var errors = new List<string>();
        var skuCodes = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var variant in variants)
        {
            string? skuCodeValue = variant.SkuCode;
            string? barcodeValue = variant.Barcode;
            string? variantNameValue = variant.VariantName;
            string? optionValuesJsonValue = variant.OptionValuesJson;
            decimal costPrice = variant.CostPrice;
            decimal retailPrice = variant.RetailPrice;
            int? minStock = variant.MinStock;
            int? maxStock = variant.MaxStock;
            bool isSellable = variant.IsSellable;
            bool allowRewardPoints = variant.AllowRewardPoints;
            bool isActive = variant.IsActive;
            string? imageUrlValue = variant.ImageUrl;

            var skuCode = NormalizeSku(skuCodeValue, errors, allowBlankSku: true);
            if (!string.IsNullOrWhiteSpace(skuCode) && !skuCodes.Add(skuCode))
                errors.Add($"Mã SKU biến thể '{skuCode}' bị trùng trong request.");

            var barcode = NormalizeBarcode(barcodeValue, errors);
            var variantName = variantNameValue?.Trim();
            if (string.IsNullOrWhiteSpace(variantName))
                errors.Add("Tên biến thể là bắt buộc.");
            else if (variantName.Length > 255)
                errors.Add("Tên biến thể tối đa 255 ký tự.");

            var optionValuesJson = optionValuesJsonValue?.Trim();
            if (string.IsNullOrWhiteSpace(optionValuesJson)) optionValuesJson = "{}";
            if (optionValuesJson.Length > 4000) errors.Add("Thông tin option biến thể quá dài.");

            ValidatePrice(costPrice, "Giá vốn biến thể", errors, mustBePositive: false);
            ValidatePrice(retailPrice, "Giá bán biến thể", errors, mustBePositive: isSellable);
            ValidateStockRange(minStock, maxStock, errors);
            var imageUrl = NormalizeUrl(imageUrlValue, "URL ảnh biến thể", errors);
            var units = ValidateUnits(variant.Units);

            if (!string.IsNullOrWhiteSpace(variantName))
                result.Add(new ValidatedProductVariantInput(
                    skuCode, barcode, variantName!, optionValuesJson!, costPrice, retailPrice,
                    minStock, maxStock, isSellable, allowRewardPoints, isActive, imageUrl, units));
        }

        if (errors.Count > 0) throw new ProductValidationException(errors);
        return result;
    }

    public static List<ValidatedProductVariantInput> ValidateVariantGenerator(dynamic? generator)
    {
        var result = new List<ValidatedProductVariantInput>();
        if (generator is null) return result;

        var errors = new List<string>();
        var optionGroups = new List<(string Name, List<string> Values)>();
        var groupNames = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var group in generator.OptionGroups)
        {
            string? nameValue = group.Name;
            List<string>? valuesValue = group.Values;
            var name = nameValue?.Trim();
            if (string.IsNullOrWhiteSpace(name))
            {
                errors.Add("Tên nhóm thuộc tính biến thể là bắt buộc.");
                continue;
            }
            if (!groupNames.Add(name))
                errors.Add($"Nhóm thuộc tính '{name}' bị trùng.");

            var values = (valuesValue ?? [])
                .Select(v => v?.Trim())
                .Where(v => !string.IsNullOrWhiteSpace(v))
                .Cast<string>()
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();
            if (values.Count == 0)
                errors.Add($"Nhóm thuộc tính '{name}' phải có ít nhất một giá trị.");
            optionGroups.Add((name, values));
        }

        decimal costPrice = generator.CostPrice;
        decimal retailPrice = generator.RetailPrice;
        int? minStock = generator.MinStock;
        int? maxStock = generator.MaxStock;
        bool isSellable = generator.IsSellable;
        bool allowRewardPoints = generator.AllowRewardPoints;
        ValidatePrice(costPrice, "Giá vốn biến thể", errors, mustBePositive: false);
        ValidatePrice(retailPrice, "Giá bán biến thể", errors, mustBePositive: true);
        ValidateStockRange(minStock, maxStock, errors);

        if (errors.Count > 0) throw new ProductValidationException(errors);
        if (optionGroups.Count == 0) return result;

        foreach (var combination in Cartesian(optionGroups))
        {
            var variantName = string.Join(" / ", combination.Select(v => v.Value));
            var json = "{" + string.Join(",", combination.Select(v => $"\"{EscapeJson(v.Name)}\":\"{EscapeJson(v.Value)}\"")) + "}";
            result.Add(new ValidatedProductVariantInput(
                null, null, variantName, json, costPrice, retailPrice,
                minStock, maxStock, isSellable, allowRewardPoints, true, null, []));
        }

        return result;
    }

    public const int MaxPageSize = 100;

    public static void ValidatePagination(int page, int pageSize)
    {
        var errors = new List<string>();
        if (page < 1) errors.Add("Page phải lớn hơn hoặc bằng 1.");
        if (pageSize < 1) errors.Add("PageSize phải lớn hơn hoặc bằng 1.");
        else if (pageSize > MaxPageSize) errors.Add($"PageSize tối đa là {MaxPageSize}.");
        if (errors.Count > 0) throw new ProductValidationException(errors);
    }

    private static string? TrimMax(string? value, int maxLength, string error, List<string> errors)
    {
        var trimmed = value?.Trim();
        if (!string.IsNullOrWhiteSpace(trimmed) && trimmed.Length > maxLength)
            errors.Add(error);
        return string.IsNullOrWhiteSpace(trimmed) ? null : trimmed;
    }

    private static string? NormalizeSku(string? value, List<string> errors, bool allowBlankSku)
    {
        var skuCode = value?.Trim().ToUpperInvariant();
        if (string.IsNullOrWhiteSpace(skuCode))
        {
            if (!allowBlankSku) errors.Add("Mã SKU là bắt buộc.");
            return null;
        }
        if (!SkuCodeRegex.IsMatch(skuCode))
            errors.Add("Mã SKU chỉ được chứa chữ in hoa, chữ số, dấu gạch ngang hoặc gạch dưới (3–50 ký tự). Ví dụ: TEA-001, CF_500G.");
        return skuCode;
    }

    private static string? NormalizeBarcode(string? value, List<string> errors)
    {
        var barcode = value?.Trim();
        if (string.IsNullOrWhiteSpace(barcode)) return null;
        if (!BarcodeRegex.IsMatch(barcode))
            errors.Add("Barcode chỉ được chứa chữ, số, dấu gạch ngang, gạch dưới hoặc dấu chấm (3–100 ký tự).");
        return barcode;
    }

    private static string? NormalizeUrl(string? value, string label, List<string> errors)
    {
        var url = value?.Trim();
        if (string.IsNullOrWhiteSpace(url)) return null;
        if (url.Length > 500)
            errors.Add($"{label} tối đa 500 ký tự.");
        else if (!UrlRegex.IsMatch(url))
            errors.Add($"{label} không hợp lệ. Phải bắt đầu bằng http:// hoặc https://.");
        return url;
    }

    private static void ValidatePrice(decimal price, string label, List<string> errors, bool mustBePositive)
    {
        if (mustBePositive ? price <= 0 : price < 0)
            errors.Add(mustBePositive ? $"{label} phải lớn hơn 0." : $"{label} không được âm.");
        else if (price > 1_000_000_000)
            errors.Add($"{label} tối đa 1,000,000,000 VNĐ.");
        else if (decimal.Round(price, 2) != price)
            errors.Add($"{label} chỉ được có tối đa 2 chữ số thập phân.");
    }

    private static void ValidateStockRange(int? minStock, int? maxStock, List<string> errors)
    {
        if (minStock.HasValue && minStock.Value < 0)
            errors.Add("Tồn kho tối thiểu không được âm.");
        if (maxStock.HasValue && maxStock.Value < 0)
            errors.Add("Tồn kho tối đa không được âm.");
        if (minStock.HasValue && maxStock.HasValue && maxStock.Value < minStock.Value)
            errors.Add("Tồn kho tối đa phải lớn hơn hoặc bằng tồn kho tối thiểu.");
    }

    private static IEnumerable<List<(string Name, string Value)>> Cartesian(List<(string Name, List<string> Values)> groups)
    {
        IEnumerable<List<(string Name, string Value)>> result = [[]];
        foreach (var group in groups)
        {
            result = result.SelectMany(existing => group.Values.Select(value => existing.Concat([(group.Name, value)]).ToList()));
        }
        return result;
    }

    private static string EscapeJson(string value) => value.Replace("\\", "\\\\").Replace("\"", "\\\"");
}

public record ValidatedCategoryInput(string Name, string? Description, int? ParentId);

public record ValidatedProductInput(
    int CategoryId,
    string Name,
    string? Origin,
    string? FlavorProfile,
    string? BrewingGuide,
    string? Description,
    string BaseUnit,
    decimal? WeightValue,
    string? WeightUnit,
    bool IsVariantParent,
    bool? IsActive);

public record ValidatedProductImageInput(
    string ImageUrl,
    string? AltText,
    int SortOrder,
    bool IsThumbnail);

public record ValidatedProductUnitInput(
    Guid? VariantId,
    string UnitName,
    decimal ConversionRate,
    decimal? Price,
    string? Barcode,
    bool IsDirectSell,
    bool IsBaseUnit);

public record ValidatedProductVariantInput(
    string? SkuCode,
    string? Barcode,
    string VariantName,
    string OptionValuesJson,
    decimal CostPrice,
    decimal RetailPrice,
    int? MinStock,
    int? MaxStock,
    bool IsSellable,
    bool AllowRewardPoints,
    bool IsActive,
    string? ImageUrl,
    List<ValidatedProductUnitInput> Units);
