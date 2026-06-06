from .embeddings import cosine_similarity
from .schemas import MemoryDomain, MemoryDraft, MemoryType, ReviewCandidate


NEGATIVE_PREFERENCE_WORDS = (
    "\u4e0d\u7231",
    "\u4e0d\u559c\u6b22",
    "\u4e0d\u559c",
    "\u4e0d\u5403",
    "\u5fcc\u53e3",
    "\u8ba8\u538c",
)

PUNCTUATION_TRANSLATION = str.maketrans(
    "",
    "",
    " \t\r\n"
    "\uff0c\u3002\uff01\uff1f\uff1b\uff1a\u3001"
    ",.!?;:"
    "\uff08\uff09()\u3010\u3011[]"
    "\u201c\u201d\"'",
)

FOOD_ALIASES = {
    "\u9999\u83dc": (
        "\u9999\u83dc",
        "\u82ab\u837d",
        "\u80e1\u837d",
        "\u76d0\u837d",
    ),
}

EXERCISE_KEYWORDS = (
    "\u8d70",
    "\u8dd1",
    "\u8fd0\u52a8",
    "\u819d\u76d6",
    "\u6563\u6b65",
)
DRESSING_KEYWORDS = (
    "\u51b7",
    "\u70ed",
    "\u7a7f",
    "\u5916\u5957",
    "\u4fdd\u6696",
)
DIET_KEYWORDS = (
    "\u5403",
    "\u996d",
    "\u7cd6",
    "\u9999\u83dc",
    "\u82ab\u837d",
    "\u8fc7\u654f",
    "\u6c64",
)
FACT_KEYWORDS = (
    "\u559c\u6b22",
    "\u4e0d\u7231",
    "\u4e0d\u559c\u6b22",
    "\u4e0d\u5403",
    "\u5fcc\u53e3",
    "\u8ba8\u538c",
    "\u8fc7\u654f",
    "\u6015",
)


def memory_dedupe_key(content: str, memory_type: MemoryType, domain: MemoryDomain) -> str:
    normalized = content.translate(PUNCTUATION_TRANSLATION).lower()
    if memory_type == MemoryType.fact and domain == MemoryDomain.diet:
        for canonical, aliases in FOOD_ALIASES.items():
            if any(alias in normalized for alias in aliases) and any(word in normalized for word in NEGATIVE_PREFERENCE_WORDS):
                return f"diet:negative-preference:{canonical}"
    return normalized


def is_duplicate_memory(
    existing_content: str,
    draft_content: str,
    memory_type: MemoryType,
    domain: MemoryDomain,
) -> bool:
    return memory_dedupe_key(existing_content, memory_type, domain) == memory_dedupe_key(
        draft_content,
        memory_type,
        domain,
    )


def is_semantic_duplicate_memory(
    existing_content: str,
    draft_content: str,
    memory_type: MemoryType,
    domain: MemoryDomain,
    existing_embedding: list[float],
    draft_embedding: list[float],
    threshold: float,
) -> bool:
    if is_duplicate_memory(existing_content, draft_content, memory_type, domain):
        return True
    if not existing_embedding or not draft_embedding:
        return False
    return cosine_similarity(existing_embedding, draft_embedding) >= threshold


def build_review_candidate_from_text(
    note_id: int,
    member_id: int | None,
    content: str,
) -> ReviewCandidate:
    domain = MemoryDomain.general
    if any(keyword in content for keyword in EXERCISE_KEYWORDS):
        domain = MemoryDomain.exercise
    elif any(keyword in content for keyword in DRESSING_KEYWORDS):
        domain = MemoryDomain.dressing
    elif any(keyword in content for keyword in DIET_KEYWORDS):
        domain = MemoryDomain.diet

    memory_type = MemoryType.fact if any(keyword in content for keyword in FACT_KEYWORDS) else MemoryType.episode
    return ReviewCandidate(
        note_id=note_id,
        member_id=member_id,
        original=content,
        candidates=[MemoryDraft(type=memory_type, domain=domain, content=content, confidence=0.72)],
    )
