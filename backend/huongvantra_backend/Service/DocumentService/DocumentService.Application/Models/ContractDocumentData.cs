using DocumentService.Application.Interfaces;
using DocumentService.Domain.Entities;

namespace DocumentService.Application.Models;

public sealed record ContractDocumentData(
    Contract Contract,
    CustomerCatalogProfile Customer,
    SellerProfileOptions Seller);
