param(
  [switch]$SkipModelPull
)

$ErrorActionPreference = "Stop"
$root = (Resolve-Path "$PSScriptRoot\..").Path
$project = "familyassister-smoke"
$override = $null

function Compose($arguments) {
  Push-Location $root
  try {
    if ($override) {
      docker compose -p $project -f docker-compose.yml -f $override @arguments
    } else {
      docker compose -p $project @arguments
    }
    if ($LASTEXITCODE -ne 0) {
      throw "docker compose $($arguments -join ' ') failed with exit code $LASTEXITCODE"
    }
  } finally {
    Pop-Location
  }
}

try {
  if ($SkipModelPull) {
    $override = Join-Path ([System.IO.Path]::GetTempPath()) "familyassister-compose-smoke.override.yml"
    @"
services:
  ollama-models:
    entrypoint: ["/bin/sh", "-c"]
    command: "echo skip model pull"
"@ | Set-Content -LiteralPath $override -Encoding UTF8
  }

  Compose @("config")
  Compose @("up", "--build", "-d")

  $deadline = (Get-Date).AddMinutes(3)
  do {
    Start-Sleep -Seconds 5
    Push-Location $root
    try {
      $health = docker compose -p $project ps --format json
    } finally {
      Pop-Location
    }
    if ($health -match '"Service":"backend".*"Health":"healthy"' -and $health -match '"Service":"nginx".*"State":"running"') {
      Write-Host "deploy_smoke_ok"
      exit 0
    }
  } while ((Get-Date) -lt $deadline)

  throw "Timed out waiting for backend healthy and nginx running"
} finally {
  try {
    Compose @("down", "-v")
  } catch {
    Write-Warning $_
  }
  if ($override) {
    Remove-Item -LiteralPath $override -Force -ErrorAction SilentlyContinue
  }
}

