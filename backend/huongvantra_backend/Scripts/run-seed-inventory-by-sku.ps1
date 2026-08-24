param(
    [string]$MySqlContainer = "hvt-mysql",
    # SEC-01: mat khau lay tu $env:MYSQL_ROOT_PASSWORD (xem .env.example), khong hardcode trong script.
    [string]$MySqlRootPassword = $(if ($env:MYSQL_ROOT_PASSWORD) { $env:MYSQL_ROOT_PASSWORD } else { throw "Chua dat `$env:MYSQL_ROOT_PASSWORD - xem .env.example, hoac truyen -MySqlRootPassword <mat_khau>." }),
    [switch]$SkipGenerate
)

# Phase B - Seed inventory by SkuCode after Excel catalog import/approve.
# Does NOT create Products/SKUs. Looks up ProductVariants by SkuCode, then
# UPSERTs SkuStocks + WarehouseBatches + WarehouseBatchItems.
# Fails clearly when SkuCodes are missing.

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$sqlFile = Join-Path $scriptDir "seed-inventory-by-sku.sql"
$generator = Join-Path $scriptDir "generate-seed-inventory-by-sku.mjs"

Write-Host "=== Phase B: inventory seed by SkuCode (after Excel catalog import) ===" -ForegroundColor Cyan

if (-not $SkipGenerate) {
    if (-not (Test-Path $generator)) {
        throw "Missing generator: $generator"
    }
    Write-Host "Generating SQL from SkuCode catalog..." -ForegroundColor Cyan
    node $generator
    if ($LASTEXITCODE -ne 0) { throw "Generator failed." }
}

if (-not (Test-Path $sqlFile)) {
    throw "SQL file not found: $sqlFile. Run node generate-seed-inventory-by-sku.mjs first."
}

$running = docker inspect -f "{{.State.Running}}" $MySqlContainer 2>$null
if ($LASTEXITCODE -ne 0 -or "$running".Trim() -ne "true") {
    throw "Container $MySqlContainer is not running. Start docker compose first."
}

Write-Host "Preflight: checking HVT Excel SkuCodes in hvt_product_db..." -ForegroundColor Cyan
$preflight = docker exec -e "MYSQL_PWD=$MySqlRootPassword" $MySqlContainer `
    mysql -N -uroot -e "SELECT COUNT(*) FROM hvt_product_db.ProductVariants WHERE IsDeleted=0 AND (SkuCode LIKE 'HVT-HONGTRA%' OR SkuCode='HVT-HUONGTRA-100G' OR SkuCode='NL-TRA-XANH-G');"
if ($LASTEXITCODE -ne 0) { throw "Preflight MySQL query failed." }
$sampleCount = 0
if ($preflight) { [int]::TryParse("$preflight".Trim(), [ref]$sampleCount) | Out-Null }
if ($sampleCount -lt 1) {
    Write-Host ""
    Write-Host "No Excel catalog SkuCodes found (e.g. HVT-HONGTRA-*, NL-TRA-XANH-G)." -ForegroundColor Red
    Write-Host "Do Phase A first:" -ForegroundColor Yellow
    Write-Host "  1) .\run-seed-hvt-categories.ps1" -ForegroundColor Yellow
    Write-Host "  2) Import + approve Excel/ZIP on product creation history" -ForegroundColor Yellow
    Write-Host "  3) Re-run .\run-seed-inventory-by-sku.ps1" -ForegroundColor Yellow
    throw "Phase B aborted: Excel catalog not present in Product DB."
}

Write-Host "MySQL: $MySqlContainer" -ForegroundColor Cyan
Write-Host "Copy seed SQL into container..." -ForegroundColor Cyan
docker cp $sqlFile "${MySqlContainer}:/tmp/seed-inventory-by-sku.sql"
if ($LASTEXITCODE -ne 0) { throw "docker cp failed." }

Write-Host "Applying Phase B inventory seed..." -ForegroundColor Cyan
docker exec -e "MYSQL_PWD=$MySqlRootPassword" $MySqlContainer `
    mysql --default-character-set=utf8mb4 -uroot `
    -e "source /tmp/seed-inventory-by-sku.sql"
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "Seed failed. If you see 'Phase B aborted: missing N SkuCode(s)' -" -ForegroundColor Red
    Write-Host "import/approve the full Excel sample, then re-run." -ForegroundColor Red
    throw "Phase B seed SQL failed."
}

Write-Host ""
Write-Host "Phase B OK - Shelf/Warehouse quantities seeded by Excel SkuCode." -ForegroundColor Green
Write-Host "Verify:" -ForegroundColor Yellow
Write-Host "  - Products & Quantity page: Warehouse/Shelf stock > 0" -ForegroundColor Yellow
Write-Host "  - POS: hard refresh / resync, sell HVT-HUONGTRA-100G" -ForegroundColor Yellow
Write-Host "Do not use run-seed-catalog-inventory.ps1 (legacy Matcha/Ceylon) on new machines." -ForegroundColor DarkYellow
