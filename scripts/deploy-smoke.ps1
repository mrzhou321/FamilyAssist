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
  $probe = New-Object System.Diagnostics.ProcessStartInfo
  $probe.FileName = "docker"
  $probe.Arguments = 'version --format "{{.Server.Version}}"'
  $probe.RedirectStandardOutput = $true
  $probe.RedirectStandardError = $true
  $probe.UseShellExecute = $false
  try {
    $process = [System.Diagnostics.Process]::Start($probe)
    $stdout = $process.StandardOutput.ReadToEnd()
    $stderr = $process.StandardError.ReadToEnd()
    $process.WaitForExit()
    $exitCode = $process.ExitCode
    $output = ($stdout + "`n" + $stderr).Trim()
  } catch {
    return [pscustomobject]@{
      Ok = $false
      Detail = $_.Exception.Message
    }
  }

  if ($exitCode -eq 0) {
    return [pscustomobject]@{
      Ok = $true
      Detail = $output
    }
  }
  return [pscustomobject]@{
    Ok = $false
    Detail = $output
  }
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

function Test-SmokeHttpStatus($url, $expectedStatus) {
  try {
    $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 10 -Method GET
    $actualStatus = [int]$response.StatusCode
  } catch {
    if ($_.Exception.Response) {
      $actualStatus = [int]$_.Exception.Response.StatusCode
    } else {
      throw
    }
  }

  if ($actualStatus -ne $expectedStatus) {
    throw "$url returned HTTP $actualStatus, expected $expectedStatus"
  }
}

function Get-ComposeStatus {
  Push-Location $root
  try {
    $lines = docker compose -p $project ps --format json
    if ($LASTEXITCODE -ne 0) {
      throw "docker compose ps failed with exit code $LASTEXITCODE"
    }
  } finally {
    Pop-Location
  }

  return @($lines | Where-Object { $_.Trim().Length -gt 0 } | ForEach-Object { $_ | ConvertFrom-Json })
}

function Test-ServicesReady($containers) {
  $backend = $containers | Where-Object { $_.Service -eq "backend" } | Select-Object -First 1
  $nginx = $containers | Where-Object { $_.Service -eq "nginx" } | Select-Object -First 1
  return $backend -and $backend.Health -eq "healthy" -and $nginx -and $nginx.State -eq "running"
}

try {
  $dockerDaemon = Test-DockerDaemon
  if (-not $dockerDaemon.Ok) {
    if (Test-ShouldSkipMissingDocker) {
      Write-Host "deploy_smoke_skipped_docker_unavailable"
      if ($dockerDaemon.Detail) {
        Write-Host "docker_unavailable_detail: $($dockerDaemon.Detail)"
      }
      exit 0
    }
    throw "Docker daemon is not reachable. Start Docker Desktop or the Docker service, make sure the current user can access the Docker named pipe, then rerun scripts\deploy-smoke.ps1. In CI jobs without Docker, set CI=true, DEPLOY_SMOKE_SKIP_DOCKER_UNAVAILABLE=1, or pass -SkipIfDockerUnavailable. Docker detail: $($dockerDaemon.Detail)"
  }

  if ($SkipModelPull) {
    $override = Join-Path ([System.IO.Path]::GetTempPath()) "familyassister-compose-smoke.override.yml"
    @"
services:
  ollama:
    image: alpine:3.20
    entrypoint: ["/bin/sh", "-c", "sleep 300"]
  ollama-models:
    image: alpine:3.20
    entrypoint: ["/bin/sh", "-c", "echo skip model pull"]
"@ | Set-Content -LiteralPath $override -Encoding UTF8
  }

  Compose @("config")
  Compose @("up", "--build", "-d")
  $composeStarted = $true

  $deadline = (Get-Date).AddMinutes(3)
  do {
    Start-Sleep -Seconds 5
    $containers = Get-ComposeStatus
    if (Test-ServicesReady $containers) {
      Test-SmokeHttpStatus "http://localhost/health" 200
      Test-SmokeHttpStatus "http://localhost/mobile/" 200
      Test-SmokeHttpStatus "http://localhost/admin/" 200
      Test-SmokeHttpStatus "http://localhost/api/members" 401
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
