from collections.abc import AsyncIterator
from datetime import timedelta
from hashlib import sha256
from secrets import token_urlsafe
from typing import Protocol

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from . import models
from .core.config import settings
from .core.db import AsyncSessionLocal
from .embeddings import build_text_embedding_async, cosine_similarity
from .llm_extractor import build_extracted_candidate, build_review_candidate as build_llm_review_candidate
from .memory_dedupe import build_review_candidate_from_text, is_semantic_duplicate_memory
from .recommendation_engine import (
    build_feedback_memory_content,
    build_recommendation,
    build_recommendation_query,
    recommendation_keywords,
)
from .schemas import (
    Member,
    MemberCreate,
    MemberDeviceSession,
    MemberProfile,
    MemberSession,
    MemberUpdate,
    Memory,
    MemoryDomain,
    MemoryDraft,
    MemoryType,
    MemoryUpdate,
    Note,
    NoteCreate,
    PairingExchange,
    PairingToken,
    Recommendation,
    RecommendationBatch,
    RecommendationDomain,
    RecommendationEvent,
    RecommendationFeedback,
    ReviewCandidate,
    SystemSettings,
    WeatherContext,
)
from .store import InMemoryStore, default_expires_at, now, store
from .tokens import create_member_token, decode_member_token
from .weather import get_weather_context


class DataStore(Protocol):
    async def list_members(self) -> list[Member]: ...
    async def create_member(self, payload: MemberCreate) -> Member: ...
    async def update_member(self, member_id: int, payload: MemberUpdate) -> Member | None: ...
    async def delete_member(self, member_id: int) -> bool: ...
    async def create_note(self, payload: NoteCreate) -> Note: ...
    async def list_notes(self, member_id: int | None = None) -> list[Note]: ...
    async def get_note(self, note_id: int) -> Note | None: ...
    async def build_review_candidate(self, note_id: int) -> ReviewCandidate | None: ...
    async def approve_review_candidate(self, note_id: int, draft: MemoryDraft) -> Memory | None: ...
    async def reject_review_candidate(self, note_id: int) -> Note | None: ...
    async def extract_memory_from_note(self, note_id: int) -> Memory | None: ...
    async def list_memories(self, member_id: int | None = None) -> list[Memory]: ...
    async def update_memory(self, memory_id: int, payload: MemoryUpdate) -> Memory | None: ...
    async def delete_memory(self, memory_id: int) -> bool: ...
    async def make_recommendation(
        self,
        domain: RecommendationDomain,
        member_id: int | None,
        record_event: bool = True,
    ) -> Recommendation: ...
    async def make_recommendations(
        self,
        domains: list[RecommendationDomain],
        member_id: int | None,
        record_events: bool = True,
    ) -> RecommendationBatch: ...
    async def record_recommendation_event(
        self,
        member_id: int | None,
        recommendation: Recommendation,
    ) -> None: ...
    async def list_recommendation_events(self, member_id: int | None = None) -> list[RecommendationEvent]: ...
    async def record_feedback(self, payload: RecommendationFeedback) -> Memory: ...
    async def create_pairing_token(self, member_id: int, server_url: str) -> PairingToken | None: ...
    async def exchange_pairing_token(self, payload: PairingExchange) -> MemberSession | None: ...
    async def cleanup_pairing_tokens(self) -> int: ...
    async def validate_member_token(self, access_token: str) -> MemberSession | None: ...
    async def list_member_sessions(self, member_id: int | None = None) -> list[MemberDeviceSession]: ...
    async def revoke_member_session(self, token_hash: str) -> bool: ...
    async def get_settings(self) -> SystemSettings: ...
    async def update_settings(self, payload: SystemSettings) -> SystemSettings: ...
    async def get_weather(self) -> WeatherContext: ...
    async def cleanup_expired_memories(self) -> int: ...
    async def rebuild_memory_embeddings(self) -> int: ...


