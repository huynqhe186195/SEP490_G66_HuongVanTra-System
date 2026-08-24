using Moq;
using OrderService.Application.Interfaces;
using OrderService.Application.UseCases;
using OrderService.Domain.Entities;
using OrderService.Domain.Enums;
using Xunit;

namespace OrderService.Application.Tests;

public class CodReminderLogicTests
{
    [Fact]
    public async Task ProcessDueReminders_SchedulesNextReminderSevenDaysLater_AndWritesOneActivity()
    {
        var payment = new Payment
        {
            Id = Guid.NewGuid(),
            OrderId = Guid.NewGuid(),
            PaymentMethod = PaymentMethod.COD,
            PaymentStatus = PaymentStatus.Pending,
            IsCodVerified = false,
            CodWarningDate = DateTime.UtcNow.AddMinutes(-1),
            Order = new Order { Id = Guid.NewGuid(), OrderCode = "HVT-260825-001" },
        };
        var paymentRepo = new Mock<IPaymentRepository>();
        var activityRepo = new Mock<IOrderActivityRepository>();
        paymentRepo.Setup(x => x.GetPendingCodAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync([payment]);

        var result = await new CodReminderLogic(paymentRepo.Object, activityRepo.Object)
            .ProcessDueRemindersAsync();

        Assert.Equal(1, result);
        Assert.InRange(payment.CodWarningDate!.Value, DateTime.UtcNow.AddDays(6).AddMinutes(59), DateTime.UtcNow.AddDays(7).AddMinutes(1));
        paymentRepo.Verify(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
        activityRepo.Verify(x => x.AddAsync(
            It.Is<OrderActivity>(a => a.OrderId == payment.OrderId
                && a.ActivityType == OrderActivityType.CodReminder),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task ProcessDueReminders_DoesNothingWhenRepositoryHasNoEligiblePendingCodPayment()
    {
        var paymentRepo = new Mock<IPaymentRepository>();
        var activityRepo = new Mock<IOrderActivityRepository>();
        paymentRepo.Setup(x => x.GetPendingCodAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync([]);

        var result = await new CodReminderLogic(paymentRepo.Object, activityRepo.Object)
            .ProcessDueRemindersAsync();

        Assert.Equal(0, result);
        paymentRepo.Verify(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
        activityRepo.Verify(x => x.AddAsync(It.IsAny<OrderActivity>(), It.IsAny<CancellationToken>()), Times.Never);
    }
}
