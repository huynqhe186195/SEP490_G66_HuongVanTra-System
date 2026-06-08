namespace OrderService.Application.Options;

public class SepayOptions
{
    public const string SectionName = "Sepay";

    public bool EnableWebhook { get; set; }
    public string WebhookSecret { get; set; } = "";
    public string AccountNumber { get; set; } = "";
    public bool ValidateAccountNumber { get; set; }
    public int AmountToleranceVnd { get; set; } = 1000;
    public string ApiBaseUrl { get; set; } = "https://userapi.sepay.vn/v2";
    public string ApiToken { get; set; } = "";
    public string BankAccountUuid { get; set; } = "";
    public string StaticVaNumber { get; set; } = "";
    public int VaDurationSeconds { get; set; } = 86400;
    public int PosVaDurationSeconds { get; set; } = 300;
    public bool RequireSepayVaForTransfer { get; set; }
    public bool AutoResolveBankAccountUuid { get; set; }
}
