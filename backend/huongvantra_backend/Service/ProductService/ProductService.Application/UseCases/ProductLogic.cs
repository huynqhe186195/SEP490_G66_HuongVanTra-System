using System.Globalization;
using System.Text;
using ProductService.Application;
using ProductService.Application.DTOs.Requests;
using ProductService.Application.DTOs.Responses;
using ProductService.Application.Interfaces;
using ProductService.Application.Validation;
using ProductService.Domain.Entities;
using ProductService.Domain.Enums;
using ProductService.Domain.Exceptions;

namespace ProductService.Application.UseCases;

public class ProductLogic(IProductRepository _productRepository, ICategoryRepository _categoryRepository)
{
    public async Task<PagedResponse<ProductResponse>> GetPagedAsync(
        GetProductsRequest request,
        CatalogViewScope scope = CatalogViewScope.Store)
    {
        if (request is null)
            throw new ProductValidationException("Request là bắt buộc.");

        ProductInputValidator.ValidatePagination(request.Page, request.PageSize);

        var (items, total) = await _productRepository.GetPagedAsync(
            request.Search, request.CategoryId, request.IsActive, request.IsDeleted,
            request.Page, request.PageSize, scope,
            ParseProductTypeFilter(request.ProductType));

        return new PagedResponse<ProductResponse>(
            items.Select(p => MapToResponse(p, scope)).ToList(),
            request.Page,
            request.PageSize,
            total,
            (int)Math.Ceiling((double)total / request.PageSize));
    }

    public async Task<List<ProductResponse>> GetAllAsync(
        bool includeInactive = false,
        CatalogViewScope scope = CatalogViewScope.Store)
    {
        var products = await _productRepository.GetAllAsync(includeInactive, scope);
        return products.Select(p => MapToResponse(p, scope)).ToList();
    }

    public async Task<ProductResponse> GetByIdAsync(Guid id, CatalogViewScope scope = CatalogViewScope.Store)
    {
        var product = await _productRepository.GetByIdAsync(id)
            ?? throw new ProductNotFoundException(id);

        if (scope == CatalogViewScope.Store && product.SyncedToStoreAt == null)
            throw new ProductNotFoundException(id);

        return MapToResponse(product, scope);
    }

    public async Task<List<BomLineResponse>> GetVariantBomAsync(Guid variantId)
    {
        var variant = await _productRepository.GetVariantByIdAsync(variantId)
            ?? throw new ProductValidationException("Không tìm thấy SKU/ProductVariant.");

        return variant.BomLines
            .Where(line => !line.IsDeleted)
            .Select(MapBomLineResponse)
            .ToList();
    }

    public async Task<List<BomLineResponse>> UpdateVariantBomAsync(Guid variantId, UpdateVariantBomRequest request)
    {
        if (request is null)
            throw new ProductValidationException("Request body là bắt buộc.");

        var variant = await _productRepository.GetVariantByIdAsync(variantId)
            ?? throw new ProductValidationException("Không tìm thấy SKU/ProductVariant.");

        if (variant.Product.ProductType != ProductType.THANH_PHAM)
            throw new ProductValidationException("Chỉ SKU Sản phẩm kệ mới được cấu hình BOM.");

        var lines = request.Lines ?? [];
        var resolvedLines = await BuildVariantBomLinesAsync(
            lines,
            variant.Product.ProductType,
            variant,
            new Dictionary<string, ProductVariant>(StringComparer.OrdinalIgnoreCase),
            new Dictionary<string, ProductVariant>(StringComparer.OrdinalIgnoreCase));
        await EnsureNoBomCyclesAsync(new Dictionary<Guid, List<Guid>>
        {
            [variant.Id] = resolvedLines
                .Where(line => line.ComponentVariantId.HasValue)
                .Select(line => line.ComponentVariantId!.Value)
                .ToList()
        });

        var updatedBom = await _productRepository.ReplaceVariantBomAsync(variantId, resolvedLines);
        return updatedBom.BomLines
            .Where(line => !line.IsDeleted)
            .Select(MapBomLineResponse)
            .ToList();
    }

