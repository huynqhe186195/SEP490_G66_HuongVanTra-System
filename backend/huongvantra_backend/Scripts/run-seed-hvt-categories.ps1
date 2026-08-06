param(
    [string]$MySqlContainer = "hvt-mysql",
    [string]$MySqlRootPassword = "hvtroot123"
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