class InMemoryDataStore:
    def __init__(self, inner: InMemoryStore) -> None:
        self.inner = inner

    async def list_members(self) -> list[Member]:
        return self.inner.list_members()

    async def create_member(self, payload: MemberCreate) -> Member:
        return self.inner.create_member(payload)

    async def update_member(self, member_id: int, payload: MemberUpdate) -> Member | None:
        return self.inner.update_member(member_id, payload)

    async def delete_member(self, member_id: int) -> bool:
        return self.inner.delete_member(member_id)

    async def create_note(self, payload: NoteCreate) -> Note:
        return self.inner.create_note(payload)

    async def list_notes(self, member_id: int | None = None) -> list[Note]:
        return self.inner.list_notes(member_id)

    async def get_note(self, note_id: int) -> Note | None:
        return self.inner.get_note(note_id)

    async def build_review_candidate(self, note_id: int) -> ReviewCandidate | None:
        return self.inner.build_review_candidate(note_id)

    async def approve_review_candidate(self, note_id: int, draft: MemoryDraft) -> Memory | None:
        return self.inner.approve_review_candidate(note_id, draft)

    async def reject_review_candidate(self, note_id: int) -> Note | None:
        return self.inner.reject_review_candidate(note_id)

    async def extract_memory_from_note(self, note_id: int) -> Memory | None:
        return self.inner.extract_memory_from_note(note_id)

    async def list_memories(self, member_id: int | None = None) -> list[Memory]:
        return self.inner.list_memories(member_id)

    async def update_memory(self, memory_id: int, payload: MemoryUpdate) -> Memory | None:
        return self.inner.update_memory(memory_id, payload)

    async def delete_memory(self, memory_id: int) -> bool:
        return self.inner.delete_memory(memory_id)

    async def make_recommendation(
        self,
        domain: RecommendationDomain,
        member_id: int | None,
        record_event: bool = True,
    ) -> Recommendation:
        return self.inner.make_recommendation(domain, member_id, record_event)

    async def make_recommendations(
        self,
        domains: list[RecommendationDomain],
        member_id: int | None,
        record_events: bool = True,
    ) -> RecommendationBatch:
        return self.inner.make_recommendations(domains, member_id, record_events)

    async def record_recommendation_event(
        self,
        member_id: int | None,
        recommendation: Recommendation,
    ) -> None:
        self.inner.record_recommendation_event(member_id, recommendation)

    async def list_recommendation_events(self, member_id: int | None = None) -> list[RecommendationEvent]:
        return self.inner.list_recommendation_events(member_id)

    async def record_feedback(self, payload: RecommendationFeedback) -> Memory:
        return self.inner.record_feedback(payload)

    async def create_pairing_token(self, member_id: int, server_url: str) -> PairingToken | None:
        return self.inner.create_pairing_token(member_id, server_url)

    async def exchange_pairing_token(self, payload: PairingExchange) -> MemberSession | None:
        return self.inner.exchange_pairing_token(payload)

    async def cleanup_pairing_tokens(self) -> int:
        return self.inner.cleanup_pairing_tokens()

    async def validate_member_token(self, access_token: str) -> MemberSession | None:
        return self.inner.validate_member_token(access_token)

    async def list_member_sessions(self, member_id: int | None = None) -> list[MemberDeviceSession]:
        return self.inner.list_member_sessions(member_id)

    async def revoke_member_session(self, token_hash: str) -> bool:
        return self.inner.revoke_member_session(token_hash)

    async def get_settings(self) -> SystemSettings:
        return self.inner.get_settings()

    async def update_settings(self, payload: SystemSettings) -> SystemSettings:
        return self.inner.update_settings(payload)

    async def get_weather(self) -> WeatherContext:
        return self.inner.get_weather()

    async def cleanup_expired_memories(self) -> int:
        return self.inner.cleanup_expired_memories()

    async def rebuild_memory_embeddings(self) -> int:
        return self.inner.rebuild_memory_embeddings()


