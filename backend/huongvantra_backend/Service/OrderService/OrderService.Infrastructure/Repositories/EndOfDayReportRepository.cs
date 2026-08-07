using System.Linq.Expressions;
using Microsoft.EntityFrameworkCore;
using OrderService.Application.DTOs.Requests;
using OrderService.Application.DTOs.Responses;
using OrderService.Application.Interfaces;
using OrderService.Domain.Entities;
using OrderService.Domain.Enums;
using OrderService.Infrastructure.Data;

namespace OrderService.Infrastructure.Repositories;

/// <summary>
/// Truy vấn Báo cáo cuối ngày. Ba nguyên tắc chi phối toàn bộ file này:
/// <list type="number">
/// <item>Doanh thu ghi nhận lấy theo đơn hoàn tất trong kỳ, mốc là <c>CompletedAt</c>
/// (lùi về <c>CreatedAt</c> với đơn cũ chưa có cột này). Không lấy tổng Payment làm doanh thu.</item>
/// <item>Tiền thu vào lấy theo <c>Payments.PaidAt</c>. Một đơn có thể có nhiều lần thu ở nhiều ngày.</item>
/// <item>Số lượng không bao giờ cộng chung Gram với Piece — luôn tách theo <c>UnitSnapshot</c>.</item>
/// </list>
/// </summary>
public class EndOfDayReportRepository(OrderDbContext dbContext) : IEndOfDayReportRepository
{
    private const int VietnamOffsetHours = 7;
    private const int MaxPageSize = 200;

    /// <summary>Trần số dòng chi tiết trả kèm khối ngoại lệ; các con số đếm/tổng vẫn tính đủ toàn kỳ.</summary>
    private const int MaxDetailRows = 50;

    /// <summary>Dùng chung cho tab Thanh toán và khối Ngoại lệ để hai nơi không lệch định nghĩa.</summary>
    private static readonly Expression<Func<Payment, CashReceiptDto>> ReceiptProjection = p => new CashReceiptDto
    {
        OrderId = p.OrderId,
        OrderCode = p.Order.OrderCode,
        PaidAt = p.PaidAt!.Value,
        OrderCreatedAt = p.Order.CreatedAt,
        PaymentMethod = p.PaymentMethod.ToString(),
        PaymentPurpose = p.PaymentPurpose.ToString(),
        Amount = p.Amount,
        EmployeeName = p.Order.EmployeeSnapshotName,
        CustomerName = p.Order.CustomerSnapshotName,
        OrderStatus = p.Order.OrderStatus.ToString()
    };

    /// <summary>Đơn tạo trong kỳ nhưng chưa chốt được doanh thu — tiền có thể đã vào két.</summary>
    private static readonly OrderStatus[] OpenStatuses =
    [
        OrderStatus.WaitingMaterials,
        OrderStatus.WaitingProduction,
        OrderStatus.WaitingTransfer,
        OrderStatus.ReadyToDeliver,
        OrderStatus.Processing,
        OrderStatus.Shipping,
        OrderStatus.PendingPayment
    ];

