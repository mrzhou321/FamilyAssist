from contextlib import asynccontextmanager

from collections.abc import AsyncIterator
from urllib.parse import urlparse

import httpx
from fastapi import BackgroundTasks, Depends, FastAPI, HTTPException, Query
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
from .cloud_llm import check_cloud_chat, is_cloud_provider_configured, provider_base_url, provider_model
from .core.config import settings
from .core.db import engine
from .data import DataStore, get_data_store, seed_database
from .embeddings import EMBEDDING_DIMENSION, check_ollama_embedding_model
from .llm_recommender import stream_recommendation_content
from .schemas import (
    AdminLogin,
    AuthToken,
    HealthStatus,
    Member,
    MemberCreate,
    MemberDeviceSession,
    MemberSession,
    MemberUpdate,
    Memory,
    MemoryDraft,
    MemoryUpdate,
    Note,
    NoteCreate,
    PairingToken,
    PairingExchange,
    ProviderCheck,
    ProviderStatus,
    PublicSystemSettings,
    Recommendation,
    RecommendationBatch,
    RecommendationDomain,
    RecommendationEvent,
    RecommendationFeedback,
    ReviewCandidate,
    SystemSettings,
    ExpiredMemoryCleanup,
    MemoryEmbeddingRebuild,
    WeatherContext,
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


def normalize_pairing_server_url(server_url: str) -> str:
    parsed = urlparse(server_url.strip())
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise HTTPException(status_code=422, detail="server_url must be an absolute http(s) URL")
    return f"{parsed.scheme}://{parsed.netloc}".rstrip("/")


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
    background_tasks: BackgroundTasks,
    data: DataStore = Depends(get_data_store),
    context: RequestContext = Depends(get_request_context),
) -> Note:
    assert_member_payload(payload.member_id, context)
    scoped_payload = payload.model_copy(update={"member_id": scoped_member_id(payload.member_id, context)})
    note = await data.create_note(scoped_payload)
    background_tasks.add_task(extract_note_memory_task, note.id)
    return note


async def extract_note_memory_task(note_id: int) -> None:
    async for task_data in get_data_store():
        await task_data.extract_memory_from_note(note_id)
        break


@app.get("/api/notes", response_model=list[Note])
async def list_notes(
    member_id: int | None = Query(default=None),
    data: DataStore = Depends(get_data_store),
    context: RequestContext = Depends(get_request_context),
) -> list[Note]:
    return await data.list_notes(scoped_member_id(member_id, context))


@app.get("/api/notes/{note_id}", response_model=Note)
async def get_note(
    note_id: int,
    data: DataStore = Depends(get_data_store),
    context: RequestContext = Depends(get_request_context),
) -> Note:
    note = await data.get_note(note_id)
    if note is None:
        raise HTTPException(status_code=404, detail="Note not found")
    if context.is_member and note.member_id not in (None, context.member_id):
        raise HTTPException(status_code=403, detail="Member token cannot access another member note")
    return note


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


@app.post("/api/review/notes/{note_id}/reject", response_model=Note)
async def reject_review_candidate(
    note_id: int,
    data: DataStore = Depends(get_data_store),
    _: None = Depends(require_admin),
) -> Note:
    note = await data.reject_review_candidate(note_id)
    if note is None:
        raise HTTPException(status_code=404, detail="Note not found")
    return note


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
    system_settings = await data.get_settings()

    async def events() -> AsyncIterator[str]:
        async for chunk in stream_recommendation_content(recommendation, system_settings):
            yield f"data: {chunk}\n\n"

    return StreamingResponse(events(), media_type="text/event-stream")


@app.get("/api/recommendation-events", response_model=list[RecommendationEvent])
async def list_recommendation_events(
    member_id: int | None = Query(default=None),
    data: DataStore = Depends(get_data_store),
    _: None = Depends(require_admin),
) -> list[RecommendationEvent]:
    return await data.list_recommendation_events(member_id)


@app.get("/api/weather/today", response_model=WeatherContext)
async def get_today_weather(
    data: DataStore = Depends(get_data_store),
    context: RequestContext = Depends(get_request_context),
) -> WeatherContext:
    if not context.is_admin and not context.is_member:
        raise HTTPException(status_code=401, detail="Login required")
    return await data.get_weather()


