# Sau git pull: dam bao DB ton tai, rebuild + restart services de EF migration chay.
# Usage: .\Scripts\sync-after-pull.ps1
#        .\Scripts\sync-after-pull.ps1 -RebuildAll

param(
    [switch]$RebuildAll
)

$ErrorActionPreference = "Stop"
$BackendRoot = Split-Path $PSScriptRoot -Parent
Set-Location $BackendRoot

Write-Host "=== 1/3 Bootstrap databases ===" -ForegroundColor Cyan
& (Join-Path $PSScriptRoot "bootstrap-databases.ps1")

if ($RebuildAll) {
    Write-Host "=== 2/3 Rebuild all services ===" -ForegroundColor Cyan
    docker compose up --build -d
} else {
    Write-Host "=== 2/3 Restart app services ===" -ForegroundColor Cyan
    docker compose up -d --build customer-service user-service product-service order-service inventory-service gateway web-client
}

Write-Host "=== 3/3 Check migration logs ===" -ForegroundColor Cyan
$containers = @(
    "hvt-inventory-service",
    "hvt-customer-service",
    "hvt-order-service",
    "hvt-product-service",
    "hvt-user-service"
)
foreach ($name in $containers) {
    Write-Host ""
    Write-Host "--- $name ---" -ForegroundColor DarkCyan
    docker logs $name --tail 30 2>$null | Select-String -Pattern "Applying migration|Migration attempt|Unknown column|Access denied" | Select-Object -Last 5
}

Write-Host ""
Write-Host "Done. Open http://localhost:3000 and test cap nhat so luong / POS." -ForegroundColor Green
