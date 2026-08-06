param(
    [string]$MySqlContainer = "hvt-mysql",
    [string]$MySqlRootPassword = "hvtroot123"
)

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$sqlFile = Join-Path $scriptDir "seed-hvt-sample-ops.sql"
$sqlExt = Join-Path $scriptDir "seed-hvt-sample-ops-ext.sql"

if (-not (Test-Path $sqlFile)) {
    throw "SQL file not found: $sqlFile"
}
if (-not (Test-Path $sqlExt)) {
    throw "SQL file not found: $sqlExt"
}

$running = docker inspect -f "{{.State.Running}}" $MySqlContainer 2>$null
if ($LASTEXITCODE -ne 0 -or "$running".Trim() -ne "true") {
    throw "Container $MySqlContainer is not running. Start docker compose first."
}

Write-Host "Seeding sample ops (supplier products, receipts, BOM, orders)..." -ForegroundColor Cyan
docker cp $sqlFile "${MySqlContainer}:/tmp/seed-hvt-sample-ops.sql"
if ($LASTEXITCODE -ne 0) { throw "docker cp failed." }

docker exec -e "MYSQL_PWD=$MySqlRootPassword" $MySqlContainer `
    mysql --default-character-set=utf8mb4 -uroot `
    -e "source /tmp/seed-hvt-sample-ops.sql"
if ($LASTEXITCODE -ne 0) {
    throw "Sample ops seed failed. Need: Excel catalog approved + baseline extras + Phase B inventory."
}

Write-Host "Seeding ops extension (shift/cash, stocktake, returns, PN Completed)..." -ForegroundColor Cyan
docker cp $sqlExt "${MySqlContainer}:/tmp/seed-hvt-sample-ops-ext.sql"
if ($LASTEXITCODE -ne 0) { throw "docker cp ext failed." }

docker exec -e "MYSQL_PWD=$MySqlRootPassword" $MySqlContainer `
    mysql --default-character-set=utf8mb4 -uroot `
    -e "source /tmp/seed-hvt-sample-ops-ext.sql"
if ($LASTEXITCODE -ne 0) {
    throw "Sample ops extension seed failed."
}

Write-Host "Sample ops OK." -ForegroundColor Green
Write-Host "  - SupplierProducts, PN Draft/Pending/Completed, BOM, orders" -ForegroundColor Gray
Write-Host "  - Ca + quỹ Open/Closed, KK Draft/Completed, THN + TH khách" -ForegroundColor Gray
Write-Host "Note: PN Completed + THN Completed adjust warehouse qty slightly. Customer return does not restock." -ForegroundColor Yellow
