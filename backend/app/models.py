from datetime import datetime
from enum import Enum

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy import Enum as SqlEnum
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from pgvector.sqlalchemy import Vector

from .embeddings import EMBEDDING_DIMENSION


class Base(DeclarativeBase):
    pass


class NoteSource(str, Enum):
    text = "text"
    voice = "voice"
    photo = "photo"


class MemoryType(str, Enum):
    fact = "fact"
    episode = "episode"


class MemoryDomain(str, Enum):
    dressing = "dressing"
    diet = "diet"
    exercise = "exercise"
    general = "general"


class Member(Base):
    __tablename__ = "members"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    birthday: Mapped[str | None] = mapped_column(String(20))
    relation: Mapped[str] = mapped_column(String(80), nullable=False)
    bound: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    profile: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    notes: Mapped[list["Note"]] = relationship(back_populates="member")
    memories: Mapped[list["Memory"]] = relationship(back_populates="member")
    sessions: Mapped[list["MemberSession"]] = relationship(back_populates="member")


class Note(Base):
    __tablename__ = "notes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    member_id: Mapped[int | None] = mapped_column(ForeignKey("members.id", ondelete="SET NULL"))
    content: Mapped[str] = mapped_column(Text, nullable=False)
    source: Mapped[NoteSource] = mapped_column(SqlEnum(NoteSource, name="note_source"), nullable=False)
    status: Mapped[str] = mapped_column(String(40), nullable=False, default="understanding")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    member: Mapped[Member | None] = relationship(back_populates="notes")
    memories: Mapped[list["Memory"]] = relationship(back_populates="source_note")


class Memory(Base):
    __tablename__ = "memories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    member_id: Mapped[int | None] = mapped_column(ForeignKey("members.id", ondelete="SET NULL"))
    type: Mapped[MemoryType] = mapped_column(SqlEnum(MemoryType, name="memory_type"), nullable=False)
    domain: Mapped[MemoryDomain] = mapped_column(SqlEnum(MemoryDomain, name="memory_domain"), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    confidence: Mapped[float] = mapped_column(Float, nullable=False)
    embedding: Mapped[list[float] | None] = mapped_column(Vector(EMBEDDING_DIMENSION))
    source_note_id: Mapped[int | None] = mapped_column(ForeignKey("notes.id", ondelete="SET NULL"))
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    member: Mapped[Member | None] = relationship(back_populates="memories")
    source_note: Mapped[Note | None] = relationship(back_populates="memories")


class RecommendationEvent(Base):
    __tablename__ = "recommendation_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    member_id: Mapped[int | None] = mapped_column(ForeignKey("members.id", ondelete="SET NULL"))
    domain: Mapped[MemoryDomain] = mapped_column(SqlEnum(MemoryDomain, name="memory_domain"), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    memory_ids: Mapped[list[int]] = mapped_column(JSONB, nullable=False, default=list)
    basis: Mapped[list[str]] = mapped_column(JSONB, nullable=False, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class PairingToken(Base):
    __tablename__ = "pairing_tokens"

    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    member_id: Mapped[int] = mapped_column(ForeignKey("members.id", ondelete="CASCADE"), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    used: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class MemberSession(Base):
    __tablename__ = "member_sessions"

    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    member_id: Mapped[int] = mapped_column(ForeignKey("members.id", ondelete="CASCADE"), nullable=False)
    device_name: Mapped[str] = mapped_column(String(160), nullable=False)
    revoked: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    member: Mapped[Member] = relationship(back_populates="sessions")


class SystemSetting(Base):
    __tablename__ = "system_settings"

    key: Mapped[str] = mapped_column(String(120), primary_key=True)
    value: Mapped[dict] = mapped_column(JSONB, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
