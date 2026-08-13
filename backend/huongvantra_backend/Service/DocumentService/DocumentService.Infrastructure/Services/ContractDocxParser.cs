using System.Globalization;
using System.Text.RegularExpressions;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Wordprocessing;
using DocumentService.Application.Interfaces;
using DocumentService.Application.Models;
using DocumentService.Domain.Exceptions;

namespace DocumentService.Infrastructure.Services;

public class ContractDocxParser : IContractDocxParser
{
    public Task<ParsedContractData> ParseAsync(Stream docxStream, string fileName, CancellationToken ct = default)
    {
        try
        {
            using var doc = WordprocessingDocument.Open(docxStream, false);
            var body = doc.MainDocumentPart?.Document?.Body;
            if (body is null)
                throw new ContractValidationException("File Word không hợp lệ hoặc không có nội dung.");

            var allText = GetAllParagraphTexts(body);

            var contractCode = ExtractContractCode(allText);
            var effectiveDate = ExtractEffectiveDate(allText);
            var signedAtLocation = ExtractSignedAtLocation(allText);
            var (buyerName, buyerTaxCode) = ExtractBuyerInfo(allText);
            var lineItems = ExtractLineItems(body);
            var paymentMethod = ExtractArticleContent(allText, "Điều 2");
            var deliveryTerms = ExtractArticleContent(allText, "Điều 3");

            if (string.IsNullOrWhiteSpace(buyerName))
                throw new ContractValidationException("Không tìm thấy thông tin Bên B (Tên doanh nghiệp).");

            if (lineItems.Count == 0)
                throw new ContractValidationException("Không tìm thấy bảng hàng hóa trong file Word.");

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
            throw new ContractValidationException($"Lỗi khi parse file Word: {ex.Message}");
        }
    }

    private static List<string> GetAllParagraphTexts(Body body)
    {
        return body.Descendants<Paragraph>()
            .Select(p => string.Join("", p.Descendants<Text>().Select(t => t.Text)))
            .Where(s => !string.IsNullOrWhiteSpace(s))
            .ToList();
    }

    private static string? ExtractContractCode(List<string> paragraphs)
    {
        var pattern = @"Số:\s*(\S+)/HĐMB";
        foreach (var para in paragraphs)
        {
            var match = Regex.Match(para, pattern);
            if (match.Success)
                return match.Groups[1].Value.Trim();
        }
        return null;
    }

    private static DateOnly? ExtractEffectiveDate(List<string> paragraphs)
    {
        var pattern = @"ngày\s+(\d+)\s+tháng\s+(\d+)\s+năm\s+(\d+)";
        foreach (var para in paragraphs)
        {
            var match = Regex.Match(para, pattern);
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

    private static string? ExtractSignedAtLocation(List<string> paragraphs)
    {
        var pattern = @"tại\s+([^,]+)";
        foreach (var para in paragraphs)
        {
            if (para.Contains("Hôm nay"))
            {
                var match = Regex.Match(para, pattern);
                if (match.Success)
                {
                    var location = match.Groups[1].Value.Trim();
                    if (!location.Contains("……"))
                        return location;
                }
            }
        }
        return null;
    }

    private static bool IsBuyerSectionHeader(string para)
    {
        var upper = para.ToUpperInvariant();
        return upper.Contains("BÊN MUA") && (upper.Contains("BÊN B") || upper.Contains("(B)"));
    }

    private static (string? BuyerName, string? BuyerTaxCode) ExtractBuyerInfo(List<string> paragraphs)
    {
        string? buyerName = null;
        string? buyerTaxCode = null;
        bool inBuyerSection = false;

        foreach (var para in paragraphs)
        {
            if (IsBuyerSectionHeader(para))
            {
                inBuyerSection = true;
                continue;
            }

            if (inBuyerSection)
            {
                if (para.Contains("Tên doanh nghiệp:"))
                {
                    buyerName = ExtractFieldValue(para, "Tên doanh nghiệp:");
                }
                else if (para.Contains("Họ và tên:"))
                {
                    buyerName ??= ExtractFieldValue(para, "Họ và tên:");
                }
                else if (para.Contains("Mã số doanh nghiệp:"))
                {
                    buyerTaxCode = ExtractFieldValue(para, "Mã số doanh nghiệp:");
                    if (buyerTaxCode?.Contains("……") == true)
                        buyerTaxCode = null;
                }
                else if (para.Contains("Mã số thuế:"))
                {
                    buyerTaxCode ??= ExtractFieldValue(para, "Mã số thuế:");
                    if (buyerTaxCode?.Contains("……") == true)
                        buyerTaxCode = null;
                }
                else if (para.Contains("Điều 1") || para.Contains("Trên cơ sở"))
                {
                    break;
                }
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

    private static string? ExtractArticleContent(List<string> paragraphs, string articlePrefix)
    {
        var content = new List<string>();
        bool inArticle = false;

        foreach (var para in paragraphs)
        {
            if (para.StartsWith(articlePrefix, StringComparison.OrdinalIgnoreCase))
            {
                inArticle = true;
                continue;
            }

            if (inArticle)
            {
                if (para.StartsWith("Điều ", StringComparison.OrdinalIgnoreCase))
                    break;

                content.Add(para);
            }
        }

        var result = string.Join(" ", content).Trim();
        return string.IsNullOrWhiteSpace(result) ? null : result;
    }

    private static List<ParsedLineItem> ExtractLineItems(Body body)
    {
        var tables = body.Descendants<Table>().ToList();
        foreach (var table in tables)
        {
            var rows = table.Descendants<TableRow>().ToList();
            if (rows.Count < 2) continue;

            var headerCells = rows[0].Descendants<TableCell>()
                .Select(c => GetCellText(c).ToLower())
                .ToList();

            if (!headerCells.Any(h => h.Contains("tên hàng")) ||
                !headerCells.Any(h => h.Contains("số lượng")) ||
                !headerCells.Any(h => h.Contains("đơn giá")))
                continue;

            var items = new List<ParsedLineItem>();

            for (int i = 1; i < rows.Count; i++)
            {
                var cells = rows[i].Descendants<TableCell>().Select(GetCellText).ToList();
                if (cells.Count < 6) continue;

                var productName = cells[1].Trim();
                if (string.IsNullOrWhiteSpace(productName) || productName.Contains("Tổng cộng"))
                    break;

                if (!int.TryParse(cells[0].Trim(), out var lineNumber))
                    continue;

                var unit = cells[2].Trim();
                var quantity = ParseVietnameseDecimal(cells[3]);
                var unitPrice = ParseVietnameseDecimal(cells[4]);
                var lineAmount = ParseVietnameseDecimal(cells[5]);
                var note = cells.Count > 6 ? cells[6].Trim() : null;

                items.Add(new ParsedLineItem(
                    lineNumber,
                    productName,
                    string.IsNullOrWhiteSpace(unit) ? null : unit,
                    quantity,
                    unitPrice,
                    lineAmount,
                    string.IsNullOrWhiteSpace(note) ? null : note));
            }

            if (items.Count > 0)
                return items;
        }

        return [];
    }

    private static string GetCellText(TableCell cell)
    {
        return string.Join("", cell.Descendants<Text>().Select(t => t.Text));
    }

    private static decimal ParseVietnameseDecimal(string text)
    {
        if (string.IsNullOrWhiteSpace(text))
            return 0m;

        var cleaned = text.Replace(".", "").Replace(",", ".").Trim();
        return decimal.TryParse(cleaned, NumberStyles.Any, CultureInfo.InvariantCulture, out var result)
            ? result
            : 0m;
    }
}
