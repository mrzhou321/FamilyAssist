param(
  [string]$PythonVersion = "3.13.1",
  [string]$RuntimeDir = "",
  [switch]$Force
)

$ErrorActionPreference = "Stop"
$root = (Resolve-Path "$PSScriptRoot\..").Path
if (-not $RuntimeDir) {
  $RuntimeDir = Join-Path $root ".tmp-runtime"
}

$runtimeRoot = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($RuntimeDir)
$embedName = "python-$PythonVersion-embed-amd64"
$zipPath = Join-Path $runtimeRoot "$embedName.zip"
$pythonDir = Join-Path $runtimeRoot $embedName
$pythonExe = Join-Path $pythonDir "python.exe"
$pthPath = Join-Path $pythonDir "python$($PythonVersion.Split('.')[0])$($PythonVersion.Split('.')[1])._pth"
$sitePackages = Join-Path $root "backend\.venv\Lib\site-packages"

if (-not (Test-Path $sitePackages)) {
  throw "Backend dependencies are missing at $sitePackages. Install backend requirements into backend\.venv first."
}

New-Item -ItemType Directory -Force -Path $runtimeRoot | Out-Null

if ($Force -and (Test-Path $pythonDir)) {
  Remove-Item -LiteralPath $pythonDir -Recurse -Force
}

if (-not (Test-Path $pythonExe)) {
  $url = "https://www.python.org/ftp/python/$PythonVersion/$embedName.zip"
  if (-not (Test-Path $zipPath)) {
    Write-Host "Downloading $url"
    curl.exe -L --fail --connect-timeout 20 --max-time 180 -o $zipPath $url
    if ($LASTEXITCODE -ne 0) {
      throw "Failed to download $url"
    }
  }
  Expand-Archive -LiteralPath $zipPath -DestinationPath $pythonDir -Force
}

if (-not (Test-Path $pthPath)) {
  throw "Cannot find embeddable Python path file at $pthPath"
}

@(
  "python$($PythonVersion.Split('.')[0])$($PythonVersion.Split('.')[1]).zip"
  "."
  (Join-Path $root "backend")
  $sitePackages
) | Set-Content -LiteralPath $pthPath -Encoding ASCII

$probe = & $pythonExe -c "import encodings, fastapi, sqlalchemy, app.main; print('self_check_python_ok')" 2>&1
if ($LASTEXITCODE -ne 0) {
  throw "Prepared Python runtime failed backend import probe: $($probe | Out-String)"
}

Write-Host $probe
Write-Host "Run self-check with:"
Write-Host "`$env:FA_BACKEND_PYTHON='$pythonExe'; powershell -ExecutionPolicy Bypass -File scripts\self-check.ps1"
