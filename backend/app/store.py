from datetime import UTC, datetime, timedelta
from hashlib import sha256
from secrets import token_urlsafe

from .embeddings import build_text_embedding, cosine_similarity
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
    MemberUpdate,
    Memory,
    MemoryDomain,
    MemoryDraft,
    MemoryType,
    MemoryUpdate,
    MemberSession,
    Note,
    NoteCreate,
    PairingExchange,
    PairingToken,
    PairingTokenRecord,
    Recommendation,
    RecommendationBatch,
    RecommendationDomain,
    RecommendationEvent,
    RecommendationFeedback,
    ReviewCandidate,
    SystemSettings,
    WeatherContext,
)
from .tokens import create_member_token, decode_member_token
from .weather import estimate_weather


def now() -> datetime:
    return datetime.now(UTC)


def default_expires_at(memory_type: MemoryType) -> datetime | None:
    return now() + timedelta(days=7) if memory_type == MemoryType.episode else None


class InMemoryStore:
    def __init__(self) -> None:
        self._member_id = 2
        self._note_id = 0
        self._memory_id = 3
        self._recommendation_event_id = 0
        self.pairing_tokens: dict[str, PairingTokenRecord] = {}
        self.member_sessions: dict[str, MemberDeviceSession] = {}
        self.recommendation_events: dict[int, RecommendationEvent] = {}
        self.settings = SystemSettings()
        created = now()
        self.members: dict[int, Member] = {
            1: Member(
                id=1,
                name="张明远",
                birthday="1964-03-18",
                relation="爸爸",
                bound=False,
                created_at=created,
                updated_at=created,
                profile=MemberProfile(
                    diet_restrictions=["少糖"],
                    chronic_conditions=["糖尿病"],
                    injury_history="膝盖受凉会不舒服，避免剧烈跑跳。",
                    thermal_sensitivity=-1,
                    exercise_preference="饭后散步 30 分钟，中低强度。",
                ),
            ),
            2: Member(
                id=2,
                name="李秋梅",
                birthday="1967-10-04",
                relation="妈妈",
                bound=True,
                created_at=created,
                updated_at=created,
                profile=MemberProfile(
                    diet_restrictions=["不吃香菜"],
                    thermal_sensitivity=-2,
                    taste_preference="清淡，喜欢汤品，不爱香菜。",
                ),
            ),
        }
        self.notes: dict[int, Note] = {}
        self.memories: dict[int, Memory] = {
            1: Memory(
                id=1,
                member_id=1,
                type=MemoryType.fact,
                domain=MemoryDomain.exercise,
                content="爸爸饭后喜欢散步 30 分钟。",
                confidence=0.92,
                created_at=created,
            ),
            2: Memory(
                id=2,
                member_id=2,
                type=MemoryType.fact,
                domain=MemoryDomain.diet,
                content="妈妈不吃香菜，喜欢清淡汤品。",
                confidence=0.9,
                created_at=created,
            ),
            3: Memory(
                id=3,
                member_id=None,
                type=MemoryType.fact,
                domain=MemoryDomain.diet,
                content="朵朵对芒果过敏。",
                confidence=0.88,
                created_at=created,
            ),
        }
        self.memories = {
            memory_id: memory.model_copy(update={"embedding": build_text_embedding(memory.content)})
            for memory_id, memory in self.memories.items()
        }

    def list_members(self) -> list[Member]:
        return list(self.members.values())

    def create_member(self, payload: MemberCreate) -> Member:
        self._member_id += 1
        timestamp = now()
        member = Member(
            id=self._member_id,
            created_at=timestamp,
            updated_at=timestamp,
            **payload.model_dump(),
        )
        self.members[member.id] = member
        return member

    def update_member(self, member_id: int, payload: MemberUpdate) -> Member | None:
        current = self.members.get(member_id)
        if current is None:
            return None

        data = current.model_dump()
        update = payload.model_dump(exclude_unset=True)
        data.update(update)
        data["updated_at"] = now()
        member = Member(**data)
        self.members[member_id] = member
        return member

    def delete_member(self, member_id: int) -> bool:
        if self.members.pop(member_id, None) is None:
            return False
        self.notes = {
            note_id: note.model_copy(update={"member_id": None}) if note.member_id == member_id else note
            for note_id, note in self.notes.items()
        }
        self.memories = {
            memory_id: memory.model_copy(update={"member_id": None}) if memory.member_id == member_id else memory
            for memory_id, memory in self.memories.items()
        }
        self.recommendation_events = {
            event_id: event.model_copy(update={"member_id": None}) if event.member_id == member_id else event
            for event_id, event in self.recommendation_events.items()
        }
        self.pairing_tokens = {
            token_hash: token for token_hash, token in self.pairing_tokens.items() if token.member_id != member_id
        }
        self.member_sessions = {
            token_hash: session
            for token_hash, session in self.member_sessions.items()
            if session.member_id != member_id
        }
        return True

    def create_note(self, payload: NoteCreate) -> Note:
        self._note_id += 1
        note = Note(id=self._note_id, created_at=now(), **payload.model_dump())
        self.notes[note.id] = note
        return note

    def list_notes(self, member_id: int | None = None) -> list[Note]:
        notes = list(self.notes.values())
        if member_id is not None:
            notes = [note for note in notes if note.member_id == member_id]
        return sorted(notes, key=lambda note: note.created_at, reverse=True)

    def get_note(self, note_id: int) -> Note | None:
        return self.notes.get(note_id)

    def build_review_candidate(self, note_id: int) -> ReviewCandidate | None:
        note = self.notes.get(note_id)
        if note is None:
            return None
        return build_review_candidate_from_text(note.id, note.member_id, note.content)

    def approve_review_candidate(self, note_id: int, draft: MemoryDraft) -> Memory | None:
        note = self.notes.get(note_id)
        if note is None:
            return None
        self._memory_id += 1
        memory = Memory(
            id=self._memory_id,
            member_id=note.member_id,
            type=draft.type,
            domain=draft.domain,
            content=draft.content,
            confidence=draft.confidence,
            embedding=build_text_embedding(draft.content),
            source_note_id=note.id,
            expires_at=default_expires_at(draft.type),
            created_at=now(),
        )
        self.memories[memory.id] = memory
        self.notes[note.id] = note.model_copy(update={"status": "reviewed"})
        return memory

    def reject_review_candidate(self, note_id: int) -> Note | None:
        note = self.notes.get(note_id)
        if note is None:
            return None
        rejected = note.model_copy(update={"status": "rejected"})
        self.notes[note.id] = rejected
        return rejected

    def extract_memory_from_note(self, note_id: int) -> Memory | None:
        candidate = self.build_review_candidate(note_id)
        if candidate is None or not candidate.candidates:
            return None
        note = self.notes.get(note_id)
        if note is None:
            return None
        draft = candidate.candidates[0]
        draft_embedding = build_text_embedding(draft.content)
        if any(
            memory.source_note_id == note_id or (
                memory.member_id == note.member_id
                and memory.domain == draft.domain
                and memory.type == draft.type
                and is_semantic_duplicate_memory(
                    memory.content,
                    draft.content,
                    draft.type,
                    draft.domain,
                    memory.embedding,
                    draft_embedding,
                    self.settings.dedupe_threshold,
                )
            )
            for memory in self.memories.values()
        ):
            self.notes[note.id] = note.model_copy(update={"status": "reviewed"})
            return None
        return self.approve_review_candidate(note_id, draft)

    def list_memories(self, member_id: int | None = None) -> list[Memory]:
        memories = list(self.memories.values())
        memories = [memory for memory in memories if memory.expires_at is None or memory.expires_at > now()]
        if member_id is not None:
            memories = [memory for memory in memories if memory.member_id == member_id]
        return memories

    def update_memory(self, memory_id: int, payload: MemoryUpdate) -> Memory | None:
        current = self.memories.get(memory_id)
        if current is None:
            return None
        data = current.model_dump()
        data.update(payload.model_dump(exclude_unset=True))
        if "content" in payload.model_fields_set and data.get("content") is not None:
            data["embedding"] = build_text_embedding(data["content"])
        memory = Memory(**data)
        self.memories[memory_id] = memory
        return memory

    def delete_memory(self, memory_id: int) -> bool:
        return self.memories.pop(memory_id, None) is not None

    def make_recommendation(self, domain: RecommendationDomain, member_id: int | None) -> Recommendation:
        weather = self.get_weather()
        member = self.members.get(member_id) if member_id is not None else None
        query_embedding = build_text_embedding(build_recommendation_query(domain, member, weather))
        candidates = [
            memory
            for memory in self.list_memories(member_id)
            if memory.domain == domain or memory.domain == MemoryDomain.general
        ]
        related_memories = sorted(
            candidates,
            key=lambda memory: (
                sum(1 for keyword in recommendation_keywords(domain) if keyword in memory.content),
                cosine_similarity(query_embedding, memory.embedding),
            ),
            reverse=True,
        )[:5]
        recommendation = build_recommendation(domain, member, related_memories, weather)
        self._record_recommendation_event(member_id, recommendation)
        return recommendation

    def _record_recommendation_event(self, member_id: int | None, recommendation: Recommendation) -> RecommendationEvent:
        self._recommendation_event_id += 1
        event = RecommendationEvent(
            id=self._recommendation_event_id,
            member_id=member_id,
            domain=recommendation.domain,
            content=recommendation.content,
            memory_ids=[ref.memory_id for ref in recommendation.basis_refs],
            basis=recommendation.basis,
            created_at=now(),
        )
        self.recommendation_events[event.id] = event
        return event

    def make_recommendations(
        self,
        domains: list[RecommendationDomain],
        member_id: int | None,
    ) -> RecommendationBatch:
        return RecommendationBatch(
            recommendations=[self.make_recommendation(domain, member_id) for domain in domains]
        )

    def list_recommendation_events(self, member_id: int | None = None) -> list[RecommendationEvent]:
        events = list(self.recommendation_events.values())
        if member_id is not None:
            events = [event for event in events if event.member_id == member_id]
        return sorted(events, key=lambda event: event.created_at, reverse=True)

    def record_feedback(self, payload: RecommendationFeedback) -> Memory:
        domain_map = {
            RecommendationDomain.dressing: MemoryDomain.dressing,
            RecommendationDomain.diet: MemoryDomain.diet,
            RecommendationDomain.exercise: MemoryDomain.exercise,
        }
        self._memory_id += 1
        memory = Memory(
            id=self._memory_id,
            member_id=payload.member_id,
            type=MemoryType.episode,
            domain=domain_map[payload.domain],
            content=build_feedback_memory_content(payload.content, payload.accepted, self.get_weather()),
            confidence=0.84,
            expires_at=default_expires_at(MemoryType.episode),
            created_at=now(),
        )
        memory = memory.model_copy(update={"embedding": build_text_embedding(memory.content)})
        self.memories[memory.id] = memory
        return memory

    def create_pairing_token(self, member_id: int, server_url: str) -> PairingToken | None:
        self.cleanup_pairing_tokens()
        if member_id not in self.members:
            return None
        raw_token = token_urlsafe(24)
        token_hash = sha256(raw_token.encode("utf-8")).hexdigest()
        expires_at = now() + timedelta(minutes=5)
        self.pairing_tokens[token_hash] = PairingTokenRecord(
            member_id=member_id,
            token_hash=token_hash,
            expires_at=expires_at,
        )
        clean_server = server_url.rstrip("/")
        pairing_url = f"{clean_server}/mobile/pair?token={raw_token}"
        return PairingToken(
            member_id=member_id,
            server_url=clean_server,
            pairing_token=raw_token,
            pairing_url=pairing_url,
            expires_at=expires_at,
        )

    def exchange_pairing_token(self, payload: PairingExchange) -> MemberSession | None:
        token_hash = sha256(payload.pairing_token.encode("utf-8")).hexdigest()
        record = self.pairing_tokens.get(token_hash)
        if record is None or record.used or record.expires_at <= now():
            return None

        member = self.members.get(record.member_id)
        if member is None:
            return None

        self.pairing_tokens[token_hash] = record.model_copy(update={"used": True})
        self.members[member.id] = member.model_copy(update={"bound": True, "updated_at": now()})
        access_token = create_member_token(member.id, payload.device_name)
        token_hash = sha256(access_token.encode("utf-8")).hexdigest()
        self.member_sessions[token_hash] = MemberDeviceSession(
            member_id=member.id,
            member_name=member.name,
            token_hash=token_hash,
            device_name=payload.device_name,
            created_at=now(),
        )
        return MemberSession(member_id=member.id, member_name=member.name, access_token=access_token)

    def cleanup_pairing_tokens(self) -> int:
        expired_or_used = [
            token_hash
            for token_hash, record in self.pairing_tokens.items()
            if record.used or record.expires_at <= now()
        ]
        for token_hash in expired_or_used:
            del self.pairing_tokens[token_hash]
        return len(expired_or_used)

    def validate_member_token(self, access_token: str) -> MemberSession | None:
        payload = decode_member_token(access_token)
        if payload is None:
            return None
        token_hash = sha256(access_token.encode("utf-8")).hexdigest()
        session = self.member_sessions.get(token_hash)
        if session is None or session.revoked:
            return None
        if session.member_id != payload["member_id"] or session.device_name != payload["device"]:
            return None
        return MemberSession(member_id=session.member_id, member_name=session.member_name, access_token=access_token)

    def list_member_sessions(self, member_id: int | None = None) -> list[MemberDeviceSession]:
        sessions = list(self.member_sessions.values())
        if member_id is not None:
            sessions = [session for session in sessions if session.member_id == member_id]
        return sorted(sessions, key=lambda session: session.created_at, reverse=True)

    def revoke_member_session(self, token_hash: str) -> bool:
        session = self.member_sessions.get(token_hash)
        if session is None:
            return False
        self.member_sessions[token_hash] = session.model_copy(update={"revoked": True})
        return True

    def get_settings(self) -> SystemSettings:
        return self.settings

    def update_settings(self, payload: SystemSettings) -> SystemSettings:
        self.settings = payload
        return self.settings

    def get_weather(self) -> WeatherContext:
        return estimate_weather(self.settings.default_city)

    def cleanup_expired_memories(self) -> int:
        expired_ids = [
            memory_id
            for memory_id, memory in self.memories.items()
            if memory.expires_at is not None and memory.expires_at <= now()
        ]
        for memory_id in expired_ids:
            self.memories.pop(memory_id, None)
        return len(expired_ids)

    def rebuild_memory_embeddings(self) -> int:
        self.memories = {
            memory_id: memory.model_copy(update={"embedding": build_text_embedding(memory.content)})
            for memory_id, memory in self.memories.items()
        }
        return len(self.memories)


store = InMemoryStore()