    public async Task<ProductResponse> CreateAsync(CreateProductRequest request)
    {
        if (request is null)
            throw new ProductValidationException("Request body là bắt buộc.");

        var input = ProductInputValidator.ValidateProduct(
            request.CategoryId, request.Name, request.Origin,
            request.FlavorProfile, request.BrewingGuide, request.Description,
            baseUnitValue: request.BaseUnit,
            weightValue: request.WeightValue,
            weightUnitValue: request.WeightUnit,
            inventoryUnitValue: request.InventoryUnit,
            isVariantParent: request.IsVariantParent);
        var images = ProductInputValidator.ValidateImages(request.Images);
        var units = ProductInputValidator.ValidateUnits(request.Units);
        var variants = MergeVariants(
            ProductInputValidator.ValidateVariants(request.Variants),
            ProductInputValidator.ValidateVariantGenerator(request.VariantGenerator));
        var attributes = ProductInputValidator.ValidateAttributes(request.Attributes);

        _ = await _categoryRepository.GetByIdAsync(input.CategoryId)
            ?? throw new CategoryNotFoundException(input.CategoryId);

        if (await _productRepository.ExistsNameAsync(input.Name))
            throw new ProductValidationException(
                $"Sản phẩm '{input.Name}' đã tồn tại (kể cả đang ngừng kinh doanh hoặc đã xóa mềm). Hãy kích hoạt lại bản cũ thay vì tạo mới.");

        var productType = ParseProductType(request.ProductType);
        var productId = Guid.NewGuid();
        var product = new Product
        {
            Id = productId,
            CategoryId = input.CategoryId,
            Name = input.Name,
            Origin = input.Origin,
            FlavorProfile = input.FlavorProfile,
            BrewingGuide = input.BrewingGuide,
            Description = input.Description,
            BaseUnit = input.BaseUnit,
            InventoryUnit = input.InventoryUnit,
            WeightValue = input.WeightValue,
            WeightUnit = input.WeightUnit,
            IsVariantParent = input.IsVariantParent || variants.Count > 0,
            ProductType = productType,
            Images = images.Select(MapImage).ToList(),
            Units = units.Select(MapUnit).ToList(),
            AttributeValues = MapAttributeValues(attributes).ToList(),
            Variants = await MapVariantsAsync(productId, input.Name, variants, request.Variants, productType)
        };

        var created = await _productRepository.CreateAsync(product);
        return MapToResponse(created, CatalogViewScope.Warehouse);
    }

    public async Task<ProductResponse> UpdateAsync(Guid id, UpdateProductRequest request)
    {
        if (request is null)
            throw new ProductValidationException("Request body là bắt buộc.");

        var product = await _productRepository.GetByIdAsync(id)
            ?? throw new ProductNotFoundException(id);
        if (product.IsDeleted)
            throw new ProductValidationException("Không thể sửa sản phẩm đã xóa mềm. Hãy kích hoạt lại trước.");

        var input = ProductInputValidator.ValidateProduct(
            request.CategoryId, request.Name, request.Origin,
            request.FlavorProfile, request.BrewingGuide, request.Description,
            baseUnitValue: request.BaseUnit,
            weightValue: request.WeightValue,
            weightUnitValue: request.WeightUnit,
            inventoryUnitValue: request.InventoryUnit,
            isVariantParent: request.IsVariantParent,
            isActive: request.IsActive);
        var images = ProductInputValidator.ValidateImages(request.Images);
        var units = ProductInputValidator.ValidateUnits(request.Units);
        var variants = MergeVariants(
            ProductInputValidator.ValidateVariants(request.Variants),
            ProductInputValidator.ValidateVariantGenerator(request.VariantGenerator));
        var attributes = ProductInputValidator.ValidateAttributes(request.Attributes);

        _ = await _categoryRepository.GetByIdAsync(input.CategoryId)
            ?? throw new CategoryNotFoundException(input.CategoryId);

        if (await _productRepository.ExistsNameAsync(input.Name, excludeProductId: id))
            throw new ProductValidationException($"Sản phẩm với tên '{input.Name}' đã tồn tại.");

        product.CategoryId = input.CategoryId;
        product.Name = input.Name;
        product.Origin = input.Origin;
        product.FlavorProfile = input.FlavorProfile;
        product.BrewingGuide = input.BrewingGuide;
        product.Description = input.Description;
        product.BaseUnit = input.BaseUnit;
        product.InventoryUnit = input.InventoryUnit;
        product.WeightValue = input.WeightValue;
        product.WeightUnit = input.WeightUnit;
        product.IsVariantParent = input.IsVariantParent || variants.Count > 0;
        product.IsActive = input.IsActive ?? product.IsActive;
        product.ProductType = ParseProductType(request.ProductType);
        product.UpdatedAt = DateTime.UtcNow;

        Replace(product.Images, images.Select(MapImage));
        Replace(product.Units, units.Select(MapUnit));
        Replace(product.AttributeValues, MapAttributeValues(attributes));
        Replace(product.Variants, await MapVariantsAsync(product.Id, input.Name, variants, request.Variants, product.ProductType));

        var updated = await _productRepository.UpdateAsync(product);
        return MapToResponse(updated, CatalogViewScope.Warehouse);
    }

