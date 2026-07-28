param(
    [string]$MySqlContainer = "hvt-mysql",
    [string]$MySqlRootPassword = "hvtroot123"
)

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
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

Write-Host "Applying seed (catalog + inventory, no auth)..." -ForegroundColor Cyan
docker exec -e "MYSQL_PWD=$MySqlRootPassword" $MySqlContainer `
    mysql --default-character-set=utf8mb4 -uroot `
    -e "source /tmp/seed-catalog-inventory-realistic.sql"
if ($LASTEXITCODE -ne 0) { throw "Seed SQL failed." }

Write-Host ""
Write-Host "Seed OK." -ForegroundColor Green
Write-Host "POS: hard refresh + resync cache to see HVT-* SKUs." -ForegroundColor Yellow
Write-Host "No new accounts - use admin/sale01/manager01 (123456)." -ForegroundColor Yellow
