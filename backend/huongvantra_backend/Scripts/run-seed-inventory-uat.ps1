param(
    [string]$MySqlContainer = "hvt-mysql",
    [string]$MySqlRootPassword = "hvtroot123"
)

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$sqlFile = Join-Path $scriptDir "seed-inventory-uat.sql"

if (-not (Test-Path $sqlFile)) {
    throw "Không tìm thấy file SQL: $sqlFile"
}

$running = docker inspect -f "{{.State.Running}}" $MySqlContainer 2>$null
if ($LASTEXITCODE -ne 0 -or $running.Trim() -ne "true") {
    throw "Container $MySqlContainer chưa chạy. Hãy chạy docker-compose dev stack trước."
}

$health = docker inspect -f "{{if .State.Health}}{{.State.Health.Status}}{{else}}no-healthcheck{{end}}" $MySqlContainer
Write-Host "MySQL container: $MySqlContainer ($health)" -ForegroundColor Cyan

Write-Host "Copy seed SQL vào MySQL container..." -ForegroundColor Cyan
docker cp $sqlFile "${MySqlContainer}:/tmp/seed-inventory-uat.sql"
if ($LASTEXITCODE -ne 0) { throw "docker cp thất bại." }

Write-Host "Áp dụng seed data..." -ForegroundColor Cyan
docker exec -e "MYSQL_PWD=$MySqlRootPassword" $MySqlContainer `
    mysql --default-character-set=utf8mb4 -uroot `
    -e "source /tmp/seed-inventory-uat.sql"
if ($LASTEXITCODE -ne 0) { throw "Seed SQL thất bại. Xem lỗi MySQL phía trên." }

Write-Host "";
Write-Host "Seed thành công." -ForegroundColor Green
Write-Host "Frontend dev: http://localhost:5173" -ForegroundColor Green
Write-Host "Tài khoản mặc định: admin / manager01 / sale01; password mặc định 123456." -ForegroundColor Yellow
Write-Host "Tài khoản mới: warehouse01 / warehouse02 dùng cùng password hiện tại của manager01 (mặc định 123456)." -ForegroundColor Yellow
Write-Host "Sau khi mở POS, hard refresh và đồng bộ lại offline cache để thấy dữ liệu mới." -ForegroundColor Yellow