    public async Task DeleteAsync(Guid id)
    {
        var product = await _productRepository.GetByIdAsync(id)
            ?? throw new ProductNotFoundException(id);
        if (product.IsDeleted)
            throw new ProductValidationException("Sản phẩm đã được xóa mềm.");
        await _productRepository.DeleteAsync(product);
    }

    public async Task<ProductResponse> RestoreAsync(Guid id)
    {
        var product = await _productRepository.GetByIdAsync(id, includeDeleted: true)
            ?? throw new ProductNotFoundException(id);
        if (!product.IsDeleted)
            throw new ProductValidationException("Sản phẩm chưa bị xóa mềm.");

        if (await _productRepository.ExistsNameAsync(product.Name, excludeProductId: id, includeDeleted: false))
            throw new ProductValidationException(
                $"Không thể kích hoạt lại — đã có sản phẩm khác tên '{product.Name}'. Đổi tên bản mới hoặc xóa bản trùng trước.");

        await _productRepository.RestoreAsync(product);
        return MapToResponse((await _productRepository.GetByIdAsync(id))!, CatalogViewScope.Warehouse);
    }

    private async Task<List<ProductVariant>> MapVariantsAsync(
        Guid productId,
        string productName,
        List<ValidatedProductVariantInput> inputs,
        List<ProductVariantRequest>? rawRequests = null,
        ProductType productType = ProductType.THANH_PHAM)
    {
        var variants = new List<ProductVariant>();
        var usedInBatch = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var explicitBaseCount = inputs.Count(input => input.IsBaseUnitVariant == true);
        if (explicitBaseCount > 1)
            throw new ProductValidationException("Chi duoc chon mot SKU don vi goc.");
        for (var i = 0; i < inputs.Count; i++)
        {
            var input = inputs[i];
            var skuCode = string.IsNullOrWhiteSpace(input.SkuCode)
                ? await GenerateUniqueVariantSkuAsync(productName, input.VariantName, usedInBatch)
                : input.SkuCode;
            if (await _productRepository.ExistsVariantSkuCodeAsync(skuCode))
                throw new DuplicateSkuCodeException(skuCode);
            usedInBatch.Add(skuCode);

            var unitName = ResolveVariantUnitName(input);
            var isBaseUnitVariant = input.IsBaseUnitVariant ?? (explicitBaseCount == 0 && i == 0);
            var conversionRate = isBaseUnitVariant ? 1 : input.ConversionRate;
            if (conversionRate <= 0)
                throw new ProductValidationException($"Ty le quy doi cua SKU {skuCode} phai lon hon 0.");
            if (!BomUnitRules.IsIntegerQuantity(conversionRate))
                throw new ProductValidationException($"Ty le quy doi cua SKU {skuCode} phai la so nguyen duong.");
            var variantId = Guid.NewGuid();

            variants.Add(new ProductVariant
            {
                Id = variantId,
                ProductId = productId,
                SkuCode = skuCode,
                Barcode = input.Barcode,
                VariantName = input.VariantName,
                OptionValuesJson = input.OptionValuesJson,
                CostPrice = input.CostPrice,
                RetailPrice = input.RetailPrice,
                MinStock = input.MinStock,
                MaxStock = input.MaxStock,
                IsSellable = input.IsSellable,
                AllowRewardPoints = input.AllowRewardPoints,
                // Mặc định mua được từ NCC; bỏ tick chỉ khi SKU thuần tự sản xuất.
                IsPurchasable = input.IsPurchasable ?? true,
                IsActive = input.IsActive,
                ImageUrl = input.ImageUrl,
                UnitName = unitName,
                ConversionRate = conversionRate,
                IsBaseUnitVariant = isBaseUnitVariant,
                IsAutoGeneratedSku = input.IsAutoGeneratedSku ?? string.IsNullOrWhiteSpace(input.SkuCode),
                Units = BuildVariantUnits(productId, variantId, unitName, input)
            });
        }

        var localBySku = variants.ToDictionary(v => v.SkuCode, StringComparer.OrdinalIgnoreCase);
        var localByRequestKey = new Dictionary<string, ProductVariant>(StringComparer.OrdinalIgnoreCase);
        for (var i = 0; i < variants.Count; i++)
        {
            var requestKey = NormalizeText(inputs[i].RequestSkuKey);
            if (requestKey != null)
                localByRequestKey[requestKey] = variants[i];
        }

        await ResolveBaseVariantReferencesAsync(inputs, variants, localBySku, localByRequestKey);

        var pendingEdges = new Dictionary<Guid, List<Guid>>();
        for (var i = 0; i < variants.Count; i++)
        {
            var bomLines = rawRequests != null && i < rawRequests.Count
                ? await BuildVariantBomLinesAsync(rawRequests[i].BomLines, productType, variants[i], localBySku, localByRequestKey)
                : [];

            variants[i].BomLines = bomLines;
            pendingEdges[variants[i].Id] = bomLines
                .Where(line => line.ComponentVariantId.HasValue)
                .Select(line => line.ComponentVariantId!.Value)
                .ToList();
        }

        await EnsureNoBomCyclesAsync(pendingEdges);
        return variants;
    }

