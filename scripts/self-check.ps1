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
  } finally {
    Pop-Location
  }
}

Step "Frontend lint" {
  Push-Location "$root\frontend"
  try {
    npm run lint
  } finally {
    Pop-Location
  }
}

Step "Backend compile" {
  & "$root\backend\.venv\Scripts\python.exe" -m compileall "$root\backend\app"
  & "$root\backend\.venv\Scripts\python.exe" -m compileall "$root\backend\alembic"
}

Step "Backend database metadata" {
  $metadataCheck = New-TemporaryFile
  @'
from app.models import Base

expected = {
    "members",
    "notes",
    "memories",
    "pairing_tokens",
    "member_sessions",
    "system_settings",
}
assert expected.issubset(Base.metadata.tables.keys())
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

members = client.get("/api/members")
assert members.status_code == 200
assert len(members.json()) >= 1

note = client.post(
    "/api/notes",
    json={
        "member_id": 1,
        "content": "爸爸今天膝盖不舒服，晚饭后不散步",
        "source": "text",
    },
)
assert note.status_code == 202

batch = client.get("/api/recommendations?domains=dressing&domains=diet&domains=exercise&member_id=1")
assert batch.status_code == 200
assert len(batch.json()["recommendations"]) == 3

pairing = client.post("/api/pairing/members/1")
assert pairing.status_code == 201
session = client.post(
    "/api/pairing/exchange",
    json={"pairing_token": pairing.json()["pairing_token"]},
)
assert session.status_code == 200

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
    Memory,
    MemoryDomain,
    MemoryType,
    PairingExchange,
    RecommendationDomain,
    SystemSettings,
)
from app.store import InMemoryStore, now

store = InMemoryStore()

token = store.create_pairing_token(1, "http://localhost:5173")
assert token is not None
session = store.exchange_pairing_token(PairingExchange(pairing_token=token.pairing_token))
assert session is not None
assert session.member_id == 1
assert store.exchange_pairing_token(PairingExchange(pairing_token=token.pairing_token)) is None

batch = store.make_recommendations(
    [RecommendationDomain.dressing, RecommendationDomain.diet, RecommendationDomain.exercise],
    1,
)
assert [item.domain for item in batch.recommendations] == [
    RecommendationDomain.dressing,
    RecommendationDomain.diet,
    RecommendationDomain.exercise,
]

settings = store.update_settings(SystemSettings(default_city="Shanghai", extraction_retries=2))
assert settings.default_city == "Shanghai"
assert settings.extraction_retries == 2

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

Write-Host ""
Write-Host "Self-check passed." -ForegroundColor Green
