param(
    [string]$MySqlContainer = "hvt-mysql",
    # SEC-01: mat khau lay tu $env:MYSQL_ROOT_PASSWORD (xem .env.example), khong hardcode trong script.
    [string]$MySqlRootPassword = $(if ($env:MYSQL_ROOT_PASSWORD) { $env:MYSQL_ROOT_PASSWORD } else { throw "Chua dat `$env:MYSQL_ROOT_PASSWORD - xem .env.example, hoac truyen -MySqlRootPassword <mat_khau>." })
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$sqlFile = Join-Path $scriptDir "seed-inventory-uat.sql"

if (-not (Test-Path -LiteralPath $sqlFile)) {
    throw "SQL seed file was not found: $sqlFile"
}

$running = docker inspect -f "{{.State.Running}}" $MySqlContainer 2>$null
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($running) -or $running.Trim() -ne "true") {
    throw "Container '$MySqlContainer' is not running. Start the Docker Compose development stack first."
}

$health = docker inspect -f "{{if .State.Health}}{{.State.Health.Status}}{{else}}no-healthcheck{{end}}" $MySqlContainer
if ($LASTEXITCODE -ne 0) {
    throw "Could not read the health state of container '$MySqlContainer'."
}

Write-Host "MySQL container: $MySqlContainer ($($health.Trim()))" -ForegroundColor Cyan
Write-Host "Copying seed SQL into the MySQL container..." -ForegroundColor Cyan

docker cp $sqlFile "${MySqlContainer}:/tmp/seed-inventory-uat.sql"
if ($LASTEXITCODE -ne 0) {
    throw "docker cp failed."
}

Write-Host "Applying Inventory UAT seed data..." -ForegroundColor Cyan

docker exec `
    -e "MYSQL_PWD=$MySqlRootPassword" `
    $MySqlContainer `
    mysql `
    --default-character-set=utf8mb4 `
    -uroot `
    -D hvt_user_db `
    --execute="SOURCE /tmp/seed-inventory-uat.sql"

if ($LASTEXITCODE -ne 0) {
    throw "The SQL seed failed. Review the MySQL error printed above."
}

Write-Host ""
Write-Host "SEED_OK" -ForegroundColor Green
Write-Host "Inventory UAT seed completed successfully." -ForegroundColor Green
Write-Host "Frontend development URL: http://localhost:5173" -ForegroundColor Green
Write-Host "Default accounts: admin / manager01 / sale01. Default password: 123456." -ForegroundColor Yellow
Write-Host "Added accounts: warehouse01 / warehouse02. They use manager01's current password." -ForegroundColor Yellow
Write-Host "Hard refresh the browser and refresh the POS offline cache before testing." -ForegroundColor Yellow
