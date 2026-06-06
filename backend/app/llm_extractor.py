import json

import httpx
from pydantic import ValidationError

from .cloud_llm import create_chat_completion, is_cloud_provider_configured
from .core.config import settings
from .memory_dedupe import build_review_candidate_from_text
from .schemas import MemoryDraft, ReviewCandidate, SystemSettings

MEMORY_DRAFT_SCHEMA = MemoryDraft.model_json_schema()

EXTRACTION_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": ["candidates"],
    "properties": {
        "candidates": {
            "type": "array",
            "minItems": 1,
            "maxItems": 5,
            "items": MEMORY_DRAFT_SCHEMA,
        }
    },
}

SYSTEM_PROMPT = (
    "You extract structured family memory candidates from one quick note. "
    "Return only JSON: {\"candidates\":[{\"type\":\"fact|episode\","
    "\"domain\":\"dressing|diet|exercise|general\",\"content\":\"...\",\"confidence\":0.0-1.0}]}. "
    "Use Chinese content when the note is Chinese. Do not include medical diagnosis."
)


async def build_review_candidate(
    note_id: int,
    member_id: int | None,
    content: str,
    system_settings: SystemSettings,
) -> ReviewCandidate:
    candidate = await build_extracted_candidate(note_id, member_id, content, system_settings)
    if candidate is not None:
        return candidate
    return build_review_candidate_from_text(note_id, member_id, content)


async def build_extracted_candidate(
    note_id: int,
    member_id: int | None,
    content: str,
    system_settings: SystemSettings,
) -> ReviewCandidate | None:
    if system_settings.llm_provider == "ollama":
        for _ in range(max(1, system_settings.extraction_retries)):
            candidate = await _try_ollama_candidate(note_id, member_id, content, system_settings.generation_model)
            if candidate is not None:
                return candidate
        return None

    for _ in range(max(1, system_settings.extraction_retries)):
        candidate = await _try_cloud_candidate(note_id, member_id, content, system_settings)
        if candidate is not None:
            return candidate
    return None


async def _try_ollama_candidate(
    note_id: int,
    member_id: int | None,
    content: str,
    model: str,
) -> ReviewCandidate | None:
    try:
        async with httpx.AsyncClient(base_url=settings.ollama_base_url, timeout=20.0) as client:
            response = await client.post(
                "/api/generate",
                json={
                    "model": model,
                    "prompt": f"{SYSTEM_PROMPT}\nQuick note: {content}",
                    "format": EXTRACTION_SCHEMA,
                    "stream": False,
                },
            )
            response.raise_for_status()
        raw = response.json().get("response", "")
        data = json.loads(raw)
        drafts = [MemoryDraft.model_validate(item) for item in data.get("candidates", [])]
        if not drafts:
            return None
        return ReviewCandidate(note_id=note_id, member_id=member_id, original=content, candidates=drafts[:5])
    except (httpx.HTTPError, json.JSONDecodeError, TypeError, ValidationError, ValueError):
        return None


async def _try_cloud_candidate(
    note_id: int,
    member_id: int | None,
    content: str,
    system_settings: SystemSettings,
) -> ReviewCandidate | None:
    if not is_cloud_provider_configured(system_settings):
        return None
    try:
        raw = await create_chat_completion(
            system_settings,
            [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": f"Quick note: {content}"},
            ],
            response_format={"type": "json_object"},
            temperature=0.1,
        )
        data = json.loads(raw)
        drafts = [MemoryDraft.model_validate(item) for item in data.get("candidates", [])]
        if not drafts:
            return None
        return ReviewCandidate(note_id=note_id, member_id=member_id, original=content, candidates=drafts[:5])
    except (httpx.HTTPError, json.JSONDecodeError, TypeError, ValidationError, ValueError):
        return None