    private async Task<List<ProductVariantBomLine>> BuildVariantBomLinesAsync(
        List<BomLineRequest>? rawLines,
        ProductType productType,
        ProductVariant outputVariant,
        Dictionary<string, ProductVariant> localBySku,
        Dictionary<string, ProductVariant> localByRequestKey)
    {
        var lines = rawLines ?? [];

        if (productType != ProductType.THANH_PHAM)
        {
            if (lines.Count > 0)
                throw new ProductValidationException("BOM chỉ áp dụng cho SKU Sản phẩm kệ.");
            return [];
        }

        foreach (var line in lines)
            ValidatePositiveIntegerBomQuantity(line.Quantity);

        var manualLines = lines
            .Where(line => !line.IsRequiredBaseComponent)
            .ToList();

        var requiredBaseVariant = await ResolveRequiredBaseVariantAsync(outputVariant, localBySku);

        var duplicate = manualLines
            .GroupBy(GetBomLineDedupKey, StringComparer.OrdinalIgnoreCase)
            .FirstOrDefault(group => group.Count() > 1);
        if (duplicate is not null)
            throw new ProductValidationException("Không được chọn trùng component trong một BOM.");

        var result = new List<ProductVariantBomLine>();
        if (requiredBaseVariant != null)
        {
            result.Add(new ProductVariantBomLine
            {
                MaterialId = requiredBaseVariant.ProductId,
                ComponentVariantId = requiredBaseVariant.Id,
                Quantity = outputVariant.ConversionRate,
                IsRequiredBaseComponent = true
            });
        }

        foreach (var line in manualLines)
        {
            var componentVariant = await ResolveComponentVariantAsync(line, localBySku, localByRequestKey);
            if (componentVariant != null)
            {
                if (componentVariant.Id == outputVariant.Id)
                    throw new ProductValidationException($"SKU {outputVariant.SkuCode} khong duoc tham chieu chinh no trong BOM.");
                if (requiredBaseVariant != null && componentVariant.Id == requiredBaseVariant.Id)
                    throw new ProductValidationException($"SKU {outputVariant.SkuCode} da co component bat buoc theo quy doi, khong duoc them trung base SKU.");

                EnsureAllowedBomComponentType(componentVariant.Product?.ProductType ?? productType, componentVariant.SkuCode);
                result.Add(new ProductVariantBomLine
                {
                    MaterialId = componentVariant.ProductId,
                    ComponentVariantId = componentVariant.Id,
                    Quantity = line.Quantity,
                    IsRequiredBaseComponent = false
                });
                continue;
            }

            if (line.MaterialId == Guid.Empty)
                throw new ProductValidationException("BOM component phai co MaterialId hoac ComponentVariantId.");

            var materialCandidates = await _productRepository.GetProductsByIdsAsync([line.MaterialId]);
            var materialCandidate = materialCandidates.FirstOrDefault()
                ?? throw new ProductValidationException("Co component BOM khong ton tai hoac da bi xoa.");
            var inferredVariant = InferSingleActiveVariant(materialCandidate);
            if (inferredVariant != null)
                EnsureAllowedBomComponentType(materialCandidate.ProductType, inferredVariant.SkuCode);
            else
                EnsureAllowedLegacyBomComponentType(materialCandidate);

            var quantity = inferredVariant == null
                ? NormalizeBomQuantities([new BomLineRequest(line.MaterialId, line.Quantity)], [materialCandidate])[0].Quantity
                : line.Quantity;

            result.Add(new ProductVariantBomLine
            {
                MaterialId = materialCandidate.Id,
                ComponentVariantId = inferredVariant?.Id,
                Quantity = quantity,
                IsRequiredBaseComponent = false
            });
        }

        return result;
    }

