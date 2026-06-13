using OrderService.Application.Interfaces;
using OrderService.Domain.Entities;
using OrderService.Domain.Enums;

namespace OrderService.Application.UseCases;

public class CodReminderLogic(
    IPaymentRepository paymentRepo,
    IOrderActivityRepository activityRepo)
{
    public async Task<int> ProcessDueRemindersAsync(CancellationToken ct = default)
    {
        var duePayments = await paymentRepo.GetPendingCodAsync(ct);
        if (duePayments.Count == 0)
            return 0;

        var now = DateTime.UtcNow;
        var processed = 0;

        foreach (var payment in duePayments)
        {
            payment.CodWarningDate = now.AddDays(7);
            payment.UpdatedAt = now;

            var orderCode = payment.Order?.OrderCode ?? "—";
            await activityRepo.AddAsync(new OrderActivity
            {
                Id = Guid.NewGuid(),
                OrderId = payment.OrderId,
                ActivityType = OrderActivityType.CodReminder,
                Description = $"Nhắc thu COD định kỳ — gia hạn thêm 7 ngày (đơn {orderCode}).",
                CreatedAt = now
            }, ct);

            processed++;
        }

        await paymentRepo.SaveChangesAsync(ct);
        return processed;
    }
}
