using DocumentService.Application.Models;

namespace DocumentService.Application.Interfaces;

public interface IContractPdfParser
{
    Task<ParsedContractData> ParseAsync(Stream pdfStream, string fileName, CancellationToken ct = default);
}
