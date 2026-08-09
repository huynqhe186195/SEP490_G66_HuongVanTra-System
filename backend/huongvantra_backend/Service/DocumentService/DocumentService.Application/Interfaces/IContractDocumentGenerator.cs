using DocumentService.Application.Models;

namespace DocumentService.Application.Interfaces;

public interface IContractDocumentGenerator
{
    Task<byte[]> GenerateDocxAsync(ContractDocumentData data, CancellationToken ct = default);
    byte[] GeneratePdf(ContractDocumentData data);
}
