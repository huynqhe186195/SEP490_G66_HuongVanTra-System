# Đồng bộ tồn kho cho SKU đã có trên ProductService nhưng chưa có dòng SkuStock.
# Cách dùng: .\Scripts\sync-sku-stocks.ps1 -Gateway http://localhost:5000 -Token "<jwt>"

param(
    [string]$Gateway = "http://localhost:5000",
    [Parameter(Mandatory = $true)]
    [string]$Token,
    [int]$InitialQuantity = 0
)

$headers = @{
    Authorization = "Bearer $Token"
    "Content-Type" = "application/json"
}

$skus = Invoke-RestMethod -Uri "$Gateway/api/v1/skus?page=1&pageSize=200&isActive=true" -Headers $headers
$skuItems = $skus.items ?? $skus.Items ?? @()

$stocks = Invoke-RestMethod -Uri "$Gateway/api/v1/inventory/sku-stocks" -Headers $headers
$stockSkuIds = @{}
foreach ($row in $stocks) {
    $id = $row.skuId ?? $row.SkuId
    if ($id) { $stockSkuIds[$id.ToString()] = $true }
}

$created = 0
foreach ($sku in $skuItems) {
    $skuId = ($sku.id ?? $sku.Id).ToString()
    if ($stockSkuIds.ContainsKey($skuId)) { continue }

    $body = @{ quantityDelta = [int]$InitialQuantity } | ConvertTo-Json
    Invoke-RestMethod -Method Post -Uri "$Gateway/api/v1/inventory/sku-stocks/$skuId/adjust" -Headers $headers -Body $body | Out-Null
    $created++
    Write-Host "Created stock row for SKU $skuId"
}

Write-Host "Done. Created $created / $($skuItems.Count) SKU stock rows."
