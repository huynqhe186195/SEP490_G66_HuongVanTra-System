# Test integration events end-to-end via Gateway (:5000)
# Usage: .\Scripts\test-integration-events.ps1

$BaseUrl = if ($env:HVT_GATEWAY) { $env:HVT_GATEWAY } else { "http://localhost:5000" }
$ErrorActionPreference = "Stop"

function Get-Token {
    $login = Invoke-RestMethod -Uri "$BaseUrl/api/auth/login" -Method POST -ContentType "application/json" `
        -Body '{"username":"sale01","password":"123456"}'
    return $login.accessToken
}

function Invoke-Hvt($Method, $Path, $Token, $Body = $null) {
    $params = @{
        Uri = "$BaseUrl$Path"
        Method = $Method
        Headers = @{ Authorization = "Bearer $Token" }
        ContentType = "application/json"
    }
    if ($Body) { $params.Body = ($Body | ConvertTo-Json -Depth 6) }
    return Invoke-RestMethod @params
}

Write-Host "=== 1. Login ===" -ForegroundColor Cyan
$token = Get-Token
Write-Host "OK"

Write-Host "`n=== 2. List customers (pick first) ===" -ForegroundColor Cyan
$customers = Invoke-Hvt GET "/api/customers?page=1&pageSize=1" $token
$customerId = $customers.items[0].id
Write-Host "CustomerId: $customerId"

Write-Host "`n=== 3. List SKUs ===" -ForegroundColor Cyan
$skus = Invoke-Hvt GET "/api/v1/skus?page=1&pageSize=5" $token
if (-not $skus.items -or $skus.items.Count -eq 0) { throw "No SKU found. Create a product SKU first." }
$sku = $skus.items[0]
$skuId = $sku.id
Write-Host "SkuId: $skuId ($($sku.skuCode))"

Write-Host "`n=== 4. Ensure inventory stock (adjust +50) ===" -ForegroundColor Cyan
try {
    $stock = Invoke-Hvt POST "/api/v1/inventory/sku-stocks/$skuId/adjust" $token @{ quantityDelta = 50 }
    Write-Host "QuantityOnHand: $($stock.quantityOnHand)"
} catch {
    Write-Host "SKU stock row may not exist yet (create SKU first or wait for SkuCreatedEvent). Error: $($_.Exception.Message)" -ForegroundColor Yellow
}

Write-Host "`n=== 5. Create POS order ===" -ForegroundColor Cyan
$orderBody = @{
    customerId = $customerId
    customerSnapshotName = $customers.items[0].fullName
    orderChannel = "POS"
    paymentMethod = "Cash"
    paidAmount = [decimal]$sku.basePrice
    discountAmount = 0
    items = @(@{
        skuId = $skuId
        skuSnapshotName = $sku.productName
        skuSnapshotCode = $sku.skuCode
        quantity = 1
        unitPrice = [decimal]$sku.basePrice
    })
}
$order = Invoke-Hvt POST "/api/v1/orders" $token $orderBody
Write-Host "Order: $($order.orderCode) | inventorySyncStatus=$($order.inventorySyncStatus)"

Start-Sleep -Seconds 2

Write-Host "`n=== 6. Stock deduct queue (OrderPlacedEvent) ===" -ForegroundColor Cyan
$queues = Invoke-Hvt GET "/api/stock-deduct-queue/waiting" $token
$queue = $queues | Where-Object { $_.orderId -eq $order.id } | Select-Object -First 1
if (-not $queue) { throw "Queue not created for order $($order.orderCode)" }
Write-Host "QueueId: $($queue.queueId)"

Write-Host "`n=== 7. Preview deduct ===" -ForegroundColor Cyan
$preview = Invoke-Hvt GET "/api/stock-deduct-queue/$($queue.queueId)/preview" $token
Write-Host "canDeduct=$($preview.canDeduct) orderStockStatus=$($preview.orderStockStatus)"

Write-Host "`n=== 8. Confirm deduct (StockDeductedEvent -> Order Synced) ===" -ForegroundColor Cyan
$confirm = Invoke-Hvt PATCH "/api/stock-deduct-queue/$($queue.queueId)/confirm" $token @{}
Write-Host "orderStockStatus=$($confirm.orderStockStatus)"

Start-Sleep -Seconds 2

Write-Host "`n=== 9. Verify order inventory synced ===" -ForegroundColor Cyan
$orderAfter = Invoke-Hvt GET "/api/v1/orders/$($order.id)" $token
Write-Host "inventorySyncStatus=$($orderAfter.inventorySyncStatus)"

Write-Host "`n=== 10. Customer spending (OrderCompletedEvent on POS) ===" -ForegroundColor Cyan
$customerAfter = Invoke-Hvt GET "/api/customers/$customerId" $token
Write-Host "totalSpending=$($customerAfter.totalSpending)"

Write-Host "`n=== DONE ===" -ForegroundColor Green
