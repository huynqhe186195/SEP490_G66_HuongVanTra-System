namespace HuongVanTra.Service.Sales {
    public interface IPaymentWebhookService {
        Task<WebhookProcessResult> ProcessSepayWebhookAsync(
            SepayWebhookCommand command,
            CancellationToken cancellationToken = default);
    }
}
