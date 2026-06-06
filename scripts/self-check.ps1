$ErrorActionPreference = "Stop"

function Step($name, $script) {
  Write-Host ""
  Write-Host "==> $name" -ForegroundColor Cyan
  & $script
}

$root = (Resolve-Path "$PSScriptRoot\..").Path
Step "Frontend build" {
  Push-Location "$root\frontend"
  try {
    npm run build
    if ($LASTEXITCODE -ne 0) {
      throw "Frontend build failed with exit code $LASTEXITCODE"
    }
  } finally {
    Pop-Location
  }
}

Step "Frontend lint" {
  Push-Location "$root\frontend"
  try {
    npm run lint
    if ($LASTEXITCODE -ne 0) {
      throw "Frontend lint failed with exit code $LASTEXITCODE"
    }
  } finally {
    Pop-Location
  }
}

Step "Deployment and backup docs" {
  $readme = Get-Content "$root\README.md" -Raw -Encoding UTF8
  if ($readme.IndexOf("docker compose up --build") -lt 0 -or $readme.IndexOf("http://localhost/admin/") -lt 0 -or $readme.IndexOf("http://localhost/mobile/") -lt 0) {
    throw "README does not document local compose startup and app entrypoints"
  }
  if ($readme.IndexOf("pg_dump") -lt 0 -or $readme.IndexOf("pg_restore") -lt 0 -or $readme.IndexOf("postgres_data") -lt 0) {
    throw "README does not document self-hosted database backup and restore"
  }
  if ($readme.IndexOf("ADMIN_PASSWORD") -lt 0 -or $readme.IndexOf("ADMIN_TOKEN_SECRET") -lt 0) {
    throw "README does not remind operators to rotate default secrets"
  }
  if ($readme.IndexOf("scripts\deploy-smoke.ps1") -lt 0 -or $readme.IndexOf("-SkipModelPull") -lt 0) {
    throw "README does not document optional Docker compose smoke test"
  }
  Write-Host "deployment_backup_docs_ok"
}

Step "Deployment smoke script" {
  $deploySmokePath = "$root\scripts\deploy-smoke.ps1"
  $parseErrors = $null
  $parseTokens = $null
  [System.Management.Automation.Language.Parser]::ParseFile($deploySmokePath, [ref]$parseTokens, [ref]$parseErrors) | Out-Null
  if ($parseErrors.Count -gt 0) {
    throw "Deploy smoke script has PowerShell syntax errors"
  }
  $deploySmoke = Get-Content $deploySmokePath -Raw -Encoding UTF8
  if ($deploySmoke.IndexOf("docker compose") -lt 0 -or $deploySmoke.IndexOf("--build") -lt 0 -or $deploySmoke.IndexOf("backend") -lt 0 -or $deploySmoke.IndexOf("nginx") -lt 0) {
    throw "Deploy smoke script does not exercise compose build and health checks"
  }
  if ($deploySmoke.IndexOf("SkipModelPull") -lt 0 -or $deploySmoke.IndexOf("skip model pull") -lt 0) {
    throw "Deploy smoke script does not expose a fast no-model-pull mode"
  }
  Write-Host "deployment_smoke_script_ok"
}

Step "Deployment security defaults" {
  $compose = Get-Content "$root\docker-compose.yml" -Raw -Encoding UTF8
  $nginx = Get-Content "$root\docker\nginx\nginx.conf" -Raw -Encoding UTF8
  if ($compose.IndexOf('DEBUG: "false"') -lt 0) {
    throw "Docker compose should not enable debug CORS by default"
  }
  if ($compose.IndexOf("ADMIN_PASSWORD") -lt 0 -or $compose.IndexOf("ADMIN_TOKEN_SECRET") -lt 0) {
    throw "Docker compose must expose admin secret environment variables"
  }
  if ($nginx.IndexOf("location /api") -lt 0 -or $nginx.IndexOf("proxy_pass http://backend:8000") -lt 0) {
    throw "Nginx does not proxy same-origin API requests to the backend"
  }
  Write-Host "deployment_security_defaults_ok"
}

Step "PRD implementation audit docs" {
  $audit = Get-Content "$root\docs\PRD_IMPLEMENTATION_AUDIT.md" -Raw -Encoding UTF8
  if ($audit.IndexOf("Text quick notes") -lt 0 -or $audit.IndexOf("Pairing QR login") -lt 0 -or $audit.IndexOf("Performance smoke") -lt 0) {
    throw "PRD implementation audit does not cover core product areas"
  }
  if ($audit.IndexOf("Residual Risks") -lt 0 -or $audit.IndexOf("GBNF") -lt 0 -or $audit.IndexOf("manual mobile testing") -lt 0) {
    throw "PRD implementation audit does not preserve known residual risks"
  }
  Write-Host "prd_implementation_audit_docs_ok"
}

Step "Frontend review status docs" {
  $review = Get-Content "$root\docs\code-review-2026-06-05.md" -Raw -Encoding UTF8
  if ($review.IndexOf("Frontend Review Status") -lt 0 -or $review.IndexOf("Closed Findings") -lt 0 -or $review.IndexOf("Remaining Intentional Tradeoffs") -lt 0) {
    throw "Frontend review document does not reflect current review status"
  }
  if ($review.IndexOf("硬编码 member_id=1") -ge 0 -or $review.IndexOf("| P0 | 硬编码 member_id") -ge 0) {
    throw "Frontend review document still advertises stale P0 member identity findings"
  }
  if ($review.IndexOf("scripts\self-check.ps1") -lt 0 -or $review.IndexOf("PRD_IMPLEMENTATION_AUDIT.md") -lt 0) {
    throw "Frontend review document does not point to current verification gates"
  }
  Write-Host "frontend_review_status_docs_ok"
}

Step "Frontend offline cache wiring" {
  $cachedData = Get-Content "$root\frontend\src\mobile\offline\cachedData.ts" -Raw
  if ($cachedData -notmatch "cached-memories" -or $cachedData -notmatch "cacheMemories" -or $cachedData -notmatch "getCachedMemories") {
    throw "Offline memory cache module is incomplete"
  }
  if ($cachedData -notmatch "cached-recommendations" -or $cachedData -notmatch "cacheRecommendations" -or $cachedData -notmatch "getCachedRecommendations") {
    throw "Offline recommendation cache module is incomplete"
  }
  if ($cachedData -notmatch "cached-weather" -or $cachedData -notmatch "cacheWeather" -or $cachedData -notmatch "getCachedWeather") {
    throw "Offline weather cache module is incomplete"
  }
  $hooks = Get-Content "$root\frontend\src\shared\hooks\index.ts" -Raw
  if ($hooks -notmatch "cacheMemories" -or $hooks -notmatch "getCachedMemories") {
    throw "Memory query does not use offline cache"
  }
  $todayAdvice = Get-Content "$root\frontend\src\mobile\pages\TodayAdvice.tsx" -Raw
  if ($todayAdvice -notmatch "cacheRecommendations" -or $todayAdvice -notmatch "getCachedRecommendations" -or $todayAdvice -notmatch "getCachedWeather") {
    throw "Today advice does not use offline recommendation and weather cache"
  }
  if ($todayAdvice.IndexOf("hasPairedMember") -lt 0 -or $todayAdvice.IndexOf("if (!isPaired) return") -lt 0 -or $todayAdvice.IndexOf('to="/pair"') -lt 0) {
    throw "Today advice does not gate recommendations behind pairing"
  }
  $memoryVault = Get-Content "$root\frontend\src\mobile\pages\MemoryVault.tsx" -Raw -Encoding UTF8
  $memoryVaultHasPairingCheck = $memoryVault.IndexOf("hasPairedMember") -ge 0
  $memoryVaultUsesEnabledQuery = $memoryVault.IndexOf("useMemberMemories(memberId, isPaired)") -ge 0
  $memoryVaultHasPairRoute = $memoryVault.IndexOf('to="/pair"') -ge 0
  $memoryVaultGatesMockData = $memoryVault.IndexOf("isPaired && isError ? normalizeMockMemories() : []") -ge 0
  if (-not $memoryVaultHasPairingCheck) {
    throw "Memory vault does not check pairing"
  }
  if (-not $memoryVaultUsesEnabledQuery) {
    throw "Memory vault does not disable memory queries before pairing"
  }
  if (-not $memoryVaultHasPairRoute -or -not $memoryVaultGatesMockData) {
    throw "Memory vault does not gate member data behind pairing"
  }
  $quickNote = Get-Content "$root\frontend\src\mobile\pages\QuickNote.tsx" -Raw -Encoding UTF8
  $quickNoteShowsPairingCopy = $quickNote.IndexOf('to="/pair"') -ge 0
  $quickNoteGatesMockMembers = ($quickNote.IndexOf("currentMemberName") -ge 0) -and ($quickNote.IndexOf("MOCK_MEMBERS.map") -lt 0) -and ($quickNote.IndexOf("useMembers") -lt 0)
  $quickNoteDisablesNotesBeforePairing = $quickNote.IndexOf("useMemberNotes(memberId, isPaired)") -ge 0
  if (-not $quickNoteShowsPairingCopy -or -not $quickNoteGatesMockMembers -or -not $quickNoteDisablesNotesBeforePairing) {
    throw "Quick note does not gate member choices behind pairing"
  }
  if ($quickNote.IndexOf("PhotoCapture") -lt 0 -or $quickNote.IndexOf("buildPhotoNoteText") -lt 0 -or $quickNote.IndexOf("formatPhotoSize") -lt 0) {
    throw "Quick note photo capture metadata is incomplete"
  }
  if ($quickNote.IndexOf("previewUrl") -lt 0 -or $quickNote.IndexOf("URL.createObjectURL") -lt 0 -or $quickNote.IndexOf("URL.revokeObjectURL") -lt 0) {
    throw "Quick note photo capture does not manage local preview URLs"
  }
  if ($quickNote.IndexOf("src={photoCapture.previewUrl}") -lt 0 -or $quickNote.IndexOf("object-cover") -lt 0) {
    throw "Quick note photo capture preview image is missing"
  }
  if ($quickNote.IndexOf("setPhotoCapture(null)") -lt 0 -or $quickNote.IndexOf("photoInputRef.current.value = ''") -lt 0) {
    throw "Quick note does not clear photo capture state after submit or recapture"
  }
  $capabilities = Get-Content "$root\frontend\src\mobile\capabilities.ts" -Raw -Encoding UTF8
  if ($capabilities.IndexOf("detectMobileCapabilities") -lt 0 -or $capabilities.IndexOf("SpeechRecognition") -lt 0 -or $capabilities.IndexOf("getUserMedia") -lt 0 -or $capabilities.IndexOf("indexedDB") -lt 0) {
    throw "Mobile capability detection module is incomplete"
  }
  if ($quickNote.IndexOf("detectMobileCapabilities") -lt 0 -or $quickNote.IndexOf("CapabilityPill") -lt 0) {
    throw "Quick note does not surface mobile capability status"
  }
  $noteQueue = Get-Content "$root\frontend\src\mobile\offline\noteQueue.ts" -Raw
  if ($noteQueue -notmatch "DB_VERSION = 3" -or $noteQueue -notmatch "cached-memories" -or $noteQueue -notmatch "cached-recommendations" -or $noteQueue -notmatch "cached-weather") {
    throw "Offline IndexedDB migration does not create cached data stores"
  }
  if ($noteQueue.IndexOf("for (const note of queued)") -lt 0 -or $noteQueue.IndexOf("catch {") -lt 0 -or $noteQueue.IndexOf("Keep failed items queued") -lt 0) {
    throw "Offline note sync does not keep later queued notes moving after a failure"
  }
  $api = Get-Content "$root\frontend\src\shared\api\index.ts" -Raw -Encoding UTF8
  $hooks = Get-Content "$root\frontend\src\shared\hooks\index.ts" -Raw -Encoding UTF8
  if ($api.IndexOf("class ApiError") -lt 0 -or $api.IndexOf("throw new ApiError(res.status, res.statusText)") -lt 0) {
    throw "API wrapper does not expose HTTP status for offline queue decisions"
  }
  if ($hooks.IndexOf("error instanceof ApiError") -lt 0 -or $hooks.IndexOf("[401, 403].includes(error.status)") -lt 0 -or $hooks.IndexOf("await enqueueNote(note)") -lt 0) {
    throw "Quick note offline queue should not enqueue authentication or authorization failures"
  }
  Write-Host "frontend_offline_cache_wiring_ok"
}