    private async Task<ProductVariant?> ResolveRequiredBaseVariantAsync(
        ProductVariant outputVariant,
        Dictionary<string, ProductVariant> localBySku)
    {
        if (outputVariant.IsBaseUnitVariant || !outputVariant.BaseVariantId.HasValue)
            return null;

        var localBaseVariant = localBySku.Values.FirstOrDefault(variant => variant.Id == outputVariant.BaseVariantId.Value);
        if (localBaseVariant != null)
        {
            if (localBaseVariant.ProductId != outputVariant.ProductId)
                throw new ProductValidationException($"SKU {outputVariant.SkuCode} phai tham chieu base SKU cung Product.");
            return localBaseVariant;
        }

        var baseVariant = (await _productRepository.GetVariantsByIdsAsync([outputVariant.BaseVariantId.Value]))
            .FirstOrDefault()
            ?? throw new ProductValidationException($"Khong tim thay base SKU cho {outputVariant.SkuCode}.");

        if (baseVariant.ProductId != outputVariant.ProductId)
            throw new ProductValidationException($"SKU {outputVariant.SkuCode} phai tham chieu base SKU cung Product.");

        return baseVariant;
    }

    private async Task ResolveBaseVariantReferencesAsync(
        List<ValidatedProductVariantInput> inputs,
        List<ProductVariant> variants,
        Dictionary<string, ProductVariant> localBySku,
        Dictionary<string, ProductVariant> localByRequestKey)
    {
        var externalBaseIds = inputs
            .Select(input => input.BaseVariantId)
            .Where(id => id.HasValue && id.Value != Guid.Empty)
            .Select(id => id!.Value)
            .ToHashSet();
        var externalBaseCodes = inputs
            .Select(input => NormalizeText(input.BaseSkuCode))
            .Where(code => code != null && !localBySku.ContainsKey(code!))
            .Cast<string>()
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        var baseById = (await _productRepository.GetVariantsByIdsAsync(externalBaseIds))
            .ToDictionary(v => v.Id);
        var baseBySku = (await _productRepository.GetVariantsBySkuCodesAsync(externalBaseCodes))
            .ToDictionary(v => v.SkuCode, StringComparer.OrdinalIgnoreCase);
        var localBase = variants.FirstOrDefault(v => v.IsBaseUnitVariant);

        for (var i = 0; i < variants.Count; i++)
        {
            var variant = variants[i];
            var input = inputs[i];
            if (variant.IsBaseUnitVariant)
            {
                variant.BaseVariantId = null;
                variant.ConversionRate = 1;
                continue;
            }

            ProductVariant? baseVariant = null;
            var baseRequestKey = NormalizeText(input.BaseRequestSkuKey);
            var baseSkuCode = NormalizeText(input.BaseSkuCode);

            if (baseRequestKey != null)
                localByRequestKey.TryGetValue(baseRequestKey, out baseVariant);
            if (baseVariant == null && baseSkuCode != null)
                baseVariant = localBySku.GetValueOrDefault(baseSkuCode) ?? baseBySku.GetValueOrDefault(baseSkuCode);
            if (baseVariant == null && input.BaseVariantId.HasValue)
                baseById.TryGetValue(input.BaseVariantId.Value, out baseVariant);
            baseVariant ??= localBase;

            if (baseVariant == null)
                throw new ProductValidationException($"SKU {variant.SkuCode} phai co SKU don vi goc.");
            if (baseVariant.Id == variant.Id)
                throw new ProductValidationException($"SKU {variant.SkuCode} khong duoc dat chinh no lam base SKU.");

            variant.BaseVariantId = baseVariant.Id;
        }
    }

