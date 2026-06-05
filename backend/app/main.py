from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from .core.config import settings
from .core.db import engine
from .schemas import (
    HealthStatus,
    Member,
    MemberCreate,
    MemberSession,
    MemberUpdate,
    Memory,
    MemoryDraft,
    MemoryUpdate,
    Note,
    NoteCreate,
    PairingToken,
    PairingExchange,
    Recommendation,
    RecommendationBatch,
    RecommendationDomain,
    RecommendationFeedback,
    ReviewCandidate,
    SystemSettings,
    ExpiredMemoryCleanup,
)
from .store import store


@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.require_database:
        # 启动时确认 pgvector 扩展存在
        async with engine.begin() as conn:
            await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
    yield
    if settings.require_database:
        await engine.dispose()


app = FastAPI(title="FamilyAssister API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if settings.debug else ["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", response_model=HealthStatus)
async def health() -> HealthStatus:
    if settings.require_database:
        # 顺带检查数据库连通性
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
    return HealthStatus()


@app.get("/api/members", response_model=list[Member])
async def list_members() -> list[Member]:
    return store.list_members()


@app.post("/api/members", response_model=Member, status_code=201)
async def create_member(payload: MemberCreate) -> Member:
    return store.create_member(payload)


@app.patch("/api/members/{member_id}", response_model=Member)
async def update_member(member_id: int, payload: MemberUpdate) -> Member:
    member = store.update_member(member_id, payload)
    if member is None:
        raise HTTPException(status_code=404, detail="Member not found")
    return member


@app.delete("/api/members/{member_id}", status_code=204)
async def delete_member(member_id: int) -> None:
    if not store.delete_member(member_id):
        raise HTTPException(status_code=404, detail="Member not found")


@app.post("/api/notes", response_model=Note, status_code=202)
async def create_note(payload: NoteCreate) -> Note:
    return store.create_note(payload)


@app.get("/api/notes", response_model=list[Note])
async def list_notes(member_id: int | None = Query(default=None)) -> list[Note]:
    return store.list_notes(member_id)


@app.get("/api/review/notes/{note_id}", response_model=ReviewCandidate)
async def get_review_candidate(note_id: int) -> ReviewCandidate:
    candidate = store.build_review_candidate(note_id)
    if candidate is None:
      raise HTTPException(status_code=404, detail="Note not found")
    return candidate


@app.post("/api/review/notes/{note_id}/approve", response_model=Memory)
async def approve_review_candidate(note_id: int, payload: MemoryDraft) -> Memory:
    memory = store.approve_review_candidate(note_id, payload)
    if memory is None:
        raise HTTPException(status_code=404, detail="Note not found")
    return memory


@app.get("/api/memories", response_model=list[Memory])
async def list_memories(member_id: int | None = Query(default=None)) -> list[Memory]:
    return store.list_memories(member_id)


@app.patch("/api/memories/{memory_id}", response_model=Memory)
async def update_memory(memory_id: int, payload: MemoryUpdate) -> Memory:
    memory = store.update_memory(memory_id, payload)
    if memory is None:
        raise HTTPException(status_code=404, detail="Memory not found")
    return memory


@app.delete("/api/memories/{memory_id}", status_code=204)
async def delete_memory(memory_id: int) -> None:
    if not store.delete_memory(memory_id):
        raise HTTPException(status_code=404, detail="Memory not found")


@app.post("/api/recommendations/feedback", response_model=Memory, status_code=201)
async def create_recommendation_feedback(payload: RecommendationFeedback) -> Memory:
    return store.record_feedback(payload)


@app.get("/api/recommendations", response_model=RecommendationBatch)
async def list_recommendations(
    domains: list[RecommendationDomain] = Query(
        default=[
            RecommendationDomain.dressing,
            RecommendationDomain.diet,
            RecommendationDomain.exercise,
        ],
    ),
    member_id: int | None = Query(default=None),
) -> RecommendationBatch:
    return store.make_recommendations(domains, member_id)


@app.get("/api/recommendations/{domain}", response_model=Recommendation)
async def get_recommendation(
    domain: RecommendationDomain,
    member_id: int | None = Query(default=None),
) -> Recommendation:
    return store.make_recommendation(domain, member_id)


@app.post("/api/pairing/members/{member_id}", response_model=PairingToken, status_code=201)
async def create_pairing_token(
    member_id: int,
    server_url: str = Query(default="http://localhost:5173"),
) -> PairingToken:
    token = store.create_pairing_token(member_id, server_url)
    if token is None:
        raise HTTPException(status_code=404, detail="Member not found")
    return token


@app.post("/api/pairing/exchange", response_model=MemberSession)
async def exchange_pairing_token(payload: PairingExchange) -> MemberSession:
    session = store.exchange_pairing_token(payload)
    if session is None:
        raise HTTPException(status_code=400, detail="Pairing token is invalid, used, or expired")
    return session


@app.get("/api/settings", response_model=SystemSettings)
async def get_settings() -> SystemSettings:
    return store.get_settings()


@app.patch("/api/settings", response_model=SystemSettings)
async def update_settings(payload: SystemSettings) -> SystemSettings:
    return store.update_settings(payload)


@app.post("/api/settings/cleanup-expired-memories", response_model=ExpiredMemoryCleanup)
async def cleanup_expired_memories() -> ExpiredMemoryCleanup:
    return ExpiredMemoryCleanup(removed=store.cleanup_expired_memories())
