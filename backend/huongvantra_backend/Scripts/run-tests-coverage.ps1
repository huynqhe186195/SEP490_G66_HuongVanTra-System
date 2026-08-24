# QA-01: mot lenh duy nhat chay toan bo unit test + sinh coverage report.
#   .\Scripts\run-tests-coverage.ps1
#   .\Scripts\run-tests-coverage.ps1 -SkipHtmlReport   (bo qua reportgenerator neu offline)
param(
    [string]$Configuration = "Release",
    [switch]$SkipHtmlReport
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$solution = Join-Path $repoRoot "huongvantra_backend.sln"
$runSettings = Join-Path $repoRoot "coverlet.runsettings"
$resultsDir = Join-Path $repoRoot "TestResults"
$reportDir = Join-Path $resultsDir "CoverageReport"

if (-not (Test-Path $solution)) { throw "Khong tim thay solution: $solution" }

if (Test-Path $resultsDir) {
    Remove-Item -Recurse -Force $resultsDir
}
New-Item -ItemType Directory -Path $resultsDir | Out-Null

Write-Host "[1/4] Restore packages..." -ForegroundColor Cyan
dotnet restore $solution
if ($LASTEXITCODE -ne 0) { throw "dotnet restore that bai." }

Write-Host "[2/4] Build ($Configuration)..." -ForegroundColor Cyan
dotnet build $solution --configuration $Configuration --no-restore
if ($LASTEXITCODE -ne 0) { throw "dotnet build that bai." }

Write-Host "[3/4] Chay unit test + thu coverage..." -ForegroundColor Cyan
dotnet test $solution `
    --configuration $Configuration `
    --no-build `
    --settings $runSettings `
    --results-directory $resultsDir `
    --logger "trx" `
    --logger "console;verbosity=normal"
$testExit = $LASTEXITCODE

# VSTest ghi coverage 2 lan: ban goc trong <user>_<may>_<timestamp>\In\<may>\ va ban attachment
# trong thu muc GUID. Chi lay ban attachment de reportgenerator khong merge trung.
$coverageFiles = @(
    Get-ChildItem -Path $resultsDir -Recurse -Filter "coverage.cobertura.xml" -ErrorAction SilentlyContinue |
        Where-Object { $_.FullName -notmatch '\\In\\' }
)
if ($coverageFiles.Count -eq 0) {
    throw "Khong sinh duoc file coverage.cobertura.xml - kiem tra coverlet.collector trong cac project test."
}

$testProjectCount = (Get-ChildItem -Path (Join-Path $repoRoot "Service") -Recurse -Filter "*.Tests.csproj").Count
Write-Host "  Da thu $($coverageFiles.Count) file coverage / $testProjectCount project test." -ForegroundColor Gray
if ($coverageFiles.Count -lt $testProjectCount) {
    Write-Host "  CANH BAO: co project test khong sinh coverage - kiem tra no da duoc add vao .sln chua." -ForegroundColor Yellow
}

if (-not $SkipHtmlReport) {
    Write-Host "[4/4] Sinh HTML coverage report..." -ForegroundColor Cyan
    Push-Location $repoRoot
    try {
        dotnet tool restore
        if ($LASTEXITCODE -ne 0) { throw "dotnet tool restore that bai (can mang de tai reportgenerator). Dung -SkipHtmlReport de bo qua." }

        $reportArg = ($coverageFiles | ForEach-Object { $_.FullName }) -join ";"
        dotnet reportgenerator "-reports:$reportArg" "-targetdir:$reportDir" "-reporttypes:Html;TextSummary;Cobertura"
        if ($LASTEXITCODE -ne 0) { throw "reportgenerator that bai." }
    }
    finally {
        Pop-Location
    }

    $summary = Join-Path $reportDir "Summary.txt"
    if (Test-Path $summary) {
        Write-Host ""
        Get-Content $summary | Select-Object -First 25
    }
    Write-Host ""
    Write-Host "HTML report: $(Join-Path $reportDir 'index.html')" -ForegroundColor Green
} else {
    Write-Host "[4/4] Bo qua HTML report (-SkipHtmlReport)." -ForegroundColor Yellow
}

Write-Host ""
if ($testExit -ne 0) {
    Write-Host "TESTS_FAILED - xem cac file .trx trong $resultsDir" -ForegroundColor Red
    exit $testExit
}

Write-Host "TESTS_OK - coverage nam trong $resultsDir" -ForegroundColor Green
