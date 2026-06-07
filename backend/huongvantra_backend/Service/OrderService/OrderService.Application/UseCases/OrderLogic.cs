using OrderService.Application.DTOs.Requests;
using OrderService.Application.DTOs.Responses;
using OrderService.Application.Interfaces;
using OrderService.Application.Validation;
using OrderService.Domain.Entities;
using OrderService.Domain.Enums;
using OrderService.Domain.Exceptions;

namespace OrderService.Application.UseCases;

public class OrderLogic(
    IOrderRepository _orderRepo,
    IPaymentRepository _paymentRepo,
    IOrderCodeGenerator _codeGen,
    IOrderEventPublisher _eventPublisher)
{
    public async Task<PagedResponse<OrderSummaryResponse>> GetPagedAsync(
        GetOrdersRequest req, CancellationToken ct = default)
    {
        OrderInputValidator.ValidatePagination(req.Page, req.PageSize);
        var (items, total) = await _orderRepo.GetPagedAsync(
            req.Search, req.CustomerId, req.Status, req.Channel,
            req.Page, req.PageSize, ct);

        var dtos = items.Select(MapToSummary).ToList();
        return new PagedResponse<OrderSummaryResponse>(
            dtos, req.Page, req.PageSize, total,
            (int)Math.Ceiling((double)total / req.PageSize));
    }

    public async Task<OrderResponse> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        var order = await _orderRepo.GetByIdAsync(id, ct)
            ?? throw new OrderNotFoundException(id);
        return MapToResponse(order);
    }

    public async Task<OrderResponse> GetByCodeAsync(string code, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(code))
            throw new OrderValidationException("Mã đơn hàng không được để trống.");
        var order = await _orderRepo.GetByCodeAsync(code.Trim().ToUpperInvariant(), ct)
            ?? throw new OrderNotFoundByCodeException(code);
        return MapToResponse(order);
    }

    public async Task<OrderResponse> CreateAsync(CreateOrderRequest req, CancellationToken ct = default)
    {
        var detailInputs = req.Items.Select(i => new CreateOrderDetailInput(
            i.SkuId, i.SkuSnapshotName.Trim(), i.SkuSnapshotCode?.Trim(),
            i.Quantity, i.UnitPrice)).ToList();

        OrderInputValidator.ValidateCreateOrder(
            detailInputs, req.DiscountAmount, req.PaidAmount,
            req.OrderChannel, req.ShippingAddress);

        var orderCode = await _codeGen.GenerateAsync(ct);
        var totalAmount = detailInputs.Sum(i => i.UnitPrice * i.Quantity);
        var finalAmount = totalAmount - req.DiscountAmount;
        if (finalAmount < 0) finalAmount = 0;

        var isPosOrCompleted = req.OrderChannel == OrderChannel.POS
            && req.PaymentMethod != PaymentMethod.COD;

        var order = new Order
        {
            Id = Guid.NewGuid(),
            OrderCode = orderCode,
            CustomerId = req.CustomerId,
            CustomerSnapshotName = req.CustomerSnapshotName?.Trim(),
            EmployeeId = req.EmployeeId,
            OrderChannel = req.OrderChannel,
            OrderStatus = isPosOrCompleted ? OrderStatus.Completed : OrderStatus.PendingPayment,
            InventorySyncStatus = InventorySyncStatus.PendingDeduction,
            TotalAmount = totalAmount,
            DiscountAmount = req.DiscountAmount,
            FinalAmount = finalAmount,
            ShippingAddress = req.ShippingAddress?.Trim(),
            Note = req.Note?.Trim(),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        order.OrderDetails = detailInputs.Select(i => new OrderDetail
        {
            Id = Guid.NewGuid(),
            OrderId = order.Id,
            SkuId = i.SkuId,
            SkuSnapshotName = i.SkuSnapshotName,
            SkuSnapshotCode = i.SkuSnapshotCode,
            Quantity = i.Quantity,
            UnitPrice = i.UnitPrice,
            SubTotal = i.UnitPrice * i.Quantity,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        }).ToList();

        var debtAmount = req.PaymentMethod == PaymentMethod.COD
            ? finalAmount
            : Math.Max(0, finalAmount - req.PaidAmount);

        var payment = new Payment
        {
            Id = Guid.NewGuid(),
            OrderId = order.Id,
            PaymentMethod = req.PaymentMethod,
            Amount = req.PaidAmount,
            PaymentStatus = req.PaymentMethod == PaymentMethod.COD
                ? PaymentStatus.Pending
                : (req.PaidAmount >= finalAmount ? PaymentStatus.Success : PaymentStatus.Pending),
            IsCodVerified = false,
            CodWarningDate = req.PaymentMethod == PaymentMethod.COD
                ? DateTime.UtcNow.AddDays(7)
                : null,
            PaidAt = req.PaymentMethod != PaymentMethod.COD && req.PaidAmount > 0
                ? DateTime.UtcNow
                : null,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        order.Payments = [payment];

        await _orderRepo.AddAsync(order, ct);
        await _orderRepo.SaveChangesAsync(ct);

        if (order.OrderStatus == OrderStatus.Completed && order.CustomerId.HasValue)
        {
            await _eventPublisher.PublishOrderCompletedAsync(
                order.Id, order.OrderCode, order.CustomerId.Value,
                finalAmount, debtAmount,
                order.OrderDetails.Select(d => (d.SkuId, d.Quantity)),
                ct);
        }

        return MapToResponse(order);
    }

    public async Task<OrderResponse> UpdateAsync(Guid id, UpdateOrderRequest req, CancellationToken ct = default)
    {
        var order = await _orderRepo.GetByIdAsync(id, ct)
            ?? throw new OrderNotFoundException(id);

        if (order.OrderStatus == OrderStatus.Completed || order.OrderStatus == OrderStatus.Cancelled)
            throw new OrderCannotBeModifiedException(id, order.OrderStatus.ToString());

        order.ShippingAddress = req.ShippingAddress?.Trim();
        order.Note = req.Note?.Trim();
        order.DiscountAmount = req.DiscountAmount;
        order.FinalAmount = Math.Max(0, order.TotalAmount - req.DiscountAmount);
        order.UpdatedAt = DateTime.UtcNow;

        await _orderRepo.SaveChangesAsync(ct);
        return MapToResponse(order);
    }

    public async Task CancelAsync(Guid id, CancellationToken ct = default)
    {
        var order = await _orderRepo.GetByIdAsync(id, ct)
            ?? throw new OrderNotFoundException(id);

        if (order.OrderStatus == OrderStatus.Completed || order.OrderStatus == OrderStatus.Cancelled)
            throw new OrderCannotBeCancelledException(id, order.OrderStatus.ToString());

        order.OrderStatus = OrderStatus.Cancelled;
        order.UpdatedAt = DateTime.UtcNow;
        await _orderRepo.SaveChangesAsync(ct);
    }

    public async Task MarkShippingAsync(Guid id, CancellationToken ct = default)
    {
        var order = await _orderRepo.GetByIdAsync(id, ct)
            ?? throw new OrderNotFoundException(id);

        if (order.OrderStatus != OrderStatus.Processing && order.OrderStatus != OrderStatus.PendingPayment)
            throw new OrderCannotBeModifiedException(id, order.OrderStatus.ToString());

        order.OrderStatus = OrderStatus.Shipping;
        order.UpdatedAt = DateTime.UtcNow;
        await _orderRepo.SaveChangesAsync(ct);
    }

    public async Task CompleteAsync(Guid id, CancellationToken ct = default)
    {
        var order = await _orderRepo.GetByIdAsync(id, ct)
            ?? throw new OrderNotFoundException(id);

        if (order.OrderStatus == OrderStatus.Cancelled || order.OrderStatus == OrderStatus.Completed)
            throw new OrderCannotBeModifiedException(id, order.OrderStatus.ToString());

        order.OrderStatus = OrderStatus.Completed;
        order.UpdatedAt = DateTime.UtcNow;
        await _orderRepo.SaveChangesAsync(ct);

        if (order.CustomerId.HasValue)
        {
            var payments = order.Payments ?? await GetPaymentsInternal(order.Id, ct);
            var paidAmount = payments.Where(p => p.PaymentStatus == PaymentStatus.Success).Sum(p => p.Amount);
            var debtAmount = Math.Max(0, order.FinalAmount - paidAmount);

            await _eventPublisher.PublishOrderCompletedAsync(
                order.Id, order.OrderCode, order.CustomerId.Value,
                order.FinalAmount, debtAmount,
                order.OrderDetails.Select(d => (d.SkuId, d.Quantity)),
                ct);
        }
    }

    private async Task<List<Payment>> GetPaymentsInternal(Guid orderId, CancellationToken ct)
        => await _paymentRepo.GetByOrderIdAsync(orderId, ct);

    private static OrderResponse MapToResponse(Order o) => new(
        o.Id, o.OrderCode, o.CustomerId, o.CustomerSnapshotName,
        o.EmployeeId, o.OrderChannel.ToString(), o.OrderStatus.ToString(),
        o.InventorySyncStatus.ToString(), o.TotalAmount, o.DiscountAmount, o.FinalAmount,
        o.ShippingAddress, o.Note, o.CreatedAt, o.UpdatedAt,
        (o.OrderDetails ?? []).Select(d => new OrderDetailResponse(
            d.Id, d.SkuId, d.SkuSnapshotName, d.SkuSnapshotCode,
            d.Quantity, d.UnitPrice, d.SubTotal)).ToList(),
        (o.Payments ?? []).Select(p => new PaymentResponse(
            p.Id, p.OrderId, o.OrderCode, o.CustomerSnapshotName,
            p.PaymentMethod.ToString(), p.Amount, p.PaymentStatus.ToString(),
            p.TransactionRef, p.IsCodVerified, p.CodWarningDate, p.PaidAt)).ToList()
    );

    private static OrderSummaryResponse MapToSummary(Order o) => new(
        o.Id, o.OrderCode, o.CustomerId, o.CustomerSnapshotName,
        o.OrderChannel.ToString(), o.OrderStatus.ToString(),
        o.InventorySyncStatus.ToString(), o.FinalAmount, o.CreatedAt
    );
}
