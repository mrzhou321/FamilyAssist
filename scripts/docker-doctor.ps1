param(
  [string]$DockerHost = "",
  [string]$DockerConfig = "",
  [int]$ProbeTimeoutSec = 12,
  [switch]$FailOnUnavailable
)

$ErrorActionPreference = "Stop"
$root = (Resolve-Path "$PSScriptRoot\..").Path
if (-not $DockerConfig) {
  $DockerConfig = $env:DOCKER_CONFIG
}
if (-not $DockerConfig) {
  $DockerConfig = Join-Path $root ".tmp-runtime\docker-config"
}

function Invoke-DockerProbe($targetHost) {
  $previousDockerHost = $env:DOCKER_HOST
  $previousDockerConfig = $env:DOCKER_CONFIG
  try {
    $env:DOCKER_CONFIG = $DockerConfig
    if ($targetHost) {
      $env:DOCKER_HOST = $targetHost
    } else {
      Remove-Item Env:DOCKER_HOST -ErrorAction SilentlyContinue
    }
    $probe = New-Object System.Diagnostics.ProcessStartInfo
    $probe.FileName = "docker"
    $probe.Arguments = "version"
    $probe.RedirectStandardOutput = $true
    $probe.RedirectStandardError = $true
    $probe.UseShellExecute = $false
    $process = [System.Diagnostics.Process]::Start($probe)
    if (-not $process.WaitForExit($ProbeTimeoutSec * 1000)) {
      $process.Kill()
      return [pscustomobject]@{
        host = $(if ($targetHost) { $targetHost } else { "default" })
        ok = $false
        detail = "docker version timed out after $ProbeTimeoutSec seconds"
      }
    }
    $stdout = $process.StandardOutput.ReadToEnd()
    $stderr = $process.StandardError.ReadToEnd()
    $output = ($stdout + "`n" + $stderr).Trim()
    return [pscustomobject]@{
      host = $(if ($targetHost) { $targetHost } else { "default" })
      ok = $process.ExitCode -eq 0
      detail = $output
    }
  } finally {
    if ($null -eq $previousDockerHost) {
      Remove-Item Env:DOCKER_HOST -ErrorAction SilentlyContinue
    } else {
      $env:DOCKER_HOST = $previousDockerHost
    }
    if ($null -eq $previousDockerConfig) {
      Remove-Item Env:DOCKER_CONFIG -ErrorAction SilentlyContinue
    } else {
      $env:DOCKER_CONFIG = $previousDockerConfig
    }
  }
}

New-Item -ItemType Directory -Force -Path $DockerConfig | Out-Null

$currentUser = (& whoami).Trim()
$groups = (& whoami /groups | Out-String)
$dockerUsers = (& net localgroup docker-users 2>&1 | Out-String).Trim()
$pipes = @(Get-ChildItem -LiteralPath "\\.\pipe\" -ErrorAction SilentlyContinue | Where-Object { $_.Name -like "*docker*" } | Select-Object -ExpandProperty Name)

$candidateHosts = @()
if ($DockerHost) {
  $candidateHosts += $DockerHost
}
$candidateHosts += @(
  "",
  "npipe:////./pipe/dockerDesktopLinuxEngine",
  "npipe:////./pipe/docker_engine",
  "npipe:////./pipe/docker_engine_linux"
) | Select-Object -Unique

$probes = @($candidateHosts | ForEach-Object { Invoke-DockerProbe $_ })
$okProbe = $probes | Where-Object { $_.ok } | Select-Object -First 1
$probeDetails = ($probes | ForEach-Object { $_.detail }) -join "`n"

$report = [pscustomobject]@{
  generated_at = [DateTime]::UtcNow.ToString("o")
  user = $currentUser
  docker_config = $DockerConfig
  user_has_docker_group = $groups.IndexOf("docker-users") -ge 0
  docker_users_group = $dockerUsers
  docker_pipes = $pipes
  probes = $probes
  ok = [bool]$okProbe
  recommendation = $(if ($okProbe) {
    "Docker is reachable through $($okProbe.host). Run scripts\deploy-smoke.ps1 next."
  } elseif ($probeDetails.IndexOf("timed out") -ge 0 -or $probeDetails.IndexOf("500 Internal Server Error") -ge 0) {
    "Docker pipes exist but the Docker API is hanging or returning 500. Restart Docker Desktop, wait until the engine is fully running, or use Docker Desktop Troubleshoot/Restart or Reset, then rerun this script."
  } elseif ($probeDetails.IndexOf("permission denied") -ge 0 -and $groups.IndexOf("docker-users") -ge 0) {
    "Docker pipes exist and the current user is in docker-users, but Docker still rejects access. Restart Docker Desktop and sign out/in to refresh the Windows access token, then rerun this script."
  } elseif ($pipes.Count -gt 0 -and $groups.IndexOf("docker-users") -ge 0) {
    "Docker pipes exist and the current user is in docker-users, but Docker is still not reachable. Restart Docker Desktop and rerun this script."
  } elseif ($pipes.Count -gt 0) {
    "Docker pipes exist, but the current user is not in docker-users. Add the user to docker-users, sign out/in, then rerun this script."
  } else {
    "Docker pipes were not found. Start Docker Desktop and wait for the Linux engine to finish starting, then rerun this script."
  })
}

$report | ConvertTo-Json -Depth 6
if (-not $report.ok -and $FailOnUnavailable) {
  exit 1
}
