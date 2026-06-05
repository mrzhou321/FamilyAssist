from contextlib import asynccontextmanager

from collections.abc import AsyncIterator

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy import text

from .auth import (
    RequestContext,
    assert_member_payload,
    create_admin_token,
    get_request_context,
    require_admin,
    scoped_member_id,
    verify_admin_credentials,
)
from .core.config import settings
from .core.db import engine
from .data import DataStore, get_data_store, seed_database
from .schemas import (
    AdminLogin,
    AuthToken,
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


@app.post("/api/admin/login", response_model=AuthToken)
async def admin_login(payload: AdminLogin) -> AuthToken:
    if not verify_admin_credentials(payload.username, payload.password):
        raise HTTPException(status_code=401, detail="Invalid admin credentials")
    return AuthToken(access_token=create_admin_token())


@app.get("/api/members", response_model=list[Member])
async def list_members(
    data: DataStore = Depends(get_data_store),
    _: None = Depends(require_admin),
) -> list[Member]:
    return await data.list_members()


@app.post("/api/members", response_model=Member, status_code=201)
async def create_member(
    payload: MemberCreate,
    data: DataStore = Depends(get_data_store),
    _: None = Depends(require_admin),
) -> Member:
    return await data.create_member(payload)


@app.patch("/api/members/{member_id}", response_model=Member)
async def update_member(
    member_id: int,
    payload: MemberUpdate,
    data: DataStore = Depends(get_data_store),
    _: None = Depends(require_admin),
) -> Member:
    member = await data.update_member(member_id, payload)
    if member is None:
        raise HTTPException(status_code=404, detail="Member not found")
    return member


@app.delete("/api/members/{member_id}", status_code=204)
async def delete_member(
    member_id: int,
    data: DataStore = Depends(get_data_store),
    _: None = Depends(require_admin),
) -> None:
    if not await data.delete_member(member_id):
        raise HTTPException(status_code=404, detail="Member not found")


@app.post("/api/notes", response_model=Note, status_code=202)
async def create_note(
    payload: NoteCreate,
    data: DataStore = Depends(get_data_store),
    context: RequestContext = Depends(get_request_context),
) -> Note:
    assert_member_payload(payload.member_id, context)
    scoped_payload = payload.model_copy(update={"member_id": scoped_member_id(payload.member_id, context)})
    return await data.create_note(scoped_payload)


@app.get("/api/notes", response_model=list[Note])
async def list_notes(
    member_id: int | None = Query(default=None),
    data: DataStore = Depends(get_data_store),
    context: RequestContext = Depends(get_request_context),
) -> list[Note]:
    return await data.list_notes(scoped_member_id(member_id, context))


@app.get("/api/review/notes/{note_id}", response_model=ReviewCandidate)
async def get_review_candidate(
    note_id: int,
    data: DataStore = Depends(get_data_store),
    _: None = Depends(require_admin),
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
    _: None = Depends(require_admin),
) -> Memory:
    memory = await data.approve_review_candidate(note_id, payload)
    if memory is None:
        raise HTTPException(status_code=404, detail="Note not found")
    return memory


@app.get("/api/memories", response_model=list[Memory])
async def list_memories(
    member_id: int | None = Query(default=None),
    data: DataStore = Depends(get_data_store),
    context: RequestContext = Depends(get_request_context),
) -> list[Memory]:
    return await data.list_memories(scoped_member_id(member_id, context))


@app.patch("/api/memories/{memory_id}", response_model=Memory)
async def update_memory(
    memory_id: int,
    payload: MemoryUpdate,
    data: DataStore = Depends(get_data_store),
    _: None = Depends(require_admin),
) -> Memory:
    memory = await data.update_memory(memory_id, payload)
    if memory is None:
        raise HTTPException(status_code=404, detail="Memory not found")
    return memory


@app.delete("/api/memories/{memory_id}", status_code=204)
async def delete_memory(
    memory_id: int,
    data: DataStore = Depends(get_data_store),
    _: None = Depends(require_admin),
) -> None:
    if not await data.delete_memory(memory_id):
        raise HTTPException(status_code=404, detail="Memory not found")


@app.post("/api/recommendations/feedback", response_model=Memory, status_code=201)
async def create_recommendation_feedback(
    payload: RecommendationFeedback,
    data: DataStore = Depends(get_data_store),
    context: RequestContext = Depends(get_request_context),
) -> Memory:
    assert_member_payload(payload.member_id, context)
    scoped_payload = payload.model_copy(update={"member_id": scoped_member_id(payload.member_id, context)})
    return await data.record_feedback(scoped_payload)


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
    context: RequestContext = Depends(get_request_context),
) -> RecommendationBatch:
    return await data.make_recommendations(domains, scoped_member_id(member_id, context))


@app.get("/api/recommendations/{domain}", response_model=Recommendation)
async def get_recommendation(
    domain: RecommendationDomain,
    member_id: int | None = Query(default=None),
    data: DataStore = Depends(get_data_store),
    context: RequestContext = Depends(get_request_context),
) -> Recommendation:
    return await data.make_recommendation(domain, scoped_member_id(member_id, context))


@app.get("/api/recommendations/{domain}/stream")
async def stream_recommendation(
    domain: RecommendationDomain,
    member_id: int | None = Query(default=None),
    data: DataStore = Depends(get_data_store),
    context: RequestContext = Depends(get_request_context),
) -> StreamingResponse:
    recommendation = await data.make_recommendation(domain, scoped_member_id(member_id, context))

    async def events() -> AsyncIterator[str]:
        for chunk in _chunk_text(recommendation.content):
            yield f"data: {chunk}\n\n"

    return StreamingResponse(events(), media_type="text/event-stream")


def _chunk_text(text: str, size: int = 4) -> list[str]:
    return [text[index : index + size] for index in range(0, len(text), size)]


@app.post("/api/pairing/members/{member_id}", response_model=PairingToken, status_code=201)
async def create_pairing_token(
    member_id: int,
    server_url: str = Query(default="http://localhost:5173"),
    data: DataStore = Depends(get_data_store),
    _: None = Depends(require_admin),
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
async def get_settings(
    data: DataStore = Depends(get_data_store),
    _: None = Depends(require_admin),
) -> SystemSettings:
    return await data.get_settings()


@app.patch("/api/settings", response_model=SystemSettings)
async def update_settings(
    payload: SystemSettings,
    data: DataStore = Depends(get_data_store),
    _: None = Depends(require_admin),
) -> SystemSettings:
    return await data.update_settings(payload)


@app.post("/api/settings/cleanup-expired-memories", response_model=ExpiredMemoryCleanup)
async def cleanup_expired_memories(
    data: DataStore = Depends(get_data_store),
    _: None = Depends(require_admin),
) -> ExpiredMemoryCleanup:
    return ExpiredMemoryCleanup(removed=await data.cleanup_expired_memories())
