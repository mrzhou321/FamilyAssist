param(
  [string]$BaseUrl = "",
  [switch]$SkipBuild,
  [switch]$SkipIfBrowserUnavailable,
  [string]$OutputDir = ""
)

$ErrorActionPreference = "Stop"
$root = (Resolve-Path "$PSScriptRoot\..").Path
$frontendRoot = Join-Path $root "frontend"
$previewProcess = $null
$previewServerScript = $null
$browserProfile = $null

function Find-Browser {
  $candidates = @(
    "C:\Program Files\Google\Chrome\Application\chrome.exe",
    "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
  )
  foreach ($candidate in $candidates) {
    if (Test-Path $candidate) {
      return $candidate
    }
  }
  return $null
}

function Get-FreePort {
  $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 0)
  try {
    $listener.Start()
    return $listener.LocalEndpoint.Port
  } finally {
    $listener.Stop()
  }
}

function Join-ProcessArguments($arguments) {
  return ($arguments | ForEach-Object {
    $value = [string]$_
    if ($value -match '[\s"]') {
      '"' + ($value -replace '"', '\"') + '"'
    } else {
      $value
    }
  }) -join " "
}

function Start-ManagedProcess($file, $arguments, $workingDirectory = "", $redirectOutput = $true) {
  $psi = [System.Diagnostics.ProcessStartInfo]::new()
  $psi.FileName = $file
  $psi.Arguments = Join-ProcessArguments $arguments
  $psi.UseShellExecute = $false
  $psi.CreateNoWindow = $true
  if ($workingDirectory) {
    $psi.WorkingDirectory = $workingDirectory
  }
  $psi.RedirectStandardOutput = $redirectOutput
  $psi.RedirectStandardError = $redirectOutput
  return [System.Diagnostics.Process]::Start($psi)
}

