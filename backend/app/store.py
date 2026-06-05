from datetime import UTC, datetime

from .schemas import (
    Member,
    MemberCreate,
    MemberProfile,
    MemberUpdate,
    Memory,
    MemoryDomain,
    MemoryType,
    Note,
    NoteCreate,
    Recommendation,
    RecommendationDomain,
)


def now() -> datetime:
    return datetime.now(UTC)


class InMemoryStore:
    def __init__(self) -> None:
        self._member_id = 2
        self._note_id = 0
        self._memory_id = 3
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
        return note

    def list_memories(self, member_id: int | None = None) -> list[Memory]:
        memories = list(self.memories.values())
        if member_id is not None:
            memories = [memory for memory in memories if memory.member_id == member_id]
        return memories

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


store = InMemoryStore()
