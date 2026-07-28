using Moq;
using OrderService.Application.Authorization;
using OrderService.Application.Interfaces;
using OrderService.Application.UseCases;

namespace OrderService.Application.Tests.TestSupport;

/// <summary>
/// Test doubles cho ca quầy/ca quỹ POS: mặc định luôn "đang trong ca" và không có ca quỹ mở,
/// để các test nghiệp vụ đơn hàng không bị chặn bởi gate ca làm việc.
/// </summary>
public static class PosShiftTestDoubles
{
    public static IShiftCatalogClient OnDutyShiftClient()
    {
        var shifts = new Mock<IShiftCatalogClient>();
        shifts
            .Setup(client => client.GetMyOnDutyAsync(
                It.IsAny<string?>(),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(new OnDutyShiftInfo(
                Guid.NewGuid(),
                Guid.NewGuid(),
                "Ca quầy test",
                StaffShiftGuard.ShelfArea,
                "2026-07-25",
                "08:00",
                "17:00",
                "Ca quầy test 08:00-17:00"));
        return shifts.Object;
    }

    public static StaffShiftGuard ShiftGuard() => new(OnDutyShiftClient());

    public static PosCashSessionLogic CashSessionLogic(StaffShiftGuard guard)
    {
        var shifts = OnDutyShiftClient();
        return new PosCashSessionLogic(
            new Mock<IPosCashSessionRepository>().Object,
            shifts,
            guard);
    }
}
