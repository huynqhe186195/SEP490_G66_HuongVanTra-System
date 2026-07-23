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
        var order = await orderRepo.GetByIdAsync(orderId, ct)
            ?? throw new OrderNotFoundException(orderId);
        EnsureCanAccess(order, access);
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
        EnsureCanAccess(order, access);
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

    private static decimal GetTransferQrAmount(Order order, Payment payment) =>
        ResolveTransferQrAmount(payment.Amount, order.FinalAmount)
        + GetDebtSettlementAmount(payment.CodDebtSettlementJson);

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
            p.PaymentMethod is PaymentMethod.VietQR or PaymentMethod.BankTransfer);

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
            ?? (order.Payments.All(payment =>
                    string.Equals(
                        payment.PaymentStatus,
                        PaymentStatus.Success.ToString(),
                        StringComparison.OrdinalIgnoreCase))
                ? PaymentStatus.Success.ToString()
                : PaymentStatus.Pending.ToString());
        var isPaid = string.Equals(
            order.OrderStatus,
            OrderStatus.Completed.ToString(),
            StringComparison.OrdinalIgnoreCase);

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
                : order.FinalAmount);
    }

    private static decimal GetTransferQrAmountForResponse(
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
            order = await orderRepo.GetSinglePendingTransferByAmountAsync(
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
            p.PaymentMethod is PaymentMethod.VietQR or PaymentMethod.BankTransfer);
        if (payment is null)
        {
            logger.LogWarning("SePay webhook ignored: order {OrderCode} has no transfer payment.", orderCode);
            return;
        }

        if (payment.PaymentStatus == PaymentStatus.Success)
        {
            await orderLogic.CompleteAsync(
                order.Id,
                new OrderAccessContext(Guid.Empty, CanViewAllOrders: true),
                actorName: "SePay Webhook Retry",
                ct: ct);
            return;
        }

        if (payment.TransferQrExpiresAtUtc.HasValue
            && payment.TransferQrExpiresAtUtc.Value <= DateTime.UtcNow)
        {
            logger.LogWarning(
                "SePay webhook ignored: transfer QR for order {OrderCode} expired at {ExpiresAtUtc}.",
                orderCode,
                payment.TransferQrExpiresAtUtc.Value);
            return;
        }

        var expectedAmount = (long)Math.Round(GetTransferQrAmount(order, payment), MidpointRounding.AwayFromZero);
        var tolerance = Math.Max(0, _sepay.AmountToleranceVnd);

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

        payment.TransactionRef = payload.ReferenceCode ?? payload.Id.ToString(CultureInfo.InvariantCulture);
        await orderRepo.SaveChangesAsync(ct);
        await orderLogic.CompleteAsync(
            order.Id,
            new OrderAccessContext(Guid.Empty, CanViewAllOrders: true),
            actorName: "SePay Webhook",
            actualReceivedAmount: (decimal)receivedAmount,
            ct: ct);
        logger.LogInformation("SePay webhook completed order {OrderCode}.", orderCode);
    }

    private static void EnsureCanAccess(Order order, OrderAccessContext access)
    {
        if (!access.CanAccessOrder(order))
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

        var hvtMatch = Regex.Match(haystack, @"HVT-\d{6}-\d{3}", RegexOptions.IgnoreCase);
        if (hvtMatch.Success)
            return hvtMatch.Value.ToUpperInvariant();

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
