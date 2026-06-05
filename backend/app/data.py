from collections.abc import AsyncIterator
from datetime import timedelta
from hashlib import sha256
from secrets import token_urlsafe
from typing import Protocol

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from . import models
from .core.config import settings
from .core.db import AsyncSessionLocal
from .schemas import (
    Member,
    MemberCreate,
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
    RecommendationFeedback,
    ReviewCandidate,
    SystemSettings,
)
from .store import InMemoryStore, now, store


class DataStore(Protocol):
    async def list_members(self) -> list[Member]: ...
    async def create_member(self, payload: MemberCreate) -> Member: ...
    async def update_member(self, member_id: int, payload: MemberUpdate) -> Member | None: ...
    async def delete_member(self, member_id: int) -> bool: ...
    async def create_note(self, payload: NoteCreate) -> Note: ...
    async def list_notes(self, member_id: int | None = None) -> list[Note]: ...
    async def build_review_candidate(self, note_id: int) -> ReviewCandidate | None: ...
    async def approve_review_candidate(self, note_id: int, draft: MemoryDraft) -> Memory | None: ...
    async def extract_memory_from_note(self, note_id: int) -> Memory | None: ...
    async def list_memories(self, member_id: int | None = None) -> list[Memory]: ...
    async def update_memory(self, memory_id: int, payload: MemoryUpdate) -> Memory | None: ...
    async def delete_memory(self, memory_id: int) -> bool: ...
    async def make_recommendation(self, domain: RecommendationDomain, member_id: int | None) -> Recommendation: ...
    async def make_recommendations(
        self,
        domains: list[RecommendationDomain],
        member_id: int | None,
    ) -> RecommendationBatch: ...
    async def record_feedback(self, payload: RecommendationFeedback) -> Memory: ...
    async def create_pairing_token(self, member_id: int, server_url: str) -> PairingToken | None: ...
    async def exchange_pairing_token(self, payload: PairingExchange) -> MemberSession | None: ...
    async def validate_member_token(self, access_token: str) -> MemberSession | None: ...
    async def get_settings(self) -> SystemSettings: ...
    async def update_settings(self, payload: SystemSettings) -> SystemSettings: ...
    async def cleanup_expired_memories(self) -> int: ...


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

    async def build_review_candidate(self, note_id: int) -> ReviewCandidate | None:
        return self.inner.build_review_candidate(note_id)

    async def approve_review_candidate(self, note_id: int, draft: MemoryDraft) -> Memory | None:
        return self.inner.approve_review_candidate(note_id, draft)

    async def extract_memory_from_note(self, note_id: int) -> Memory | None:
        return self.inner.extract_memory_from_note(note_id)

    async def list_memories(self, member_id: int | None = None) -> list[Memory]:
        return self.inner.list_memories(member_id)

    async def update_memory(self, memory_id: int, payload: MemoryUpdate) -> Memory | None:
        return self.inner.update_memory(memory_id, payload)

    async def delete_memory(self, memory_id: int) -> bool:
        return self.inner.delete_memory(memory_id)

    async def make_recommendation(self, domain: RecommendationDomain, member_id: int | None) -> Recommendation:
        return self.inner.make_recommendation(domain, member_id)

    async def make_recommendations(
        self,
        domains: list[RecommendationDomain],
        member_id: int | None,
    ) -> RecommendationBatch:
        return self.inner.make_recommendations(domains, member_id)

    async def record_feedback(self, payload: RecommendationFeedback) -> Memory:
        return self.inner.record_feedback(payload)

    async def create_pairing_token(self, member_id: int, server_url: str) -> PairingToken | None:
        return self.inner.create_pairing_token(member_id, server_url)

    async def exchange_pairing_token(self, payload: PairingExchange) -> MemberSession | None:
        return self.inner.exchange_pairing_token(payload)

    async def validate_member_token(self, access_token: str) -> MemberSession | None:
        return self.inner.validate_member_token(access_token)

    async def get_settings(self) -> SystemSettings:
        return self.inner.get_settings()

    async def update_settings(self, payload: SystemSettings) -> SystemSettings:
        return self.inner.update_settings(payload)

    async def cleanup_expired_memories(self) -> int:
        return self.inner.cleanup_expired_memories()


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
            source_note_id=memory.source_note_id,
            expires_at=memory.expires_at,
            created_at=memory.created_at,
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
        await self.extract_memory_from_note(note.id)
        await self.session.refresh(note)
        return self._to_note(note)

    async def list_notes(self, member_id: int | None = None) -> list[Note]:
        statement = select(models.Note)
        if member_id is not None:
            statement = statement.where(models.Note.member_id == member_id)
        result = await self.session.scalars(statement.order_by(models.Note.created_at.desc()))
        return [self._to_note(note) for note in result.all()]

    async def build_review_candidate(self, note_id: int) -> ReviewCandidate | None:
        note = await self.session.get(models.Note, note_id)
        if note is None:
            return None
        text = note.content
        domain = MemoryDomain.general
        if any(keyword in text for keyword in ["跑", "路", "运动", "膝盖", "散步"]):
            domain = MemoryDomain.exercise
        elif any(keyword in text for keyword in ["冷", "热", "穿", "外套", "保暖"]):
            domain = MemoryDomain.dressing
        elif any(keyword in text for keyword in ["吃", "饮", "糖", "香菜", "过敏", "汤"]):
            domain = MemoryDomain.diet
        memory_type = MemoryType.fact if any(keyword in text for keyword in ["喜欢", "不吃", "过敏", "怕"]) else MemoryType.episode
        return ReviewCandidate(
            note_id=note.id,
            member_id=note.member_id,
            original=note.content,
            candidates=[MemoryDraft(type=memory_type, domain=domain, content=text, confidence=0.72)],
        )

    async def approve_review_candidate(self, note_id: int, draft: MemoryDraft) -> Memory | None:
        note = await self.session.get(models.Note, note_id)
        if note is None:
            return None
        existing = await self.session.scalar(
            select(models.Memory).where(models.Memory.source_note_id == note_id).order_by(models.Memory.id)
        )
        if existing is not None:
            existing.type = models.MemoryType(draft.type.value)
            existing.domain = models.MemoryDomain(draft.domain.value)
            existing.content = draft.content
            existing.confidence = draft.confidence
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
            source_note_id=note.id,
        )
        note.status = "reviewed"
        self.session.add(memory)
        await self.session.commit()
        await self.session.refresh(memory)
        return self._to_memory(memory)

    async def extract_memory_from_note(self, note_id: int) -> Memory | None:
        candidate = await self.build_review_candidate(note_id)
        if candidate is None or not candidate.candidates:
            return None
        note = await self.session.get(models.Note, note_id)
        if note is None:
            return None
        draft = candidate.candidates[0]
        existing = await self.session.scalar(
            select(models.Memory).where(
                (models.Memory.source_note_id == note_id)
                | (
                    (models.Memory.member_id == note.member_id)
                    & (models.Memory.domain == models.MemoryDomain(draft.domain.value))
                    & (models.Memory.content == draft.content)
                )
            )
        )
        if existing is not None:
            note.status = "reviewed"
            await self.session.commit()
            return None
        return await self.approve_review_candidate(note_id, draft)

    async def list_memories(self, member_id: int | None = None) -> list[Memory]:
        statement = select(models.Memory)
        if member_id is not None:
            statement = statement.where(models.Memory.member_id == member_id)
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

    async def make_recommendation(self, domain: RecommendationDomain, member_id: int | None) -> Recommendation:
        memories = await self.list_memories(member_id)
        related = [
            memory.content
            for memory in memories
            if memory.domain == domain.value or memory.domain == MemoryDomain.general.value
        ][:3]
        member = await self.session.get(models.Member, member_id) if member_id is not None else None
        name = member.name if member else "全家"
        templates = {
            RecommendationDomain.dressing: f"{name} 今日建议穿长袖加薄外套，早晚注意保暖。",
            RecommendationDomain.diet: f"{name} 今日饮食以清淡少油为主，避开已知忌口和过敏源。",
            RecommendationDomain.exercise: f"{name} 今日适合低到中等强度活动，优先散步和拉伸。",
        }
        return Recommendation(domain=domain, content=templates[domain], basis=related)

    async def make_recommendations(
        self,
        domains: list[RecommendationDomain],
        member_id: int | None,
    ) -> RecommendationBatch:
        return RecommendationBatch(
            recommendations=[await self.make_recommendation(domain, member_id) for domain in domains]
        )

    async def record_feedback(self, payload: RecommendationFeedback) -> Memory:
        domain_map = {
            RecommendationDomain.dressing: models.MemoryDomain.dressing,
            RecommendationDomain.diet: models.MemoryDomain.diet,
            RecommendationDomain.exercise: models.MemoryDomain.exercise,
        }
        verdict = "采纳" if payload.accepted else "不合适"
        memory = models.Memory(
            member_id=payload.member_id,
            type=models.MemoryType.episode,
            domain=domain_map[payload.domain],
            content=f"用户反馈「{verdict}」：{payload.content}",
            confidence=0.84,
        )
        self.session.add(memory)
        await self.session.commit()
        await self.session.refresh(memory)
        return self._to_memory(memory)

    async def create_pairing_token(self, member_id: int, server_url: str) -> PairingToken | None:
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
        access_token = token_urlsafe(32)
        self.session.add(
            models.MemberSession(
                token_hash=sha256(access_token.encode("utf-8")).hexdigest(),
                member_id=member.id,
                device_name=payload.device_name,
            )
        )
        await self.session.commit()
        return MemberSession(member_id=member.id, member_name=member.name, access_token=access_token)

    async def validate_member_token(self, access_token: str) -> MemberSession | None:
        token_hash = sha256(access_token.encode("utf-8")).hexdigest()
        session = await self.session.get(models.MemberSession, token_hash)
        if session is None or session.revoked:
            return None
        member = await self.session.get(models.Member, session.member_id)
        if member is None:
            return None
        return MemberSession(member_id=member.id, member_name=member.name, access_token=access_token)

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

    async def cleanup_expired_memories(self) -> int:
        result = await self.session.execute(
            delete(models.Memory).where(models.Memory.expires_at.is_not(None), models.Memory.expires_at <= now())
        )
        await self.session.commit()
        return result.rowcount or 0


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

        for memory in seed.list_memories():
            session.add(
                models.Memory(
                    member_id=member_id_map.get(memory.member_id) if memory.member_id is not None else None,
                    type=models.MemoryType(memory.type.value),
                    domain=models.MemoryDomain(memory.domain.value),
                    content=memory.content,
                    confidence=memory.confidence,
                    source_note_id=memory.source_note_id,
                    expires_at=memory.expires_at,
                    created_at=memory.created_at,
                )
            )
        await session.commit()
