using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;
using DocumentService.Application.Interfaces;
using DocumentService.Application.Models;
using DocumentService.Domain.Exceptions;
using UglyToad.PdfPig;
using UglyToad.PdfPig.Content;

namespace DocumentService.Infrastructure.Services;

public class ContractPdfParser : IContractPdfParser
{
    public Task<ParsedContractData> ParseAsync(Stream pdfStream, string fileName, CancellationToken ct = default)
    {
        try
        {
            var bytes = ReadAllBytes(pdfStream);
            using var doc = PdfDocument.Open(bytes);

            var allLines = ExtractLines(doc);

            var contractCode = ExtractContractCode(allLines);
            var effectiveDate = ExtractEffectiveDate(allLines);
            var signedAtLocation = ExtractSignedAtLocation(allLines);
            var (buyerName, buyerTaxCode) = ExtractBuyerInfo(allLines);
            var lineItems = ExtractLineItems(allLines);
            var paymentMethod = ExtractArticleContent(allLines, "Điều 2");
            var deliveryTerms = ExtractArticleContent(allLines, "Điều 3");

            if (string.IsNullOrWhiteSpace(buyerName))
                throw new ContractValidationException("Không tìm thấy thông tin Bên B (Tên doanh nghiệp).");

            if (lineItems.Count == 0)
                throw new ContractValidationException("Không tìm thấy bảng hàng hóa trong file PDF.");

            return Task.FromResult(new ParsedContractData(
                contractCode,
                effectiveDate,
                signedAtLocation,
                buyerName,
                buyerTaxCode,
                lineItems,
                paymentMethod,
                deliveryTerms,
                ShippingResponsibility: null));
        }
        catch (Exception ex) when (ex is not ContractValidationException)
        {
            throw new ContractValidationException($"Lỗi khi parse file PDF: {ex.Message}");
        }
    }

    // PdfPig groups words by position — rebuild logical lines by clustering words with similar Y
    private static List<string> ExtractLines(PdfDocument doc)
    {
        var allWords = new List<(double X, double Y, string Text, int Page)>();

        foreach (var page in doc.GetPages())
        {
            foreach (var word in page.GetWords())
            {
                allWords.Add((word.BoundingBox.Left, word.BoundingBox.Bottom, word.Text, page.Number));
            }
        }

        // Group by page then by Y (round to nearest 3pt to cluster same-line words)
        var lines = allWords
            .GroupBy(w => (w.Page, Y: Math.Round(w.Y / 3) * 3))
            .OrderBy(g => g.Key.Page)
            .ThenByDescending(g => g.Key.Y)
            .Select(g => string.Join(" ", g.OrderBy(w => w.X).Select(w => w.Text)).Trim())
            .Where(l => !string.IsNullOrWhiteSpace(l))
            .ToList();

        return lines;
    }

    private static byte[] ReadAllBytes(Stream stream)
    {
        using var ms = new MemoryStream();
        stream.CopyTo(ms);
        return ms.ToArray();
    }

    private static string? ExtractContractCode(List<string> lines)
    {
        var pattern = @"Số:\s*(\S+)/HĐMB";
        foreach (var line in lines)
        {
            var match = Regex.Match(line, pattern);
            if (match.Success)
                return match.Groups[1].Value.Trim();
        }
        return null;
    }

    private static DateOnly? ExtractEffectiveDate(List<string> lines)
    {
        var pattern = @"ngày\s+(\d+)\s+tháng\s+(\d+)\s+năm\s+(\d+)";
        foreach (var line in lines)
        {
            var match = Regex.Match(line, pattern);
            if (match.Success &&
                int.TryParse(match.Groups[3].Value, out var year) &&
                int.TryParse(match.Groups[2].Value, out var month) &&
                int.TryParse(match.Groups[1].Value, out var day))
            {
                try { return new DateOnly(year, month, day); }
                catch { }
            }
        }
        return null;
    }

    private static string? ExtractSignedAtLocation(List<string> lines)
    {
        var pattern = @"tại\s+([^,]+)";
        foreach (var line in lines)
        {
            if (line.Contains("Hôm nay"))
            {
                var match = Regex.Match(line, pattern);
                if (match.Success)
                {
                    var location = match.Groups[1].Value.Trim();
                    if (!location.Contains("……") && !location.Contains("..."))
                        return location;
                }
            }
        }
        return null;
    }

