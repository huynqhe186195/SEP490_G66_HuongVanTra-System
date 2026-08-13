namespace DocumentService.Infrastructure.Helpers;

internal static class VietnameseNumberWords
{
    private static readonly string[] Units = ["", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];
    private static readonly string[] Tens = ["", "mười", "hai mươi", "ba mươi", "bốn mươi", "năm mươi",
        "sáu mươi", "bảy mươi", "tám mươi", "chín mươi"];

    public static string Convert(decimal amount)
    {
        var intPart = (long)Math.Floor(amount);
        if (intPart == 0) return "Không đồng";

        var result = ConvertLong(intPart);
        return char.ToUpper(result[0]) + result[1..] + " đồng";
    }

    private static string ConvertLong(long n)
    {
        if (n == 0) return "không";
        if (n < 0) return "âm " + ConvertLong(-n);

        var parts = new List<string>();

        if (n >= 1_000_000_000_000L)
        {
            parts.Add(ConvertLong(n / 1_000_000_000_000L) + " nghìn tỷ");
            n %= 1_000_000_000_000L;
        }
        if (n >= 1_000_000_000L)
        {
            parts.Add(ConvertLong(n / 1_000_000_000L) + " tỷ");
            n %= 1_000_000_000L;
        }
        if (n >= 1_000_000L)
        {
            parts.Add(ConvertLong(n / 1_000_000L) + " triệu");
            n %= 1_000_000L;
        }
        if (n >= 1_000L)
        {
            parts.Add(ConvertLong(n / 1_000L) + " nghìn");
            n %= 1_000L;
        }
        if (n > 0)
            parts.Add(ConvertThreeDigits((int)n, parts.Count > 0));

        return string.Join(" ", parts);
    }

    private static string ConvertThreeDigits(int n, bool hasHigher)
    {
        var hundreds = n / 100;
        var remainder = n % 100;
        var tens = remainder / 10;
        var units = remainder % 10;

        var sb = new System.Text.StringBuilder();

        if (hundreds > 0)
            sb.Append(Units[hundreds] + " trăm");
        else if (hasHigher)
            sb.Append("không trăm");

        if (tens == 0 && units > 0 && (hundreds > 0 || hasHigher))
            sb.Append(" lẻ " + Units[units]);
        else if (tens == 1)
        {
            sb.Append((sb.Length > 0 ? " " : "") + "mười");
            if (units == 5) sb.Append(" lăm");
            else if (units > 0) sb.Append(" " + Units[units]);
        }
        else if (tens > 1)
        {
            sb.Append((sb.Length > 0 ? " " : "") + Tens[tens]);
            if (units == 1) sb.Append(" mốt");
            else if (units == 4) sb.Append(" tư");
            else if (units == 5) sb.Append(" lăm");
            else if (units > 0) sb.Append(" " + Units[units]);
        }
        else if (units > 0 && hundreds == 0 && !hasHigher)
            sb.Append(Units[units]);

        return sb.ToString().Trim();
    }
}
