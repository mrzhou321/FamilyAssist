from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from .core.config import settings
from .core.db import engine
from .data import DataStore, get_data_store, seed_database
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


@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.require_database:
        # 启动时确认 pgvector 扩展存在
        async with engine.begin() as conn:
            await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        await seed_database()
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
async def list_members(data: DataStore = Depends(get_data_store)) -> list[Member]:
    return await data.list_members()


@app.post("/api/members", response_model=Member, status_code=201)
async def create_member(payload: MemberCreate, data: DataStore = Depends(get_data_store)) -> Member:
    return await data.create_member(payload)


@app.patch("/api/members/{member_id}", response_model=Member)
async def update_member(
    member_id: int,
    payload: MemberUpdate,
    data: DataStore = Depends(get_data_store),
) -> Member:
    member = await data.update_member(member_id, payload)
    if member is None:
        raise HTTPException(status_code=404, detail="Member not found")
    return member


@app.delete("/api/members/{member_id}", status_code=204)
async def delete_member(member_id: int, data: DataStore = Depends(get_data_store)) -> None:
    if not await data.delete_member(member_id):
        raise HTTPException(status_code=404, detail="Member not found")


@app.post("/api/notes", response_model=Note, status_code=202)
async def create_note(payload: NoteCreate, data: DataStore = Depends(get_data_store)) -> Note:
    return await data.create_note(payload)


@app.get("/api/notes", response_model=list[Note])
async def list_notes(
    member_id: int | None = Query(default=None),
    data: DataStore = Depends(get_data_store),
) -> list[Note]:
    return await data.list_notes(member_id)


@app.get("/api/review/notes/{note_id}", response_model=ReviewCandidate)
async def get_review_candidate(
    note_id: int,
    data: DataStore = Depends(get_data_store),
) -> ReviewCandidate:
    candidate = await data.build_review_candidate(note_id)
    if candidate is None:
      raise HTTPException(status_code=404, detail="Note not found")
    return candidate


@app.post("/api/review/notes/{note_id}/approve", response_model=Memory)
async def approve_review_candidate(
    note_id: int,
    payload: MemoryDraft,
    data: DataStore = Depends(get_data_store),
) -> Memory:
    memory = await data.approve_review_candidate(note_id, payload)
    if memory is None:
        raise HTTPException(status_code=404, detail="Note not found")
    return memory


@app.get("/api/memories", response_model=list[Memory])
async def list_memories(
    member_id: int | None = Query(default=None),
    data: DataStore = Depends(get_data_store),
) -> list[Memory]:
    return await data.list_memories(member_id)


@app.patch("/api/memories/{memory_id}", response_model=Memory)
async def update_memory(
    memory_id: int,
    payload: MemoryUpdate,
    data: DataStore = Depends(get_data_store),
) -> Memory:
    memory = await data.update_memory(memory_id, payload)
    if memory is None:
        raise HTTPException(status_code=404, detail="Memory not found")
    return memory


@app.delete("/api/memories/{memory_id}", status_code=204)
async def delete_memory(memory_id: int, data: DataStore = Depends(get_data_store)) -> None:
    if not await data.delete_memory(memory_id):
        raise HTTPException(status_code=404, detail="Memory not found")


@app.post("/api/recommendations/feedback", response_model=Memory, status_code=201)
async def create_recommendation_feedback(
    payload: RecommendationFeedback,
    data: DataStore = Depends(get_data_store),
) -> Memory:
    return await data.record_feedback(payload)


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
    data: DataStore = Depends(get_data_store),
) -> RecommendationBatch:
    return await data.make_recommendations(domains, member_id)


@app.get("/api/recommendations/{domain}", response_model=Recommendation)
async def get_recommendation(
    domain: RecommendationDomain,
    member_id: int | None = Query(default=None),
    data: DataStore = Depends(get_data_store),
) -> Recommendation:
    return await data.make_recommendation(domain, member_id)


@app.post("/api/pairing/members/{member_id}", response_model=PairingToken, status_code=201)
async def create_pairing_token(
    member_id: int,
    server_url: str = Query(default="http://localhost:5173"),
    data: DataStore = Depends(get_data_store),
) -> PairingToken:
    token = await data.create_pairing_token(member_id, server_url)
    if token is None:
        raise HTTPException(status_code=404, detail="Member not found")
    return token


@app.post("/api/pairing/exchange", response_model=MemberSession)
async def exchange_pairing_token(
    payload: PairingExchange,
    data: DataStore = Depends(get_data_store),
) -> MemberSession:
    session = await data.exchange_pairing_token(payload)
    if session is None:
        raise HTTPException(status_code=400, detail="Pairing token is invalid, used, or expired")
    return session


@app.get("/api/settings", response_model=SystemSettings)
async def get_settings(data: DataStore = Depends(get_data_store)) -> SystemSettings:
    return await data.get_settings()


@app.patch("/api/settings", response_model=SystemSettings)
async def update_settings(
    payload: SystemSettings,
    data: DataStore = Depends(get_data_store),
) -> SystemSettings:
    return await data.update_settings(payload)


@app.post("/api/settings/cleanup-expired-memories", response_model=ExpiredMemoryCleanup)
async def cleanup_expired_memories(data: DataStore = Depends(get_data_store)) -> ExpiredMemoryCleanup:
    return ExpiredMemoryCleanup(removed=await data.cleanup_expired_memories())
