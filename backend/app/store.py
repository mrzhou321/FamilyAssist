from datetime import UTC, datetime, timedelta
from hashlib import sha256
from secrets import token_urlsafe

from .schemas import (
    Member,
    MemberCreate,
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
    RecommendationFeedback,
    ReviewCandidate,
    SystemSettings,
)


def now() -> datetime:
    return datetime.now(UTC)


def default_expires_at(memory_type: MemoryType) -> datetime | None:
    return now() + timedelta(days=7) if memory_type == MemoryType.episode else None


class InMemoryStore:
    def __init__(self) -> None:
        self._member_id = 2
        self._note_id = 0
        self._memory_id = 3
        self.pairing_tokens: dict[str, PairingTokenRecord] = {}
        self.member_sessions: dict[str, MemberSession] = {}
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
        return self.members.pop(member_id, None) is not None

    def create_note(self, payload: NoteCreate) -> Note:
        self._note_id += 1
        note = Note(id=self._note_id, created_at=now(), **payload.model_dump())
        self.notes[note.id] = note
        self.extract_memory_from_note(note.id)
        return note

    def list_notes(self, member_id: int | None = None) -> list[Note]:
        notes = list(self.notes.values())
        if member_id is not None:
            notes = [note for note in notes if note.member_id == member_id]
        return sorted(notes, key=lambda note: note.created_at, reverse=True)

    def build_review_candidate(self, note_id: int) -> ReviewCandidate | None:
        note = self.notes.get(note_id)
        if note is None:
            return None
        text = note.content
        domain = MemoryDomain.general
        if any(keyword in text for keyword in ["走", "跑", "运动", "膝盖", "散步"]):
            domain = MemoryDomain.exercise
        elif any(keyword in text for keyword in ["冷", "热", "穿", "外套", "保暖"]):
            domain = MemoryDomain.dressing
        elif any(keyword in text for keyword in ["吃", "饭", "糖", "香菜", "过敏", "汤"]):
            domain = MemoryDomain.diet

        memory_type = MemoryType.fact if any(keyword in text for keyword in ["喜欢", "不吃", "过敏", "怕"]) else MemoryType.episode
        candidate = MemoryDraft(type=memory_type, domain=domain, content=text, confidence=0.72)
        return ReviewCandidate(
            note_id=note.id,
            member_id=note.member_id,
            original=note.content,
            candidates=[candidate],
        )

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
            source_note_id=note.id,
            expires_at=default_expires_at(draft.type),
            created_at=now(),
        )
        self.memories[memory.id] = memory
        self.notes[note.id] = note.model_copy(update={"status": "reviewed"})
        return memory

    def extract_memory_from_note(self, note_id: int) -> Memory | None:
        candidate = self.build_review_candidate(note_id)
        if candidate is None or not candidate.candidates:
            return None
        note = self.notes.get(note_id)
        if note is None:
            return None
        draft = candidate.candidates[0]
        if any(
            memory.source_note_id == note_id or (
                memory.member_id == note.member_id
                and memory.domain == draft.domain
                and memory.content == draft.content
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
        memory = Memory(**data)
        self.memories[memory_id] = memory
        return memory

    def delete_memory(self, memory_id: int) -> bool:
        return self.memories.pop(memory_id, None) is not None

    def make_recommendation(self, domain: RecommendationDomain, member_id: int | None) -> Recommendation:
        related = [
            memory.content
            for memory in self.list_memories(member_id)
            if memory.domain == domain or memory.domain == MemoryDomain.general
        ][:3]
        member = self.members.get(member_id) if member_id is not None else None
        name = member.name if member else "全家"

        templates = {
            RecommendationDomain.dressing: f"{name} 今日建议穿长袖加薄外套，早晚注意保暖。",
            RecommendationDomain.diet: f"{name} 今日饮食以清淡少油为主，避开已知忌口和过敏源。",
            RecommendationDomain.exercise: f"{name} 今日适合低到中等强度活动，优先散步和拉伸。",
        }
        return Recommendation(domain=domain, content=templates[domain], basis=related)

    def make_recommendations(
        self,
        domains: list[RecommendationDomain],
        member_id: int | None,
    ) -> RecommendationBatch:
        return RecommendationBatch(
            recommendations=[self.make_recommendation(domain, member_id) for domain in domains]
        )

    def record_feedback(self, payload: RecommendationFeedback) -> Memory:
        domain_map = {
            RecommendationDomain.dressing: MemoryDomain.dressing,
            RecommendationDomain.diet: MemoryDomain.diet,
            RecommendationDomain.exercise: MemoryDomain.exercise,
        }
        verdict = "采纳" if payload.accepted else "不合适"
        content = f"用户反馈「{verdict}」：{payload.content}"
        self._memory_id += 1
        memory = Memory(
            id=self._memory_id,
            member_id=payload.member_id,
            type=MemoryType.episode,
            domain=domain_map[payload.domain],
            content=content,
            confidence=0.84,
            expires_at=default_expires_at(MemoryType.episode),
            created_at=now(),
        )
        self.memories[memory.id] = memory
        return memory

    def create_pairing_token(self, member_id: int, server_url: str) -> PairingToken | None:
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
        access_token = token_urlsafe(32)
        session = MemberSession(
            member_id=member.id,
            member_name=member.name,
            access_token=access_token,
        )
        self.member_sessions[sha256(access_token.encode("utf-8")).hexdigest()] = session
        return session

    def validate_member_token(self, access_token: str) -> MemberSession | None:
        return self.member_sessions.get(sha256(access_token.encode("utf-8")).hexdigest())

    def get_settings(self) -> SystemSettings:
        return self.settings

    def update_settings(self, payload: SystemSettings) -> SystemSettings:
        self.settings = payload
        return self.settings

    def cleanup_expired_memories(self) -> int:
        expired_ids = [
            memory_id
            for memory_id, memory in self.memories.items()
            if memory.expires_at is not None and memory.expires_at <= now()
        ]
        for memory_id in expired_ids:
            self.memories.pop(memory_id, None)
        return len(expired_ids)


store = InMemoryStore()