    private static (string? BuyerName, string? BuyerTaxCode) ExtractBuyerInfo(List<string> lines)
    {
        string? buyerName = null;
        string? buyerTaxCode = null;
        bool inBuyerSection = false;

        foreach (var line in lines)
        {
            if (line.Contains("BÊN MUA") && line.Contains("Bên B"))
            {
                inBuyerSection = true;
                continue;
            }

            if (inBuyerSection)
            {
                if (line.Contains("Tên doanh nghiệp:"))
                    buyerName = ExtractFieldValue(line, "Tên doanh nghiệp:");
                else if (line.Contains("Mã số doanh nghiệp:"))
                {
                    buyerTaxCode = ExtractFieldValue(line, "Mã số doanh nghiệp:");
                    if (buyerTaxCode?.Contains("……") == true || buyerTaxCode?.Contains("...") == true)
                        buyerTaxCode = null;
                }
                else if (line.Contains("Điều 1") || line.Contains("Trên cơ sở"))
                    break;
            }
        }

        return (buyerName, buyerTaxCode);
    }

    private static string? ExtractFieldValue(string text, string fieldName)
    {
        var idx = text.IndexOf(fieldName, StringComparison.OrdinalIgnoreCase);
        if (idx < 0) return null;
        var value = text[(idx + fieldName.Length)..].Trim();
        return string.IsNullOrWhiteSpace(value) || value.Contains("……") ? null : value;
    }

    private static string? ExtractArticleContent(List<string> lines, string articlePrefix)
    {
        var content = new List<string>();
        bool inArticle = false;

        foreach (var line in lines)
        {
            if (line.StartsWith(articlePrefix, StringComparison.OrdinalIgnoreCase))
            {
                inArticle = true;
                continue;
            }

            if (inArticle)
            {
                if (line.StartsWith("Điều ", StringComparison.OrdinalIgnoreCase))
                    break;
                content.Add(line);
            }
        }

        var result = string.Join(" ", content).Trim();
        return string.IsNullOrWhiteSpace(result) ? null : result;
    }

    // Detect table rows by finding lines where column 0 is a small integer (row number)
    private static List<ParsedLineItem> ExtractLineItems(List<string> lines)
    {
        var items = new List<ParsedLineItem>();
        bool inTable = false;

        foreach (var line in lines)
        {
            var lower = line.ToLowerInvariant();

            // Detect header row
            if (!inTable && lower.Contains("tên hàng") && lower.Contains("số lượng") && lower.Contains("đơn giá"))
            {
                inTable = true;
                continue;
            }

            if (!inTable) continue;

            // Stop at total row
            if (lower.Contains("tổng cộng") || lower.Contains("tổng tiền"))
                break;

            // Each data row starts with a line number
            var parts = SplitTableRow(line);
            if (parts.Count < 6) continue;

            if (!int.TryParse(parts[0].Trim(), out var lineNumber))
                continue;

            var productName = parts[1].Trim();
            if (string.IsNullOrWhiteSpace(productName)) continue;

            var unit = parts.Count > 2 ? parts[2].Trim() : null;
            var quantity = ParseVietnameseDecimal(parts.Count > 3 ? parts[3] : "");
            var unitPrice = ParseVietnameseDecimal(parts.Count > 4 ? parts[4] : "");
            var lineAmount = ParseVietnameseDecimal(parts.Count > 5 ? parts[5] : "");
            var note = parts.Count > 6 ? parts[6].Trim() : null;

            items.Add(new ParsedLineItem(
                lineNumber,
                productName,
                string.IsNullOrWhiteSpace(unit) ? null : unit,
                quantity,
                unitPrice,
                lineAmount,
                string.IsNullOrWhiteSpace(note) ? null : note));
        }

        return items;
    }

    // Split a PDF text line into columns — words are space-separated but amounts contain dots/commas
    // Strategy: split on 2+ consecutive spaces (PdfPig preserves inter-column spacing)
    private static List<string> SplitTableRow(string line)
    {
        return Regex.Split(line, @"\s{2,}")
            .Select(s => s.Trim())
            .Where(s => !string.IsNullOrEmpty(s))
            .ToList();
    }

    private static decimal ParseVietnameseDecimal(string text)
    {
        if (string.IsNullOrWhiteSpace(text)) return 0m;
        var cleaned = text.Replace(".", "").Replace(",", ".").Trim();
        return decimal.TryParse(cleaned, NumberStyles.Any, CultureInfo.InvariantCulture, out var result)
            ? result : 0m;
    }
}