    private async Task<ProductVariant?> ResolveComponentVariantAsync(
        BomLineRequest line,
        Dictionary<string, ProductVariant> localBySku,
        Dictionary<string, ProductVariant> localByRequestKey)
    {
        var requestKey = NormalizeText(line.ComponentRequestSkuKey);
        if (requestKey != null && localByRequestKey.TryGetValue(requestKey, out var localByKey))
            return localByKey;

        var skuCode = NormalizeText(line.ComponentSkuCode);
        if (skuCode != null && localBySku.TryGetValue(skuCode, out var localByCode))
            return localByCode;

        if (line.ComponentVariantId.HasValue && line.ComponentVariantId.Value != Guid.Empty)
        {
            var localById = localBySku.Values.FirstOrDefault(v => v.Id == line.ComponentVariantId.Value);
            if (localById != null) return localById;

            return (await _productRepository.GetVariantsByIdsAsync([line.ComponentVariantId.Value]))
                .FirstOrDefault();
        }

        if (skuCode != null)
            return (await _productRepository.GetVariantsBySkuCodesAsync([skuCode])).FirstOrDefault()
                ?? throw new ProductValidationException($"Khong tim thay component SKU {skuCode}.");

        return null;
    }

    private async Task EnsureNoBomCyclesAsync(Dictionary<Guid, List<Guid>> pendingEdges)
    {
        if (pendingEdges.Count == 0) return;

        var graph = (await _productRepository.GetActiveBomEdgesAsync())
            .GroupBy(edge => edge.ProductVariantId)
            .ToDictionary(
                group => group.Key,
                group => group.Select(edge => edge.ComponentVariantId).Distinct().ToList());

        foreach (var edge in pendingEdges)
            graph[edge.Key] = edge.Value.Distinct().ToList();

        foreach (var outputVariantId in pendingEdges.Keys)
        {
            foreach (var componentVariantId in graph.GetValueOrDefault(outputVariantId) ?? [])
            {
                if (HasBomPathTo(componentVariantId, outputVariantId, graph, []))
                    throw new ProductValidationException("BOM khong duoc tao vong lap giua cac SKU thanh pham.");
            }
        }
    }

    private static bool HasBomPathTo(
        Guid current,
        Guid target,
        Dictionary<Guid, List<Guid>> graph,
        HashSet<Guid> visited)
    {
        if (current == target) return true;
        if (!visited.Add(current)) return false;
        if (!graph.TryGetValue(current, out var nextNodes)) return false;
        return nextNodes.Any(next => HasBomPathTo(next, target, graph, visited));
    }

    private static ProductVariant? InferSingleActiveVariant(Product material)
    {
        var activeVariants = material.Variants
            .Where(variant => !variant.IsDeleted && variant.IsActive)
            .ToList();
        return activeVariants.Count == 1 ? activeVariants[0] : null;
    }

    private static void EnsureAllowedBomComponentType(ProductType productType, string componentLabel)
    {
        if (productType is ProductType.THANH_PHAM or ProductType.NGUYEN_LIEU or ProductType.BAO_BI)
            return;

        throw new ProductValidationException($"SKU component {componentLabel} khong hop le cho BOM.");
    }

    private static void EnsureAllowedLegacyBomComponentType(Product material)
    {
        if (material.ProductType is ProductType.NGUYEN_LIEU or ProductType.BAO_BI)
            return;

        throw new ProductValidationException(
            $"Product component {material.Name} phai chon SKU cu the khi dung trong BOM.");
    }

    private static string GetBomLineDedupKey(BomLineRequest line)
    {
        if (line.ComponentVariantId.HasValue && line.ComponentVariantId.Value != Guid.Empty)
            return $"variant:{line.ComponentVariantId.Value}";

        var componentSkuCode = NormalizeText(line.ComponentSkuCode);
        if (componentSkuCode != null)
            return $"sku:{componentSkuCode}";

        var componentRequestSkuKey = NormalizeText(line.ComponentRequestSkuKey);
        if (componentRequestSkuKey != null)
            return $"request:{componentRequestSkuKey}";

        return $"material:{line.MaterialId}";
    }

    private static void ValidatePositiveIntegerBomQuantity(decimal quantity)
    {
        if (quantity <= 0 || !BomUnitRules.IsIntegerQuantity(quantity))
            throw new ProductValidationException("Định mức phải là số nguyên dương.");
    }

    private static string ResolveVariantUnitName(ValidatedProductVariantInput input)
    {
        var unitName = NormalizeText(input.UnitName)
            ?? NormalizeText(input.Units.FirstOrDefault(unit => unit.IsBaseUnit)?.UnitName)
            ?? NormalizeText(input.Units.FirstOrDefault()?.UnitName)
            ?? NormalizeText(input.VariantName)
            ?? "unit";

        return unitName.Length > 100 ? unitName[..100] : unitName;
    }

