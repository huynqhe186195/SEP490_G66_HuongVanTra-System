namespace OrderService.Application.Options;

public class PosTransferPaymentOptions
{
    public const string SectionName = "PosTransferPayment";

    public string BankCode { get; set; } = "";
    public string BankBin { get; set; } = "";
    public string BankName { get; set; } = "";
    public string AccountNumber { get; set; } = "";
    public string AccountHolder { get; set; } = "";
    public string Template { get; set; } = "compact2";
    public string ClientId { get; set; } = "";
    public string ApiKey { get; set; } = "";
    public bool AllowSimulateWebhook { get; set; }
    public string SimulateWebhookSecret { get; set; } = "";
}
