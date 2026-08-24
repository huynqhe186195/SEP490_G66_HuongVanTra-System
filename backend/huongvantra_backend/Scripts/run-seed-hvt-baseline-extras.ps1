param(
    [string]$MySqlContainer = "hvt-mysql",
    # SEC-01: mat khau lay tu $env:MYSQL_ROOT_PASSWORD (xem .env.example), khong hardcode trong script.
    [string]$MySqlRootPassword = $(if ($env:MYSQL_ROOT_PASSWORD) { $env:MYSQL_ROOT_PASSWORD } else { throw "Chua dat `$env:MYSQL_ROOT_PASSWORD - xem .env.example, hoac truyen -MySqlRootPassword <mat_khau>." })
)

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$sqlFile = Join-Path $scriptDir "seed-hvt-baseline-extras.sql"

if (-not (Test-Path $sqlFile)) {
    throw "SQL file not found: $sqlFile"
}

$running = docker inspect -f "{{.State.Running}}" $MySqlContainer 2>$null
if ($LASTEXITCODE -ne 0 -or "$running".Trim() -ne "true") {
    throw "Container $MySqlContainer is not running. Start docker compose first."
}

Write-Host "Seeding baseline extras (customers, suppliers, promotions)..." -ForegroundColor Cyan
docker cp $sqlFile "${MySqlContainer}:/tmp/seed-hvt-baseline-extras.sql"
if ($LASTEXITCODE -ne 0) { throw "docker cp failed." }

docker exec -e "MYSQL_PWD=$MySqlRootPassword" $MySqlContainer `
    mysql --default-character-set=utf8mb4 -uroot `
    -e "source /tmp/seed-hvt-baseline-extras.sql"
if ($LASTEXITCODE -ne 0) { throw "Baseline extras seed failed." }

Write-Host "Baseline extras OK: 5 KH, 3 NCC, 2 promo (HVT10 / HVT50K)." -ForegroundColor Green
Write-Host "Next: import/approve Excel catalog, then .\run-seed-inventory-by-sku.ps1" -ForegroundColor Yellow