    public async Task<EndOfDaySummaryResponse> GetSummaryAsync(
        EndOfDayReportFilter filter, CancellationToken ct = default)
    {
        var from = filter.FromUtc;
        var to = filter.ToUtc;
        var methodFilter = ExpandMethodFilter(filter.PaymentMethod);

        var receipts = await BuildPaymentQuery(filter, methodFilter)
            .Select(p => new
            {
                p.Amount,
                p.PaymentMethod,
                p.PaymentPurpose,
                PaidAt = p.PaidAt!.Value,
                OrderCreatedAt = p.Order.CreatedAt,
                OrderStatus = p.Order.OrderStatus
            })
            .ToListAsync(ct);

        var refunds = await BuildRefundQuery(filter, methodFilter)
            .Select(r => new { r.RefundAmount, r.RefundMethod })
            .ToListAsync(ct);

        var recognizedStatus = filter.OrderStatus ?? OrderStatus.Completed;
        var completed = await BuildRecognizedOrderQuery(filter, methodFilter)
            .Select(o => new
            {
                o.Id,
                o.EmployeeId,
                o.EmployeeSnapshotName,
                o.OrderChannel,
                o.PickupDate,
                o.ShippingAddress,
                o.TotalAmount,
                o.DiscountAmount,
                o.FinalAmount,
                RecognizedAt = o.CompletedAt ?? o.CreatedAt,
                PaidAmount = o.Payments
                    .Where(p => p.PaymentStatus == PaymentStatus.Success)
                    .Sum(p => (decimal?)p.Amount) ?? 0m,
                LineCount = o.OrderDetails.Count,
                SkuIds = o.OrderDetails.Select(d => d.SkuId).ToList()
            })
            .ToListAsync(ct);

        var forfeited = await BuildForfeitedQuery(filter, methodFilter)
            .Select(o => o.DepositAmount!.Value)
            .ToListAsync(ct);

        var totalIn = receipts.Sum(r => r.Amount);
        var totalOut = refunds.Sum(r => r.RefundAmount);
        var salesRevenue = completed.Sum(o => o.FinalAmount);
        var returnedRevenue = totalOut;

        var cashIn = Enum.GetValues<PaymentPurpose>()
            .Select(purpose =>
            {
                var lines = receipts.Where(r => r.PaymentPurpose == purpose).ToList();
                return new CashFlowLineDto
                {
                    Key = purpose.ToString(),
                    Label = PaymentPurposeLabel(purpose),
                    Amount = lines.Sum(l => l.Amount),
                    Count = lines.Count
                };
            })
            .Where(l => l.Count > 0)
            .ToList();

        var cashOut = refunds
            .GroupBy(r => r.RefundMethod)
            .Select(g => new CashFlowLineDto
            {
                Key = g.Key.ToString(),
                Label = PaymentMethodLabel(g.Key),
                Amount = g.Sum(r => r.RefundAmount),
                Count = g.Count()
            })
            .OrderBy(l => l.Key)
            .ToList();

        var byMethod = BuildMethodReconciliation(
            receipts.Select(r => (r.PaymentMethod, r.Amount)),
            refunds.Select(r => (r.RefundMethod, r.RefundAmount)));

        var openOrders = await BuildOpenOrderQuery(filter).CountAsync(ct);

        var statusRows = await BuildStatusScopeQuery(filter)
            .Select(o => new { o.OrderStatus, o.RefundStatus })
            .ToListAsync(ct);

        // Biểu đồ theo giờ hiển thị theo giờ Việt Nam; dữ liệu lưu ở UTC.
        var revenueByHour = completed
            .GroupBy(o => o.RecognizedAt.AddHours(VietnamOffsetHours).Hour)
            .ToDictionary(g => g.Key, g => (Revenue: g.Sum(o => o.FinalAmount), Count: g.Count()));

        var cashByHour = receipts
            .GroupBy(r => r.PaidAt.AddHours(VietnamOffsetHours).Hour)
            .ToDictionary(g => g.Key, g => g.Sum(r => r.Amount));

        var hourly = revenueByHour.Keys.Concat(cashByHour.Keys).Distinct().OrderBy(h => h)
            .Select(h => new HourlyRevenueLineDto
            {
                Hour = h,
                Revenue = revenueByHour.TryGetValue(h, out var r) ? r.Revenue : 0m,
                OrderCount = revenueByHour.TryGetValue(h, out var c) ? c.Count : 0,
                CashIn = cashByHour.TryGetValue(h, out var cash) ? cash : 0m
            })
            .ToList();

        var advanceOnOpenOrders = receipts
            .Where(r => r.OrderCreatedAt >= from
                        && r.OrderStatus != recognizedStatus
                        && r.OrderStatus != OrderStatus.Cancelled)
            .Sum(r => r.Amount);

        var netRecognized = salesRevenue - returnedRevenue;

        var gaps = new List<string>();
        var missingCompletedAt = completed.Count == 0
            ? 0
            : await BuildRecognizedOrderQuery(filter, methodFilter)
                .CountAsync(o => o.CompletedAt == null, ct);
        if (missingCompletedAt > 0)
            gaps.Add($"{missingCompletedAt} đơn hoàn tất chưa có mốc CompletedAt (tạo trước khi bổ sung cột); "
                     + "báo cáo tạm lấy CreatedAt làm kỳ ghi nhận.");

        return new EndOfDaySummaryResponse
        {
            FromUtc = from,
            ToUtc = to,
            SalesRevenue = salesRevenue,
            SalesDiscount = completed.Sum(o => o.DiscountAmount),
            ReturnedRevenue = returnedRevenue,
            NetRecognizedRevenue = netRecognized,
            CompletedOrders = completed.Count,
            TotalCashIn = totalIn,
            TotalCashOut = totalOut,
            NetCashFlow = totalIn - totalOut,
            CashOnHand = byMethod.Where(m => m.IsCash).Sum(m => m.Net),
            BankIn = byMethod.Where(m => !m.IsCash).Sum(m => m.AmountIn),
            ForfeitedDepositIncome = forfeited.Sum(),
            ForfeitedDepositOrders = forfeited.Count,
            TotalLineCount = completed.Sum(o => o.LineCount),
            DistinctSkuCount = completed.SelectMany(o => o.SkuIds).Distinct().Count(),
            CancelledOrders = statusRows.Count(o => o.OrderStatus == OrderStatus.Cancelled),
            RefundedOrders = statusRows.Count(o =>
                o.RefundStatus == BackorderRefundStatus.Approved
                || o.RefundStatus == BackorderRefundStatus.Completed),
            OpenOrders = openOrders,
            CashIn = cashIn,
            CashOut = cashOut,
            ByPaymentMethod = byMethod,
            HourlyRevenue = hourly,
            ByEmployee = completed
                .GroupBy(o => new { o.EmployeeId, Name = o.EmployeeSnapshotName })
                .Select(g => new EmployeeSalesLineDto
                {
                    EmployeeId = g.Key.EmployeeId,
                    EmployeeName = string.IsNullOrWhiteSpace(g.Key.Name) ? "Không xác định" : g.Key.Name!,
                    OrderCount = g.Count(),
                    Revenue = g.Sum(o => o.FinalAmount),
                    Discount = g.Sum(o => o.DiscountAmount),
                    CashCollected = g.Sum(o => o.PaidAmount)
                })
                .OrderByDescending(l => l.Revenue)
                .ToList(),
            ByChannel = completed
                .GroupBy(o => o.OrderChannel)
                .Select(g => new ChannelSalesLineDto
                {
                    Channel = g.Key.ToString(),
                    Label = OrderChannelLabel(g.Key),
                    OrderCount = g.Count(),
                    Revenue = g.Sum(o => o.FinalAmount)
                })
                .OrderByDescending(l => l.Revenue)
                .ToList(),
            BySalesMode = completed
                .GroupBy(o => DeriveSalesMode(o.PickupDate, o.OrderChannel, o.ShippingAddress))
                .Select(g => new SalesModeLineDto
                {
                    SalesMode = g.Key.ToString(),
                    Label = SalesModeLabel(g.Key),
                    OrderCount = g.Count(),
                    // Số dòng hàng, không phải tổng số lượng — Gram và Piece không cộng chung được.
                    Quantity = g.Sum(o => o.LineCount),
                    Revenue = g.Sum(o => o.FinalAmount)
                })
                .OrderBy(l => l.SalesMode)
                .ToList(),
            Bridge = new RevenueCashBridgeDto
            {
                RecognizedRevenue = netRecognized,
                UnpaidRevenue = completed.Sum(o => o.FinalAmount - o.PaidAmount),
                PriorPeriodCollections = receipts.Where(r => r.OrderCreatedAt < from).Sum(r => r.Amount),
                AdvanceOnOpenOrders = advanceOnOpenOrders,
                ForfeitedDeposit = forfeited.Sum(),
                Refunds = totalOut,
                TotalCashIn = totalIn
            },
            DataGaps = gaps
        };
    }

