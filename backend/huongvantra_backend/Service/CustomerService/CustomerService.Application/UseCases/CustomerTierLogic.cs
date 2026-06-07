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

    public async Task<IEnumerable<CustomerTierResponse>> GetAllAsync(CancellationToken ct = default)
    {
        var tiers = await _tierRepo.GetAllAsync(ct);
        return tiers.Select(t => new CustomerTierResponse(
            t.Id, t.TierName, t.MinSpendingThreshold, t.DiscountPercent, t.ValidityMonths));
    }

    public async Task<CustomerTierResponse> CreateAsync(CreateCustomerTierRequest request, CancellationToken ct = default)
    {
        var tier = new CustomerTier
        {
            TierName = request.TierName,
            MinSpendingThreshold = request.MinSpendingThreshold,
            DiscountPercent = request.DiscountPercent,
            ValidityMonths = request.ValidityMonths,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        await _tierRepo.AddAsync(tier, ct);
        await _tierRepo.SaveChangesAsync(ct);
        return new CustomerTierResponse(tier.Id, tier.TierName, tier.MinSpendingThreshold, tier.DiscountPercent, tier.ValidityMonths);
    }

    public async Task<CustomerTierResponse?> UpdateAsync(int id, UpdateCustomerTierRequest request, CancellationToken ct = default)
    {
        var tier = await _tierRepo.GetByIdAsync(id, ct);
        if (tier == null) return null;

        tier.TierName = request.TierName;
        tier.MinSpendingThreshold = request.MinSpendingThreshold;
        tier.DiscountPercent = request.DiscountPercent;
        tier.ValidityMonths = request.ValidityMonths;
        tier.UpdatedAt = DateTime.UtcNow;

        _tierRepo.Update(tier);
        await _tierRepo.SaveChangesAsync(ct);
        return new CustomerTierResponse(tier.Id, tier.TierName, tier.MinSpendingThreshold, tier.DiscountPercent, tier.ValidityMonths);
    }
}
