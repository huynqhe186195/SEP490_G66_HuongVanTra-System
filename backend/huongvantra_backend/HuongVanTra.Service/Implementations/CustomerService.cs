using HuongVanTra.Core.Entities.Customers;
using HuongVanTra.Core.Entities.System;
using HuongVanTra.Core.Interfaces;
using HuongVanTra.Service.DTO.Customers;
using HuongVanTra.Service.Interfaces;
using System.Text.Json;

namespace HuongVanTra.Service.Implementations {
    public class CustomerService : ICustomerService {
        private readonly IUnitOfWork _unitOfWork;

        public CustomerService(IUnitOfWork unitOfWork) {
            _unitOfWork = unitOfWork;
        }

        // get: get membership tiers
        public async Task<List<MembershipTierResponseDto>> GetMembershipTiersAsync() {
            var tiers = await _unitOfWork.Repository<MembershipTier>().GetAllAsync();

            return tiers.Select(t => new MembershipTierResponseDto {
                Id = t.Id,
                TierCode = t.TierCode,
                MinTotalSpend = t.MinTotalSpend,
                DiscountPercent = t.DiscountPercent
            }).ToList();
        }

        // put: upgrade membership tier manually
        public async Task<bool> UpgradeTierManuallyAsync(UpgradeTierRequestDto dto) {
            await _unitOfWork.BeginTransactionAsync();
            try {
                var customerRepo = _unitOfWork.Repository<Customer>();
                var tierRepo = _unitOfWork.Repository<MembershipTier>();
                var auditRepo = _unitOfWork.Repository<AuditLog>();

                var customer = await customerRepo.GetByIdAsync(dto.CustomerId);
                if (customer == null)
                    throw new Exception("Không tìm thấy khách hàng.");

                var newTier = await tierRepo.GetByIdAsync(dto.NewTierId);
                if (newTier == null)
                    throw new Exception("Hạng thẻ không tồn tại.");

                var oldTierId = customer.TierId;

                customer.TierId = dto.NewTierId;
                customerRepo.Update(customer);

                var auditLog = new AuditLog {
                    UserId = dto.UpdatedByEmpId,
                    Action = "MANUAL_UPGRADE_TIER",
                    EntityType = "Customer",
                    EntityId = customer.Id,
                    OldValues = JsonSerializer.Serialize(new { TierId = oldTierId }),
                    NewValues = JsonSerializer.Serialize(new { TierId = dto.NewTierId }),
                    Status = "SUCCESS",
                    CreatedAt = DateTime.UtcNow.AddHours(7) // shift to UTC/GMT +7
                };
                await auditRepo.AddAsync(auditLog);

                await _unitOfWork.CommitTransactionAsync();
                return true;
            }
            catch (Exception) {
                await _unitOfWork.RollbackTransactionAsync();
                throw;
            }
        }
    }
}