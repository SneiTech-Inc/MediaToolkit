<#
.SYNOPSIS
    Downloads self-hosted AI model files for @imgly/background-removal.

.DESCRIPTION
    Reads the resources.json manifest (which maps logical model paths to
    4 MB chunk hashes), then downloads each unique chunk from the IMG.LY CDN
    into public/models/. After running this script, the Remove Background tool
    will load models from your own domain instead of the CDN.

    Total download: ~123 MB (isnet_fp16 model + onnxruntime-web WASM runtime).
    The full package including all model variants is ~271 MB but only the
    fp16 variant is required.

.PARAMETER Version
    The @imgly/background-removal npm package version. Defaults to "1.7.0".

.PARAMETER CDN
    Base URL of the CDN. Defaults to the official IMG.LY CDN.

.EXAMPLE
    .\scripts\download-models.ps1

.EXAMPLE
    .\scripts\download-models.ps1 -Version "1.7.0"
#>

param(
    [string]$Version = "1.7.0",
    [string]$CDN = "https://staticimgly.com/@imgly/background-removal-data"
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Resolve-Path "$ScriptDir\.."
$ModelsDir = "$ProjectRoot\public\models"
$ResourcesUrl = "$CDN/$Version/dist/resources.json"

Write-Host "=== SaveVex Model Download ===" -ForegroundColor Cyan
Write-Host "Version:  $Version"
Write-Host "CDN:      $CDN"
Write-Host "Target:   $ModelsDir"
Write-Host ""

# Ensure target directory exists
New-Item -ItemType Directory -Force -Path $ModelsDir | Out-Null

# Step 1: Download resources.json
Write-Host "[1/3] Downloading resources.json..." -ForegroundColor Yellow
try {
    Invoke-WebRequest -Uri $ResourcesUrl -OutFile "$ModelsDir\resources.json" -TimeoutSec 60
    Write-Host "       Done." -ForegroundColor Green
} catch {
    Write-Host "       FAILED: $_" -ForegroundColor Red
    exit 1
}

# Step 2: Extract unique chunk hashes
Write-Host "[2/3] Extracting chunk list..." -ForegroundColor Yellow
$resources = Get-Content "$ModelsDir\resources.json" -Raw | ConvertFrom-Json
$hashes = [System.Collections.Generic.HashSet[string]]::new()

foreach ($prop in $resources.PSObject.Properties) {
    $file = $resources.$($prop.Name)
    foreach ($chunk in $file.chunks) {
        [void]$hashes.Add($chunk.hash)
    }
}

Write-Host "       Found $($hashes.Count) unique chunks to download." -ForegroundColor Green

# Step 3: Download each chunk
Write-Host "[3/3] Downloading chunks..." -ForegroundColor Yellow
$total = $hashes.Count
$done = 0
$failed = 0

foreach ($hash in $hashes) {
    $done++
    $destPath = "$ModelsDir\$hash"
    $url = "$CDN/$Version/dist/$hash"

    # Skip if already downloaded (allows resume)
    if (Test-Path $destPath) {
        $existingSize = (Get-Item $destPath).Length
        if ($existingSize -gt 0) {
            Write-Host "       [$done/$total] $hash (cached)" -ForegroundColor DarkGray
            continue
        }
    }

    Write-Host "       [$done/$total] $hash" -NoNewline
    try {
        Invoke-WebRequest -Uri $url -OutFile $destPath -TimeoutSec 120
        $size = (Get-Item $destPath).Length
        Write-Host " ($([math]::Round($size/1KB)) KB)" -ForegroundColor Green
    } catch {
        Write-Host " FAILED: $_" -ForegroundColor Red
        $failed++
    }
}

# Summary
Write-Host ""
if ($failed -eq 0) {
    Write-Host "=== Done! All $total chunks downloaded successfully. ===" -ForegroundColor Green
    Write-Host ""
    Write-Host "The Remove Background tool will now load AI models from:" -ForegroundColor Cyan
    Write-Host "  /models/" -ForegroundColor White
    Write-Host ""
    Write-Host "You can verify by opening DevTools → Network tab and checking"
    Write-Host "that model requests go to your own domain during processing."
} else {
    Write-Host "=== Done with $failed failures. Re-run to retry. ===" -ForegroundColor Yellow
}