class DatabaseDataStore:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    def _to_member(self, member: models.Member) -> Member:
        return Member(
            id=member.id,
            name=member.name,
            birthday=member.birthday,
            relation=member.relation,
            bound=member.bound,
            profile=MemberProfile.model_validate(member.profile or {}),
            created_at=member.created_at,
            updated_at=member.updated_at,
        )

    def _to_note(self, note: models.Note) -> Note:
        return Note(
            id=note.id,
            member_id=note.member_id,
            content=note.content,
            source=note.source.value,
            status=note.status,
            created_at=note.created_at,
        )

    def _to_memory(self, memory: models.Memory) -> Memory:
        return Memory(
            id=memory.id,
            member_id=memory.member_id,
            type=memory.type.value,
            domain=memory.domain.value,
            content=memory.content,
            confidence=memory.confidence,
            embedding=list(memory.embedding or []),
            source_note_id=memory.source_note_id,
            expires_at=memory.expires_at,
            created_at=memory.created_at,
        )

    def _to_member_session(self, session: models.MemberSession) -> MemberDeviceSession:
        member_name = session.member.name if session.member is not None else "Unknown member"
        return MemberDeviceSession(
            token_hash=session.token_hash,
            member_id=session.member_id,
            member_name=member_name,
            device_name=session.device_name,
            revoked=session.revoked,
            created_at=session.created_at,
        )

    def _to_recommendation_event(self, event: models.RecommendationEvent) -> RecommendationEvent:
        return RecommendationEvent(
            id=event.id,
            member_id=event.member_id,
            domain=event.domain.value,
            content=event.content,
            memory_ids=list(event.memory_ids or []),
            basis=list(event.basis or []),
            created_at=event.created_at,
        )

    async def list_members(self) -> list[Member]:
        result = await self.session.scalars(select(models.Member).order_by(models.Member.id))
        return [self._to_member(member) for member in result.all()]

    async def create_member(self, payload: MemberCreate) -> Member:
        member = models.Member(
            name=payload.name,
            birthday=payload.birthday,
            relation=payload.relation,
            profile=payload.profile.model_dump(),
        )
        self.session.add(member)
        await self.session.commit()
        await self.session.refresh(member)
        return self._to_member(member)

    async def update_member(self, member_id: int, payload: MemberUpdate) -> Member | None:
        member = await self.session.get(models.Member, member_id)
        if member is None:
            return None
        update = payload.model_dump(exclude_unset=True)
        if "profile" in update and update["profile"] is not None:
            update["profile"] = payload.profile.model_dump() if payload.profile else {}
        for key, value in update.items():
            setattr(member, key, value)
        await self.session.commit()
        await self.session.refresh(member)
        return self._to_member(member)

    async def delete_member(self, member_id: int) -> bool:
        member = await self.session.get(models.Member, member_id)
        if member is None:
            return False
        await self.session.execute(delete(models.PairingToken).where(models.PairingToken.member_id == member_id))
        await self.session.execute(delete(models.MemberSession).where(models.MemberSession.member_id == member_id))
        notes = await self.session.scalars(select(models.Note).where(models.Note.member_id == member_id))
        for note in notes.all():
            note.member_id = None
        memories = await self.session.scalars(select(models.Memory).where(models.Memory.member_id == member_id))
        for memory in memories.all():
            memory.member_id = None
        events = await self.session.scalars(
            select(models.RecommendationEvent).where(models.RecommendationEvent.member_id == member_id)
        )
        for event in events.all():
            event.member_id = None
        await self.session.delete(member)
        await self.session.commit()
        return True

    async def create_note(self, payload: NoteCreate) -> Note:
        note = models.Note(
            member_id=payload.member_id,
            content=payload.content,
            source=models.NoteSource(payload.source.value),
            status="understanding",
        )
        self.session.add(note)
        await self.session.commit()
        await self.session.refresh(note)
        return self._to_note(note)

    async def list_notes(self, member_id: int | None = None) -> list[Note]:
        statement = select(models.Note)
        if member_id is not None:
            statement = statement.where(models.Note.member_id == member_id)
        result = await self.session.scalars(statement.order_by(models.Note.created_at.desc()))
        return [self._to_note(note) for note in result.all()]

    async def get_note(self, note_id: int) -> Note | None:
        note = await self.session.get(models.Note, note_id)
        return self._to_note(note) if note is not None else None

    async def build_review_candidate(self, note_id: int) -> ReviewCandidate | None:
        note = await self.session.get(models.Note, note_id)
        if note is None:
            return None
        return await build_llm_review_candidate(note.id, note.member_id, note.content, await self.get_settings())

    async def approve_review_candidate(self, note_id: int, draft: MemoryDraft) -> Memory | None:
        note = await self.session.get(models.Note, note_id)
        if note is None:
            return None
        embedding = await self._build_embedding(draft.content)
        existing = await self.session.scalar(
            select(models.Memory).where(models.Memory.source_note_id == note_id).order_by(models.Memory.id)
        )
        if existing is not None:
            existing.type = models.MemoryType(draft.type.value)
            existing.domain = models.MemoryDomain(draft.domain.value)
            existing.content = draft.content
            existing.confidence = draft.confidence
            existing.embedding = embedding
            note.status = "reviewed"
            await self.session.commit()
            await self.session.refresh(existing)
            return self._to_memory(existing)
        memory = models.Memory(
            member_id=note.member_id,
            type=models.MemoryType(draft.type.value),
            domain=models.MemoryDomain(draft.domain.value),
            content=draft.content,
            confidence=draft.confidence,
            embedding=embedding,
            source_note_id=note.id,
            expires_at=default_expires_at(draft.type),
        )
        note.status = "reviewed"
        self.session.add(memory)
        await self.session.commit()
        await self.session.refresh(memory)
        return self._to_memory(memory)

    async def reject_review_candidate(self, note_id: int) -> Note | None:
        note = await self.session.get(models.Note, note_id)
        if note is None:
            return None
        note.status = "rejected"
        await self.session.commit()
        await self.session.refresh(note)
        return self._to_note(note)

    async def extract_memory_from_note(self, note_id: int) -> Memory | None:
        note = await self.session.get(models.Note, note_id)
        if note is None:
            return None
        candidate = await build_extracted_candidate(note.id, note.member_id, note.content, await self.get_settings())
        if candidate is None or not candidate.candidates:
            return None
        draft = candidate.candidates[0]
        system_settings = await self.get_settings()
        draft_embedding = await self._build_embedding(draft.content)
        existing = await self.session.scalar(select(models.Memory).where(models.Memory.source_note_id == note_id))
        if existing is None:
            candidates = await self.session.scalars(
                select(models.Memory).where(
                    ((models.Memory.member_id == note.member_id) | (models.Memory.member_id.is_(None)))
                    & (models.Memory.domain == models.MemoryDomain(draft.domain.value))
                    & (models.Memory.type == models.MemoryType(draft.type.value))
                )
            )
            existing = next(
                (
                    memory
                    for memory in candidates.all()
                    if is_semantic_duplicate_memory(
                        memory.content,
                        draft.content,
                        draft.type,
                        draft.domain,
                        list(memory.embedding or []),
                        draft_embedding,
                        system_settings.dedupe_threshold,
                    )
                ),
                None,
            )
        if existing is not None:
            note.status = "reviewed"
            await self.session.commit()
            return None
        return await self.approve_review_candidate(note_id, draft)

    async def list_memories(self, member_id: int | None = None) -> list[Memory]:
        statement = select(models.Memory)
        statement = statement.where((models.Memory.expires_at.is_(None)) | (models.Memory.expires_at > now()))
        if member_id is not None:
            statement = statement.where((models.Memory.member_id == member_id) | (models.Memory.member_id.is_(None)))
        result = await self.session.scalars(statement.order_by(models.Memory.created_at.desc()))
        return [self._to_memory(memory) for memory in result.all()]

    async def update_memory(self, memory_id: int, payload: MemoryUpdate) -> Memory | None:
        memory = await self.session.get(models.Memory, memory_id)
        if memory is None:
            return None
        update = payload.model_dump(exclude_unset=True)
        if "type" in update and update["type"] is not None:
            update["type"] = models.MemoryType(update["type"].value)
        if "domain" in update and update["domain"] is not None:
            update["domain"] = models.MemoryDomain(update["domain"].value)
        for key, value in update.items():
            setattr(memory, key, value)
        if "content" in update and update["content"] is not None:
            memory.embedding = await self._build_embedding(update["content"])
        await self.session.commit()
        await self.session.refresh(memory)
        return self._to_memory(memory)

    async def delete_memory(self, memory_id: int) -> bool:
        memory = await self.session.get(models.Memory, memory_id)
        if memory is None:
            return False
        await self.session.delete(memory)
        await self.session.commit()
        return True

    async def make_recommendation(
        self,
        domain: RecommendationDomain,
        member_id: int | None,
        record_event: bool = True,
    ) -> Recommendation:
        weather = await self.get_weather()
        member_model = await self.session.get(models.Member, member_id) if member_id is not None else None
        member = self._to_member(member_model) if member_model is not None else None
        query_embedding = await self._build_embedding(build_recommendation_query(domain, member, weather))
        candidates = await self._vector_ranked_memories(domain, member_id, query_embedding)
        related_memories = sorted(
            candidates,
            key=lambda memory: (
                sum(1 for keyword in recommendation_keywords(domain) if keyword in memory.content),
                cosine_similarity(query_embedding, memory.embedding),
            ),
            reverse=True,
        )[:5]
        recommendation = build_recommendation(domain, member, related_memories, weather)
        if record_event:
            await self.record_recommendation_event(member_id, recommendation)
        return recommendation

    async def record_recommendation_event(
        self,
        member_id: int | None,
        recommendation: Recommendation,
    ) -> None:
        self.session.add(
            models.RecommendationEvent(
                member_id=member_id,
                domain=models.MemoryDomain(recommendation.domain.value),
                content=recommendation.content,
                memory_ids=[ref.memory_id for ref in recommendation.basis_refs],
                basis=recommendation.basis,
            )
        )
        await self.session.commit()

    async def _vector_ranked_memories(
        self,
        domain: RecommendationDomain,
        member_id: int | None,
        query_embedding: list[float],
    ) -> list[Memory]:
        statement = select(models.Memory).where(
            ((models.Memory.expires_at.is_(None)) | (models.Memory.expires_at > now()))
            & models.Memory.embedding.is_not(None)
            & (
                (models.Memory.domain == models.MemoryDomain(domain.value))
                | (models.Memory.domain == models.MemoryDomain.general)
            )
        )
        if member_id is not None:
            statement = statement.where((models.Memory.member_id == member_id) | (models.Memory.member_id.is_(None)))

        distance = models.Memory.embedding.cosine_distance(query_embedding)
        result = await self.session.scalars(statement.order_by(distance).limit(40))
        return [self._to_memory(memory) for memory in result.all()]

    async def make_recommendations(
        self,
        domains: list[RecommendationDomain],
        member_id: int | None,
        record_events: bool = True,
    ) -> RecommendationBatch:
        return RecommendationBatch(
            recommendations=[
                await self.make_recommendation(domain, member_id, record_events) for domain in domains
            ]
        )

    async def list_recommendation_events(self, member_id: int | None = None) -> list[RecommendationEvent]:
        statement = select(models.RecommendationEvent)
        if member_id is not None:
            statement = statement.where(models.RecommendationEvent.member_id == member_id)
        result = await self.session.scalars(statement.order_by(models.RecommendationEvent.created_at.desc()))
        return [self._to_recommendation_event(event) for event in result.all()]

    async def record_feedback(self, payload: RecommendationFeedback) -> Memory:
        domain_map = {
            RecommendationDomain.dressing: models.MemoryDomain.dressing,
            RecommendationDomain.diet: models.MemoryDomain.diet,
            RecommendationDomain.exercise: models.MemoryDomain.exercise,
        }
        content = build_feedback_memory_content(payload.content, payload.accepted, await self.get_weather())
        memory = models.Memory(
            member_id=payload.member_id,
            type=models.MemoryType.episode,
            domain=domain_map[payload.domain],
            content=content,
            confidence=0.84,
            embedding=await self._build_embedding(content),
            expires_at=default_expires_at(MemoryType.episode),
        )
        self.session.add(memory)
        await self.session.commit()
        await self.session.refresh(memory)
        return self._to_memory(memory)

    async def create_pairing_token(self, member_id: int, server_url: str) -> PairingToken | None:
        await self.cleanup_pairing_tokens()
        member = await self.session.get(models.Member, member_id)
        if member is None:
            return None
        raw_token = token_urlsafe(24)
        token_hash = sha256(raw_token.encode("utf-8")).hexdigest()
        expires_at = now() + timedelta(minutes=5)
        self.session.add(models.PairingToken(token_hash=token_hash, member_id=member_id, expires_at=expires_at))
        await self.session.commit()
        clean_server = server_url.rstrip("/")
        return PairingToken(
            member_id=member_id,
            server_url=clean_server,
            pairing_token=raw_token,
            pairing_url=f"{clean_server}/mobile/pair?token={raw_token}",
            expires_at=expires_at,
        )

    async def exchange_pairing_token(self, payload: PairingExchange) -> MemberSession | None:
        token_hash = sha256(payload.pairing_token.encode("utf-8")).hexdigest()
        record = await self.session.get(models.PairingToken, token_hash)
        if record is None or record.used or record.expires_at <= now():
            return None
        member = await self.session.get(models.Member, record.member_id)
        if member is None:
            return None
        record.used = True
        member.bound = True
        access_token = create_member_token(member.id, payload.device_name)
        self.session.add(
            models.MemberSession(
                token_hash=sha256(access_token.encode("utf-8")).hexdigest(),
                member_id=member.id,
                device_name=payload.device_name,
            )
        )
        await self.session.commit()
        return MemberSession(member_id=member.id, member_name=member.name, access_token=access_token)

    async def cleanup_pairing_tokens(self) -> int:
        result = await self.session.execute(
            delete(models.PairingToken).where(
                (models.PairingToken.used.is_(True)) | (models.PairingToken.expires_at <= now())
            )
        )
        await self.session.commit()
        return int(result.rowcount or 0)

    async def validate_member_token(self, access_token: str) -> MemberSession | None:
        payload = decode_member_token(access_token)
        if payload is None:
            return None
        token_hash = sha256(access_token.encode("utf-8")).hexdigest()
        session = await self.session.get(models.MemberSession, token_hash)
        if session is None or session.revoked:
            return None
        if session.member_id != payload["member_id"] or session.device_name != payload["device"]:
            return None
        member = await self.session.get(models.Member, session.member_id)
        if member is None:
            return None
        return MemberSession(member_id=member.id, member_name=member.name, access_token=access_token)

    async def list_member_sessions(self, member_id: int | None = None) -> list[MemberDeviceSession]:
        statement = select(models.MemberSession).options(selectinload(models.MemberSession.member))
        if member_id is not None:
            statement = statement.where(models.MemberSession.member_id == member_id)
        result = await self.session.scalars(statement.order_by(models.MemberSession.created_at.desc()))
        return [self._to_member_session(session) for session in result.all()]

    async def revoke_member_session(self, token_hash: str) -> bool:
        session = await self.session.get(models.MemberSession, token_hash)
        if session is None:
            return False
        session.revoked = True
        active_session = await self.session.scalar(
            select(models.MemberSession)
            .where(
                models.MemberSession.member_id == session.member_id,
                models.MemberSession.token_hash != token_hash,
                models.MemberSession.revoked.is_(False),
            )
            .limit(1)
        )
        if active_session is None:
            member = await self.session.get(models.Member, session.member_id)
            if member is not None:
                member.bound = False
        await self.session.commit()
        return True

    async def get_settings(self) -> SystemSettings:
        row = await self.session.get(models.SystemSetting, "system")
        if row is None:
            return SystemSettings()
        return SystemSettings.model_validate(row.value)

    async def update_settings(self, payload: SystemSettings) -> SystemSettings:
        row = await self.session.get(models.SystemSetting, "system")
        if row is None:
            row = models.SystemSetting(key="system", value=payload.model_dump())
            self.session.add(row)
        else:
            row.value = payload.model_dump()
        await self.session.commit()
        return payload

    async def get_weather(self) -> WeatherContext:
        settings = await self.get_settings()
        return await get_weather_context(settings.default_city, settings.weather_api_key)

    async def _build_embedding(self, content: str) -> list[float]:
        system_settings = await self.get_settings()
        return await build_text_embedding_async(content, system_settings.embedding_model)

    async def cleanup_expired_memories(self) -> int:
        result = await self.session.execute(
            delete(models.Memory).where(models.Memory.expires_at.is_not(None), models.Memory.expires_at <= now())
        )
        await self.session.commit()
        return result.rowcount or 0

    async def rebuild_memory_embeddings(self) -> int:
        result = await self.session.scalars(select(models.Memory).order_by(models.Memory.id))
        memories = result.all()
        for memory in memories:
            memory.embedding = await self._build_embedding(memory.content)
        await self.session.commit()
        return len(memories)


