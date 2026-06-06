from datetime import datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field, field_validator


def _strip_non_blank(value: str) -> str:
    stripped = value.strip()
    if not stripped:
        raise ValueError("must not be blank")
    return stripped


def _strip_optional_non_blank(value: str | None) -> str | None:
    if value is None:
        return None
    return _strip_non_blank(value)


class HealthStatus(BaseModel):
    status: str = "ok"
    service: str = "family-assister-backend"
    version: str = "0.1.0"


class AdminLogin(BaseModel):
    username: str
    password: str


class AuthToken(BaseModel):
    access_token: str
    token_type: str = "bearer"


class MemberProfile(BaseModel):
    height: float | None = None
    weight: float | None = None
    allergies: list[str] = Field(default_factory=list)
    diet_restrictions: list[str] = Field(default_factory=list)
    chronic_conditions: list[str] = Field(default_factory=list)
    injury_history: str = ""
    thermal_sensitivity: int = Field(default=0, ge=-2, le=2)
    taste_preference: str = ""
    exercise_preference: str = ""


class MemberBase(BaseModel):
    name: str = Field(min_length=1)
    birthday: str | None = None
    relation: str = Field(min_length=1)
    profile: MemberProfile = Field(default_factory=MemberProfile)

    _strip_required_text = field_validator("name", "relation")(_strip_non_blank)


class MemberCreate(MemberBase):
    pass


class MemberUpdate(BaseModel):
    name: str | None = None
    birthday: str | None = None
    relation: str | None = None
    profile: MemberProfile | None = None

    _strip_optional_text = field_validator("name", "relation")(_strip_optional_non_blank)


class Member(MemberBase):
    id: int
    bound: bool = False
    created_at: datetime
    updated_at: datetime


class NoteSource(str, Enum):
    text = "text"
    voice = "voice"
    photo = "photo"


class NoteCreate(BaseModel):
    member_id: int | None = None
    content: str = Field(min_length=1)
    source: NoteSource = NoteSource.text

    _strip_content = field_validator("content")(_strip_non_blank)


class Note(BaseModel):
    id: int
    member_id: int | None = None
    content: str
    source: NoteSource
    status: str = "understanding"
    created_at: datetime


class MemoryType(str, Enum):
    fact = "fact"
    episode = "episode"


class MemoryDomain(str, Enum):
    dressing = "dressing"
    diet = "diet"
    exercise = "exercise"
    general = "general"


class MemoryDraft(BaseModel):
    model_config = ConfigDict(extra="forbid")

    type: MemoryType
    domain: MemoryDomain
    content: str
    confidence: float = Field(ge=0, le=1)

    _strip_content = field_validator("content")(_strip_non_blank)


class ReviewCandidate(BaseModel):
    note_id: int
    member_id: int | None = None
    original: str
    candidates: list[MemoryDraft]


class Memory(BaseModel):
    id: int
    member_id: int | None = None
    type: MemoryType
    domain: MemoryDomain
    content: str
    confidence: float = Field(ge=0, le=1)
    embedding: list[float] = Field(default_factory=list)
    source_note_id: int | None = None
    expires_at: datetime | None = None
    created_at: datetime


class MemoryUpdate(BaseModel):
    member_id: int | None = None
    type: MemoryType | None = None
    domain: MemoryDomain | None = None
    content: str | None = None
    confidence: float | None = Field(default=None, ge=0, le=1)
    expires_at: datetime | None = None

    _strip_content = field_validator("content")(_strip_optional_non_blank)


class RecommendationDomain(str, Enum):
    dressing = "dressing"
    diet = "diet"
    exercise = "exercise"


class RecommendationBasisRef(BaseModel):
    memory_id: int
    source_note_id: int | None = None
    content: str


class Recommendation(BaseModel):
    domain: RecommendationDomain
    content: str
    basis: list[str] = Field(default_factory=list)
    basis_refs: list[RecommendationBasisRef] = Field(default_factory=list)


class RecommendationBatch(BaseModel):
    recommendations: list[Recommendation]


class RecommendationEvent(BaseModel):
    id: int
    member_id: int | None = None
    domain: RecommendationDomain
    content: str
    memory_ids: list[int] = Field(default_factory=list)
    basis: list[str] = Field(default_factory=list)
    created_at: datetime


class WeatherContext(BaseModel):
    city: str
    temperature_c: int
    condition: str
    wind: str
    precipitation_chance: int = Field(ge=0, le=100)
    source: str = "local-estimate"


class RecommendationFeedback(BaseModel):
    domain: RecommendationDomain
    member_id: int | None = None
    content: str
    accepted: bool

    _strip_content = field_validator("content")(_strip_non_blank)


class PairingToken(BaseModel):
    member_id: int
    server_url: str
    pairing_token: str
    pairing_url: str
    expires_at: datetime


class PairingTokenRecord(BaseModel):
    member_id: int
    token_hash: str
    expires_at: datetime
    used: bool = False


class PairingExchange(BaseModel):
    pairing_token: str
    device_name: str = Field(default="mobile-browser", min_length=1, max_length=160)

    _strip_required_text = field_validator("pairing_token", "device_name")(_strip_non_blank)


class MemberSession(BaseModel):
    member_id: int
    member_name: str
    access_token: str
    token_type: str = "bearer"


class MemberDeviceSession(BaseModel):
    token_hash: str
    member_id: int
    member_name: str
    device_name: str
    revoked: bool = False
    created_at: datetime


class SystemSettings(BaseModel):
    llm_provider: str = "ollama"
    generation_model: str = "qwen2.5:3b"
    embedding_model: str = "qllama/bge-small-zh-v1.5"
    cloud_generation_model: str = ""
    cloud_llm_base_url: str = ""
    cloud_llm_api_key: str = ""
    weather_api_key: str = ""
    default_city: str = "广州"
    extraction_retries: int = Field(default=3, ge=0, le=10)
    dedupe_threshold: float = Field(default=0.86, ge=0, le=1)
    cloud_llm_risk_acknowledged: bool = False


class PublicSystemSettings(SystemSettings):
    cloud_llm_api_key: str = ""
    weather_api_key: str = ""
    cloud_llm_api_key_configured: bool = False
    weather_api_key_configured: bool = False


class ExpiredMemoryCleanup(BaseModel):
    removed: int


class MemoryEmbeddingRebuild(BaseModel):
    rebuilt: int


class ProviderCheck(BaseModel):
    status: str
    label: str
    detail: str


class ProviderStatus(BaseModel):
    database: ProviderCheck
    llm: ProviderCheck
    weather: ProviderCheck
    embedding: ProviderCheck
    privacy: ProviderCheck
