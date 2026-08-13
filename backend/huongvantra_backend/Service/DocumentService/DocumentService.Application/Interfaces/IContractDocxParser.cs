using DocumentService.Application.Models;

namespace DocumentService.Application.Interfaces;

public interface IContractDocxParser
{
    Task<ParsedContractData> ParseAsync(Stream docxStream, string fileName, CancellationToken ct = default);
}
