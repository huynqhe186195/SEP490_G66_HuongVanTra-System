using System.Globalization;
using System.Text;
using ProductService.Application;
using ProductService.Application.DTOs.Requests;
using ProductService.Application.DTOs.Responses;
using ProductService.Application.Interfaces;
using ProductService.Application.Validation;
using ProductService.Domain.Entities;
using ProductService.Domain.Exceptions;

namespace ProductService.Application.UseCases;

public class PriceBookLogic(IPriceBookRepository _priceBookRepository)
{
    public async Task<PagedResponse<PriceBookResponse>> GetPagedAsync(GetPriceBooksRequest request)
    {
        if (request is null)
            throw new ProductValidationException("Request là bắt buộc.");

        ProductInputValidator.ValidatePagination(request.Page, request.PageSize);
        var (items, total) = await _priceBookRepository.GetPagedAsync(
            request.Search, request.IsActive, request.Page, request.PageSize);

        return new PagedResponse<PriceBookResponse>(
            items.Select(MapToResponse).ToList(),
            request.Page,
            request.PageSize,
            total,
            (int)Math.Ceiling((double)total / request.PageSize));
    }

    public async Task<PriceBookResponse> GetByIdAsync(Guid id)
    {
        var priceBook = await _priceBookRepository.GetByIdAsync(id)
            ?? throw new ProductValidationException($"Bảng giá '{id}' không tồn tại.");
        return MapToResponse(priceBook);
    }

    public async Task<PriceBookResponse> CreateAsync(CreatePriceBookRequest request)
    {
        if (request is null)
            throw new ProductValidationException("Request body là bắt buộc.");

        var input = ValidatePriceBook(request.Code, request.Name, request.Description,
            request.IsActive, request.StartsAt, request.EndsAt, request.Entries);

        if (await _priceBookRepository.ExistsCodeAsync(input.Code))
            throw new ProductValidationException($"Mã bảng giá '{input.Code}' đã tồn tại.");

        var priceBook = new PriceBook
        {
            Code = input.Code,
            Name = input.Name,
            Description = input.Description,
            IsActive = input.IsActive,
            StartsAt = input.StartsAt,
            EndsAt = input.EndsAt,
            Entries = input.Entries.Select(MapEntry).ToList()
        };

        var created = await _priceBookRepository.CreateAsync(priceBook);
        return MapToResponse(created);
    }

    public async Task<PriceBookResponse> UpdateAsync(Guid id, UpdatePriceBookRequest request)
    {
        if (request is null)
            throw new ProductValidationException("Request body là bắt buộc.");

        var priceBook = await _priceBookRepository.GetByIdAsync(id)
            ?? throw new ProductValidationException($"Bảng giá '{id}' không tồn tại.");

        var input = ValidatePriceBook(request.Code, request.Name, request.Description,
            request.IsActive, request.StartsAt, request.EndsAt, request.Entries);

        if (await _priceBookRepository.ExistsCodeAsync(input.Code, id))
            throw new ProductValidationException($"Mã bảng giá '{input.Code}' đã tồn tại.");

        priceBook.Code = input.Code;
        priceBook.Name = input.Name;
        priceBook.Description = input.Description;
        priceBook.IsActive = input.IsActive;
        priceBook.StartsAt = input.StartsAt;
        priceBook.EndsAt = input.EndsAt;
        priceBook.UpdatedAt = DateTime.UtcNow;
        priceBook.Entries.Clear();
        foreach (var entry in input.Entries.Select(MapEntry))
            priceBook.Entries.Add(entry);

        var updated = await _priceBookRepository.UpdateAsync(priceBook);
        return MapToResponse(updated);
    }

    public async Task DeleteAsync(Guid id)
    {
        var priceBook = await _priceBookRepository.GetByIdAsync(id)
            ?? throw new ProductValidationException($"Bảng giá '{id}' không tồn tại.");
        await _priceBookRepository.DeleteAsync(priceBook);
    }