    private static List<ProductUnit> BuildVariantUnits(
        Guid productId,
        Guid variantId,
        string unitName,
        ValidatedProductVariantInput input)
    {
        var source = input.Units
            .FirstOrDefault(unit => string.Equals(unit.UnitName, unitName, StringComparison.OrdinalIgnoreCase))
            ?? input.Units.FirstOrDefault(unit => unit.IsDirectSell)
            ?? input.Units.FirstOrDefault();

        return
        [
            new ProductUnit
            {
                Id = Guid.NewGuid(),
                ProductId = productId,
                VariantId = variantId,
                UnitName = unitName,
                ConversionRate = 1,
                Price = source?.Price ?? (input.RetailPrice > 0 ? input.RetailPrice : null),
                Barcode = source?.Barcode ?? input.Barcode,
                IsDirectSell = source?.IsDirectSell ?? input.IsSellable,
                IsBaseUnit = true
            }
        ];
    }

    private static string? NormalizeText(string? value)
    {
        var text = value?.Trim();
        return string.IsNullOrWhiteSpace(text) ? null : text;
    }

    private async Task<string> GenerateUniqueVariantSkuAsync(string productName, string variantName, HashSet<string>? usedInBatch = null)
    {
        // variantName already contains product name (built on frontend as "productName - unitName - attrs")
        // so use variantName alone to avoid doubling the product name in the prefix
        var skuSource = variantName.StartsWith(productName, StringComparison.OrdinalIgnoreCase)
            ? variantName
            : $"{productName} {variantName}";
        var prefix = BuildSkuPrefix(skuSource);
        for (var i = 1; i <= 999; i++)
        {
            var candidate = $"{prefix}-{i:000}";
            if ((usedInBatch == null || !usedInBatch.Contains(candidate))
                && !await _productRepository.ExistsVariantSkuCodeAsync(candidate))
                return candidate;
        }

        throw new ProductValidationException("Không thể tự sinh SKU biến thể duy nhất. Vui lòng nhập SKU thủ công.");
    }

    private static string BuildSkuPrefix(string value)
    {
        var normalized = value.Normalize(NormalizationForm.FormD);
        var chars = normalized
            .Where(c => CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark)
            .Select(c => char.IsLetterOrDigit(c) ? char.ToUpperInvariant(c) : '-')
            .ToArray();
        var prefix = string.Join('-', new string(chars).Split('-', StringSplitOptions.RemoveEmptyEntries));
        return prefix.Length switch
        {
            0 => "SKU",
            > 20 => prefix[..20].Trim('-'),
            _ => prefix
        };
    }

    private static List<ValidatedProductVariantInput> MergeVariants(
        List<ValidatedProductVariantInput> explicitVariants,
        List<ValidatedProductVariantInput> generatedVariants)
    {
        explicitVariants.AddRange(generatedVariants);
        return explicitVariants;
    }

    private static ProductImage MapImage(ValidatedProductImageInput input) => new()
    {
        ImageUrl = input.ImageUrl,
        AltText = input.AltText,
        SortOrder = input.SortOrder,
        IsThumbnail = input.IsThumbnail
    };

    private static ProductUnit MapUnit(ValidatedProductUnitInput input) => new()
    {
        VariantId = input.VariantId,
        UnitName = input.UnitName,
        ConversionRate = input.ConversionRate,
        Price = input.Price,
        Barcode = input.Barcode,
        IsDirectSell = input.IsDirectSell,
        IsBaseUnit = input.IsBaseUnit
    };

    private static IEnumerable<ProductAttributeValue> MapAttributeValues(List<ProductAttributeValueRequest>? attributes) =>
        (attributes ?? [])
            .Select(attribute => new ProductAttributeValue
            {
                AttributeNameId = attribute.AttributeNameId,
                AttributeName = NormalizeText(attribute.AttributeName) ?? string.Empty,
                Value = NormalizeText(attribute.Value) ?? string.Empty
            })
            .Where(attribute => attribute.AttributeName.Length > 0 && attribute.Value.Length > 0);

    private static void Replace<T>(ICollection<T> target, IEnumerable<T> values)
    {
        target.Clear();
        foreach (var value in values)
            target.Add(value);
    }

