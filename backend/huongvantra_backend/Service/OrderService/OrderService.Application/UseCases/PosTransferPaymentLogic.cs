using System.Globalization;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using OrderService.Application.Authorization;
using OrderService.Application.DTOs.Responses;
using OrderService.Application.Interfaces;
using OrderService.Application.Options;
using OrderService.Domain.Entities;
using OrderService.Domain.Enums;
using OrderService.Domain.Exceptions;

namespace OrderService.Application.UseCases;

public class PosTransferPaymentLogic(
    IOptions<PosTransferPaymentOptions> posOptions,
    IOptions<SepayOptions> sepayOptions,
    IOrderRepository orderRepo,
    OrderLogic orderLogic,
    StaffShiftGuard shiftGuard,
    ILogger<PosTransferPaymentLogic> logger)
{
    private readonly PosTransferPaymentOptions _pos = posOptions.Value;
    private readonly SepayOptions _sepay = sepayOptions.Value;

    public TransferPaymentInfoResponse GetTransferPaymentInfo()
    {
        var (paymentMode, _) = ResolveReceiveAccount();
        return new TransferPaymentInfoResponse(
            _pos.BankCode,
            _pos.BankBin,
            _pos.BankName,
            _pos.AccountNumber,
            _pos.AccountHolder,
            paymentMode,
            _sepay.RequireSepayVaForTransfer && HasSepayVa(),
            _sepay.EnableWebhook);
    }

    public SepaySetupResponse GetSepaySetup()
    {
        var apiTokenConfigured = !string.IsNullOrWhiteSpace(_sepay.ApiToken);
        var bankAccountUuidConfigured = !string.IsNullOrWhiteSpace(_sepay.BankAccountUuid);
        var staticVaConfigured = !string.IsNullOrWhiteSpace(_sepay.StaticVaNumber);
        var (paymentMode, receiveAccount) = ResolveReceiveAccount();
        var canCreateTransferQr = CanBuildQr(receiveAccount);
        string? setupMessage = null;

        if (_sepay.RequireSepayVaForTransfer && !staticVaConfigured && !apiTokenConfigured)
        {
            setupMessage =
                "Cấu hình Sepay:ApiToken hoặc Sepay:StaticVaNumber trong appsettings của order-service.";
        }
        else if (!canCreateTransferQr)
        {
            setupMessage =
                "Cấu hình PosTransferPayment:BankBin và PosTransferPayment:AccountNumber trong appsettings.";
        }

        var bankAccounts = string.IsNullOrWhiteSpace(_pos.AccountNumber)
            ? Array.Empty<SepayBankAccountResponse>()
            :
            [
                new SepayBankAccountResponse(
                    "main",
                    _pos.BankName,
                    _pos.AccountNumber,
                    _pos.AccountHolder,
                    "active")
            ];

        return new SepaySetupResponse(
            paymentMode,
            _sepay.RequireSepayVaForTransfer,
            apiTokenConfigured,
            bankAccountUuidConfigured,
            staticVaConfigured,
            canCreateTransferQr,
            setupMessage,
            bankAccounts);
    }

    public async Task<TransferQrResponse> BuildTransferQrAsync(
        BuildTransferQrRequest request, OrderAccessContext access, CancellationToken ct = default)
    {
        await shiftGuard.EnsureShelfOnDutyAsync(access, ct);

        if (request.OrderId.HasValue)
            return await ResolveTransferQrForOrderAsync(request.OrderId.Value, access, issueOnCreate: true, ct);

        if (string.IsNullOrWhiteSpace(request.OrderCode))
            throw new OrderValidationException("Mã đơn hàng không được để trống.");

        var expiresAt = DateTime.UtcNow.AddMinutes(GetExpiryMinutes());
        return CreateTransferQrResponse(request.OrderCode, request.Amount, expiresAt);
    }

    public async Task<TransferQrResponse> GetTransferQrForOrderAsync(
        Guid orderId, OrderAccessContext access, CancellationToken ct = default) =>
        await ResolveTransferQrForOrderAsync(orderId, access, issueOnCreate: false, ct);

    public async Task<TransferQrResponse> RefreshTransferQrForOrderAsync(
        Guid orderId, OrderAccessContext access, CancellationToken ct = default)
    {
        await shiftGuard.EnsureShelfOnDutyAsync(access, ct);

        var order = await orderRepo.GetByIdAsync(orderId, ct)
            ?? throw new OrderNotFoundException(orderId);
        EnsureCanModify(order, access);
        var payment = GetTransferPayment(order)
            ?? throw new OrderValidationException("Đơn không có thanh toán chuyển khoản.");

        EnsureTransferPaymentPending(order, payment);

        var expiresAt = payment.TransferQrExpiresAtUtc ?? order.CreatedAt.AddMinutes(GetExpiryMinutes());
        if (DateTime.UtcNow < expiresAt)
            throw new OrderValidationException("Mã QR còn hiệu lực. Chỉ tạo lại khi đã hết hạn.");

        payment.TransferQrExpiresAtUtc = DateTime.UtcNow.AddMinutes(GetExpiryMinutes());
        payment.UpdatedAt = DateTime.UtcNow;
        await orderRepo.SaveChangesAsync(ct);

        return CreateTransferQrResponse(
            order.OrderCode,
            GetTransferQrAmount(order, payment),
            payment.TransferQrExpiresAtUtc.Value);
    }

    private async Task<TransferQrResponse> ResolveTransferQrForOrderAsync(
        Guid orderId, OrderAccessContext access, bool issueOnCreate, CancellationToken ct)
    {
        var order = await orderRepo.GetByIdAsync(orderId, ct)
            ?? throw new OrderNotFoundException(orderId);
        EnsureCanModify(order, access);
        var payment = GetTransferPayment(order)
            ?? throw new OrderValidationException("Đơn không có thanh toán chuyển khoản.");

        EnsureTransferPaymentPending(order, payment);

        if (!payment.TransferQrExpiresAtUtc.HasValue)
        {
            payment.TransferQrExpiresAtUtc = issueOnCreate
                ? DateTime.UtcNow.AddMinutes(GetExpiryMinutes())
                : order.CreatedAt.AddMinutes(GetExpiryMinutes());
            payment.UpdatedAt = DateTime.UtcNow;
            await orderRepo.SaveChangesAsync(ct);
        }

        return CreateTransferQrResponse(
            order.OrderCode,
            GetTransferQrAmount(order, payment),
            payment.TransferQrExpiresAtUtc.Value);
    }

    private decimal GetTransferQrAmount(Order order, Payment payment) =>
        ApplyTestQrAmount(GetRealTransferAmount(order, payment));

    private static decimal GetRealTransferAmount(Order order, Payment payment) =>
        ResolveTransferQrAmount(payment.Amount, order.FinalAmount)
        + GetDebtSettlementAmount(payment.CodDebtSettlementJson);

    /// Chế độ test: QR hiển thị số tiền cố định nhỏ thay vì giá trị thật của đơn.
    private decimal ApplyTestQrAmount(decimal realAmount) =>
        _pos.TestQrFixedAmountVnd > 0 && realAmount > 0
            ? Math.Min(_pos.TestQrFixedAmountVnd, realAmount)
            : realAmount;

    private static decimal ResolveTransferQrAmount(decimal paymentAmount, decimal orderFinalAmount) =>
        paymentAmount > 0 ? paymentAmount : orderFinalAmount;

    private static decimal GetDebtSettlementAmount(string? settlementJson)
    {
        if (string.IsNullOrWhiteSpace(settlementJson))
            return 0;

        try
        {
            using var document = JsonDocument.Parse(settlementJson);
            if (document.RootElement.ValueKind != JsonValueKind.Object)
                return 0;

            foreach (var property in document.RootElement.EnumerateObject())
            {
                if (!string.Equals(
                        property.Name,
                        "allocatedAmount",
                        StringComparison.OrdinalIgnoreCase))
                {
                    continue;
                }

                return property.Value.TryGetDecimal(out var amount)
                    ? Math.Max(0, amount)
                    : 0;
            }
        }
        catch (JsonException)
        {
            return 0;
        }

        return 0;
    }

    private static bool IsTransferPaymentMethod(string? paymentMethod) =>
        string.Equals(paymentMethod, PaymentMethod.VietQR.ToString(), StringComparison.OrdinalIgnoreCase)
        || string.Equals(paymentMethod, PaymentMethod.BankTransfer.ToString(), StringComparison.OrdinalIgnoreCase);

    private TransferQrResponse CreateTransferQrResponse(
        string orderCode, decimal amount, DateTime expiresAtUtc)
    {
        if (string.IsNullOrWhiteSpace(orderCode))
            throw new OrderValidationException("Mã đơn hàng không được để trống.");

        var transferContent = orderCode.Trim().ToUpperInvariant();
        var (paymentMode, receiveAccount) = ResolveReceiveAccount();

        if (!CanBuildQr(receiveAccount))
            throw new OrderValidationException("Chưa cấu hình tài khoản nhận chuyển khoản.");

        var qrImageUrl = BuildVietQrImageUrl(
            _pos.BankBin,
            receiveAccount,
            _pos.AccountHolder,
            amount,
            transferContent,
            _pos.Template);

        var expiresAt = EnsureUtc(expiresAtUtc);
        var isExpired = DateTime.UtcNow >= expiresAt;

        return new TransferQrResponse(
            qrImageUrl,
            qrImageUrl,
            transferContent,
            receiveAccount,
            paymentMode,
            expiresAt,
            isExpired);
    }

    private static DateTime EnsureUtc(DateTime value) =>
        value.Kind switch
        {
            DateTimeKind.Utc => value,
            DateTimeKind.Local => value.ToUniversalTime(),
            _ => DateTime.SpecifyKind(value, DateTimeKind.Utc)
        };

    private static Payment? GetTransferPayment(Order order) =>
        order.Payments?.FirstOrDefault(p =>
            p.PaymentPurpose != PaymentPurpose.RemainingAtPickup
            && p.PaymentMethod is PaymentMethod.VietQR or PaymentMethod.BankTransfer);

    /// POS-06 (cọc): QR thu nốt phần còn lại khi khách quay lại nhận hàng.
    /// Dùng chung hạn 5 phút và webhook SePay như QR bán hàng ở POS.
    public async Task<TransferQrResponse> GetRemainingBalanceQrAsync(
        Guid orderId, OrderAccessContext access, bool forceRefresh, CancellationToken ct = default)
    {
        var order = await orderRepo.GetByIdAsync(orderId, ct)
            ?? throw new OrderNotFoundException(orderId);
        EnsureCanCollectAtCounter(order, access);

        var remaining = GetRemainingBalance(order);
        if (remaining <= 0)
            throw new OrderValidationException("Đơn không còn khoản phải thu.");

        var payment = GetRemainingPayment(order);
        if (payment is null)
        {
            var now = DateTime.UtcNow;
            payment = new Payment
            {
                Id = Guid.NewGuid(),
                OrderId = order.Id,
                PaymentMethod = PaymentMethod.VietQR,
                Amount = remaining,
                PaymentStatus = PaymentStatus.Pending,
                PaymentPurpose = PaymentPurpose.RemainingAtPickup,
                TransferQrExpiresAtUtc = now.AddMinutes(GetExpiryMinutes()),
                CreatedAt = now,
                UpdatedAt = now
            };
            order.Payments?.Add(payment);
            await orderRepo.SaveChangesAsync(ct);
        }
        else if (payment.PaymentStatus == PaymentStatus.Success)
        {
            throw new OrderValidationException("Khách đã thanh toán phần còn lại.");
        }
        else if (forceRefresh || !payment.TransferQrExpiresAtUtc.HasValue
                 || payment.TransferQrExpiresAtUtc.Value <= DateTime.UtcNow)
        {
            payment.PaymentMethod = PaymentMethod.VietQR;
            payment.Amount = remaining;
            payment.TransferQrExpiresAtUtc = DateTime.UtcNow.AddMinutes(GetExpiryMinutes());
            payment.UpdatedAt = DateTime.UtcNow;
            await orderRepo.SaveChangesAsync(ct);
        }

        return CreateTransferQrResponse(
            order.OrderCode,
            ApplyTestQrAmount(remaining),
            payment.TransferQrExpiresAtUtc!.Value);
    }

    public async Task<PosOrderPaymentStatusResponse> GetRemainingBalanceStatusAsync(
        Guid orderId, OrderAccessContext access, CancellationToken ct = default)
    {
        var order = await orderRepo.GetByIdAsync(orderId, ct)
            ?? throw new OrderNotFoundException(orderId);
        EnsureCanCollectAtCounter(order, access);

        var payment = GetRemainingPayment(order);
        var isPaid = order.OrderStatus == OrderStatus.Completed
            || payment?.PaymentStatus == PaymentStatus.Success;

        return new PosOrderPaymentStatusResponse(
            order.Id,
            order.OrderCode,
            (payment?.PaymentStatus ?? PaymentStatus.Pending).ToString(),
            order.OrderStatus.ToString(),
            isPaid,
            null,
            order.OrderCode,
            ApplyTestQrAmount(GetRemainingBalance(order)),
            GetRemainingBalance(order));
    }

    private static Payment? GetRemainingPayment(Order order) =>
        order.Payments?.FirstOrDefault(p => p.PaymentPurpose == PaymentPurpose.RemainingAtPickup);

    private static decimal GetRemainingBalance(Order order)
    {
        var collected = (order.Payments ?? [])
            .Where(p => p.PaymentStatus == PaymentStatus.Success)
            .Sum(p => p.Amount);
        return Math.Max(0, order.FinalAmount - collected);
    }

    private static void EnsureTransferPaymentPending(Order order, Payment payment)
    {
        if (payment.PaymentStatus == PaymentStatus.Success
            || order.OrderStatus is OrderStatus.Completed or OrderStatus.Cancelled)
        {
            throw new OrderValidationException("Đơn đã thanh toán hoặc không còn chờ chuyển khoản.");
        }
    }

    private int GetExpiryMinutes() =>
        _sepay.PosVaDurationSeconds > 0
            ? Math.Max(1, _sepay.PosVaDurationSeconds / 60)
            : 15;

    public async Task<PosOrderPaymentStatusResponse> GetOrderPaymentStatusAsync(
        Guid orderId, OrderAccessContext access, CancellationToken ct = default)
    {
        var order = await orderLogic.GetByIdAsync(orderId, access, ct);
        var transferPayment = order.Payments?.FirstOrDefault(p =>
            IsTransferPaymentMethod(p.PaymentMethod));
        var paymentStatus = transferPayment?.PaymentStatus
            ?? ((order.Payments ?? []).All(payment =>
                    string.Equals(
                        payment.PaymentStatus,
                        PaymentStatus.Success.ToString(),
                        StringComparison.OrdinalIgnoreCase))
                ? PaymentStatus.Success.ToString()
                : PaymentStatus.Pending.ToString());
        static bool IsPostPaymentStatus(string status) =>
            string.Equals(status, OrderStatus.Completed.ToString(), StringComparison.OrdinalIgnoreCase)
            || string.Equals(status, OrderStatus.WaitingProduction.ToString(), StringComparison.OrdinalIgnoreCase)
            || string.Equals(status, OrderStatus.WaitingTransfer.ToString(), StringComparison.OrdinalIgnoreCase)
            || string.Equals(status, OrderStatus.WaitingMaterials.ToString(), StringComparison.OrdinalIgnoreCase)
            || string.Equals(status, OrderStatus.ReadyToDeliver.ToString(), StringComparison.OrdinalIgnoreCase);

        var transferPending = transferPayment is not null
            && !string.Equals(
                paymentStatus,
                PaymentStatus.Success.ToString(),
                StringComparison.OrdinalIgnoreCase);
        // Đơn chờ đóng gói/SX không được coi là đã thu QR — nếu không trang POS ẩn QR cọc.
        var isPaid = !transferPending
            && (IsPostPaymentStatus(order.OrderStatus)
                || string.Equals(
                    paymentStatus,
                    PaymentStatus.Success.ToString(),
                    StringComparison.OrdinalIgnoreCase));

        return new PosOrderPaymentStatusResponse(
            order.Id,
            order.OrderCode,
            paymentStatus,
            order.OrderStatus,
            isPaid,
            null,
            order.OrderCode,
            transferPayment is not null
                ? GetTransferQrAmountForResponse(order, transferPayment)
                : order.FinalAmount,
            transferPayment is not null
                ? GetRealTransferQrAmountForResponse(order, transferPayment)
                : order.FinalAmount);
    }

    private decimal GetTransferQrAmountForResponse(
        OrderResponse order,
        PaymentResponse payment) =>
        ApplyTestQrAmount(
            ResolveTransferQrAmount(payment.Amount, order.FinalAmount)
            + GetDebtSettlementAmount(payment.CodDebtSettlementJson));

    private static decimal GetRealTransferQrAmountForResponse(
        OrderResponse order,
        PaymentResponse payment) =>
        ResolveTransferQrAmount(payment.Amount, order.FinalAmount)
        + GetDebtSettlementAmount(payment.CodDebtSettlementJson);

    public async Task HandleSepayWebhookAsync(SepayWebhookPayload payload, CancellationToken ct = default)
    {
        if (!_sepay.EnableWebhook)
        {
            logger.LogWarning("SePay webhook received but Sepay:EnableWebhook is false.");
            return;
        }

        if (!string.Equals(payload.TransferType, "in", StringComparison.OrdinalIgnoreCase))
        {
            logger.LogInformation("SePay webhook skipped: transferType={TransferType} (not 'in').", payload.TransferType);
            return;
        }

        if (_sepay.ValidateAccountNumber
            && !string.IsNullOrWhiteSpace(_sepay.AccountNumber)
            && !string.Equals(
                NormalizeDigits(payload.AccountNumber),
                NormalizeDigits(_sepay.AccountNumber),
                StringComparison.Ordinal))
        {
            logger.LogWarning(
                "SePay webhook ignored: account {Account} does not match configured account.",
                payload.AccountNumber);
            return;
        }

        var receivedAmount = payload.TransferAmount;
        var orderCode = ResolveOrderCode(payload);
        Order? order;

        if (!string.IsNullOrWhiteSpace(orderCode))
        {
            order = await orderRepo.GetByCodeAsync(orderCode, ct);
            if (order is null)
            {
                logger.LogWarning("SePay webhook ignored: order {OrderCode} not found.", orderCode);
                return;
            }
        }
        else
        {
            // Chế độ QR test ép mọi QR về cùng một số tiền nên không thể dò đơn theo FinalAmount.
            order = _pos.TestQrFixedAmountVnd > 0
                ? await orderRepo.GetLatestPendingTransferAsync(DateTime.UtcNow, ct)
                : await orderRepo.GetSinglePendingTransferByAmountAsync(
                    receivedAmount,
                    _sepay.AmountToleranceVnd,
                    ct);

            if (order is null)
            {
                logger.LogWarning(
                    "SePay webhook ignored: no order code and no unique pending transfer for amount {Amount}.",
                    receivedAmount);
                return;
            }

            orderCode = order.OrderCode;
        }

        if (order.OrderStatus == OrderStatus.Cancelled)
            return;
        if (order.OrderStatus == OrderStatus.Completed)
        {
            await orderLogic.RepublishCompletedCustomerStateAsync(order.Id, ct);
            return;
        }

        var payment = order.Payments?.FirstOrDefault(p =>
            p.PaymentPurpose != PaymentPurpose.RemainingAtPickup
            && p.PaymentMethod is PaymentMethod.VietQR or PaymentMethod.BankTransfer);

        // POS-06 (cọc): đơn đã cọc và đang chờ khách tới lấy — tiền về là phần còn lại.
        if (order.OrderStatus == OrderStatus.ReadyToDeliver && GetRemainingPayment(order) is not null)
        {
            await HandleRemainingBalanceWebhookAsync(order, receivedAmount, payload, ct);
            return;
        }

        if (payment is null)
        {
            logger.LogWarning("SePay webhook ignored: order {OrderCode} has no transfer payment.", orderCode);
            return;
        }

        if (payment.PaymentStatus == PaymentStatus.Success)
        {
            logger.LogInformation(
                "SePay webhook duplicate ignored: payment for order {OrderCode} is already successful.",
                orderCode);
            return;
        }

        // QR expiry chỉ kiểm soát việc hiển thị/làm mới QR trên UI; không dùng để từ chối thanh toán.
        // Nếu ngân hàng đã gửi tiền kèm mã đơn hợp lệ thì phải ghi nhận dù QR đã hết hạn.
        if (payment.TransferQrExpiresAtUtc.HasValue
            && payment.TransferQrExpiresAtUtc.Value <= DateTime.UtcNow)
        {
            logger.LogInformation(
                "SePay webhook: QR for order {OrderCode} was expired at {ExpiresAtUtc} but payment arrived — accepting.",
                orderCode,
                payment.TransferQrExpiresAtUtc.Value);
        }

        var expectedAmount = (long)Math.Round(GetTransferQrAmount(order, payment), MidpointRounding.AwayFromZero);
        var tolerance = Math.Max(0, _sepay.AmountToleranceVnd);

        // Chế độ test QR: số tiền cố định TestQrFixedAmountVnd (thường rất nhỏ) không so sánh
        // được với giá trị thật của đơn — bỏ qua hoàn toàn amount check.
        var isTestQrMode = _pos.TestQrFixedAmountVnd > 0;

        if (!isTestQrMode)
        {
            // Từ chối nếu chuyển thừa quá tolerance (có thể nhầm đơn) hoặc chuyển 0/âm
            if (receivedAmount <= 0 || receivedAmount > expectedAmount + tolerance)
            {
                logger.LogWarning(
                    "SePay webhook ignored: amount out of range for {OrderCode}. Expected {Expected}, got {Received}.",
                    orderCode,
                    expectedAmount,
                    receivedAmount);
                return;
            }

            // Cho phép chuyển thiếu — phần còn lại sẽ tính vào công nợ khách hàng
            if (receivedAmount < expectedAmount - tolerance)
            {
                logger.LogWarning(
                    "SePay webhook ignored: transfer component is incomplete for {OrderCode}. Expected {Expected}, received {Received}.",
                    orderCode,
                    expectedAmount,
                    receivedAmount);
                return;
            }
        }

        payment.TransactionRef = payload.ReferenceCode ?? payload.Id.ToString(CultureInfo.InvariantCulture);
        await orderRepo.SaveChangesAsync(ct);

        // Ở chế độ QR test, khách chỉ chuyển số tiền tượng trưng nhưng đơn phải ghi nhận
        // đủ giá trị thật, nếu không phần chênh sẽ bị tính thành công nợ khách hàng.
        var creditedAmount = _pos.TestQrFixedAmountVnd > 0
            ? GetRealTransferAmount(order, payment)
            : receivedAmount;

        await orderLogic.CompleteAsync(
            order.Id,
            new OrderAccessContext(Guid.Empty, CanViewAllOrders: true),
            actorName: "SePay Webhook",
            actualReceivedAmount: creditedAmount,
            ct: ct);
        logger.LogInformation("SePay webhook completed order {OrderCode}.", orderCode);
    }

    private async Task HandleRemainingBalanceWebhookAsync(
        Order order, long receivedAmount, SepayWebhookPayload payload, CancellationToken ct)
    {
        var payment = GetRemainingPayment(order)!;
        if (payment.PaymentStatus == PaymentStatus.Success)
            return;

        // Mã VietQR tĩnh không thể thu hồi ở phía ngân hàng: khách vẫn quét được ảnh cũ.
        // Tiền đã về thì phải ghi nhận, hạn 5 phút chỉ điều khiển việc hiển thị/làm mới QR.
        if (payment.TransferQrExpiresAtUtc.HasValue
            && payment.TransferQrExpiresAtUtc.Value <= DateTime.UtcNow)
        {
            logger.LogWarning(
                "SePay webhook: remaining-balance QR for {OrderCode} was expired but payment arrived — accepting.",
                order.OrderCode);
        }

        var remaining = GetRemainingBalance(order);
        var expected = (long)Math.Round(ApplyTestQrAmount(remaining), MidpointRounding.AwayFromZero);
        var tolerance = Math.Max(0, _sepay.AmountToleranceVnd);
        if (receivedAmount <= 0
            || receivedAmount > expected + tolerance
            || receivedAmount < expected - tolerance)
        {
            logger.LogWarning(
                "SePay webhook ignored: remaining-balance amount mismatch for {OrderCode}. Expected {Expected}, got {Received}.",
                order.OrderCode,
                expected,
                receivedAmount);
            return;
        }

        payment.TransactionRef = payload.ReferenceCode ?? payload.Id.ToString(CultureInfo.InvariantCulture);
        payment.Amount = remaining;
        payment.PaymentStatus = PaymentStatus.Success;
        payment.PaidAt = DateTime.UtcNow;
        payment.UpdatedAt = DateTime.UtcNow;
        await orderRepo.SaveChangesAsync(ct);

        await orderLogic.MarkDeliveredAsync(
            order.Id,
            new OrderAccessContext(Guid.Empty, CanViewAllOrders: true),
            actorName: order.EmployeeSnapshotName,
            ct: ct);
        logger.LogInformation("SePay webhook collected remaining balance for {OrderCode}.", order.OrderCode);
    }

    private static void EnsureCanModify(Order order, OrderAccessContext access)    {
        if (!access.CanModifyOrder(order))
            throw new OrderForbiddenException();
    }

    /// Thu tiền tại quầy không phụ thuộc người tạo đơn: khách quay lại nhận hàng
    /// có thể gặp bất kỳ thu ngân nào đang trực.
    private static void EnsureCanCollectAtCounter(Order order, OrderAccessContext access)
    {
        if (!access.CanViewOrder(order))
            throw new OrderForbiddenException();
    }

    public async Task SimulateWebhookAsync(
        SimulateSepayWebhookRequest request, CancellationToken ct = default)
    {
        if (!_pos.AllowSimulateWebhook)
            throw new OrderValidationException("Mô phỏng webhook đang tắt.");

        await HandleSepayWebhookAsync(new SepayWebhookPayload(
            Id: DateTimeOffset.UtcNow.ToUnixTimeSeconds(),
            Gateway: _pos.BankName,
            TransactionDate: DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss", CultureInfo.InvariantCulture),
            AccountNumber: _pos.AccountNumber,
            SubAccount: _sepay.StaticVaNumber,
            Code: request.OrderCode.Trim().ToUpperInvariant(),
            Content: request.OrderCode.Trim().ToUpperInvariant(),
            TransferType: "in",
            Description: "Simulated webhook",
            TransferAmount: (long)Math.Round(request.Amount, MidpointRounding.AwayFromZero),
            Accumulated: 0,
            ReferenceCode: "SIMULATED"), ct);
    }

    private (string PaymentMode, string ReceiveAccount) ResolveReceiveAccount()
    {
        if (_sepay.RequireSepayVaForTransfer && !string.IsNullOrWhiteSpace(_sepay.StaticVaNumber))
            return ("sepay_static_va", _sepay.StaticVaNumber.Trim());

        if (_sepay.RequireSepayVaForTransfer && !string.IsNullOrWhiteSpace(_sepay.ApiToken))
            return ("sepay_order_va", _sepay.StaticVaNumber.Trim());

        return ("vietqr_main", _pos.AccountNumber.Trim());
    }

    private bool HasSepayVa() =>
        !string.IsNullOrWhiteSpace(_sepay.StaticVaNumber)
        || !string.IsNullOrWhiteSpace(_sepay.ApiToken);

    private bool CanBuildQr(string receiveAccount) =>
        !string.IsNullOrWhiteSpace(_pos.BankBin) && !string.IsNullOrWhiteSpace(receiveAccount);

    private static string ResolveOrderCode(SepayWebhookPayload payload)
    {
        if (!string.IsNullOrWhiteSpace(payload.Code))
            return payload.Code.Trim().ToUpperInvariant();

        var haystack = string.Join(
            ' ',
            new[] { payload.Content, payload.Description }
                .Where(value => !string.IsNullOrWhiteSpace(value))
                .Select(value => value!.Trim()));

        if (string.IsNullOrWhiteSpace(haystack))
            return "";

        // BIDV và một số ngân hàng strip dấu gạch ngang khi gửi nội dung chuyển khoản
        // nên cần match cả "HVT-260819-010" lẫn "HVT260819010".
        var hvtMatch = Regex.Match(haystack, @"HVT-?(\d{6})-?(\d{3})", RegexOptions.IgnoreCase);
        if (hvtMatch.Success)
        {
            // Chuẩn hóa về dạng có dấu gạch ngang để tra cứu DB khớp với OrderCode đã lưu.
            return $"HVT-{hvtMatch.Groups[1].Value}-{hvtMatch.Groups[2].Value}".ToUpperInvariant();
        }

        var ordMatch = Regex.Match(haystack, @"ORD[A-Z0-9-]*", RegexOptions.IgnoreCase);
        if (ordMatch.Success)
            return ordMatch.Value.ToUpperInvariant();

        return "";
    }

    private static string NormalizeDigits(string? value) =>
        new string((value ?? "").Where(char.IsDigit).ToArray());

    private static string BuildVietQrImageUrl(
        string bankBin,
        string accountNumber,
        string accountHolder,
        decimal amount,
        string addInfo,
        string template)
    {
        var normalizedTemplate = string.IsNullOrWhiteSpace(template) ? "compact2" : template.Trim();
        var normalizedAmount = Math.Max(0, (long)Math.Round(amount, MidpointRounding.AwayFromZero));
        var queryParts = new List<string>();

        if (normalizedAmount > 0)
            queryParts.Add($"amount={Uri.EscapeDataString(normalizedAmount.ToString(CultureInfo.InvariantCulture))}");
        if (!string.IsNullOrWhiteSpace(addInfo))
            queryParts.Add($"addInfo={Uri.EscapeDataString(addInfo.Trim())}");
        if (!string.IsNullOrWhiteSpace(accountHolder))
            queryParts.Add($"accountName={Uri.EscapeDataString(accountHolder.Trim())}");

        var queryString = string.Join('&', queryParts);
        return $"https://img.vietqr.io/image/{bankBin}-{accountNumber}-{normalizedTemplate}.jpg"
               + (string.IsNullOrEmpty(queryString) ? "" : $"?{queryString}");
    }
}