    public async Task<EndOfDaySalesResponse> GetSalesAsync(
        EndOfDayPagedFilter filter, CancellationToken ct = default)
    {
        var (page, pageSize) = NormalizePaging(filter);
        var methodFilter = ExpandMethodFilter(filter.PaymentMethod);
        var query = BuildRecognizedOrderQuery(filter, methodFilter);

        var totalCount = await query.CountAsync(ct);

        // Tổng toàn kỳ tính ở DB, không cộng từ trang đang xem.
        var totals = await query
            .GroupBy(_ => 1)
            .Select(g => new
            {
                Final = g.Sum(o => o.FinalAmount),
                Discount = g.Sum(o => o.DiscountAmount)
            })
            .FirstOrDefaultAsync(ct);

        var totalPaid = await query
            .SelectMany(o => o.Payments.Where(p => p.PaymentStatus == PaymentStatus.Success))
            .SumAsync(p => (decimal?)p.Amount, ct) ?? 0m;

        var items = await query
            .OrderByDescending(o => o.CompletedAt ?? o.CreatedAt)
            .ThenByDescending(o => o.OrderCode)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(o => new
            {
                o.Id,
                o.OrderCode,
                RecognizedAt = o.CompletedAt ?? o.CreatedAt,
                o.CustomerSnapshotName,
                o.EmployeeSnapshotName,
                o.OrderChannel,
                o.PickupDate,
                o.ShippingAddress,
                o.OrderStatus,
                o.TotalAmount,
                o.DiscountAmount,
                o.FinalAmount,
                PaidAmount = o.Payments
                    .Where(p => p.PaymentStatus == PaymentStatus.Success)
                    .Sum(p => (decimal?)p.Amount) ?? 0m,
                Methods = o.Payments
                    .Where(p => p.PaymentStatus == PaymentStatus.Success)
                    .Select(p => p.PaymentMethod)
                    .ToList(),
                LineCount = o.OrderDetails.Count
            })
            .ToListAsync(ct);

        var statusCounts = await BuildStatusScopeQuery(filter)
            .GroupBy(o => o.OrderStatus)
            .Select(g => new { Status = g.Key, Count = g.Count() })
            .ToListAsync(ct);

        return new EndOfDaySalesResponse
        {
            Items = items.Select(o =>
            {
                var mode = DeriveSalesMode(o.PickupDate, o.OrderChannel, o.ShippingAddress);
                return new OrderSummaryLineDto
                {
                    OrderId = o.Id,
                    OrderCode = o.OrderCode,
                    CreatedAt = o.RecognizedAt,
                    CustomerName = o.CustomerSnapshotName,
                    EmployeeName = o.EmployeeSnapshotName,
                    Channel = o.OrderChannel.ToString(),
                    ChannelLabel = OrderChannelLabel(o.OrderChannel),
                    SalesMode = mode.ToString(),
                    SalesModeLabel = SalesModeLabel(mode),
                    OrderStatus = o.OrderStatus.ToString(),
                    TotalAmount = o.TotalAmount,
                    DiscountAmount = o.DiscountAmount,
                    FinalAmount = o.FinalAmount,
                    PaidAmount = o.PaidAmount,
                    PaymentMethods = string.Join(", ", o.Methods.Distinct().Select(PaymentMethodLabel)),
                    LineCount = o.LineCount
                };
            }).ToList(),
            Page = page,
            PageSize = pageSize,
            TotalCount = totalCount,
            TotalPages = TotalPages(totalCount, pageSize),
            TotalFinalAmount = totals?.Final ?? 0m,
            TotalDiscountAmount = totals?.Discount ?? 0m,
            TotalPaidAmount = totalPaid,
            StatusCounts = statusCounts.ToDictionary(s => s.Status.ToString(), s => s.Count)
        };
    }

