# Tao/cap quyen tat ca databases HVT tren MySQL container (volume cu van dung duoc).
# Usage: .\Scripts\bootstrap-databases.ps1

$ErrorActionPreference = "Stop"
$RootPassword = if ($env:MYSQL_ROOT_PASSWORD) { $env:MYSQL_ROOT_PASSWORD } else { "hvtroot123" }
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$SqlFile = Join-Path $ScriptDir "ensure-databases.sql"

Write-Host "Ensuring HVT databases in hvt-mysql..." -ForegroundColor Cyan
Get-Content $SqlFile -Raw | docker exec -i hvt-mysql mysql -uroot -p$RootPassword
Write-Host "Done. Restart services if needed: docker compose restart inventory-service customer-service order-service" -ForegroundColor Green
