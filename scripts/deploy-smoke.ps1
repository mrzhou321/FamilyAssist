param(
  [switch]$SkipModelPull,
  [switch]$SkipIfDockerUnavailable
)

$ErrorActionPreference = "Stop"
$root = (Resolve-Path "$PSScriptRoot\..").Path
$project = "familyassister-smoke"
$override = $null
$composeStarted = $false

function Test-DockerDaemon {
  try {
    docker version --format "{{.Server.Version}}" 2>$null | Out-Null
  } catch {
    return $false
  }
  if ($LASTEXITCODE -ne 0) {
    return $false
  }
  return $true
}

function Test-ShouldSkipMissingDocker {
  if ($SkipIfDockerUnavailable) {
    return $true
  }
  if ($env:DEPLOY_SMOKE_SKIP_DOCKER_UNAVAILABLE -eq "1") {
    return $true
  }
  if ($env:CI -eq "true" -or $env:CI -eq "1") {
    return $true
  }
  return $false
}

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
  if (-not (Test-DockerDaemon)) {
    if (Test-ShouldSkipMissingDocker) {
      Write-Host "deploy_smoke_skipped_docker_unavailable"
      exit 0
    }
    throw "Docker daemon is not reachable. Start Docker Desktop or the Docker service, then rerun scripts\deploy-smoke.ps1. In CI jobs without Docker, set CI=true, DEPLOY_SMOKE_SKIP_DOCKER_UNAVAILABLE=1, or pass -SkipIfDockerUnavailable."
  }

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
  $composeStarted = $true

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
} catch {
  Write-Host $_.Exception.Message
  exit 1
} finally {
  if ($composeStarted) {
    try {
      Compose @("down", "-v")
    } catch {
      Write-Warning $_
    }
  }
  if ($override) {
    Remove-Item -LiteralPath $override -Force -ErrorAction SilentlyContinue
  }
}