@app.post("/api/pairing/members/{member_id}", response_model=PairingToken, status_code=201)
async def create_pairing_token(
    member_id: int,
    server_url: str = Query(default="http://localhost:5173"),
    data: DataStore = Depends(get_data_store),
    _: None = Depends(require_admin),
) -> PairingToken:
    token = await data.create_pairing_token(member_id, normalize_pairing_server_url(server_url))
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


@app.get("/api/pairing/sessions", response_model=list[MemberDeviceSession])
async def list_member_sessions(
    member_id: int | None = Query(default=None),
    data: DataStore = Depends(get_data_store),
    _: None = Depends(require_admin),
) -> list[MemberDeviceSession]:
    return await data.list_member_sessions(member_id)


@app.post("/api/pairing/sessions/{token_hash}/revoke", response_model=MemberDeviceSession)
async def revoke_member_session(
    token_hash: str,
    data: DataStore = Depends(get_data_store),
    _: None = Depends(require_admin),
) -> MemberDeviceSession:
    if not await data.revoke_member_session(token_hash):
        raise HTTPException(status_code=404, detail="Member session not found")
    session = next((item for item in await data.list_member_sessions() if item.token_hash == token_hash), None)
    if session is None:
        raise HTTPException(status_code=404, detail="Member session not found")
    return session


@app.get("/api/settings", response_model=PublicSystemSettings)
async def get_settings(
    data: DataStore = Depends(get_data_store),
    _: None = Depends(require_admin),
) -> PublicSystemSettings:
    return _public_settings(await data.get_settings())


@app.patch("/api/settings", response_model=PublicSystemSettings)
async def update_settings(
    payload: SystemSettings,
    data: DataStore = Depends(get_data_store),
    _: None = Depends(require_admin),
) -> PublicSystemSettings:
    current_settings = await data.get_settings()
    merged_settings = _merge_secret_settings(current_settings, payload)
    if merged_settings.llm_provider != "ollama" and not merged_settings.cloud_llm_risk_acknowledged:
        raise HTTPException(status_code=400, detail="Cloud LLM risk acknowledgement is required")
    return _public_settings(await data.update_settings(merged_settings))


@app.get("/api/settings/provider-status", response_model=ProviderStatus)
async def get_provider_status(
    data: DataStore = Depends(get_data_store),
    _: None = Depends(require_admin),
) -> ProviderStatus:
    current_settings = await data.get_settings()
    weather = await data.get_weather()
    return ProviderStatus(
        database=await _database_check(),
        llm=await _llm_check(current_settings),
        weather=_weather_check(current_settings, weather),
        embedding=await _embedding_check(current_settings),
        privacy=_privacy_check(current_settings),
    )


async def _database_check() -> ProviderCheck:
    if not settings.require_database:
        return ProviderCheck(status="ready", label="内存数据源", detail="开发模式使用内存存储，API 自测可用")
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
    except Exception as exc:
        return ProviderCheck(status="error", label="PostgreSQL", detail=f"数据库不可达：{exc.__class__.__name__}")
    return ProviderCheck(status="ready", label="PostgreSQL + pgvector", detail="数据库连接正常")


async def _llm_check(current_settings: SystemSettings) -> ProviderCheck:
    if current_settings.llm_provider != "ollama":
        if not current_settings.cloud_llm_risk_acknowledged:
            return ProviderCheck(
                status="error",
                label=current_settings.llm_provider,
                detail="云端 LLM 风险尚未确认",
            )
        label = f"{current_settings.llm_provider} / {provider_model(current_settings) or '未配置模型'}"
        if not is_cloud_provider_configured(current_settings):
            return ProviderCheck(
                status="degraded",
                label=label,
                detail="云端 Provider 已选择，但 API Key、base URL 或模型尚未完整配置；抽取和推荐会本地降级",
            )
        try:
            await check_cloud_chat(current_settings)
        except (httpx.HTTPError, KeyError, TypeError, ValueError) as exc:
            return ProviderCheck(
                status="degraded",
                label=label,
                detail=f"云端 LLM 暂不可达，抽取和推荐会本地降级：{exc.__class__.__name__}",
            )
        return ProviderCheck(
            status="ready",
            label=label,
            detail=f"OpenAI-compatible Chat Completions 已可用：{provider_base_url(current_settings)}",
        )
    try:
        async with httpx.AsyncClient(base_url=settings.ollama_base_url, timeout=2.0) as client:
            response = await client.get("/api/tags")
            response.raise_for_status()
            model_names = [item.get("name", "") for item in response.json().get("models", [])]
    except (httpx.HTTPError, KeyError, TypeError, ValueError) as exc:
        return ProviderCheck(
            status="degraded",
            label=f"Ollama / {current_settings.generation_model}",
            detail=f"Ollama 暂不可达，抽取会回退到本地规则：{exc.__class__.__name__}",
        )

    has_model = any(name == current_settings.generation_model for name in model_names)
    if has_model:
        return ProviderCheck(status="ready", label="Ollama", detail=f"已检测到 {current_settings.generation_model}")
    return ProviderCheck(
        status="degraded",
        label="Ollama",
        detail=f"Ollama 可达，但未列出 {current_settings.generation_model}；需要先拉取模型",
    )


