namespace UserService.Application.Options;

public class SmsOptions
{
    public const string SectionName = "Sms";

    /// <summary>Bật gửi SMS thật. False = chỉ ghi log (dev/demo).</summary>
    public bool Enabled { get; set; }

    /// <summary>Hiện chỉ hỗ trợ: Esms</summary>
    public string Provider { get; set; } = "Esms";

    public string ApiKey { get; set; } = string.Empty;
    public string SecretKey { get; set; } = string.Empty;

    /// <summary>Brandname đã đăng ký trên eSMS (bắt buộc khi Enabled).</summary>
    public string BrandName { get; set; } = string.Empty;

    /// <summary>2 = tin CSKH/OTP theo tài liệu eSMS.</summary>
    public string SmsType { get; set; } = "2";

    /// <summary>1 = Sandbox (không trừ tiền, không về máy). 0 = gửi thật.</summary>
    public string Sandbox { get; set; } = "0";

    /// <summary>0 = không dấu (rẻ hơn), 1 = Unicode.</summary>
    public string IsUnicode { get; set; } = "0";

    public string ApiUrl { get; set; } =
        "https://rest.esms.vn/MainService.svc/json/SendMultipleMessage_V4_post_json/";

    /// <summary>Dùng {otp} và {minutes}.</summary>
    public string OtpTemplate { get; set; } =
        "HVT: Ma OTP dat lai mat khau la {otp}. Hieu luc {minutes} phut. Khong chia se ma nay.";
}
