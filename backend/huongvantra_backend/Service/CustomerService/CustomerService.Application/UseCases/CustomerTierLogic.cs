using CustomerService.Application.DTOs.Requests;
using CustomerService.Application.DTOs.Responses;
using CustomerService.Application.Interfaces;
using CustomerService.Domain.Entities;

namespace CustomerService.Application.UseCases;

public class CustomerTierLogic
{
    private readonly ICustomerTierRepository _tierRepo;

    public CustomerTierLogic(ICustomerTierRepository tierRepo)
    {
        _tierRepo = tierRepo;
    }

    public async Task<IEnumerable<CustomerTierResponse>> GetAllAsync(
        bool includeInactive = false,
        CancellationToken ct = default)
    {
        var tiers = includeInactive
            ? await _tierRepo.GetAllIncludingInactiveAsync(ct)
            : await _tierRepo.GetAllAsync(ct);

        var customerCounts = includeInactive
            ? await _tierRepo.GetCustomerCountsByTierAsync(ct)
            : new Dictionary<int, int>();

        return tiers.Select(t => MapResponse(t, customerCounts));
    }

    public async Task<CustomerTierResponse> CreateAsync(CreateCustomerTierRequest request, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.TierName))
            throw new ArgumentException("Tên hạng thành viên là bắt buộc.");
        if (request.MinSpendingThreshold < 0)
            throw new ArgumentException("Ngưỡng chi tiêu tối thiểu không được âm.");
        if (request.DiscountPercent is < 0 or > 100)
            throw new ArgumentException("Phần trăm giảm giá phải trong khoảng 0–100.");

        var tier = new CustomerTier
        {
            TierName = request.TierName.Trim(),
            MinSpendingThreshold = request.MinSpendingThreshold,
            DiscountPercent = request.DiscountPercent,
            ValidityMonths = request.ValidityMonths,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        await _tierRepo.AddAsync(tier, ct);
        await _tierRepo.SaveChangesAsync(ct);
        return MapResponse(tier);
    }

    public async Task<CustomerTierResponse?> UpdateAsync(int id, UpdateCustomerTierRequest request, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.TierName))
            throw new ArgumentException("Tên hạng thành viên là bắt buộc.");
        if (request.MinSpendingThreshold < 0)
            throw new ArgumentException("Ngưỡng chi tiêu tối thiểu không được âm.");
        if (request.DiscountPercent is < 0 or > 100)
            throw new ArgumentException("Phần trăm giảm giá phải trong khoảng 0–100.");

        var tier = await _tierRepo.GetByIdIncludingInactiveAsync(id, ct);
        if (tier == null) return null;

        tier.TierName = request.TierName.Trim();
        tier.MinSpendingThreshold = request.MinSpendingThreshold;
        tier.DiscountPercent = request.DiscountPercent;
        tier.ValidityMonths = request.ValidityMonths;
        tier.UpdatedAt = DateTime.UtcNow;

        _tierRepo.Update(tier);
        await _tierRepo.SaveChangesAsync(ct);
        return MapResponse(tier);
    }

    public async Task<CustomerTierResponse?> DeactivateAsync(int id, CancellationToken ct = default)
    {
        var tier = await _tierRepo.GetByIdAsync(id, ct);
        if (tier == null) return null;

        tier.IsDeleted = true;
        tier.UpdatedAt = DateTime.UtcNow;
        _tierRepo.Update(tier);
        await _tierRepo.SaveChangesAsync(ct);
        return MapResponse(tier);
    }

    public async Task<CustomerTierResponse?> ReactivateAsync(int id, CancellationToken ct = default)
    {
        var tier = await _tierRepo.GetByIdIncludingInactiveAsync(id, ct);
        if (tier == null) return null;

        tier.IsDeleted = false;
        tier.UpdatedAt = DateTime.UtcNow;
        _tierRepo.Update(tier);
        await _tierRepo.SaveChangesAsync(ct);

        var customerCounts = await _tierRepo.GetCustomerCountsByTierAsync(ct);
        return MapResponse(tier, customerCounts);
    }

    private static CustomerTierResponse MapResponse(
        CustomerTier tier,
        IReadOnlyDictionary<int, int>? customerCounts = null) =>
        new(
            tier.Id,
            tier.TierName,
            tier.MinSpendingThreshold,
            tier.DiscountPercent,
            tier.ValidityMonths,
            !tier.IsDeleted,
            customerCounts != null && customerCounts.TryGetValue(tier.Id, out var count) ? count : 0);
}
