from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


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


class MemberCreate(MemberBase):
    pass


class MemberUpdate(BaseModel):
    name: str | None = None
    birthday: str | None = None
    relation: str | None = None
    profile: MemberProfile | None = None
    bound: bool | None = None


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
    type: MemoryType
    domain: MemoryDomain
    content: str
    confidence: float = Field(ge=0, le=1)


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
    device_name: str = "mobile-browser"


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
    embedding_model: str = "bge-small-zh-v1.5"
    weather_api_key: str = ""
    default_city: str = "广州"
    extraction_retries: int = Field(default=3, ge=0, le=10)
    dedupe_threshold: float = Field(default=0.86, ge=0, le=1)
    cloud_llm_risk_acknowledged: bool = False


class ExpiredMemoryCleanup(BaseModel):
    removed: int


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
