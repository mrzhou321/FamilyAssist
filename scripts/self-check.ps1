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
}
assert expected.issubset(Base.metadata.tables.keys())
memory_embedding = Base.metadata.tables["memories"].c.embedding
assert memory_embedding.type.dim == EMBEDDING_DIMENSION
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

Step "Backend API smoke" {
  $apiSmoke = New-TemporaryFile
  @'
from fastapi.testclient import TestClient

from app.main import app
client = TestClient(app)

assert client.get("/health").status_code == 200
assert client.get("/api/members").status_code == 401
assert client.get("/api/weather/today").status_code == 401
admin_login = client.post("/api/admin/login", json={"username": "admin", "password": "family-admin"})
assert admin_login.status_code == 200
admin_headers = {"Authorization": f"Bearer {admin_login.json()['access_token']}"}

members = client.get("/api/members", headers=admin_headers)
assert members.status_code == 200
assert len(members.json()) >= 1

settings = client.get("/api/settings", headers=admin_headers)
assert settings.status_code == 200
cloud_settings = {**settings.json(), "llm_provider": "deepseek", "cloud_llm_risk_acknowledged": False}
assert client.patch("/api/settings", json=cloud_settings, headers=admin_headers).status_code == 400
cloud_settings["cloud_llm_risk_acknowledged"] = True
updated_settings = client.patch("/api/settings", json=cloud_settings, headers=admin_headers)
assert updated_settings.status_code == 200
assert updated_settings.json()["llm_provider"] == "deepseek"
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
headers = {"Authorization": f"Bearer {session.json()['access_token']}"}

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

store = InMemoryStore()
assert len(build_text_embedding("stable vector smoke")) == EMBEDDING_DIMENSION
assert all(len(memory.embedding) == EMBEDDING_DIMENSION for memory in store.list_memories())
token = store.create_pairing_token(1, "http://localhost:5173")
assert token is not None
session = store.exchange_pairing_token(PairingExchange(pairing_token=token.pairing_token, device_name="store-smoke-phone"))
assert session is not None
assert session.member_id == 1
assert store.exchange_pairing_token(PairingExchange(pairing_token=token.pairing_token)) is None
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
created_memory = next(memory for memory in store.list_memories(1) if memory.source_note_id == note.id)
assert created_memory.expires_at is not None
assert len(created_memory.embedding) == EMBEDDING_DIMENSION
updated_created_memory = store.update_memory(created_memory.id, MemoryUpdate(content="updated walking after dinner"))
assert updated_created_memory is not None
assert updated_created_memory.embedding == build_text_embedding("updated walking after dinner")

assert is_duplicate_memory("\u5988\u5988\u4e0d\u7231\u9999\u83dc", "\u5988\u5988\u4e0d\u559c\u6b22\u82ab\u837d", MemoryType.fact, MemoryDomain.diet)
note_a = store.create_note(NoteCreate(member_id=1, content="\u5988\u5988\u4e0d\u7231\u9999\u83dc"))
count_before = len(store.list_memories(1))
note_b = store.create_note(NoteCreate(member_id=1, content="\u5988\u5988\u4e0d\u559c\u6b22\u82ab\u837d"))
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
  Write-Host "backend_migration_smoke_ok"
}

Write-Host ""
Write-Host "Self-check passed." -ForegroundColor Green