    public async Task<EndOfDayPaymentsResponse> GetPaymentsAsync(
        EndOfDayPagedFilter filter, CancellationToken ct = default)
    {
        var (page, pageSize) = NormalizePaging(filter);
        var methodFilter = ExpandMethodFilter(filter.PaymentMethod);
        var query = BuildPaymentQuery(filter, methodFilter);

        var totalCount = await query.CountAsync(ct);
        var totalAmount = await query.SumAsync(p => (decimal?)p.Amount, ct) ?? 0m;

        var byPurpose = await query
            .GroupBy(p => p.PaymentPurpose)
            .Select(g => new { Purpose = g.Key, Amount = g.Sum(p => p.Amount), Count = g.Count() })
            .ToListAsync(ct);

        var byMethodIn = await query
            .GroupBy(p => p.PaymentMethod)
            .Select(g => new { Method = g.Key, Amount = g.Sum(p => p.Amount), Count = g.Count() })
            .ToListAsync(ct);

        var refunds = await BuildRefundQuery(filter, methodFilter)
            .GroupBy(r => r.RefundMethod)
            .Select(g => new { Method = g.Key, Amount = g.Sum(r => r.RefundAmount) })
            .ToListAsync(ct);

        var items = await query
            .OrderByDescending(p => p.PaidAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(p => new CashReceiptDto
            {
                OrderId = p.OrderId,
                OrderCode = p.Order.OrderCode,
                PaidAt = p.PaidAt!.Value,
                OrderCreatedAt = p.Order.CreatedAt,
                PaymentMethod = p.PaymentMethod.ToString(),
                PaymentPurpose = p.PaymentPurpose.ToString(),
                Amount = p.Amount,
                EmployeeName = p.Order.EmployeeSnapshotName,
                CustomerName = p.Order.CustomerSnapshotName,
                OrderStatus = p.Order.OrderStatus.ToString()
            })
            .ToListAsync(ct);

        var reconciliation = BuildMethodReconciliation(
            byMethodIn.Select(m => (m.Method, m.Amount)),
            refunds.Select(r => (r.Method, r.Amount)),
            byMethodIn.ToDictionary(m => m.Method, m => m.Count));

        return new EndOfDayPaymentsResponse
        {
            Items = items,
            Page = page,
            PageSize = pageSize,
            TotalCount = totalCount,
            TotalPages = TotalPages(totalCount, pageSize),
            TotalAmount = totalAmount,
            ByPurpose = byPurpose
                .Select(g => new CashFlowLineDto
                {
                    Key = g.Purpose.ToString(),
                    Label = PaymentPurposeLabel(g.Purpose),
                    Amount = g.Amount,
                    Count = g.Count
                })
                .OrderBy(l => l.Key)
                .ToList(),
            ByPaymentMethod = reconciliation,
            CashOnHand = reconciliation.Where(m => m.IsCash).Sum(m => m.Net),
            BankIn = reconciliation.Where(m => !m.IsCash).Sum(m => m.AmountIn)
        };
    }

    public async Task<EndOfDayProductsResponse> GetProductsAsync(
        EndOfDayPagedFilter filter, CancellationToken ct = default)
    {
        var (page, pageSize) = NormalizePaging(filter);
        var methodFilter = ExpandMethodFilter(filter.PaymentMethod);
        var orderQuery = BuildRecognizedOrderQuery(filter, methodFilter);

        // Cần toàn bộ dòng hàng của kỳ vì giảm giá cấp đơn phải phân bổ theo tỷ trọng dòng
        // trong phạm vi từng đơn — không thể phân trang trước khi phân bổ.
        // Dùng join tường minh thay vì SelectMany trên navigation: global query filter
        // IsDeleted của OrderDetail khiến EF sinh CROSS APPLY, mà MySQL không hỗ trợ.
        var lines = await (
            from d in dbContext.OrderDetails.AsNoTracking()
            join o in orderQuery on d.OrderId equals o.Id
            select new
            {
                OrderId = o.Id,
                OrderDiscount = o.DiscountAmount,
                d.SkuId,
                d.SkuSnapshotCode,
                d.SkuSnapshotName,
                d.CategorySnapshotName,
                d.UnitSnapshot,
                d.Quantity,
                d.ReturnedQuantity,
                d.SubTotal
            }).ToListAsync(ct);

        var allocated = new Dictionary<(Guid SkuId, string Unit), decimal>();
        foreach (var group in lines.GroupBy(l => l.OrderId))
        {
            var orderGross = group.Sum(l => l.SubTotal);
            var orderDiscount = group.First().OrderDiscount;
            if (orderGross <= 0 || orderDiscount <= 0) continue;

            // Phân bổ theo tỷ trọng doanh thu gộp, làm tròn tới đồng. Phần dư do làm tròn
            // dồn vào dòng lớn nhất để tổng phân bổ khớp đúng giảm giá của đơn.
            var ordered = group.OrderByDescending(l => l.SubTotal).ToList();
            var running = 0m;
            for (var i = 0; i < ordered.Count; i++)
            {
                var line = ordered[i];
                var share = i == ordered.Count - 1
                    ? orderDiscount - running
                    : Math.Round(orderDiscount * (line.SubTotal / orderGross), 0, MidpointRounding.AwayFromZero);
                running += share;
                var key = (line.SkuId, NormalizeUnit(line.UnitSnapshot));
                allocated[key] = allocated.TryGetValue(key, out var acc) ? acc + share : share;
            }
        }

        var groups = lines
            .GroupBy(l => new { l.SkuId, Unit = NormalizeUnit(l.UnitSnapshot) })
            .Select(g =>
            {
                var gross = g.Sum(l => l.SubTotal);
                var discount = allocated.TryGetValue((g.Key.SkuId, g.Key.Unit), out var d) ? d : 0m;
                return new EndOfDayProductLineDto
                {
                    SkuId = g.Key.SkuId,
                    SkuCode = g.First().SkuSnapshotCode ?? string.Empty,
                    SkuName = g.First().SkuSnapshotName ?? string.Empty,
                    CategoryName = g.First().CategorySnapshotName,
                    Unit = g.Key.Unit,
                    UnitLabel = UnitLabel(g.Key.Unit),
                    Quantity = g.Sum(l => l.Quantity),
                    ReturnedQuantity = g.Sum(l => l.ReturnedQuantity),
                    GrossRevenue = gross,
                    AllocatedDiscount = discount,
                    NetRevenue = gross - discount,
                    OrderCount = g.Select(l => l.OrderId).Distinct().Count()
                };
            })
            .OrderByDescending(p => p.NetRevenue)
            .ToList();

        return new EndOfDayProductsResponse
        {
            Items = groups.Skip((page - 1) * pageSize).Take(pageSize).ToList(),
            Page = page,
            PageSize = pageSize,
            TotalCount = groups.Count,
            TotalPages = TotalPages(groups.Count, pageSize),
            Totals = groups
                .GroupBy(p => p.Unit)
                .Select(g => new EndOfDayProductTotalsDto
                {
                    Unit = g.Key,
                    UnitLabel = UnitLabel(g.Key),
                    Quantity = g.Sum(p => p.Quantity),
                    ReturnedQuantity = g.Sum(p => p.ReturnedQuantity),
                    NetRevenue = g.Sum(p => p.NetRevenue),
                    LineCount = g.Count()
                })
                .OrderBy(t => t.Unit)
                .ToList()
        };
    }

    /// <summary>
    /// Ngoại lệ trong kỳ. Đếm và tổng tiền luôn tính trên toàn kỳ ở phía DB; danh sách chi tiết
    /// mới phân trang (đơn chưa thu đủ) hoặc cắt bớt (hai nhóm khoản thu). Cố tình không để
    /// frontend lọc từ trang đang xem vì như vậy số ngoại lệ sẽ báo thiếu.
    /// </summary>
    public async Task<EndOfDayExceptionsResponse> GetExceptionsAsync(
        EndOfDayPagedFilter filter, CancellationToken ct = default)
    {
        var (page, pageSize) = NormalizePaging(filter);
        var methodFilter = ExpandMethodFilter(filter.PaymentMethod);

        var underpaidQuery = BuildRecognizedOrderQuery(filter, methodFilter)
            .Select(o => new
            {
                o.Id,
                o.OrderCode,
                RecognizedAt = o.CompletedAt ?? o.CreatedAt,
                o.CustomerSnapshotName,
                o.EmployeeSnapshotName,
                o.OrderChannel,
                o.PickupDate,
                o.ShippingAddress,
                o.OrderStatus,
                o.TotalAmount,
                o.DiscountAmount,
                o.FinalAmount,
                PaidAmount = o.Payments
                    .Where(p => p.PaymentStatus == PaymentStatus.Success)
                    .Sum(p => (decimal?)p.Amount) ?? 0m,
                LineCount = o.OrderDetails.Count
            })
            .Where(o => o.PaidAmount < o.FinalAmount);

        var underpaidCount = await underpaidQuery.CountAsync(ct);
        var underpaidAmount = await underpaidQuery
            .SumAsync(o => (decimal?)(o.FinalAmount - o.PaidAmount), ct) ?? 0m;

        var underpaidRows = await underpaidQuery
            .OrderByDescending(o => o.FinalAmount - o.PaidAmount)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        // Phương thức thanh toán lấy bằng một truy vấn riêng theo đúng các đơn của trang
        // hiện tại. Không nhét collection vào projection chung vì query đó còn dùng cho
        // Count/Sum toàn kỳ.
        var underpaidIds = underpaidRows.Select(o => o.Id).ToList();
        var underpaidMethods = underpaidIds.Count == 0
            ? new Dictionary<Guid, List<PaymentMethod>>()
            : (await dbContext.Payments
                    .AsNoTracking()
                    .Where(p => underpaidIds.Contains(p.OrderId) && p.PaymentStatus == PaymentStatus.Success)
                    .Select(p => new { p.OrderId, p.PaymentMethod })
                    .Distinct()
                    .ToListAsync(ct))
                .GroupBy(p => p.OrderId)
                .ToDictionary(g => g.Key, g => g.Select(x => x.PaymentMethod).ToList());

        var paymentQuery = BuildPaymentQuery(filter, methodFilter);

        var cancelledQuery = paymentQuery.Where(p => p.Order.OrderStatus == OrderStatus.Cancelled);
        var cancelledCount = await cancelledQuery.CountAsync(ct);
        var cancelledAmount = await cancelledQuery.SumAsync(p => (decimal?)p.Amount, ct) ?? 0m;
        var cancelledRows = await cancelledQuery
            .OrderByDescending(p => p.PaidAt)
            .Take(MaxDetailRows)
            .Select(ReceiptProjection)
            .ToListAsync(ct);

        var priorQuery = paymentQuery.Where(p => p.Order.CreatedAt < filter.FromUtc);
        var priorCount = await priorQuery.CountAsync(ct);
        var priorAmount = await priorQuery.SumAsync(p => (decimal?)p.Amount, ct) ?? 0m;
        var priorRows = await priorQuery
            .OrderByDescending(p => p.PaidAt)
            .Take(MaxDetailRows)
            .Select(ReceiptProjection)
            .ToListAsync(ct);

        var statusRows = await BuildStatusScopeQuery(filter)
            .Select(o => new { o.OrderStatus, o.RefundStatus })
            .ToListAsync(ct);

        var forfeited = await BuildForfeitedQuery(filter, methodFilter)
            .Select(o => o.DepositAmount!.Value)
            .ToListAsync(ct);

        var gaps = new List<string>();
        if (cancelledCount > MaxDetailRows)
            gaps.Add($"Chỉ hiển thị {MaxDetailRows}/{cancelledCount} khoản thu trên đơn đã hủy; "
                     + "tổng tiền bên trên vẫn tính đủ toàn kỳ.");
        if (priorCount > MaxDetailRows)
            gaps.Add($"Chỉ hiển thị {MaxDetailRows}/{priorCount} khoản thu thuộc đơn kỳ trước; "
                     + "tổng tiền bên trên vẫn tính đủ toàn kỳ.");

        return new EndOfDayExceptionsResponse
        {
            UnderpaidCount = underpaidCount,
            UnderpaidAmount = underpaidAmount,
            Underpaid = underpaidRows.Select(o =>
            {
                var mode = DeriveSalesMode(o.PickupDate, o.OrderChannel, o.ShippingAddress);
                return new OrderSummaryLineDto
                {
                    OrderId = o.Id,
                    OrderCode = o.OrderCode,
                    CreatedAt = o.RecognizedAt,
                    CustomerName = o.CustomerSnapshotName,
                    EmployeeName = o.EmployeeSnapshotName,
                    Channel = o.OrderChannel.ToString(),
                    ChannelLabel = OrderChannelLabel(o.OrderChannel),
                    SalesMode = mode.ToString(),
                    SalesModeLabel = SalesModeLabel(mode),
                    OrderStatus = o.OrderStatus.ToString(),
                    TotalAmount = o.TotalAmount,
                    DiscountAmount = o.DiscountAmount,
                    FinalAmount = o.FinalAmount,
                    PaidAmount = o.PaidAmount,
                    PaymentMethods = underpaidMethods.TryGetValue(o.Id, out var methods)
                        ? string.Join(", ", methods.Select(PaymentMethodLabel))
                        : string.Empty,
                    LineCount = o.LineCount
                };
            }).ToList(),
            Page = page,
            PageSize = pageSize,
            TotalPages = TotalPages(underpaidCount, pageSize),
            ReceiptsOnCancelledCount = cancelledCount,
            ReceiptsOnCancelledAmount = cancelledAmount,
            ReceiptsOnCancelled = cancelledRows,
            PriorPeriodReceiptCount = priorCount,
            PriorPeriodReceiptAmount = priorAmount,
            PriorPeriodReceipts = priorRows,
            CancelledOrders = statusRows.Count(o => o.OrderStatus == OrderStatus.Cancelled),
            RefundedOrders = statusRows.Count(o =>
                o.RefundStatus == BackorderRefundStatus.Approved
                || o.RefundStatus == BackorderRefundStatus.Completed),
            ForfeitedDepositOrders = forfeited.Count,
            ForfeitedDepositIncome = forfeited.Sum(),
            DataGaps = gaps
        };
    }

    // ---- query builders -------------------------------------------------
    /// <summary>"Chuyển khoản" gộp cả VietQR vì cùng là tiền vào tài khoản, không phải tiền két.</summary>
    private static PaymentMethod[]? ExpandMethodFilter(PaymentMethod? method) => method switch
    {
        PaymentMethod.BankTransfer => [PaymentMethod.BankTransfer, PaymentMethod.VietQR],
        null => null,
        _ => [method.Value]
    };

    private IQueryable<Payment> BuildPaymentQuery(
        EndOfDayReportFilter filter, PaymentMethod[]? methodFilter)
    {
        var q = dbContext.Payments
            .AsNoTracking()
            .Where(p => p.PaymentStatus == PaymentStatus.Success
                        && p.PaidAt != null
                        && p.PaidAt >= filter.FromUtc
                        && p.PaidAt <= filter.ToUtc);

        if (filter.EmployeeId.HasValue)
            q = q.Where(p => p.Order.EmployeeId == filter.EmployeeId.Value);
        if (filter.CustomerId.HasValue)
            q = q.Where(p => p.Order.CustomerId == filter.CustomerId.Value);
        if (methodFilter != null)
            q = q.Where(p => methodFilter.Contains(p.PaymentMethod));
        if (filter.Channel.HasValue)
            q = q.Where(p => p.Order.OrderChannel == filter.Channel.Value);
        if (filter.OrderStatus.HasValue)
            q = q.Where(p => p.Order.OrderStatus == filter.OrderStatus.Value);

        if (filter.SalesMode.HasValue)
            q = filter.SalesMode.Value switch
            {
                SalesMode.Scheduled => q.Where(p => p.Order.PickupDate != null),
                SalesMode.Delivery => q.Where(p => p.Order.PickupDate == null
                    && (p.Order.OrderChannel == OrderChannel.COD
                        || (p.Order.ShippingAddress != null && p.Order.ShippingAddress != ""))),
                _ => q.Where(p => p.Order.PickupDate == null
                    && p.Order.OrderChannel != OrderChannel.COD
                    && (p.Order.ShippingAddress == null || p.Order.ShippingAddress == ""))
            };

        return q;
    }

    private IQueryable<ReturnOrder> BuildRefundQuery(
        EndOfDayReportFilter filter, PaymentMethod[]? methodFilter)
    {
        var q = dbContext.ReturnOrders
            .AsNoTracking()
            .Where(r => r.RefundAmount > 0
                        && r.CreatedAt >= filter.FromUtc
                        && r.CreatedAt <= filter.ToUtc);

        if (filter.EmployeeId.HasValue)
            q = q.Where(r => r.SourceOrder.EmployeeId == filter.EmployeeId.Value);
        if (filter.CustomerId.HasValue)
            q = q.Where(r => r.SourceOrder.CustomerId == filter.CustomerId.Value);
        if (methodFilter != null)
            q = q.Where(r => methodFilter.Contains(r.RefundMethod));
        if (filter.Channel.HasValue)
            q = q.Where(r => r.SourceOrder.OrderChannel == filter.Channel.Value);

        if (filter.SalesMode.HasValue)
            q = filter.SalesMode.Value switch
            {
                SalesMode.Scheduled => q.Where(r => r.SourceOrder.PickupDate != null),
                SalesMode.Delivery => q.Where(r => r.SourceOrder.PickupDate == null
                    && (r.SourceOrder.OrderChannel == OrderChannel.COD
                        || (r.SourceOrder.ShippingAddress != null && r.SourceOrder.ShippingAddress != ""))),
                _ => q.Where(r => r.SourceOrder.PickupDate == null
                    && r.SourceOrder.OrderChannel != OrderChannel.COD
                    && (r.SourceOrder.ShippingAddress == null || r.SourceOrder.ShippingAddress == ""))
            };

        return q;
    }

    /// <summary>
    /// Đơn được ghi nhận doanh thu trong kỳ. Mốc kỳ là <c>CompletedAt</c>; đơn cũ chưa có
    /// giá trị này thì lùi về <c>CreatedAt</c> để không mất doanh thu lịch sử.
    /// </summary>
    private IQueryable<Order> BuildRecognizedOrderQuery(
        EndOfDayReportFilter filter, PaymentMethod[]? methodFilter)
    {
        var status = filter.OrderStatus ?? OrderStatus.Completed;
        var q = dbContext.Orders
            .AsNoTracking()
            .Where(o => o.OrderStatus == status
                        && (o.CompletedAt ?? o.CreatedAt) >= filter.FromUtc
                        && (o.CompletedAt ?? o.CreatedAt) <= filter.ToUtc);

        if (filter.Channel.HasValue)
            q = q.Where(o => o.OrderChannel == filter.Channel.Value);
        if (filter.EmployeeId.HasValue)
            q = q.Where(o => o.EmployeeId == filter.EmployeeId.Value);
        if (filter.CustomerId.HasValue)
            q = q.Where(o => o.CustomerId == filter.CustomerId.Value);
        if (methodFilter != null)
            q = q.Where(o => o.Payments.Any(p =>
                p.PaymentStatus == PaymentStatus.Success && methodFilter.Contains(p.PaymentMethod)));

        if (filter.SalesMode.HasValue)
            q = filter.SalesMode.Value switch
            {
                SalesMode.Scheduled => q.Where(o => o.PickupDate != null),
                SalesMode.Delivery => q.Where(o => o.PickupDate == null
                    && (o.OrderChannel == OrderChannel.COD
                        || (o.ShippingAddress != null && o.ShippingAddress != ""))),
                _ => q.Where(o => o.PickupDate == null
                    && o.OrderChannel != OrderChannel.COD
                    && (o.ShippingAddress == null || o.ShippingAddress == ""))
            };

        return q;
    }

    private IQueryable<Order> BuildForfeitedQuery(
        EndOfDayReportFilter filter, PaymentMethod[]? methodFilter)
    {
        var q = dbContext.Orders
            .AsNoTracking()
            .Where(o => o.OrderStatus == OrderStatus.Cancelled
                        && o.DepositAmount != null
                        && o.DepositAmount > 0
                        && o.CancellationRequestedAt != null
                        && o.CancellationRequestedAt >= filter.FromUtc
                        && o.CancellationRequestedAt <= filter.ToUtc);

        if (filter.EmployeeId.HasValue)
            q = q.Where(o => o.EmployeeId == filter.EmployeeId.Value);
        if (filter.CustomerId.HasValue)
            q = q.Where(o => o.CustomerId == filter.CustomerId.Value);
        if (filter.Channel.HasValue)
            q = q.Where(o => o.OrderChannel == filter.Channel.Value);
        if (methodFilter != null)
            q = q.Where(o => o.Payments.Any(p =>
                p.PaymentStatus == PaymentStatus.Success && methodFilter.Contains(p.PaymentMethod)));

        return q;
    }

    /// <summary>Đơn tạo trong kỳ, dùng cho các con số đếm theo trạng thái (hủy, hoàn tiền, dở dang).</summary>
    private IQueryable<Order> BuildStatusScopeQuery(EndOfDayReportFilter filter)
    {
        var q = dbContext.Orders
            .AsNoTracking()
            .Where(o => o.CreatedAt >= filter.FromUtc && o.CreatedAt <= filter.ToUtc);

        if (filter.EmployeeId.HasValue)
            q = q.Where(o => o.EmployeeId == filter.EmployeeId.Value);
        if (filter.CustomerId.HasValue)
            q = q.Where(o => o.CustomerId == filter.CustomerId.Value);
        if (filter.Channel.HasValue)
            q = q.Where(o => o.OrderChannel == filter.Channel.Value);

        return q;
    }

    private IQueryable<Order> BuildOpenOrderQuery(EndOfDayReportFilter filter) =>
        BuildStatusScopeQuery(filter).Where(o => OpenStatuses.Contains(o.OrderStatus));

    // ---- helpers --------------------------------------------------------

    private static (int Page, int PageSize) NormalizePaging(EndOfDayPagedFilter filter)
    {
        var page = filter.Page < 1 ? 1 : filter.Page;
        var size = filter.PageSize < 1 ? 20 : Math.Min(filter.PageSize, MaxPageSize);
        return (page, size);
    }

    private static int TotalPages(int totalCount, int pageSize) =>
        totalCount == 0 ? 0 : (int)Math.Ceiling(totalCount / (double)pageSize);

    private static List<CashReconciliationLineDto> BuildMethodReconciliation(
        IEnumerable<(PaymentMethod Method, decimal Amount)> receipts,
        IEnumerable<(PaymentMethod Method, decimal Amount)> refunds,
        IReadOnlyDictionary<PaymentMethod, int>? counts = null)
    {
        var inList = receipts.ToList();
        var outList = refunds.ToList();

        return inList.Select(r => r.Method)
            .Concat(outList.Select(r => r.Method))
            .Distinct()
            .Select(method =>
            {
                var amountIn = inList.Where(r => r.Method == method).Sum(r => r.Amount);
                var amountOut = outList.Where(r => r.Method == method).Sum(r => r.Amount);
                return new CashReconciliationLineDto
                {
                    PaymentMethod = method.ToString(),
                    Label = PaymentMethodLabel(method),
                    AmountIn = amountIn,
                    AmountOut = amountOut,
                    Net = amountIn - amountOut,
                    Count = counts != null && counts.TryGetValue(method, out var c)
                        ? c
                        : inList.Count(r => r.Method == method),
                    // Chỉ Cash mới là tiền mặt thật trong két; VietQR/chuyển khoản vào tài khoản.
                    IsCash = method == PaymentMethod.Cash
                };
            })
            .OrderBy(l => l.PaymentMethod)
            .ToList();
    }

    /// <summary>Đơn hàng tạo trước khi có cột UnitSnapshot không có đơn vị — hiển thị riêng, không gộp bừa.</summary>
    private static string NormalizeUnit(string? unit) =>
        string.IsNullOrWhiteSpace(unit) ? "Unknown" : unit.Trim();

    private static string UnitLabel(string unit) => unit switch
    {
        "Gram" => "Gram",
        "Piece" => "Cái",
        _ => "Không xác định"
    };

    private static string PaymentMethodLabel(PaymentMethod method) => method switch
    {
        PaymentMethod.Cash => "Tiền mặt",
        PaymentMethod.VietQR => "VietQR",
        PaymentMethod.BankTransfer => "Chuyển khoản",
        PaymentMethod.COD => "Thu hộ COD",
        PaymentMethod.Debt => "Ghi nợ",
        _ => method.ToString()
    };

    private static string PaymentPurposeLabel(PaymentPurpose purpose) => purpose switch
    {
        PaymentPurpose.Full => "Thu đủ một lần",
        PaymentPurpose.Deposit => "Tiền cọc",
        PaymentPurpose.RemainingAtPickup => "Thu phần còn lại khi nhận hàng",
        _ => purpose.ToString()
    };

    private static string SalesModeLabel(SalesMode mode) => mode switch
    {
        SalesMode.Counter => "Tại quầy",
        SalesMode.Delivery => "Giao hàng",
        SalesMode.Scheduled => "Hẹn giao",
        _ => mode.ToString()
    };

    private static string OrderChannelLabel(OrderChannel channel) => channel switch
    {
        OrderChannel.POS => "Tại quầy (POS)",
        OrderChannel.Website => "Website",
        OrderChannel.Zalo => "Zalo",
        OrderChannel.Phone => "Điện thoại",
        OrderChannel.COD => "Giao hàng COD",
        OrderChannel.B2B => "Khách sỉ B2B",
        _ => channel.ToString()
    };

    private static SalesMode DeriveSalesMode(DateTime? pickupDate, OrderChannel channel, string? shippingAddress)
    {
        if (pickupDate != null) return SalesMode.Scheduled;
        if (channel == OrderChannel.COD || !string.IsNullOrWhiteSpace(shippingAddress)) return SalesMode.Delivery;
        return SalesMode.Counter;
    }
}