    private static ProductResponse MapToResponse(Product p, CatalogViewScope scope) => new(
        p.Id, p.CategoryId, p.Category?.Name ?? string.Empty,
        p.Name, p.Origin, p.FlavorProfile, p.BrewingGuide, p.Description,
        p.BaseUnit, p.InventoryUnit.ToString(), p.WeightValue, p.WeightUnit, p.IsVariantParent,
        p.IsActive, p.IsDeleted, p.CreatedAt, p.SyncedToStoreAt,
        p.ProductType.ToString(),
        new List<ProductSkuResponse>(),
        p.Images.Where(i => !i.IsDeleted).OrderBy(i => i.SortOrder).Select(MapImageResponse).ToList(),
        p.Units.Where(u => !u.IsDeleted).Select(MapUnitResponse).ToList(),
        p.Variants.Where(v => !v.IsDeleted).Select(MapVariantResponse).ToList(),
        p.AttributeValues.Where(v => !v.IsDeleted).OrderBy(v => v.AttributeName).Select(MapAttributeValueResponse).ToList());

    private static ProductImageResponse MapImageResponse(ProductImage i) => new(
        i.Id, i.ProductId, i.ImageUrl, i.AltText, i.SortOrder, i.IsThumbnail);

    private static ProductAttributeValueResponse MapAttributeValueResponse(ProductAttributeValue v) => new(
        v.Id, v.ProductId, v.AttributeNameId, v.AttributeName, v.Value);

    private static ProductUnitResponse MapUnitResponse(ProductUnit u) => new(
        u.Id, u.ProductId, u.VariantId, u.UnitName, u.ConversionRate,
        u.Price, u.Barcode, u.IsDirectSell, u.IsBaseUnit);

    private static BomLineResponse MapBomLineResponse(ProductVariantBomLine b) => new(
        b.MaterialId,
        b.Material?.Name ?? string.Empty,
        ResolveMaterialUnit(b.Material),
        b.Quantity,
        b.ComponentVariantId,
        b.ComponentVariant?.SkuCode,
        b.ComponentVariant?.VariantName,
        b.IsRequiredBaseComponent);

    private static List<BomLineRequest> NormalizeBomQuantities(List<BomLineRequest> lines, List<Product> materials)
    {
        var materialById = materials.ToDictionary(material => material.Id);
        var errors = new List<string>();
        var result = new List<BomLineRequest>();

        foreach (var line in lines)
        {
            var material = materialById[line.MaterialId];
            if (line.Quantity <= 0 || !BomUnitRules.IsIntegerQuantity(line.Quantity))
            {
                errors.Add("Định mức phải là số nguyên dương.");
                continue;
            }
            var unit = ResolveMaterialUnit(material);
            var unitLabel = string.IsNullOrWhiteSpace(unit) ? "đơn vị" : unit.Trim();

            try
            {
                var normalized = InventoryUnitConverter.NormalizeQuantity(
                    line.Quantity,
                    material.InventoryUnit,
                    unit);
                result.Add(new BomLineRequest(line.MaterialId, normalized));
            }
            catch (ProductValidationException ex)
            {
                errors.AddRange(ex.Errors.Select(error => $"{material.Name} ({unitLabel}): {error}"));
            }
        }

        if (errors.Count > 0)
            throw new ProductValidationException(errors.Distinct());

        return result;
    }

    private static string ResolveMaterialUnit(Product? material)
    {
        if (material is null) return string.Empty;

        return InventoryUnitConverter.GetDisplayUnit(material.InventoryUnit);
    }

    private static ProductVariantResponse MapVariantResponse(ProductVariant v)
    {
        var activeBomLines = v.BomLines.Where(b => !b.IsDeleted).ToList();

        return new ProductVariantResponse(
            v.Id, v.ProductId, v.SkuCode, v.Barcode, v.VariantName,
            v.OptionValuesJson, v.CostPrice, v.RetailPrice, v.MinStock, v.MaxStock,
            v.IsSellable, v.AllowRewardPoints, v.IsActive, v.ImageUrl,
            v.UnitName,
            v.ConversionRate,
            v.BaseVariantId,
            v.IsBaseUnitVariant,
            v.IsAutoGeneratedSku,
            activeBomLines.Count > 0,
            activeBomLines.Count,
            v.Units.Where(u => !u.IsDeleted).Select(MapUnitResponse).ToList(),
            activeBomLines.Select(MapBomLineResponse).ToList(),
            v.IsPurchasable);
    }

    private static ProductType? ParseProductTypeFilter(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        return Enum.TryParse<ProductType>(value, ignoreCase: true, out var result)
            ? result
            : null;
    }

    private static ProductType ParseProductType(string? value) =>
        ParseProductTypeFilter(value) ?? ProductType.THANH_PHAM;
}
