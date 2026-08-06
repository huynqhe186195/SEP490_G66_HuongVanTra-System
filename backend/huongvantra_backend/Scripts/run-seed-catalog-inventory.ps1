param(
    [string]$MySqlContainer = "hvt-mysql",
    [string]$MySqlRootPassword = "hvtroot123"
)

# [SOFT-DEPRECATED] Legacy catalog+inventory seed (Matcha/Ceylon / HVT-SEN...).
# New machines should use:
#   1) run-seed-hvt-categories.ps1
#   2) Import + approve Excel/ZIP
#   3) run-seed-inventory-by-sku.ps1

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "[DEPRECATED] run-seed-catalog-inventory.ps1 - prefer run-seed-inventory-by-sku.ps1 after Excel import." -ForegroundColor Yellow
Write-Host "Continue legacy path in 5s (Ctrl+C to cancel)..." -ForegroundColor DarkYellow
Start-Sleep -Seconds 5

$sqlFile = Join-Path $scriptDir "seed-catalog-inventory-realistic.sql"
$generator = Join-Path $scriptDir "generate-seed-catalog-inventory.mjs"

if (-not (Test-Path $sqlFile)) {
    if (-not (Test-Path $generator)) {
        throw "Missing $sqlFile and generator $generator"
    }
    Write-Host "Generating SQL seed..." -ForegroundColor Cyan
    node $generator
    if ($LASTEXITCODE -ne 0) { throw "Generator failed." }
}

if (-not (Test-Path $sqlFile)) {
    throw "SQL file not found: $sqlFile"
}

$running = docker inspect -f "{{.State.Running}}" $MySqlContainer 2>$null
if ($LASTEXITCODE -ne 0 -or "$running".Trim() -ne "true") {
    throw "Container $MySqlContainer is not running. Start docker compose first."
}

Write-Host "MySQL: $MySqlContainer" -ForegroundColor Cyan
Write-Host "Copy seed SQL into container..." -ForegroundColor Cyan
docker cp $sqlFile "${MySqlContainer}:/tmp/seed-catalog-inventory-realistic.sql"
if ($LASTEXITCODE -ne 0) { throw "docker cp failed." }

Write-Host "Applying legacy seed (catalog + inventory)..." -ForegroundColor Cyan
docker exec -e "MYSQL_PWD=$MySqlRootPassword" $MySqlContainer `
    mysql --default-character-set=utf8mb4 -uroot `
    -e "source /tmp/seed-catalog-inventory-realistic.sql"
if ($LASTEXITCODE -ne 0) { throw "Seed SQL failed." }

Write-Host ""
Write-Host "Legacy seed OK (deprecated path)." -ForegroundColor Green
Write-Host "Prefer: .\run-seed-inventory-by-sku.ps1 after Excel import." -ForegroundColor Yellow
