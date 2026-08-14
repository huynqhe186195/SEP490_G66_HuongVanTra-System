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
        var pattern = @"Số:\s*([^\s/]+)";
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

    private static bool IsBuyerSectionHeader(string line)
    {
        var upper = line.ToUpperInvariant();
        return upper.Contains("BÊN MUA") && (upper.Contains("BÊN B") || upper.Contains("(B)"));
    }

    private static (string? BuyerName, string? BuyerTaxCode) ExtractBuyerInfo(List<string> lines)
    {
        string? buyerName = null;
        string? buyerTaxCode = null;
        bool inBuyerSection = false;

        foreach (var line in lines)
        {
            if (IsBuyerSectionHeader(line))
            {
                inBuyerSection = true;
                continue;
            }

            if (inBuyerSection)
            {
                if (line.Contains("Tên doanh nghiệp:"))
                    buyerName = ExtractFieldValue(line, "Tên doanh nghiệp:");
                else if (line.Contains("Họ và tên:"))
                    buyerName ??= ExtractFieldValue(line, "Họ và tên:");
                else if (line.Contains("Mã số doanh nghiệp:"))
                {
                    buyerTaxCode = ExtractFieldValue(line, "Mã số doanh nghiệp:");
                    if (buyerTaxCode?.Contains("……") == true || buyerTaxCode?.Contains("...") == true)
                        buyerTaxCode = null;
                }
                else if (line.Contains("Mã số thuế:"))
                {
                    buyerTaxCode ??= ExtractFieldValue(line, "Mã số thuế:");
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

    // PDF tables are rendered word-by-word and cells often wrap across multiple visual lines.
    // Header cells can be split arbitrarily: "Tên" on one line, "hàng" + "hóa" on the next.
    // We use a sliding-window approach: for each line, concatenate the next N lines and check
    // whether the combined text contains enough table-header keywords.
    private static List<ParsedLineItem> ExtractLineItems(List<string> lines)
    {
        // --- Step 1: find the header region end index ---
        // A header region is a group of consecutive short lines (before any anchored data row)
        // whose combined text contains "tên" + "hàng" + at least one of "số lượng"/"đơn giá"/"stt".
        int headerEndIdx = -1;
        const int HeaderWindowSize = 8;

        for (int i = 0; i < lines.Count; i++)
        {
            // Skip article headings like "Điều 1: TÊN HÀNG..."
            if (lines[i].TrimStart().StartsWith("Điều", StringComparison.OrdinalIgnoreCase)) continue;

            // Build a combined view of a small window of consecutive short/label-only lines.
            // A header line has no decimal numbers (prices/quantities) — that's what distinguishes
            // it from a product data line.
            int windowEnd = i;
            var combined = new System.Text.StringBuilder();
            for (int j = i; j < Math.Min(i + HeaderWindowSize, lines.Count); j++)
            {
                // Stop at an anchored data row (starts with row index number)
                if (StartsWithRowIndex(lines[j])) break;
                var jl = lines[j].ToLowerInvariant();
                if (jl.Contains("tổng cộng") || jl.Contains("tổng tiền")) break;
                // Stop if this line contains a decimal number ≥ 100 — it's product data, not a header label
                if (LineContainsDecimalNumber(lines[j])) break;
                combined.Append(' ').Append(jl);
                windowEnd = j;

                // Early-exit: once all three header keyword groups are present stop extending —
                // the next line is likely the first product name row, not more header.
                var c = combined.ToString();
                if ((c.Contains("tên") || c.Contains("ten"))
                    && (c.Contains("hàng") || c.Contains("hang"))
                    && (c.Contains("số lượng") || c.Contains("đơn giá") || c.Contains("stt")
                        || c.Contains("thành tiền") || c.Contains("don gia") || c.Contains("so luong")))
                    break;
            }

            var comb = combined.ToString();
            bool hasTen  = comb.Contains("tên") || comb.Contains("ten");
            bool hasHang = comb.Contains("hàng") || comb.Contains("hang");
            bool hasNumericHeader = comb.Contains("số lượng") || comb.Contains("đơn giá")
                || comb.Contains("don gia") || comb.Contains("so luong")
                || comb.Contains("stt") || comb.Contains("thành tiền") || comb.Contains("thanh tien");

            if (hasTen && hasHang && hasNumericHeader)
            {
                headerEndIdx = windowEnd;
                break;
            }
        }

        if (headerEndIdx < 0) return [];

        // --- Step 2: collect body lines ---
        var bodyLines = new List<string>();
        for (int i = headerEndIdx + 1; i < lines.Count; i++)
        {
            var lower = lines[i].ToLowerInvariant();
            if (lower.Contains("tổng cộng") || lower.Contains("tổng tiền") || lower.Contains("tong cong")) break;
            bodyLines.Add(lines[i]);
        }

        if (bodyLines.Count == 0) return [];

        // --- Step 3: cluster body lines into per-row groups ---
        // Each group: { pendingPrefix lines (before anchor), anchor line, continuation lines }
        var rowGroups = new List<(List<string> Before, string Anchor, List<string> After)>();
        var pending = new List<string>();

        foreach (var line in bodyLines)
        {
            if (StartsWithRowIndex(line))
            {
                // Redistribute "after" lines from the previous row that look like product name
                // fragments (pure text, no numbers) — they belong as "before" of this new row.
                if (rowGroups.Count > 0)
                {
                    var (pb, pa, prevAfter) = rowGroups[^1];
                    var realAfter = new List<string>();
                    var promoted = new List<string>();
                    foreach (var a in prevAfter)
                    {
                        var tokens = a.Split(' ', StringSplitOptions.RemoveEmptyEntries);
                        var hasNumber = tokens.Any(t =>
                            decimal.TryParse(t.Replace(".", "").Replace(",", "."),
                                System.Globalization.NumberStyles.Any,
                                System.Globalization.CultureInfo.InvariantCulture, out _));
                        // A product-name fragment: pure text, ≤ 4 words, no hyphenated SKU codes
                        var looksLikeSku = tokens.Any(t => t.Contains('-') && t.Length > 4);
                        if (!hasNumber && !looksLikeSku && tokens.Length <= 4)
                            promoted.Add(a);
                        else
                            realAfter.Add(a);
                    }
                    rowGroups[^1] = (pb, pa, realAfter);
                    pending.InsertRange(0, promoted);
                }

                rowGroups.Add((new List<string>(pending), line, new List<string>()));
                pending.Clear();
            }
            else if (rowGroups.Count == 0)
            {
                pending.Add(line);
            }
            else
            {
                rowGroups[^1].After.Add(line);
            }
        }

        // --- Step 4: parse each group into a ParsedLineItem ---
        // Anchor line format (single-space separated, no guaranteed column widths):
        //   STT  [name tokens...]  ĐVT  SL  Đơn_giá  Thành_tiền  [ghi_chú tokens...]
        // We detect the last 3 numeric tokens as Thành_tiền, Đơn_giá, SL (right-to-left),
        // then the token immediately before SL is ĐVT, and everything before ĐVT is the name suffix.
        var items = new List<ParsedLineItem>();
        foreach (var (before, anchor, after) in rowGroups)
        {
            var tokens = anchor.Split(' ', StringSplitOptions.RemoveEmptyEntries);
            if (tokens.Length < 2) continue;
            if (!int.TryParse(tokens[0], out var lineNumber)) continue;

            var rest = tokens[1..]; // everything after STT

            // Find positions of numeric tokens in rest
            var numPositions = rest
                .Select((t, idx) => (idx, IsNumericToken(t)))
                .Where(x => x.Item2)
                .Select(x => x.idx)
                .ToList();

            string? unit = null;
            decimal quantity = 0, unitPrice = 0, lineAmt = 0;
            string anchorName, anchorNote;

            if (numPositions.Count >= 3)
            {
                int pAmt   = numPositions[^1];
                int pPrice = numPositions[^2];
                int pQty   = numPositions[^3];

                lineAmt   = ParseVietnameseDecimal(rest[pAmt]);
                unitPrice = ParseVietnameseDecimal(rest[pPrice]);
                quantity  = ParseVietnameseDecimal(rest[pQty]);

                int unitPos = pQty - 1;
                unit = unitPos >= 0 ? rest[unitPos].Trim() : null;

                int nameEndPos = unitPos > 0 ? unitPos : pQty;
                anchorName = string.Join(" ", rest[..nameEndPos]);
                anchorNote = string.Join(" ", rest[(pAmt + 1)..]);
            }
            else
            {
                anchorName = string.Join(" ", rest);
                anchorNote = string.Empty;
            }

            // Full product name = before-lines + anchor name suffix
            var nameParts = before.Select(b => b.Trim()).Where(b => !string.IsNullOrWhiteSpace(b)).ToList();
            if (!string.IsNullOrWhiteSpace(anchorName)) nameParts.Add(anchorName.Trim());
            var productName = string.Join(" ", nameParts);
            if (string.IsNullOrWhiteSpace(productName)) continue;

            // Note = anchor note suffix + after lines
            var noteParts = new List<string>();
            if (!string.IsNullOrWhiteSpace(anchorNote)) noteParts.Add(anchorNote.Trim());
            noteParts.AddRange(after.Select(a => a.Trim()).Where(a => !string.IsNullOrWhiteSpace(a)));
            var note = string.Join(" ", noteParts);

            items.Add(new ParsedLineItem(
                lineNumber,
                productName,
                string.IsNullOrWhiteSpace(unit) ? null : unit,
                quantity,
                unitPrice,
                lineAmt,
                string.IsNullOrWhiteSpace(note) ? null : note));
        }

        return items;
    }

    // Returns true if the line contains at least one decimal number with value ≥ 100
    // (prices/quantities), which distinguishes data rows from column-header label rows.
    private static bool LineContainsDecimalNumber(string line)
    {
        foreach (var token in line.Split(' ', StringSplitOptions.RemoveEmptyEntries))
        {
            var cleaned = token.Replace(".", "").Replace(",", ".");
            if (decimal.TryParse(cleaned, System.Globalization.NumberStyles.Any,
                    System.Globalization.CultureInfo.InvariantCulture, out var val)
                && val >= 100m)
                return true;
        }
        return false;
    }

    private static bool IsNumericToken(string token)    {
        // Matches Vietnamese number format: digits with dots as thousand separators, comma as decimal
        var cleaned = token.Replace(".", "").Replace(",", ".");
        return decimal.TryParse(cleaned, System.Globalization.NumberStyles.Any,
            System.Globalization.CultureInfo.InvariantCulture, out _);
    }

    private static bool StartsWithRowIndex(string line)
    {
        var first = line.TrimStart().Split(' ', '\t')[0];
        return int.TryParse(first, out var n) && n >= 1 && n <= 500;
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
