param(
    [string]$BaseUrl = $env:HVTPOSIMS_BASE_URL,
    [string]$GatewayInventoryProbe = $env:HVTPOSIMS_GATEWAY_INVENTORY_PROBE,
    [string[]]$HealthUrls = $env:HVTPOSIMS_HEALTH_URLS,
    [string]$Username = $env:HVTPOSIMS_USERNAME,
    [string]$Password = $env:HVTPOSIMS_PASSWORD
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($BaseUrl)) {
    $BaseUrl = "http://localhost:5000"
}

if ([string]::IsNullOrWhiteSpace($GatewayInventoryProbe)) {
    $GatewayInventoryProbe = "$BaseUrl/api/v1/inventory/sku-stocks"
}

if (-not $HealthUrls -or $HealthUrls.Count -eq 0) {
    # SEC-05: port 5003-5005 chi mo khi chay kem docker-compose.dev.yml.
    # Production (chi publish 5000/3000) => set $env:HVTPOSIMS_HEALTH_URLS hoac bo qua buoc health.
    $HealthUrls = @(
        "http://localhost:5003/health",
        "http://localhost:5004/health",
        "http://localhost:5005/health"
    )
}

function Write-Step {
    param([string]$Message)
    Write-Host "[inventory-smoke] $Message"
}

function Invoke-Health {
    param([string]$Url)

    try {
        $response = Invoke-WebRequest -Uri $Url -Method GET -TimeoutSec 10 -UseBasicParsing
        if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
            Write-Step "PASS $Url -> HTTP $($response.StatusCode)"
            return
        }

        throw "Unexpected HTTP $($response.StatusCode)"
    }
    catch {
        throw "FAIL $Url : $($_.Exception.Message)"
    }
}

function Invoke-GatewayProbe {
    param([string]$Url)

    try {
        $response = Invoke-WebRequest -Uri $Url -Method GET -TimeoutSec 10 -UseBasicParsing
        Write-Step "PASS $Url -> HTTP $($response.StatusCode)"
    }
    catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        if ($statusCode -eq 401 -or $statusCode -eq 403) {
            Write-Step "PASS $Url -> HTTP $statusCode (auth required)"
            return
        }

        throw "FAIL $Url : $($_.Exception.Message)"
    }
}

Write-Step "BaseUrl=$BaseUrl"

foreach ($url in $HealthUrls) {
    Invoke-Health $url
}

Invoke-GatewayProbe $GatewayInventoryProbe

if (-not [string]::IsNullOrWhiteSpace($Username) -and -not [string]::IsNullOrWhiteSpace($Password)) {
    Write-Step "Credentials were supplied through environment variables. Authenticated workflow smoke tests can be added safely in later batches."
}
else {
    Write-Step "No credentials supplied. Set HVTPOSIMS_USERNAME and HVTPOSIMS_PASSWORD to enable authenticated smoke tests."
}

Write-Step "Baseline smoke completed."
