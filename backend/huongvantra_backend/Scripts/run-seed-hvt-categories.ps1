param(
    [string]$MySqlContainer = "hvt-mysql",
    # SEC-01: mat khau lay tu $env:MYSQL_ROOT_PASSWORD (xem .env.example), khong hardcode trong script.
    [string]$MySqlRootPassword = $(if ($env:MYSQL_ROOT_PASSWORD) { $env:MYSQL_ROOT_PASSWORD } else { throw "Chua dat `$env:MYSQL_ROOT_PASSWORD - xem .env.example, hoac truyen -MySqlRootPassword <mat_khau>." })
)

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$sqlFile = Join-Path $scriptDir "seed-hvt-categories.sql"

if (-not (Test-Path $sqlFile)) {
    throw "SQL file not found: $sqlFile"
}

$running = docker inspect -f "{{.State.Running}}" $MySqlContainer 2>$null
if ($LASTEXITCODE -ne 0 -or "$running".Trim() -ne "true") {
    throw "Container $MySqlContainer is not running. Start docker compose first."
}

Write-Host "Applying HVT categories before Excel import..." -ForegroundColor Cyan
docker cp $sqlFile "${MySqlContainer}:/tmp/seed-hvt-categories.sql"
if ($LASTEXITCODE -ne 0) { throw "docker cp failed." }

docker exec -e "MYSQL_PWD=$MySqlRootPassword" $MySqlContainer `
    mysql --default-character-set=utf8mb4 -uroot `
    -e "source /tmp/seed-hvt-categories.sql"
if ($LASTEXITCODE -ne 0) { throw "Category seed failed." }

Write-Host "Category seed OK. Download the Excel sample and import the catalog next." -ForegroundColor Green
