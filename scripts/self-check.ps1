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

assert client.get("/api/members").status_code == 401
admin_login = client.post("/api/admin/login", json={"username": "admin", "password": "family-admin"})
assert admin_login.status_code == 200
admin_headers = {"Authorization": f"Bearer {admin_login.json()['access_token']}"}

members = client.get("/api/members", headers=admin_headers)
assert members.status_code == 200
assert len(members.json()) >= 1

note = client.post(
    "/api/notes",
    json={
        "member_id": 1,
        "content": "member 1 knee note",
        "source": "text",
    },
)
assert note.status_code == 202
note_id = note.json()["id"]
memories = client.get("/api/memories?member_id=1")
assert memories.status_code == 200
assert any(item["source_note_id"] == note_id for item in memories.json())
auto_memory = next(item for item in memories.json() if item["source_note_id"] == note_id)
assert auto_memory["type"] == "episode"
assert auto_memory["expires_at"] is not None

batch = client.get("/api/recommendations?domains=dressing&domains=diet&domains=exercise&member_id=1")
assert batch.status_code == 200
assert len(batch.json()["recommendations"]) == 3
assert any("member 1 knee note" in basis for item in batch.json()["recommendations"] for basis in item["basis"])
assert any(ref["source_note_id"] == note_id for item in batch.json()["recommendations"] for ref in item["basis_refs"])

source_note = client.get(f"/api/notes/{note_id}")
assert source_note.status_code == 200
assert source_note.json()["content"] == "member 1 knee note"

with client.stream("GET", "/api/recommendations/diet/stream?member_id=1") as stream:
    assert stream.status_code == 200
    assert "data:" in "".join(stream.iter_text())

assert client.post("/api/pairing/members/1").status_code == 401
pairing = client.post("/api/pairing/members/1", headers=admin_headers)
assert pairing.status_code == 201
session = client.post(
    "/api/pairing/exchange",
    json={"pairing_token": pairing.json()["pairing_token"]},
)
assert session.status_code == 200
headers = {"Authorization": f"Bearer {session.json()['access_token']}"}

own_notes = client.get("/api/notes?member_id=1", headers=headers)
assert own_notes.status_code == 200

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
    NoteCreate,
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

note = store.create_note(NoteCreate(member_id=1, content="likes walking after dinner"))
created_memory = next(memory for memory in store.list_memories(1) if memory.source_note_id == note.id)
assert created_memory.expires_at is not None

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