    private static ValidatedPriceBookInput ValidatePriceBook(
        string? codeValue,
        string? nameValue,
        string? descriptionValue,
        bool isActive,
        DateTime? startsAt,
        DateTime? endsAt,
        List<PriceBookEntryRequest>? entriesValue)
    {
        var errors = new List<string>();
        var name = nameValue?.Trim();
        if (string.IsNullOrWhiteSpace(name))
            errors.Add("Tên bảng giá là bắt buộc.");
        else if (name.Length > 255)
            errors.Add("Tên bảng giá tối đa 255 ký tự.");

        var code = string.IsNullOrWhiteSpace(codeValue)
            ? BuildCode(name ?? "PRICEBOOK")
            : codeValue.Trim().ToUpperInvariant();
        if (code.Length > 50)
            errors.Add("Mã bảng giá tối đa 50 ký tự.");

        var description = descriptionValue?.Trim();
        if (string.IsNullOrWhiteSpace(description)) description = null;

        if (startsAt.HasValue && endsAt.HasValue && endsAt.Value < startsAt.Value)
            errors.Add("Ngày kết thúc phải sau ngày bắt đầu.");

        var entries = new List<ValidatedPriceBookEntryInput>();
        var keys = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var entry in entriesValue ?? [])
        {
            var targetCount = new[] { entry.VariantId, entry.UnitId }.Count(v => v.HasValue && v.Value != Guid.Empty);
            if (targetCount != 1)
                errors.Add("Mỗi dòng bảng giá phải chọn đúng một biến thể hoặc đơn vị tính.");
            if (entry.Price <= 0)
                errors.Add("Giá trong bảng giá phải lớn hơn 0.");
            if (decimal.Round(entry.Price, 2) != entry.Price)
                errors.Add("Giá trong bảng giá chỉ được có tối đa 2 chữ số thập phân.");
            if (entry.StartsAt.HasValue && entry.EndsAt.HasValue && entry.EndsAt.Value < entry.StartsAt.Value)
                errors.Add("Ngày kết thúc dòng bảng giá phải sau ngày bắt đầu.");

            var key = $"{entry.VariantId}:{entry.UnitId}";
            if (!keys.Add(key))
                errors.Add("Dòng bảng giá bị trùng đối tượng áp dụng.");

            entries.Add(new ValidatedPriceBookEntryInput(
                entry.VariantId, entry.UnitId,
                entry.Price, entry.IsActive, entry.StartsAt, entry.EndsAt));
        }

        if (errors.Count > 0) throw new ProductValidationException(errors);
        return new ValidatedPriceBookInput(code, name!, description, isActive, startsAt, endsAt, entries);
    }

    private static PriceBookEntry MapEntry(ValidatedPriceBookEntryInput input) => new()
    {
        VariantId = input.VariantId,
        UnitId = input.UnitId,
        Price = input.Price,
        IsActive = input.IsActive,
        StartsAt = input.StartsAt,
        EndsAt = input.EndsAt
    };

    private static PriceBookResponse MapToResponse(PriceBook p) => new(
        p.Id, p.Code, p.Name, p.Description, p.IsActive, p.StartsAt, p.EndsAt, p.CreatedAt,
        p.Entries.Where(e => !e.IsDeleted).Select(MapEntryResponse).ToList());

    private static PriceBookEntryResponse MapEntryResponse(PriceBookEntry e) => new(
        e.Id, e.PriceBookId, e.VariantId, e.UnitId,
        e.Price, e.IsActive, e.StartsAt, e.EndsAt);

    private static string BuildCode(string value)
    {
        var normalized = value.Normalize(NormalizationForm.FormD);
        var chars = normalized
            .Where(c => CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark)
            .Select(c => char.IsLetterOrDigit(c) ? char.ToUpperInvariant(c) : '-')
            .ToArray();
        var code = string.Join('-', new string(chars).Split('-', StringSplitOptions.RemoveEmptyEntries));
        return code.Length switch
        {
            0 => "PRICEBOOK",
            > 40 => code[..40].Trim('-'),
            _ => code
        };
    }
}

public record ValidatedPriceBookInput(
    string Code,
    string Name,
    string? Description,
    bool IsActive,
    DateTime? StartsAt,
    DateTime? EndsAt,
    List<ValidatedPriceBookEntryInput> Entries);

public record ValidatedPriceBookEntryInput(
    Guid? VariantId,
    Guid? UnitId,
    decimal Price,
    bool IsActive,
    DateTime? StartsAt,
    DateTime? EndsAt);
