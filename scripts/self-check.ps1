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
  $quickNoteGatesMockMembers = ($quickNote.IndexOf(": isPaired") -ge 0) -and ($quickNote.IndexOf("MOCK_MEMBERS.map") -ge 0) -and ($quickNote.IndexOf(": []") -ge 0)
  $quickNoteDisablesNotesBeforePairing = $quickNote.IndexOf("useMemberNotes(memberId, isPaired)") -ge 0
  if (-not $quickNoteShowsPairingCopy -or -not $quickNoteGatesMockMembers -or -not $quickNoteDisablesNotesBeforePairing) {
    throw "Quick note does not gate member choices behind pairing"
  }
  if ($quickNote.IndexOf("PhotoCapture") -lt 0 -or $quickNote.IndexOf("buildPhotoNoteText") -lt 0 -or $quickNote.IndexOf("formatPhotoSize") -lt 0) {
    throw "Quick note photo capture metadata is incomplete"
  }
  if ($quickNote.IndexOf("setPhotoCapture(null)") -lt 0 -or $quickNote.IndexOf("photoInputRef.current.value = ''") -lt 0) {
    throw "Quick note does not clear photo capture state after submit or recapture"
  }
  $noteQueue = Get-Content "$root\frontend\src\mobile\offline\noteQueue.ts" -Raw
  if ($noteQueue -notmatch "DB_VERSION = 3" -or $noteQueue -notmatch "cached-memories" -or $noteQueue -notmatch "cached-recommendations" -or $noteQueue -notmatch "cached-weather") {
    throw "Offline IndexedDB migration does not create cached data stores"
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
from app.llm_extractor import build_review_candidate
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


async def main():
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
        fallback = await build_review_candidate(1, 2, "\u5988\u5988\u4e0d\u5403\u9999\u83dc", SystemSettings(extraction_retries=1))
    finally:
        extractor.httpx.AsyncClient = original_client
    assert fallback.candidates[0].content == "\u5988\u5988\u4e0d\u5403\u9999\u83dc"
    assert fallback.candidates[0].domain == MemoryDomain.diet


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
provider_status = client.get("/api/settings/provider-status", headers=admin_headers)
assert provider_status.status_code == 200
provider_json = provider_status.json()
assert provider_json["database"]["status"] in {"ready", "degraded", "error"}
assert provider_json["llm"]["status"] in {"ready", "degraded", "error"}
assert provider_json["weather"]["status"] in {"ready", "degraded", "error"}
assert provider_json["embedding"]["label"] == settings.json()["embedding_model"]
assert "512" in provider_json["embedding"]["detail"]
assert provider_json["privacy"]["status"] == "ready"
cloud_settings = {**settings.json(), "llm_provider": "deepseek", "cloud_llm_risk_acknowledged": False}
assert client.patch("/api/settings", json=cloud_settings, headers=admin_headers).status_code == 400
cloud_settings["cloud_llm_risk_acknowledged"] = True
cloud_settings["cloud_generation_model"] = "deepseek-v4-flash"
cloud_settings["cloud_llm_base_url"] = "https://api.deepseek.com"
updated_settings = client.patch("/api/settings", json=cloud_settings, headers=admin_headers)
assert updated_settings.status_code == 200
assert updated_settings.json()["llm_provider"] == "deepseek"
assert updated_settings.json()["cloud_generation_model"] == "deepseek-v4-flash"
assert updated_settings.json()["cloud_llm_base_url"] == "https://api.deepseek.com"
cloud_provider_status = client.get("/api/settings/provider-status", headers=admin_headers)
assert cloud_provider_status.status_code == 200
assert cloud_provider_status.json()["privacy"]["status"] == "degraded"
assert cloud_provider_status.json()["llm"]["status"] == "degraded"
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

with client.stream("GET", "/api/recommendations/diet/stream?member_id=1", headers=headers) as stream:
    assert stream.status_code == 200
    assert "data:" in "".join(stream.iter_text())

feedback = client.post(
    "/api/recommendations/feedback",
    json={"domain": "dressing", "member_id": 1, "content": contents["dressing"], "accepted": True},
    headers=headers,
)
assert feedback.status_code == 201
assert "\u91c7\u7eb3" in feedback.json()["content"]
assert "\u00b0C" in feedback.json()["content"]

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
from app.memory_dedupe import is_duplicate_memory
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
  if ($dataSource.IndexOf("cosine_distance(query_embedding)") -lt 0 -or $dataSource.IndexOf("limit(40)") -lt 0) {
    throw "Database recommendation path does not use pgvector ranking"
  }
  if ($dataSource.IndexOf("candidates = await self._vector_ranked_memories") -lt 0) {
    throw "Database recommendation path still bypasses vector-ranked memories"
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