async def get_data_store() -> AsyncIterator[DataStore]:
    if not settings.require_database:
        yield InMemoryDataStore(store)
        return

    async with AsyncSessionLocal() as session:
        yield DatabaseDataStore(session)


async def seed_database() -> None:
    async with AsyncSessionLocal() as session:
        count = await session.scalar(select(func.count()).select_from(models.Member))
        if count:
            return

        seed = InMemoryStore()
        db_store = DatabaseDataStore(session)
        member_id_map: dict[int, int] = {}
        for member in seed.list_members():
            created_schema = await db_store.create_member(
                MemberCreate(**member.model_dump(exclude={"id", "bound", "created_at", "updated_at"}))
            )
            member_id_map[member.id] = created_schema.id
            created = await session.get(models.Member, created_schema.id)
            if created:
                created.bound = member.bound

        system_settings = await db_store.get_settings()
        for memory in seed.list_memories():
            session.add(
                models.Memory(
                    member_id=member_id_map.get(memory.member_id) if memory.member_id is not None else None,
                    type=models.MemoryType(memory.type.value),
                    domain=models.MemoryDomain(memory.domain.value),
                    content=memory.content,
                    confidence=memory.confidence,
                    embedding=await build_text_embedding_async(memory.content, system_settings.embedding_model),
                    source_note_id=memory.source_note_id,
                    expires_at=memory.expires_at,
                    created_at=memory.created_at,
                )
            )
        await session.commit()