async def _embedding_check(current_settings: SystemSettings) -> ProviderCheck:
    try:
        await check_ollama_embedding_model(current_settings.embedding_model)
    except (httpx.HTTPError, KeyError, TypeError, ValueError) as exc:
        return ProviderCheck(
            status="degraded",
            label=current_settings.embedding_model,
            detail=(
                f"Ollama embedding 暂不可用，记忆入库会回退到本地 {EMBEDDING_DIMENSION} 维向量："
                f"{exc.__class__.__name__}"
            ),
        )
    return ProviderCheck(
        status="ready",
        label=current_settings.embedding_model,
        detail=f"Ollama embedding 已可用，独立于生成 Provider，当前向量维度 {EMBEDDING_DIMENSION}",
    )


def _weather_check(current_settings: SystemSettings, weather: WeatherContext) -> ProviderCheck:
    if weather.source == "qweather":
        return ProviderCheck(status="ready", label="和风天气", detail=f"{weather.city} 实时天气已接入")
    detail = f"{weather.city} 使用本地估算"
    if current_settings.weather_api_key:
        detail += "，和风天气请求失败时已自动降级"
    return ProviderCheck(status="degraded", label="本地天气估算", detail=detail)


def _privacy_check(current_settings: SystemSettings) -> ProviderCheck:
    if current_settings.llm_provider == "ollama":
        return ProviderCheck(status="ready", label="本地优先", detail="速记与生成上下文默认不发送给云端 LLM")
    if current_settings.cloud_llm_risk_acknowledged:
        return ProviderCheck(status="degraded", label="云端 LLM 已启用", detail="管理员已确认第三方 API 数据出境风险")
    return ProviderCheck(status="error", label="云端 LLM 风险", detail="需要确认风险后才能保存云端 Provider")


def _public_settings(current_settings: SystemSettings) -> PublicSystemSettings:
    return PublicSystemSettings(
        **current_settings.model_dump(exclude={"cloud_llm_api_key", "weather_api_key"}),
        cloud_llm_api_key_configured=bool(current_settings.cloud_llm_api_key.strip()),
        weather_api_key_configured=bool(current_settings.weather_api_key.strip()),
    )


def _merge_secret_settings(current_settings: SystemSettings, payload: SystemSettings) -> SystemSettings:
    update = payload.model_dump()
    if not payload.cloud_llm_api_key.strip():
        update["cloud_llm_api_key"] = current_settings.cloud_llm_api_key
    if not payload.weather_api_key.strip():
        update["weather_api_key"] = current_settings.weather_api_key
    return SystemSettings.model_validate(update)


@app.post("/api/settings/cleanup-expired-memories", response_model=ExpiredMemoryCleanup)
async def cleanup_expired_memories(
    data: DataStore = Depends(get_data_store),
    _: None = Depends(require_admin),
) -> ExpiredMemoryCleanup:
    return ExpiredMemoryCleanup(removed=await data.cleanup_expired_memories())


@app.post("/api/settings/rebuild-memory-embeddings", response_model=MemoryEmbeddingRebuild)
async def rebuild_memory_embeddings(
    data: DataStore = Depends(get_data_store),
    _: None = Depends(require_admin),
) -> MemoryEmbeddingRebuild:
    return MemoryEmbeddingRebuild(rebuilt=await data.rebuild_memory_embeddings())