function Test-HttpStatus($url, $expectedStatus) {
  try {
    $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 10
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

function Wait-ForPreview($url) {
  $deadline = (Get-Date).AddSeconds(45)
  do {
    try {
      Test-HttpStatus $url 200
      return
    } catch {
      Start-Sleep -Milliseconds 500
    }
  } while ((Get-Date) -lt $deadline)
  throw "Timed out waiting for frontend preview at $url"
}

function Invoke-BrowserDom($browser, $profile, $url) {
  $arguments = @(
    "--headless=new",
    "--disable-gpu",
    "--disable-extensions",
    "--disable-dev-shm-usage",
    "--no-sandbox",
    "--no-first-run",
    "--no-default-browser-check",
    "--user-data-dir=$profile",
    "--window-size=390,844",
    "--virtual-time-budget=5000",
    "--dump-dom",
    $url
  )
  $process = Start-ManagedProcess $browser $arguments "" $true
  if (-not $process.WaitForExit(45000)) {
    $process.Kill()
    throw "Headless browser timed out for $url. $($process.StandardError.ReadToEnd())"
  }
  $output = $process.StandardOutput.ReadToEnd()
  $errorText = $process.StandardError.ReadToEnd()
  if ($process.ExitCode -ne 0) {
    throw "Headless browser failed for $url with exit code $($process.ExitCode). $errorText"
  }
  if (-not $output) {
    throw "Headless browser returned an empty DOM for $url. $errorText"
  }
  return $output
}

function Save-MobileScreenshot($browser, $profile, $url, $path) {
  $arguments = @(
    "--headless=new",
    "--disable-gpu",
    "--disable-extensions",
    "--disable-dev-shm-usage",
    "--no-sandbox",
    "--no-first-run",
    "--no-default-browser-check",
    "--user-data-dir=$profile",
    "--window-size=390,844",
    "--virtual-time-budget=5000",
    "--screenshot=$path",
    $url
  )
  $process = Start-ManagedProcess $browser $arguments "" $true
  if (-not $process.WaitForExit(45000)) {
    $process.Kill()
    throw "Mobile screenshot browser timed out for $url. $($process.StandardError.ReadToEnd())"
  }
  $errorText = $process.StandardError.ReadToEnd()
  if ($process.ExitCode -ne 0 -or -not (Test-Path $path) -or (Get-Item $path).Length -lt 1024) {
    throw "Mobile screenshot failed for $url. $errorText"
  }
}

function Invoke-BrowserDomWithRetry($browser, $profile, $url) {
  $lastError = $null
  for ($attempt = 1; $attempt -le 2; $attempt++) {
    try {
      return Invoke-BrowserDom $browser $profile $url
    } catch {
      $lastError = $_
      if ($attempt -lt 2) {
        Start-Sleep -Seconds 2
      }
    }
  }
  throw $lastError
}
try {
  $browser = Find-Browser
  if (-not $browser) {
    if ($SkipIfBrowserUnavailable) {
      Write-Host "mobile_viewport_smoke_skipped_browser_unavailable"
      exit 0
    }
    throw "No supported Edge or Chrome executable was found. Install Edge/Chrome, or pass -SkipIfBrowserUnavailable in environments without a browser."
  }

  if (-not $BaseUrl) {
    if (-not $SkipBuild) {
      Push-Location $frontendRoot
      try {
        npm run build
        if ($LASTEXITCODE -ne 0) {
          throw "frontend build failed with exit code $LASTEXITCODE"
        }
      } finally {
        Pop-Location
      }
    }

    $port = Get-FreePort
    $BaseUrl = "http://127.0.0.1:$port"
    $node = (Get-Command node.exe -ErrorAction SilentlyContinue).Source
    if (-not $node) {
      $node = (Get-Command node -ErrorAction Stop).Source
    }
    $previewServerScript = New-TemporaryFile
    @'
const fs = require("fs")
const http = require("http")
const path = require("path")

const root = process.argv[2]
const port = Number(process.argv[3])
const types = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json; charset=utf-8",
}

function send(response, status, file) {
  const ext = path.extname(file)
  response.writeHead(status, { "Content-Type": types[ext] || "application/octet-stream" })
  fs.createReadStream(file).pipe(response)
}

http
  .createServer((request, response) => {
    const url = new URL(request.url, "http://127.0.0.1")
    let pathname = decodeURIComponent(url.pathname)
    if (pathname === "/") {
      response.writeHead(302, { Location: "/mobile/" })
      response.end()
      return
    }

    const direct = path.join(root, pathname.replace(/^\/+/, ""))
    if (fs.existsSync(direct) && fs.statSync(direct).isFile()) {
      send(response, 200, direct)
      return
    }
    if (pathname.startsWith("/mobile/")) {
      send(response, 200, path.join(root, "mobile", "index.html"))
      return
    }
    if (pathname.startsWith("/admin/")) {
      send(response, 200, path.join(root, "admin", "index.html"))
      return
    }
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" })
    response.end("not found")
  })
  .listen(port, "127.0.0.1")
'@ | Set-Content -LiteralPath $previewServerScript -Encoding ASCII
    $previewProcess = Start-ManagedProcess $node @($previewServerScript, (Join-Path $frontendRoot "dist"), "$port") $frontendRoot $false
    Wait-ForPreview "$BaseUrl/mobile/"
  }

  $BaseUrl = $BaseUrl.TrimEnd("/")
  $browserProfile = Join-Path ([System.IO.Path]::GetTempPath()) ("familyassister-mobile-smoke-" + [System.Guid]::NewGuid().ToString("N"))
  New-Item -ItemType Directory -Path $browserProfile | Out-Null

  Test-HttpStatus "$BaseUrl/manifest.webmanifest" 200
  Test-HttpStatus "$BaseUrl/service-worker.js" 200

  $routes = @(
    @{ Path = "/mobile/"; Checks = @("id=`"root`"", "href=`"/mobile/pair`"", "href=`"/mobile/advice`"", "href=`"/mobile/memory`"") },
    @{ Path = "/mobile/pair"; Checks = @("id=`"root`"", "<input", "<button", "<video") },
    @{ Path = "/mobile/advice"; Checks = @("id=`"root`"", "href=`"/mobile/pair`"") },
    @{ Path = "/mobile/memory"; Checks = @("id=`"root`"", "href=`"/mobile/pair`"") }
  )

  foreach ($route in $routes) {
    $url = "$BaseUrl$($route.Path)"
    Test-HttpStatus $url 200
    $dom = Invoke-BrowserDomWithRetry $browser $browserProfile $url
    if ($dom.Length -lt 1200 -or $dom.IndexOf('<div id="root"></div>') -ge 0) {
      throw "$url rendered a blank or too-small mobile shell"
    }
    foreach ($check in $route.Checks) {
      if ($dom.IndexOf($check) -lt 0) {
        throw "$url is missing expected mobile marker: $check"
      }
    }
  }

  if ($OutputDir) {
    $resolvedOutputDir = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($OutputDir)
    New-Item -ItemType Directory -Path $resolvedOutputDir -Force | Out-Null
    Save-MobileScreenshot $browser $browserProfile "$BaseUrl/mobile/" (Join-Path $resolvedOutputDir "mobile-home.png")
  }

  Write-Host "mobile_viewport_smoke_ok"
} catch {
  Write-Host $_.Exception.Message
  exit 1
} finally {
  if ($previewProcess -and -not $previewProcess.HasExited) {
    $previewProcess.Kill()
  }
  if ($previewServerScript) {
    Remove-Item -LiteralPath $previewServerScript -Force -ErrorAction SilentlyContinue
  }
  if ($browserProfile) {
    Remove-Item -LiteralPath $browserProfile -Recurse -Force -ErrorAction SilentlyContinue
  }
}