Step "Frontend review workflow wiring" {
  $reviewPage = Get-Content "$root\frontend\src\admin\pages\Review.tsx" -Raw -Encoding UTF8
  if ($reviewPage -match "\?\?\?") {
    throw "Review page contains placeholder question marks"
  }
  if ($reviewPage -notmatch "StatusFilter" -or $reviewPage -notmatch "FILTER_LABEL" -or $reviewPage -notmatch "setStatusFilter") {
    throw "Review page status filters are missing"
  }
  if ($reviewPage -notmatch "understanding" -or $reviewPage -notmatch "reviewed" -or $reviewPage -notmatch "rejected") {
    throw "Review page does not expose all review statuses"
  }
  if ($reviewPage -notmatch "/review/notes/\$\{activeSelectedId\}/approve" -or $reviewPage -notmatch "/review/notes/\$\{activeSelectedId\}/reject") {
    throw "Review page approve/reject actions are not wired"
  }
  Write-Host "frontend_review_workflow_wiring_ok"
}

Step "Frontend provider status wiring" {
  $settingsPage = Get-Content "$root\frontend\src\admin\pages\Settings.tsx" -Raw -Encoding UTF8
  if ($settingsPage -notmatch "ProviderStatus" -or $settingsPage -notmatch "/settings/provider-status") {
    throw "Settings page does not fetch provider status"
  }
  if ($settingsPage.IndexOf("StatusRow") -lt 0 -or $settingsPage.IndexOf("statusLabel") -lt 0 -or $settingsPage.IndexOf("providerStatus.llm") -lt 0) {
    throw "Settings page does not render provider status rows"
  }
  if ($settingsPage.IndexOf("cloud_llm_api_key") -lt 0 -or $settingsPage.IndexOf("cloud_llm_base_url") -lt 0 -or $settingsPage.IndexOf("cloud_generation_model") -lt 0) {
    throw "Settings page does not expose cloud LLM provider configuration"
  }
  if ($settingsPage.IndexOf("cloud_llm_api_key_configured") -lt 0 -or $settingsPage.IndexOf("weather_api_key_configured") -lt 0) {
    throw "Settings page does not show masked secret configuration state"
  }
  if ($settingsPage.IndexOf("type=`"password`"") -lt 0 -or $settingsPage.IndexOf("cloud_llm_api_key_configured ?") -lt 0) {
    throw "Settings page does not explain secret masking behavior"
  }
  if ($settingsPage.IndexOf("rebuild-memory-embeddings") -lt 0 -or $settingsPage.IndexOf("rebuildEmbeddings") -lt 0) {
    throw "Settings page does not expose memory embedding rebuild action"
  }
  $usesParallelLoad = $settingsPage.IndexOf("Promise.all") -ge 0
  $hasRefreshButton = $settingsPage.IndexOf("onClick={loadSettings}") -ge 0
  if (-not $usesParallelLoad -or -not $hasRefreshButton) {
    throw "Settings page provider status refresh wiring is incomplete"
  }
  Write-Host "frontend_provider_status_wiring_ok"
}

Step "Frontend recommendation events wiring" {
  $adminMain = Get-Content "$root\frontend\src\admin\main.tsx" -Raw -Encoding UTF8
  $eventsPage = Get-Content "$root\frontend\src\admin\pages\RecommendationEvents.tsx" -Raw -Encoding UTF8
  if ($adminMain.IndexOf("RecommendationEvents") -lt 0 -or $adminMain.IndexOf("/recommendations") -lt 0) {
    throw "Admin recommendation events route is missing"
  }
  if ($eventsPage.IndexOf("/recommendation-events") -lt 0 -or $eventsPage.IndexOf("memory_ids") -lt 0 -or $eventsPage.IndexOf("basis") -lt 0) {
    throw "Recommendation events page does not render audit details"
  }
  if ($eventsPage.IndexOf("setMemberFilter") -lt 0 -or $eventsPage.IndexOf("setDomainFilter") -lt 0) {
    throw "Recommendation events filters are missing"
  }
  Write-Host "frontend_recommendation_events_wiring_ok"
}

Step "Frontend memory metadata wiring" {
  $memoryLibrary = Get-Content "$root\frontend\src\admin\pages\MemoryLibrary.tsx" -Raw -Encoding UTF8
  if ($memoryLibrary.IndexOf("formatExpiry") -lt 0 -or $memoryLibrary.IndexOf("toDateTimeLocal") -lt 0 -or $memoryLibrary.IndexOf("fromDateTimeLocal") -lt 0) {
    throw "Memory library does not format editable expiry metadata"
  }
  if ($memoryLibrary.IndexOf("datetime-local") -lt 0 -or $memoryLibrary.IndexOf("updateEditing('expires_at', null)") -lt 0) {
    throw "Memory library does not expose expiry editing controls"
  }
  if ($memoryLibrary.IndexOf("expires_at: editing.expires_at") -lt 0) {
    throw "Memory library does not persist expiry edits"
  }
  Write-Host "frontend_memory_metadata_wiring_ok"
}

Step "Frontend PWA install wiring" {
  $mobileHtml = Get-Content "$root\frontend\mobile\index.html" -Raw -Encoding UTF8
  if ($mobileHtml.IndexOf("manifest.webmanifest") -lt 0 -or $mobileHtml.IndexOf("apple-mobile-web-app-capable") -lt 0) {
    throw "Mobile HTML is missing installable PWA metadata"
  }
  $manifest = Get-Content "$root\frontend\public\manifest.webmanifest" -Raw -Encoding UTF8 | ConvertFrom-Json
  if ($manifest.start_url -ne "/mobile/" -or $manifest.display -ne "standalone" -or $manifest.id -ne "/mobile/") {
    throw "PWA manifest install scope is incorrect"
  }
  if (-not $manifest.shortcuts -or $manifest.shortcuts.Count -lt 2) {
    throw "PWA manifest shortcuts are missing"
  }
  $serviceWorker = Get-Content "$root\frontend\public\service-worker.js" -Raw -Encoding UTF8
  if ($serviceWorker.IndexOf("SHELL_URLS") -lt 0 -or $serviceWorker.IndexOf("/mobile/") -lt 0 -or $serviceWorker.IndexOf("SKIP_WAITING") -lt 0) {
    throw "Service worker app shell/update wiring is incomplete"
  }
  $mobileMain = Get-Content "$root\frontend\src\mobile\main.tsx" -Raw -Encoding UTF8
  if ($mobileMain.IndexOf("beforeinstallprompt") -lt 0 -or $mobileMain.IndexOf("useInstallPrompt") -lt 0 -or $mobileMain.IndexOf("navigator.serviceWorker.register") -lt 0) {
    throw "Mobile app install prompt or service worker registration is missing"
  }
  Write-Host "frontend_pwa_install_wiring_ok"
}

Step "Frontend mobile pairing scanner wiring" {
  $pairDevice = Get-Content "$root\frontend\src\mobile\pages\PairDevice.tsx" -Raw -Encoding UTF8
  if ($pairDevice.IndexOf("BarcodeDetector") -lt 0 -or $pairDevice.IndexOf("getUserMedia") -lt 0 -or $pairDevice.IndexOf("qr_code") -lt 0) {
    throw "Mobile pairing page does not wire QR scanning"
  }
  if ($pairDevice.IndexOf("detectMobileCapabilities") -lt 0 -or $pairDevice.IndexOf("CapabilityBadge") -lt 0) {
    throw "Mobile pairing page does not surface camera and barcode capability status"
  }
  if ($pairDevice.IndexOf("extractPairingToken") -lt 0 -or $pairDevice.IndexOf("searchParams.get('token')") -lt 0) {
    throw "Mobile pairing page does not extract token from scanned pairing URLs"
  }
  if ($pairDevice.IndexOf("onClick={isScanning ? stopScanner : startScanner}") -lt 0 -or $pairDevice.IndexOf("value={token}") -lt 0 -or $pairDevice.IndexOf("setToken(event.target.value)") -lt 0) {
    throw "Mobile pairing page does not expose scan and manual token controls"
  }
  Write-Host "frontend_mobile_pairing_scanner_wiring_ok"
}

Step "Frontend auth token constants" {
  $frontendSource = Get-ChildItem "$root\frontend\src" -Recurse -Include *.ts,*.tsx |
    ForEach-Object { Get-Content $_.FullName -Raw -Encoding UTF8 }
  if (($frontendSource | Select-String -Pattern "localStorage\.(getItem|setItem|removeItem)\('([^']+)'" ).Count -gt 0) {
    throw "Frontend still uses raw localStorage auth keys"
  }
  $constants = Get-Content "$root\frontend\src\shared\constants\index.ts" -Raw -Encoding UTF8
  if ($constants.IndexOf("ADMIN_TOKEN_KEY") -lt 0 -or $constants.IndexOf("MEMBER_TOKEN_KEY") -lt 0 -or $constants.IndexOf("LEGACY_MEMBER_TOKEN_KEY") -lt 0) {
    throw "Frontend auth token constants are incomplete"
  }
  Write-Host "frontend_auth_token_constants_ok"
}

Step "Frontend design token colors" {
  $colors = Get-Content "$root\frontend\src\shared\constants\colors.ts" -Raw -Encoding UTF8
  $globals = Get-Content "$root\frontend\src\globals.css" -Raw -Encoding UTF8
  if (($colors | Select-String -Pattern "#[0-9A-Fa-f]{3,8}").Count -gt 0) {
    throw "Shared color constants should use design tokens instead of raw hex values"
  }
  foreach ($token in @(
    "--color-clay",
    "--color-marigold",
    "--color-dressing-bg",
    "--color-diet-bg",
    "--color-exercise-bg",
    "--color-dressing-border",
    "--color-diet-border",
    "--color-exercise-border"
  )) {
    if ($globals.IndexOf($token) -lt 0 -or $colors.IndexOf($token) -lt 0) {
      throw "Design token $token is missing from globals.css or shared color constants"
    }
  }
  Write-Host "frontend_design_token_colors_ok"
}

Step "Frontend admin auth expiry wiring" {
  $constants = Get-Content "$root\frontend\src\shared\constants\index.ts" -Raw -Encoding UTF8
  $api = Get-Content "$root\frontend\src\shared\api\index.ts" -Raw -Encoding UTF8
  $adminMain = Get-Content "$root\frontend\src\admin\main.tsx" -Raw -Encoding UTF8
  if ($constants.IndexOf("ADMIN_AUTH_EXPIRED_EVENT") -lt 0) {
    throw "Frontend does not define an admin auth expiry event"
  }
  if ($api.IndexOf("expireAdminAuth") -lt 0 -or $api.IndexOf("res.status === 401") -lt 0 -or $api.IndexOf("localStorage.removeItem(ADMIN_TOKEN_KEY)") -lt 0) {
    throw "API wrapper does not clear expired admin tokens on 401"
  }
  if ($api.IndexOf("window.dispatchEvent(new Event(ADMIN_AUTH_EXPIRED_EVENT))") -lt 0) {
    throw "API wrapper does not notify admin shell when auth expires"
  }
  if ($adminMain.IndexOf("ADMIN_AUTH_EXPIRED_EVENT") -lt 0 -or $adminMain.IndexOf("window.addEventListener") -lt 0 -or $adminMain.IndexOf("setIsAuthed(false)") -lt 0) {
    throw "Admin shell does not return to login when admin auth expires"
  }
  Write-Host "frontend_admin_auth_expiry_wiring_ok"
}

Step "Frontend member auth expiry wiring" {
  $constants = Get-Content "$root\frontend\src\shared\constants\index.ts" -Raw -Encoding UTF8
  $api = Get-Content "$root\frontend\src\shared\api\index.ts" -Raw -Encoding UTF8
  $mobileMain = Get-Content "$root\frontend\src\mobile\main.tsx" -Raw -Encoding UTF8
  $session = Get-Content "$root\frontend\src\mobile\session\index.ts" -Raw -Encoding UTF8
  $pairDevice = Get-Content "$root\frontend\src\mobile\pages\PairDevice.tsx" -Raw -Encoding UTF8
  if ($constants.IndexOf("MEMBER_AUTH_EXPIRED_EVENT") -lt 0) {
    throw "Frontend does not define a member auth expiry event"
  }
  if ($session.IndexOf("clearMemberSession") -lt 0 -or $session.IndexOf("localStorage.removeItem(MEMBER_TOKEN_KEY)") -lt 0 -or $session.IndexOf("localStorage.removeItem(LEGACY_MEMBER_TOKEN_KEY)") -lt 0) {
    throw "Mobile session module does not centralize paired member cleanup"
  }
  if ($api.IndexOf("expireMemberAuth") -lt 0 -or $api.IndexOf("localStorage.removeItem(MEMBER_ID_KEY)") -lt 0 -or $api.IndexOf("window.dispatchEvent(new Event(MEMBER_AUTH_EXPIRED_EVENT))") -lt 0) {
    throw "API wrapper does not clear member session on 401"
  }
  if ($mobileMain.IndexOf("useNavigate") -lt 0 -or $mobileMain.IndexOf("MEMBER_AUTH_EXPIRED_EVENT") -lt 0 -or $mobileMain.IndexOf("navigate('/pair', { replace: true })") -lt 0) {
    throw "Mobile shell does not send revoked or expired member sessions back to pairing"
  }
  if ($pairDevice.IndexOf("clearMemberSession()") -lt 0 -or $pairDevice.IndexOf("localStorage.removeItem(LEGACY_MEMBER_TOKEN_KEY)") -ge 0) {
    throw "Pairing flow does not clear stale member session through the shared helper"
  }
  $quickNote = Get-Content "$root\frontend\src\mobile\pages\QuickNote.tsx" -Raw -Encoding UTF8
  if ($quickNote.IndexOf("useMembers") -ge 0 -or $quickNote.IndexOf("MOCK_MEMBERS.map") -ge 0) {
    throw "Mobile quick note should not request admin-only member lists with member auth"
  }
  Write-Host "frontend_member_auth_expiry_wiring_ok"
}

Step "Frontend copy placeholders" {
  $frontendSource = Get-ChildItem "$root\frontend\src" -Recurse -Include *.ts,*.tsx |
    ForEach-Object { Get-Content $_.FullName -Raw -Encoding UTF8 }
  if (($frontendSource | Select-String -Pattern "\?\?\?" -SimpleMatch).Count -gt 0) {
    throw "Frontend source contains placeholder question marks"
  }
  $frontendText = Get-ChildItem "$root\frontend" -Recurse -Include *.ts,*.tsx,*.html,*.md |
    Where-Object { $_.FullName -notmatch "\\node_modules\\|\\dist\\" } |
    ForEach-Object { Get-Content $_.FullName -Raw -Encoding UTF8 }
  if (($frontendText | Select-String -Pattern "Get started|React logo|Vite logo|React \+ TypeScript \+ Vite|开发中").Count -gt 0) {
    throw "Frontend still contains starter template copy"
  }
  Write-Host "frontend_copy_placeholders_ok"
}

Step "Backend compile" {
  & "$root\backend\.venv\Scripts\python.exe" -m compileall "$root\backend\app"
  if ($LASTEXITCODE -ne 0) {
    throw "Backend app compile failed with exit code $LASTEXITCODE"
  }
  & "$root\backend\.venv\Scripts\python.exe" -m compileall "$root\backend\alembic"
  if ($LASTEXITCODE -ne 0) {
    throw "Backend alembic compile failed with exit code $LASTEXITCODE"
  }
}

Step "Backend admin token smoke" {
  $authSmoke = New-TemporaryFile
  @'
import app.auth as auth

token = auth.create_admin_token()
assert auth.is_valid_admin_token(token)
assert not auth.is_valid_admin_token(token + "tampered")

original_time = auth.time
auth.time = lambda: original_time() + auth.ADMIN_TOKEN_TTL_SECONDS + 1
try:
    assert not auth.is_valid_admin_token(token)
finally:
    auth.time = original_time

bad_payload = "admin:not-a-time:nonce"
bad_signature = auth.hmac_new(
    auth.settings.admin_token_secret.encode("utf-8"),
    bad_payload.encode("utf-8"),
    auth.sha256,
).hexdigest()
assert not auth.is_valid_admin_token(f"{bad_payload}:{bad_signature}")

future_issued_at = int(original_time() + 30)
future_payload = f"admin:{future_issued_at}:nonce"
future_signature = auth.hmac_new(
    auth.settings.admin_token_secret.encode("utf-8"),
    future_payload.encode("utf-8"),
    auth.sha256,
).hexdigest()
assert not auth.is_valid_admin_token(f"{future_payload}:{future_signature}")

print("backend_admin_token_smoke_ok")
'@ | Set-Content -LiteralPath $authSmoke -Encoding UTF8
  Push-Location "$root\backend"
  try {
    & "$root\backend\.venv\Scripts\python.exe" $authSmoke
    if ($LASTEXITCODE -ne 0) {
      throw "Backend admin token smoke failed with exit code $LASTEXITCODE"
    }
  } finally {
    Pop-Location
    Remove-Item -LiteralPath $authSmoke -Force -ErrorAction SilentlyContinue
  }
}

Step "Backend database metadata" {
  $metadataCheck = New-TemporaryFile
  @'
from app.models import Base
from app.embeddings import EMBEDDING_DIMENSION

expected = {
    "members",
    "notes",
    "memories",
    "pairing_tokens",
    "member_sessions",
    "system_settings",
    "recommendation_events",
}
assert expected.issubset(Base.metadata.tables.keys())
memory_embedding = Base.metadata.tables["memories"].c.embedding
assert memory_embedding.type.dim == EMBEDDING_DIMENSION
event_table = Base.metadata.tables["recommendation_events"]
assert {"member_id", "domain", "content", "memory_ids", "basis", "created_at"}.issubset(event_table.c.keys())
print("backend_db_metadata_ok")
'@ | Set-Content -LiteralPath $metadataCheck -Encoding UTF8
  Push-Location "$root\backend"
  try {
    & "$root\backend\.venv\Scripts\python.exe" $metadataCheck
    if ($LASTEXITCODE -ne 0) {
      throw "Backend database metadata check failed with exit code $LASTEXITCODE"
    }
  } finally {
    Pop-Location
    Remove-Item -LiteralPath $metadataCheck -Force -ErrorAction SilentlyContinue
  }
}

Step "Backend pairing token cleanup wiring" {
  $dataSource = Get-Content "$root\backend\app\data.py" -Raw -Encoding UTF8
  $storeSource = Get-Content "$root\backend\app\store.py" -Raw -Encoding UTF8
  if ($dataSource.IndexOf("async def cleanup_pairing_tokens") -lt 0 -or $dataSource.IndexOf("delete(models.PairingToken)") -lt 0 -or $dataSource.IndexOf("models.PairingToken.used.is_(True)") -lt 0) {
    throw "Database store does not clean expired or used pairing tokens"
  }
  if ($storeSource.IndexOf("def cleanup_pairing_tokens") -lt 0 -or $storeSource.IndexOf("if record.used or record.expires_at <= now()") -lt 0) {
    throw "In-memory store does not clean expired or used pairing tokens"
  }
  if ($dataSource.IndexOf("await self.cleanup_pairing_tokens()") -lt 0 -or $storeSource.IndexOf("self.cleanup_pairing_tokens()") -lt 0) {
    throw "Pairing token creation does not opportunistically clean stale tokens"
  }
  Write-Host "backend_pairing_token_cleanup_wiring_ok"
}

Step "Backend extraction failure review handoff" {
  $handoffSmoke = New-TemporaryFile
  @'
import asyncio
from types import SimpleNamespace

import app.data as data_module
from app.data import DatabaseDataStore
from app.schemas import NoteSource, SystemSettings


class FakeSession:
    def __init__(self):
        self.note = SimpleNamespace(
            id=7,
            member_id=1,
            content="unparsed quick note",
            source=NoteSource.text,
            status="understanding",
            created_at=None,
        )
        self.commits = 0

    async def get(self, model, item_id):
        return self.note if item_id == self.note.id else None

    async def commit(self):
        self.commits += 1


async def main():
    fake_session = FakeSession()
    store = DatabaseDataStore(fake_session)

    async def fake_get_settings():
        return SystemSettings(extraction_retries=1)

    async def failed_candidate(note_id, member_id, content, settings):
        return None

    original_builder = data_module.build_extracted_candidate
    data_module.build_extracted_candidate = failed_candidate
    store.get_settings = fake_get_settings
    try:
        result = await store.extract_memory_from_note(fake_session.note.id)
    finally:
        data_module.build_extracted_candidate = original_builder

    assert result is None
    assert fake_session.note.status == "understanding"
    assert fake_session.commits == 0
    review_candidate = build_review_candidate_from_text(
        fake_session.note.id,
        fake_session.note.member_id,
        fake_session.note.content,
    )
    assert review_candidate.candidates[0].content == "unparsed quick note"


from app.memory_dedupe import build_review_candidate_from_text

asyncio.run(main())
print("backend_extraction_failure_review_handoff_ok")
'@ | Set-Content -LiteralPath $handoffSmoke -Encoding UTF8
  Push-Location "$root\backend"
  try {
    & "$root\backend\.venv\Scripts\python.exe" $handoffSmoke
    if ($LASTEXITCODE -ne 0) {
      throw "Backend extraction failure handoff smoke failed with exit code $LASTEXITCODE"
    }
  } finally {
    Pop-Location
    Remove-Item -LiteralPath $handoffSmoke -Force -ErrorAction SilentlyContinue
  }
}

Step "Backend embedding provider independence" {
  $embeddingModeSmoke = New-TemporaryFile
  @'
import asyncio

import app.data as data_module
from app.data import DatabaseDataStore
from app.schemas import SystemSettings


async def main():
    store = DatabaseDataStore(session=None)
    calls = []

    async def fake_get_settings():
        return SystemSettings(llm_provider="deepseek", embedding_model="custom-embedding-model")

    async def fake_build_embedding(content, model):
        calls.append((content, model))
        return [1.0, 0.0]

    original_builder = data_module.build_text_embedding_async
    data_module.build_text_embedding_async = fake_build_embedding
    store.get_settings = fake_get_settings
    try:
        vector = await store._build_embedding("family memory")
    finally:
        data_module.build_text_embedding_async = original_builder

    assert vector == [1.0, 0.0]
    assert calls == [("family memory", "custom-embedding-model")]


asyncio.run(main())
print("backend_embedding_provider_independence_ok")
'@ | Set-Content -LiteralPath $embeddingModeSmoke -Encoding UTF8
  Push-Location "$root\backend"
  try {
    & "$root\backend\.venv\Scripts\python.exe" $embeddingModeSmoke
    if ($LASTEXITCODE -ne 0) {
      throw "Backend embedding provider independence smoke failed with exit code $LASTEXITCODE"
    }
  } finally {
    Pop-Location
    Remove-Item -LiteralPath $embeddingModeSmoke -Force -ErrorAction SilentlyContinue
  }
}

Step "Backend weather provider smoke" {
  $weatherSmoke = New-TemporaryFile
  @'
import asyncio

import httpx

from app.weather import get_weather_context
import app.weather as weather_module


class MockAsyncClient(httpx.AsyncClient):
    def __init__(self, *args, **kwargs):
        transport = httpx.MockTransport(self._handler)
        super().__init__(transport=transport, base_url=kwargs.get("base_url", "https://example.test"))

    @staticmethod
    def _handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/geo/v2/city/lookup":
            return httpx.Response(200, json={"location": [{"id": "101280101", "name": "Guangzhou"}]})
        if request.url.path == "/v7/weather/now":
            return httpx.Response(
                200,
                json={"now": {"temp": "24", "text": "Cloudy", "windDir": "East wind", "humidity": "72", "precip": "0"}},
            )
        return httpx.Response(404)


async def main():
    fallback = await get_weather_context("Shanghai", "")
    assert fallback.source == "local-estimate"
    original_client = weather_module.httpx.AsyncClient
    weather_module.httpx.AsyncClient = MockAsyncClient
    try:
        live = await get_weather_context("Guangzhou", "test-key")
    finally:
        weather_module.httpx.AsyncClient = original_client
    assert live.source == "qweather"
    assert live.city == "Guangzhou"
    assert live.temperature_c == 24
    assert live.precipitation_chance == 30


asyncio.run(main())
print("backend_weather_provider_ok")
'@ | Set-Content -LiteralPath $weatherSmoke -Encoding UTF8
  Push-Location "$root\backend"
  try {
    & "$root\backend\.venv\Scripts\python.exe" $weatherSmoke
    if ($LASTEXITCODE -ne 0) {
      throw "Backend weather provider smoke failed with exit code $LASTEXITCODE"
    }
  } finally {
    Pop-Location
    Remove-Item -LiteralPath $weatherSmoke -Force -ErrorAction SilentlyContinue
  }
}

Step "Backend LLM extractor smoke" {
  $llmSmoke = New-TemporaryFile
@'
import asyncio
import json

import httpx

import app.llm_extractor as extractor
from app.llm_extractor import build_extracted_candidate, build_review_candidate
from app.schemas import MemoryDomain, MemoryType, SystemSettings


class MockOllamaClient(httpx.AsyncClient):
    def __init__(self, *args, **kwargs):
        transport = httpx.MockTransport(self._handler)
        super().__init__(transport=transport, base_url=kwargs.get("base_url", "https://ollama.test"))

    @staticmethod
    def _handler(request: httpx.Request) -> httpx.Response:
        payload = json.loads(request.content.decode("utf-8"))
        assert isinstance(payload["format"], dict)
        assert payload["format"]["properties"]["candidates"]["maxItems"] == 5
        return httpx.Response(
            200,
            json={
                "response": (
                    "{\"candidates\":[{\"type\":\"fact\",\"domain\":\"diet\","
                    "\"content\":\"妈妈不吃香菜\",\"confidence\":0.91}]}"
                )
            },
        )


class BadOllamaClient(httpx.AsyncClient):
    def __init__(self, *args, **kwargs):
        transport = httpx.MockTransport(lambda request: httpx.Response(200, json={"response": "not-json"}))
        super().__init__(transport=transport, base_url=kwargs.get("base_url", "https://ollama.test"))


class LooseOllamaClient(httpx.AsyncClient):
    def __init__(self, *args, **kwargs):
        transport = httpx.MockTransport(self._handler)
        super().__init__(transport=transport, base_url=kwargs.get("base_url", "https://ollama.test"))

    @staticmethod
    def _handler(request: httpx.Request) -> httpx.Response:
        payload = json.loads(request.content.decode("utf-8"))
        assert payload["format"]["properties"]["candidates"]["items"]["additionalProperties"] is False
        return httpx.Response(
            200,
            json={
                "response": (
                    "{\"candidates\":[{\"type\":\"fact\",\"domain\":\"diet\","
                    "\"content\":\"妈妈不吃香菜\",\"confidence\":0.91,\"unexpected\":\"drop-me\"}]}"
                )
            },
        )


async def main():
    assert extractor.MEMORY_DRAFT_SCHEMA["additionalProperties"] is False

    original_client = extractor.httpx.AsyncClient
    extractor.httpx.AsyncClient = MockOllamaClient
    try:
        candidate = await build_review_candidate(1, 2, "\u5988\u5988\u4e0d\u5403\u9999\u83dc", SystemSettings(extraction_retries=1))
    finally:
        extractor.httpx.AsyncClient = original_client
    assert candidate.candidates[0].type == MemoryType.fact
    assert candidate.candidates[0].domain == MemoryDomain.diet
    assert candidate.candidates[0].confidence == 0.91

    extractor.httpx.AsyncClient = BadOllamaClient
    try:
        failed_extract = await build_extracted_candidate(1, 2, "\u5988\u5988\u4e0d\u5403\u9999\u83dc", SystemSettings(extraction_retries=1))
        fallback = await build_review_candidate(1, 2, "\u5988\u5988\u4e0d\u5403\u9999\u83dc", SystemSettings(extraction_retries=1))
    finally:
        extractor.httpx.AsyncClient = original_client
    assert failed_extract is None
    assert fallback.candidates[0].content == "\u5988\u5988\u4e0d\u5403\u9999\u83dc"
    assert fallback.candidates[0].domain == MemoryDomain.diet

    extractor.httpx.AsyncClient = LooseOllamaClient
    try:
        loose_extract = await build_extracted_candidate(1, 2, "\u5988\u5988\u4e0d\u5403\u9999\u83dc", SystemSettings(extraction_retries=1))
        loose_fallback = await build_review_candidate(1, 2, "\u5988\u5988\u4e0d\u5403\u9999\u83dc", SystemSettings(extraction_retries=1))
    finally:
        extractor.httpx.AsyncClient = original_client
    assert loose_extract is None
    assert loose_fallback.candidates[0].content == "\u5988\u5988\u4e0d\u5403\u9999\u83dc"


asyncio.run(main())
print("backend_llm_extractor_ok")
'@ | Set-Content -LiteralPath $llmSmoke -Encoding UTF8
  Push-Location "$root\backend"
  try {
    & "$root\backend\.venv\Scripts\python.exe" $llmSmoke
    if ($LASTEXITCODE -ne 0) {
      throw "Backend LLM extractor smoke failed with exit code $LASTEXITCODE"
    }
  } finally {
    Pop-Location
    Remove-Item -LiteralPath $llmSmoke -Force -ErrorAction SilentlyContinue
  }
}

Step "Backend extraction golden cases" {
  $goldenSmoke = New-TemporaryFile
@'
from app.memory_dedupe import build_review_candidate_from_text
from app.schemas import MemoryDomain, MemoryType

cases = [
    ("\u5988\u5988\u4e0d\u5403\u9999\u83dc", MemoryDomain.diet, MemoryType.fact),
    ("\u6735\u6735\u5bf9\u8292\u679c\u8fc7\u654f", MemoryDomain.diet, MemoryType.fact),
    ("\u7238\u7238\u6015\u51b7\uff0c\u65e9\u665a\u8981\u7a7f\u5916\u5957", MemoryDomain.dressing, MemoryType.fact),
    ("\u7238\u7238\u4e0a\u5468\u819d\u76d6\u75bc\uff0c\u907f\u514d\u5267\u70c8\u8dd1\u8df3", MemoryDomain.exercise, MemoryType.episode),
    ("\u4eca\u5929\u5168\u5bb6\u665a\u996d\u540e\u6563\u6b65\u4e09\u5341\u5206\u949f", MemoryDomain.exercise, MemoryType.episode),
]

for index, (content, domain, memory_type) in enumerate(cases, start=1):
    candidate = build_review_candidate_from_text(index, 1, content)
    assert candidate.candidates, content
    draft = candidate.candidates[0]
    assert draft.domain == domain, (content, draft.domain, domain)
    assert draft.type == memory_type, (content, draft.type, memory_type)
    assert draft.confidence >= 0.7

print("backend_extraction_golden_cases_ok")
'@ | Set-Content -LiteralPath $goldenSmoke -Encoding UTF8
  Push-Location "$root\backend"
  try {
    & "$root\backend\.venv\Scripts\python.exe" $goldenSmoke
    if ($LASTEXITCODE -ne 0) {
      throw "Backend extraction golden cases failed with exit code $LASTEXITCODE"
    }
  } finally {
    Pop-Location
    Remove-Item -LiteralPath $goldenSmoke -Force -ErrorAction SilentlyContinue
  }
}

Step "Backend LLM recommender smoke" {
  $recommendSmoke = New-TemporaryFile
  @'
import asyncio

import httpx

import app.llm_recommender as recommender
from app.llm_recommender import stream_recommendation_content
from app.schemas import Recommendation, RecommendationDomain, SystemSettings


class MockStreamResponse:
    def __init__(self, lines):
        self.lines = lines

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    def raise_for_status(self):
        return None

    async def aiter_lines(self):
        for line in self.lines:
            yield line


class MockOllamaClient:
    def __init__(self, *args, **kwargs):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    def stream(self, method, path, json):
        assert method == "POST"
        assert path == "/api/generate"
        assert json["stream"] is True
        return MockStreamResponse([
            "{\"response\":\"LLM \",\"done\":false}",
            "{\"response\":\"advice\",\"done\":false}",
            "{\"done\":true}",
        ])


class BadOllamaClient(MockOllamaClient):
    def stream(self, method, path, json):
        return MockStreamResponse(["not-json"])


async def collect(settings):
    recommendation = Recommendation(
        domain=RecommendationDomain.diet,
        content="\u996e\u98df\u4ee5\u6e05\u6de1\u4e3a\u4e3b",
        basis=["\u4e0d\u5403\u9999\u83dc"],
        basis_refs=[],
    )
    return "".join([chunk async for chunk in stream_recommendation_content(recommendation, settings)])


async def main():
    original_client = recommender.httpx.AsyncClient
    recommender.httpx.AsyncClient = MockOllamaClient
    try:
        streamed = await collect(SystemSettings(llm_provider="ollama"))
    finally:
        recommender.httpx.AsyncClient = original_client
    assert streamed == "LLM advice"

    recommender.httpx.AsyncClient = BadOllamaClient
    try:
        fallback = await collect(SystemSettings(llm_provider="ollama"))
    finally:
        recommender.httpx.AsyncClient = original_client
    assert fallback == "\u996e\u98df\u4ee5\u6e05\u6de1\u4e3a\u4e3b"

    cloud_fallback = await collect(SystemSettings(llm_provider="deepseek", cloud_llm_risk_acknowledged=True))
    assert cloud_fallback == "\u996e\u98df\u4ee5\u6e05\u6de1\u4e3a\u4e3b"


asyncio.run(main())
print("backend_llm_recommender_ok")
'@ | Set-Content -LiteralPath $recommendSmoke -Encoding UTF8
  Push-Location "$root\backend"
  try {
    & "$root\backend\.venv\Scripts\python.exe" $recommendSmoke
    if ($LASTEXITCODE -ne 0) {
      throw "Backend LLM recommender smoke failed with exit code $LASTEXITCODE"
    }
  } finally {
    Pop-Location
    Remove-Item -LiteralPath $recommendSmoke -Force -ErrorAction SilentlyContinue
  }
}

Step "Backend cloud LLM provider smoke" {
  $cloudSmoke = New-TemporaryFile
  @'
import asyncio

import httpx

import app.cloud_llm as cloud
import app.llm_extractor as extractor
import app.llm_recommender as recommender
from app.cloud_llm import provider_base_url, provider_model
from app.llm_extractor import build_review_candidate
from app.llm_recommender import stream_recommendation_content
from app.schemas import Recommendation, RecommendationDomain, SystemSettings


class MockStreamResponse:
    def __init__(self, lines):
        self.lines = lines

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    def raise_for_status(self):
        return None

    async def aiter_lines(self):
        for line in self.lines:
            yield line


class MockCloudClient(httpx.AsyncClient):
    def __init__(self, *args, **kwargs):
        self.base_url_seen = kwargs.get("base_url")
        transport = httpx.MockTransport(self._handler)
        super().__init__(transport=transport, base_url=kwargs.get("base_url", "https://cloud.test"))

    @staticmethod
    def _handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path.endswith("/chat/completions")
        assert request.headers.get("authorization") == "Bearer cloud-key"
        payload = request.read().decode("utf-8")
        assert "deepseek-v4-flash" in payload
        return httpx.Response(
            200,
            json={
                "choices": [
                    {
                        "message": {
                            "content": (
                                "{\"candidates\":[{\"type\":\"fact\",\"domain\":\"diet\","
                                "\"content\":\"\u5988\u5988\u4e0d\u5403\u9999\u83dc\",\"confidence\":0.93}]}"
                            )
                        }
                    }
                ]
            },
        )

    def stream(self, method, path, json, headers):
        assert method == "POST"
        assert path == "/chat/completions"
        assert headers["Authorization"] == "Bearer cloud-key"
        assert json["stream"] is True
        return MockStreamResponse([
            "data: {\"choices\":[{\"delta\":{\"content\":\"\\u4e91\\u7aef\"}}]}",
            "data: {\"choices\":[{\"delta\":{\"content\":\"\\u5efa\\u8bae\"}}]}",
            "data: [DONE]",
        ])


class BadCloudClient(MockCloudClient):
    @staticmethod
    def _handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(503, json={"error": "unavailable"})

    def stream(self, method, path, json, headers):
        return MockStreamResponse(["data: not-json"])


async def main():
    configured = SystemSettings(
        llm_provider="deepseek",
        cloud_llm_risk_acknowledged=True,
        cloud_llm_api_key="cloud-key",
    )
    assert provider_base_url(configured) == "https://api.deepseek.com"
    assert provider_model(configured) == "deepseek-v4-flash"
    qwen = SystemSettings(llm_provider="qwen", cloud_llm_risk_acknowledged=True, cloud_llm_api_key="cloud-key")
    assert provider_base_url(qwen) == "https://dashscope.aliyuncs.com/compatible-mode/v1"
    assert provider_model(qwen) == "qwen-plus"

    original_cloud_client = cloud.httpx.AsyncClient
    original_extractor_client = extractor.httpx.AsyncClient
    original_recommender_client = recommender.httpx.AsyncClient
    cloud.httpx.AsyncClient = MockCloudClient
    try:
        candidate = await build_review_candidate(1, 2, "\u5988\u5988\u4e0d\u5403\u9999\u83dc", configured)
        assert candidate.candidates[0].content == "\u5988\u5988\u4e0d\u5403\u9999\u83dc"
        assert candidate.candidates[0].confidence == 0.93
        recommendation = Recommendation(
            domain=RecommendationDomain.diet,
            content="\u996e\u98df\u4ee5\u6e05\u6de1\u4e3a\u4e3b",
            basis=["\u4e0d\u5403\u9999\u83dc"],
            basis_refs=[],
        )
        streamed = "".join([chunk async for chunk in stream_recommendation_content(recommendation, configured)])
        assert streamed == "\u4e91\u7aef\u5efa\u8bae"
    finally:
        cloud.httpx.AsyncClient = original_cloud_client
        extractor.httpx.AsyncClient = original_extractor_client
        recommender.httpx.AsyncClient = original_recommender_client

    cloud.httpx.AsyncClient = BadCloudClient
    try:
        fallback = await build_review_candidate(1, 2, "\u5988\u5988\u4e0d\u5403\u9999\u83dc", configured)
        assert fallback.candidates[0].content == "\u5988\u5988\u4e0d\u5403\u9999\u83dc"
        recommendation = Recommendation(
            domain=RecommendationDomain.diet,
            content="\u996e\u98df\u4ee5\u6e05\u6de1\u4e3a\u4e3b",
            basis=[],
            basis_refs=[],
        )
        fallback_stream = "".join([chunk async for chunk in stream_recommendation_content(recommendation, configured)])
        assert fallback_stream == "\u996e\u98df\u4ee5\u6e05\u6de1\u4e3a\u4e3b"
    finally:
        cloud.httpx.AsyncClient = original_cloud_client


asyncio.run(main())
print("backend_cloud_llm_provider_ok")
'@ | Set-Content -LiteralPath $cloudSmoke -Encoding UTF8
  Push-Location "$root\backend"
  try {
    & "$root\backend\.venv\Scripts\python.exe" $cloudSmoke
    if ($LASTEXITCODE -ne 0) {
      throw "Backend cloud LLM provider smoke failed with exit code $LASTEXITCODE"
    }
  } finally {
    Pop-Location
    Remove-Item -LiteralPath $cloudSmoke -Force -ErrorAction SilentlyContinue
  }
}

Step "Backend embedding provider smoke" {
  $embeddingSmoke = New-TemporaryFile
  @'
import asyncio

import httpx

import app.embeddings as embeddings
from app.embeddings import (
    DEFAULT_EMBEDDING_MODEL,
    EMBEDDING_DIMENSION,
    build_text_embedding,
    build_text_embedding_async,
    build_ollama_text_embedding,
    check_ollama_embedding_model,
)


class MockOllamaClient(httpx.AsyncClient):
    def __init__(self, *args, **kwargs):
        transport = httpx.MockTransport(self._handler)
        super().__init__(transport=transport, base_url=kwargs.get("base_url", "https://ollama.test"))

    @staticmethod
    def _handler(request: httpx.Request) -> httpx.Response:
        payload = request.read()
        assert request.url.path == "/api/embed"
        assert b"qllama/bge-small-zh-v1.5" in payload
        vector = [0.0] * EMBEDDING_DIMENSION
        vector[0] = 2.0
        return httpx.Response(200, json={"embeddings": [vector]})


class BadOllamaClient(httpx.AsyncClient):
    def __init__(self, *args, **kwargs):
        transport = httpx.MockTransport(lambda request: httpx.Response(503, json={"error": "model missing"}))
        super().__init__(transport=transport, base_url=kwargs.get("base_url", "https://ollama.test"))


async def main():
    assert DEFAULT_EMBEDDING_MODEL == "qllama/bge-small-zh-v1.5"
    original_client = embeddings.httpx.AsyncClient
    embeddings.httpx.AsyncClient = MockOllamaClient
    try:
        vector = await build_ollama_text_embedding("family memory")
        assert len(vector) == EMBEDDING_DIMENSION
        assert vector[0] == 1.0
        assert await check_ollama_embedding_model(DEFAULT_EMBEDDING_MODEL) is True
    finally:
        embeddings.httpx.AsyncClient = original_client

    embeddings.httpx.AsyncClient = BadOllamaClient
    try:
        fallback = await build_text_embedding_async("family memory")
    finally:
        embeddings.httpx.AsyncClient = original_client
    assert fallback == build_text_embedding("family memory")


asyncio.run(main())
print("backend_embedding_provider_ok")
'@ | Set-Content -LiteralPath $embeddingSmoke -Encoding UTF8
  Push-Location "$root\backend"
  try {
    & "$root\backend\.venv\Scripts\python.exe" $embeddingSmoke
    if ($LASTEXITCODE -ne 0) {
      throw "Backend embedding provider smoke failed with exit code $LASTEXITCODE"
    }
  } finally {
    Pop-Location
    Remove-Item -LiteralPath $embeddingSmoke -Force -ErrorAction SilentlyContinue
  }
}

Step "Backend API smoke" {
  $apiSmoke = New-TemporaryFile
  @'
from time import perf_counter

from fastapi.testclient import TestClient

from app.main import app
from app.tokens import decode_member_token
client = TestClient(app)

assert client.get("/health").status_code == 200
assert client.get("/api/members").status_code == 401
assert client.get("/api/weather/today").status_code == 401
assert client.get("/api/settings/provider-status").status_code == 401
admin_login = client.post("/api/admin/login", json={"username": "admin", "password": "family-admin"})
assert admin_login.status_code == 200
admin_headers = {"Authorization": f"Bearer {admin_login.json()['access_token']}"}

members = client.get("/api/members", headers=admin_headers)
assert members.status_code == 200
assert len(members.json()) >= 1

settings = client.get("/api/settings", headers=admin_headers)
assert settings.status_code == 200
assert settings.json()["cloud_llm_api_key"] == ""
assert settings.json()["weather_api_key"] == ""
assert settings.json()["cloud_llm_api_key_configured"] is False
assert settings.json()["weather_api_key_configured"] is False
provider_status = client.get("/api/settings/provider-status", headers=admin_headers)
assert provider_status.status_code == 200
provider_json = provider_status.json()
assert provider_json["database"]["status"] in {"ready", "degraded", "error"}
assert provider_json["llm"]["status"] in {"ready", "degraded", "error"}
assert provider_json["weather"]["status"] in {"ready", "degraded", "error"}
assert provider_json["embedding"]["label"] == settings.json()["embedding_model"]
assert "512" in provider_json["embedding"]["detail"]
assert provider_json["privacy"]["status"] == "ready"
secret_settings = {
    **settings.json(),
    "cloud_llm_api_key": "self-check-cloud-secret",
    "weather_api_key": "self-check-weather-secret",
}
secret_update = client.patch("/api/settings", json=secret_settings, headers=admin_headers)
assert secret_update.status_code == 200
assert secret_update.json()["cloud_llm_api_key"] == ""
assert secret_update.json()["weather_api_key"] == ""
assert secret_update.json()["cloud_llm_api_key_configured"] is True
assert secret_update.json()["weather_api_key_configured"] is True
secret_read = client.get("/api/settings", headers=admin_headers)
assert "self-check-cloud-secret" not in secret_read.text
assert "self-check-weather-secret" not in secret_read.text
non_secret_update = client.patch(
    "/api/settings",
    json={**secret_read.json(), "default_city": "Shanghai"},
    headers=admin_headers,
)
assert non_secret_update.status_code == 200
assert non_secret_update.json()["cloud_llm_api_key_configured"] is True
assert non_secret_update.json()["weather_api_key_configured"] is True
assert "self-check-cloud-secret" not in non_secret_update.text
assert "self-check-weather-secret" not in non_secret_update.text
cloud_settings = {**non_secret_update.json(), "llm_provider": "deepseek", "cloud_llm_risk_acknowledged": False}
assert client.patch("/api/settings", json=cloud_settings, headers=admin_headers).status_code == 400
cloud_settings["cloud_llm_risk_acknowledged"] = True
cloud_settings["cloud_generation_model"] = "deepseek-v4-flash"
cloud_settings["cloud_llm_base_url"] = "https://api.deepseek.com"
cloud_settings["cloud_llm_api_key"] = ""
cloud_settings["weather_api_key"] = ""
updated_settings = client.patch("/api/settings", json=cloud_settings, headers=admin_headers)
assert updated_settings.status_code == 200
assert updated_settings.json()["llm_provider"] == "deepseek"
assert updated_settings.json()["cloud_generation_model"] == "deepseek-v4-flash"
assert updated_settings.json()["cloud_llm_base_url"] == "https://api.deepseek.com"
assert updated_settings.json()["cloud_llm_api_key"] == ""
assert updated_settings.json()["cloud_llm_api_key_configured"] is True
cloud_provider_status = client.get("/api/settings/provider-status", headers=admin_headers)
assert cloud_provider_status.status_code == 200
assert cloud_provider_status.json()["privacy"]["status"] == "degraded"
assert cloud_provider_status.json()["llm"]["status"] in {"ready", "degraded"}
assert client.patch("/api/settings", json={**updated_settings.json(), "llm_provider": "ollama"}, headers=admin_headers).status_code == 200

assert client.post("/api/notes", json={"member_id": 1, "content": "anonymous note", "source": "text"}).status_code == 401
assert client.get("/api/memories?member_id=1").status_code == 401
assert client.get("/api/recommendations?member_id=1").status_code == 401
assert client.post("/api/pairing/members/1").status_code == 401
pairing = client.post("/api/pairing/members/1", headers=admin_headers)
assert pairing.status_code == 201
session = client.post(
    "/api/pairing/exchange",
    json={"pairing_token": pairing.json()["pairing_token"], "device_name": "self-check-phone"},
)
assert session.status_code == 200
member_token = session.json()["access_token"]
assert member_token.count(".") == 2
token_payload = decode_member_token(member_token)
assert token_payload["member_id"] == 1
assert token_payload["device"] == "self-check-phone"
headers = {"Authorization": f"Bearer {member_token}"}

latencies = []
for index in range(5):
    start = perf_counter()
    perf_note = client.post(
        "/api/notes",
        json={
            "member_id": 1,
            "content": f"performance smoke note {index}",
            "source": "text",
        },
        headers=headers,
    )
    latencies.append(perf_counter() - start)
    assert perf_note.status_code == 202
assert max(latencies) < 0.3, f"note submit exceeded 300ms: {latencies}"

note = client.post(
    "/api/notes",
    json={
        "member_id": 1,
        "content": "member 1 knee note",
        "source": "text",
    },
    headers=headers,
)
assert note.status_code == 202
note_id = note.json()["id"]
memories = client.get("/api/memories?member_id=1", headers=headers)
assert memories.status_code == 200
assert any(item["source_note_id"] == note_id for item in memories.json())
auto_memory = next(item for item in memories.json() if item["source_note_id"] == note_id)
assert auto_memory["type"] == "episode"
assert auto_memory["expires_at"] is not None

batch = client.get("/api/recommendations?domains=dressing&domains=diet&domains=exercise&member_id=1", headers=headers)
assert batch.status_code == 200
assert len(batch.json()["recommendations"]) == 3
assert any("member 1 knee note" in basis for item in batch.json()["recommendations"] for basis in item["basis"])
assert any(ref["source_note_id"] == note_id for item in batch.json()["recommendations"] for ref in item["basis_refs"])
contents = {item["domain"]: item["content"] for item in batch.json()["recommendations"]}
assert "\u00b0C" in contents["dressing"]
assert "\u5c11\u7cd6" in contents["diet"]
assert "\u7cd6\u5c3f\u75c5" in contents["diet"]
assert "\u7cd6\u5c3f\u75c5" in contents["diet"]
assert "\u819d\u76d6" in contents["exercise"]
events = client.get("/api/recommendation-events?member_id=1", headers=admin_headers)
assert events.status_code == 200
assert len(events.json()) >= 3
diet_event = next(item for item in events.json() if item["domain"] == "diet")
assert diet_event["memory_ids"]
assert any("member 1 knee note" in item for item in diet_event["basis"])

source_note = client.get(f"/api/notes/{note_id}", headers=headers)
assert source_note.status_code == 200
assert source_note.json()["content"] == "member 1 knee note"

first_token_start = perf_counter()
with client.stream("GET", "/api/recommendations/diet/stream?member_id=1", headers=headers) as stream:
    assert stream.status_code == 200
    first_chunk = ""
    for chunk in stream.iter_text():
        if chunk.strip():
            first_chunk = chunk
            break
    first_token_latency = perf_counter() - first_token_start
    assert "data:" in first_chunk
    assert first_token_latency < 5, f"recommendation first token exceeded 5s: {first_token_latency}"

feedback = client.post(
    "/api/recommendations/feedback",
    json={"domain": "dressing", "member_id": 1, "content": contents["dressing"], "accepted": True},
    headers=headers,
)
assert feedback.status_code == 201
assert "\u91c7\u7eb3" in feedback.json()["content"]
assert "\u00b0C" in feedback.json()["content"]

retrieval_latencies = []
for _ in range(5):
    start = perf_counter()
    memory_response = client.get("/api/memories?member_id=1", headers=headers)
    retrieval_latencies.append(perf_counter() - start)
    assert memory_response.status_code == 200
assert max(retrieval_latencies) < 0.5, f"memory retrieval exceeded 500ms: {retrieval_latencies}"

reject_note = client.post(
    "/api/notes",
    json={"member_id": 1, "content": "manual review reject note", "source": "text"},
    headers=headers,
)
assert reject_note.status_code == 202
reject_note_id = reject_note.json()["id"]
before_reject_memories = client.get("/api/memories?member_id=1", headers=headers).json()
rejected = client.post(f"/api/review/notes/{reject_note_id}/reject", headers=admin_headers)
assert rejected.status_code == 200
assert rejected.json()["status"] == "rejected"
after_reject_memories = client.get("/api/memories?member_id=1", headers=headers).json()
assert len(after_reject_memories) == len(before_reject_memories)

sessions = client.get("/api/pairing/sessions?member_id=1", headers=admin_headers)
assert sessions.status_code == 200
device_session = next(item for item in sessions.json() if item["device_name"] == "self-check-phone")
assert device_session["revoked"] is False

own_notes = client.get("/api/notes?member_id=1", headers=headers)
assert own_notes.status_code == 200
weather = client.get("/api/weather/today", headers=headers)
assert weather.status_code == 200
assert weather.json()["city"]
assert isinstance(weather.json()["temperature_c"], int)

rebuild_embeddings = client.post("/api/settings/rebuild-memory-embeddings", headers=admin_headers)
assert rebuild_embeddings.status_code == 200
assert rebuild_embeddings.json()["rebuilt"] >= 1

other_notes = client.get("/api/notes?member_id=2", headers=headers)
assert other_notes.status_code == 403

own_note = client.post(
    "/api/notes",
    json={"member_id": 1, "content": "own member note", "source": "text"},
    headers=headers,
)
assert own_note.status_code == 202

other_note = client.post(
    "/api/notes",
    json={"member_id": 2, "content": "other member note", "source": "text"},
    headers=headers,
)
assert other_note.status_code == 403

revoked = client.post(f"/api/pairing/sessions/{device_session['token_hash']}/revoke", headers=admin_headers)
assert revoked.status_code == 200
assert revoked.json()["revoked"] is True
assert client.get("/api/notes?member_id=1", headers=headers).status_code == 401

print("backend_api_smoke_ok")
'@ | Set-Content -LiteralPath $apiSmoke -Encoding UTF8
  Push-Location "$root\backend"
  try {
    & "$root\backend\.venv\Scripts\python.exe" $apiSmoke
    if ($LASTEXITCODE -ne 0) {
      throw "Backend API smoke failed with exit code $LASTEXITCODE"
    }
  } finally {
    Pop-Location
    Remove-Item -LiteralPath $apiSmoke -Force -ErrorAction SilentlyContinue
  }
}

Step "Backend store smoke" {
  $smoke = New-TemporaryFile
  @'
from datetime import timedelta

from app.schemas import (
    MemoryDraft,
    Memory,
    MemoryDomain,
    MemoryType,
    MemoryUpdate,
    NoteCreate,
    PairingExchange,
    RecommendationDomain,
    RecommendationFeedback,
    SystemSettings,
)
from app.embeddings import EMBEDDING_DIMENSION, build_text_embedding
from app.memory_dedupe import is_duplicate_memory, is_semantic_duplicate_memory
from app.store import InMemoryStore, now
from app.tokens import decode_member_token

store = InMemoryStore()
assert len(build_text_embedding("stable vector smoke")) == EMBEDDING_DIMENSION
assert all(len(memory.embedding) == EMBEDDING_DIMENSION for memory in store.list_memories())
token = store.create_pairing_token(1, "http://localhost:5173")
assert token is not None
session = store.exchange_pairing_token(PairingExchange(pairing_token=token.pairing_token, device_name="store-smoke-phone"))
assert session is not None
assert session.member_id == 1
assert store.exchange_pairing_token(PairingExchange(pairing_token=token.pairing_token)) is None
assert len(store.pairing_tokens) == 1
assert store.create_pairing_token(1, "http://localhost:5173") is not None
assert len(store.pairing_tokens) == 1
for token_hash, record in list(store.pairing_tokens.items()):
    if record.expires_at > now() and not record.used:
        store.pairing_tokens[token_hash] = record.model_copy(update={"expires_at": now() - timedelta(minutes=1)})
        break
assert store.cleanup_pairing_tokens() == 1
assert session.access_token.count(".") == 2
payload = decode_member_token(session.access_token)
assert payload["member_id"] == 1
assert payload["device"] == "store-smoke-phone"
assert store.validate_member_token(session.access_token + "tampered") is None
sessions = store.list_member_sessions(1)
assert len(sessions) == 1
assert sessions[0].device_name == "store-smoke-phone"
assert store.validate_member_token(session.access_token) is not None
assert store.revoke_member_session(sessions[0].token_hash) is True
assert store.validate_member_token(session.access_token) is None

batch = store.make_recommendations(
    [RecommendationDomain.dressing, RecommendationDomain.diet, RecommendationDomain.exercise],
    1,
)
assert [item.domain for item in batch.recommendations] == [
    RecommendationDomain.dressing,
    RecommendationDomain.diet,
    RecommendationDomain.exercise,
]
contents = {item.domain: item.content for item in batch.recommendations}
assert "\u00b0C" in contents[RecommendationDomain.dressing]
assert "\u5c11\u7cd6" in contents[RecommendationDomain.diet]
assert "\u7cd6\u5c3f\u75c5" in contents[RecommendationDomain.diet]
assert "\u7cd6\u5c3f\u75c5" in contents[RecommendationDomain.diet]
assert "\u819d\u76d6" in contents[RecommendationDomain.exercise]

feedback_memory = store.record_feedback(
    RecommendationFeedback(
        domain=RecommendationDomain.dressing,
        member_id=1,
        content=contents[RecommendationDomain.dressing],
        accepted=True,
    )
)
assert "\u91c7\u7eb3" in feedback_memory.content
assert "\u00b0C" in feedback_memory.content
assert len(feedback_memory.embedding) == EMBEDDING_DIMENSION

settings = store.update_settings(SystemSettings(default_city="Shanghai", extraction_retries=2))
assert settings.default_city == "Shanghai"
assert settings.extraction_retries == 2
weather = store.get_weather()
assert weather.city == "Shanghai"
assert weather.temperature_c == 22
assert store.rebuild_memory_embeddings() == len(store.list_memories())
assert all(len(memory.embedding) == EMBEDDING_DIMENSION for memory in store.list_memories())

store.memories[99] = Memory(
    id=99,
    member_id=1,
    type=MemoryType.episode,
    domain=MemoryDomain.general,
    content="expired",
    confidence=0.5,
    expires_at=now() - timedelta(days=1),
    created_at=now(),
)
assert store.cleanup_expired_memories() == 1
assert 99 not in store.memories

note = store.create_note(NoteCreate(member_id=1, content="likes walking after dinner"))
assert store.extract_memory_from_note(note.id) is not None
created_memory = next(memory for memory in store.list_memories(1) if memory.source_note_id == note.id)
assert created_memory.expires_at is not None
assert len(created_memory.embedding) == EMBEDDING_DIMENSION
updated_created_memory = store.update_memory(created_memory.id, MemoryUpdate(content="updated walking after dinner"))
assert updated_created_memory is not None
assert updated_created_memory.embedding == build_text_embedding("updated walking after dinner")

assert is_duplicate_memory("\u5988\u5988\u4e0d\u7231\u9999\u83dc", "\u5988\u5988\u4e0d\u559c\u6b22\u82ab\u837d", MemoryType.fact, MemoryDomain.diet)
semantic_left = build_text_embedding("semantic dedupe example")
semantic_right = build_text_embedding("semantic dedupe example")
assert is_semantic_duplicate_memory(
    "semantic dedupe example",
    "semantic dedupe example",
    MemoryType.episode,
    MemoryDomain.general,
    semantic_left,
    semantic_right,
    0.99,
)
assert not is_semantic_duplicate_memory(
    "semantic dedupe example",
    "different content",
    MemoryType.episode,
    MemoryDomain.general,
    semantic_left,
    build_text_embedding("different content"),
    0.99,
)
note_a = store.create_note(NoteCreate(member_id=1, content="\u5988\u5988\u4e0d\u7231\u9999\u83dc"))
assert store.extract_memory_from_note(note_a.id) is not None
count_before = len(store.list_memories(1))
note_b = store.create_note(NoteCreate(member_id=1, content="\u5988\u5988\u4e0d\u559c\u6b22\u82ab\u837d"))
assert store.extract_memory_from_note(note_b.id) is None
assert len(store.list_memories(1)) == count_before
assert store.notes[note_b.id].status == "reviewed"
assert not any(memory.source_note_id == note_b.id for memory in store.list_memories(1))
review_memory = store.approve_review_candidate(
    note_a.id,
    MemoryDraft(type=MemoryType.fact, domain=MemoryDomain.diet, content="\u5988\u5988\u4e0d\u5403\u9999\u83dc", confidence=0.95),
)
assert review_memory is not None
assert review_memory.content == "\u5988\u5988\u4e0d\u5403\u9999\u83dc"

store.memories[100] = Memory(
    id=100,
    member_id=1,
    type=MemoryType.episode,
    domain=MemoryDomain.exercise,
    content="expired recommendation basis",
    confidence=0.8,
    expires_at=now() - timedelta(days=1),
    created_at=now(),
)
assert all(memory.content != "expired recommendation basis" for memory in store.list_memories(1))
assert "expired recommendation basis" not in store.make_recommendation(RecommendationDomain.exercise, 1).basis

store.memories[101] = Memory(
    id=101,
    member_id=1,
    type=MemoryType.fact,
    domain=MemoryDomain.exercise,
    content="\u7238\u7238\u819d\u76d6\u53d7\u51c9\u540e\u4e0d\u8212\u670d\uff0c\u8fd0\u52a8\u8981\u907f\u514d\u5267\u70c8\u8dd1\u8df3",
    confidence=0.96,
    embedding=build_text_embedding("\u7238\u7238\u819d\u76d6\u53d7\u51c9\u540e\u4e0d\u8212\u670d\uff0c\u8fd0\u52a8\u8981\u907f\u514d\u5267\u70c8\u8dd1\u8df3"),
    created_at=now(),
)
exercise_recommendation = store.make_recommendation(RecommendationDomain.exercise, 1)
assert len(exercise_recommendation.basis_refs) <= 5
assert exercise_recommendation.basis_refs[0].memory_id == 101
events = store.list_recommendation_events(1)
assert events
assert events[0].domain == RecommendationDomain.exercise
assert 101 in events[0].memory_ids

print("backend_store_smoke_ok")
'@ | Set-Content -LiteralPath $smoke -Encoding UTF8
  Push-Location "$root\backend"
  try {
    & "$root\backend\.venv\Scripts\python.exe" $smoke
    if ($LASTEXITCODE -ne 0) {
      throw "Backend store smoke failed with exit code $LASTEXITCODE"
    }
  } finally {
    Pop-Location
    Remove-Item -LiteralPath $smoke -Force -ErrorAction SilentlyContinue
  }
}

Step "Backend migration smoke" {
  $migration = Get-Content "$root\backend\alembic\versions\0003_add_memory_embeddings.py" -Raw -Encoding UTF8
  if ($migration -notmatch "Vector\(EMBEDDING_DIMENSION\)" -or $migration -notmatch "ivfflat" -or $migration -notmatch "vector_cosine_ops") {
    throw "Memory embedding migration is incomplete"
  }
  $hnswMigration = Get-Content "$root\backend\alembic\versions\0005_use_hnsw_memory_embedding_index.py" -Raw -Encoding UTF8
  if ($hnswMigration -notmatch "down_revision = `"0004`"" -or $hnswMigration -notmatch "postgresql_using=`"hnsw`"" -or $hnswMigration -notmatch "ef_construction") {
    throw "HNSW memory embedding migration is incomplete"
  }
  $eventMigration = Get-Content "$root\backend\alembic\versions\0004_add_recommendation_events.py" -Raw -Encoding UTF8
  if ($eventMigration -notmatch "recommendation_events" -or $eventMigration -notmatch "memory_ids" -or $eventMigration -notmatch "ix_recommendation_events_member_created") {
    throw "Recommendation event migration is incomplete"
  }
  Write-Host "backend_migration_smoke_ok"
}

Step "Backend vector ranking wiring" {
  $dataSource = Get-Content "$root\backend\app\data.py" -Raw -Encoding UTF8
  $mainSource = Get-Content "$root\backend\app\main.py" -Raw -Encoding UTF8
  if ($dataSource.IndexOf("cosine_distance(query_embedding)") -lt 0 -or $dataSource.IndexOf("limit(40)") -lt 0) {
    throw "Database recommendation path does not use pgvector ranking"
  }
  if ($dataSource.IndexOf("candidates = await self._vector_ranked_memories") -lt 0) {
    throw "Database recommendation path still bypasses vector-ranked memories"
  }
  if ($dataSource.IndexOf("return await build_text_embedding_async(content, system_settings.embedding_model)") -lt 0) {
    throw "Database embedding path is not independent from generation provider"
  }
  $embeddingCheckStart = $mainSource.IndexOf("async def _embedding_check")
  $weatherCheckStart = $mainSource.IndexOf("def _weather_check")
  $embeddingCheckSource = $mainSource.Substring($embeddingCheckStart, $weatherCheckStart - $embeddingCheckStart)
  if ($embeddingCheckSource.IndexOf("llm_provider") -ge 0) {
    throw "Provider status does not describe independent embedding provider"
  }
  Write-Host "backend_vector_ranking_wiring_ok"
}

Step "Backend async note extraction wiring" {
  $mainSource = Get-Content "$root\backend\app\main.py" -Raw -Encoding UTF8
  $dataSource = Get-Content "$root\backend\app\data.py" -Raw -Encoding UTF8
  $storeSource = Get-Content "$root\backend\app\store.py" -Raw -Encoding UTF8
  if ($mainSource.IndexOf("BackgroundTasks") -lt 0 -or $mainSource.IndexOf("background_tasks.add_task(extract_note_memory_task") -lt 0) {
    throw "Note creation endpoint does not enqueue background extraction"
  }
  if ($dataSource.IndexOf("await self.extract_memory_from_note(note.id)") -ge 0 -or $storeSource.IndexOf("self.extract_memory_from_note(note.id)") -ge 0) {
    throw "Note creation still performs synchronous extraction"
  }
  Write-Host "backend_async_note_extraction_wiring_ok"
}

Step "Docker compose model bootstrap" {
  $compose = Get-Content "$root\docker-compose.yml" -Raw -Encoding UTF8
  if ($compose.IndexOf("ollama-models:") -lt 0 -or $compose.IndexOf("ollama pull") -lt 0 -or $compose.IndexOf("GENERATION_MODEL") -lt 0) {
    throw "Docker compose does not bootstrap the Ollama generation model"
  }
  if ($compose.IndexOf("EMBEDDING_MODEL") -lt 0 -or $compose.IndexOf("qllama/bge-small-zh-v1.5") -lt 0) {
    throw "Docker compose does not bootstrap the Ollama embedding model"
  }
  if ($compose.IndexOf("condition: service_completed_successfully") -lt 0) {
    throw "Backend does not wait for Ollama model bootstrap"
  }
  Push-Location $root
  try {
    docker compose config | Out-Null
    if ($LASTEXITCODE -ne 0) {
      throw "Docker compose config failed with exit code $LASTEXITCODE"
    }
  } finally {
    Pop-Location
  }
  Write-Host "docker_compose_model_bootstrap_ok"
}

Write-Host ""
Write-Host "Self-check passed." -ForegroundColor Green
