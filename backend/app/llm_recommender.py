from collections.abc import AsyncIterator
import json

import httpx

from .cloud_llm import is_cloud_provider_configured, stream_chat_completion
from .core.config import settings
from .schemas import Recommendation, SystemSettings


SYSTEM_PROMPT = (
    "You are FamilyAssister, a private family care assistant. "
    "Give concise Chinese daily advice. Do not provide diagnosis or medication advice. "
    "Use the supplied weather, profile and memory basis only."
)


async def stream_recommendation_content(
    recommendation: Recommendation,
    system_settings: SystemSettings,
) -> AsyncIterator[str]:
    if system_settings.llm_provider != "ollama":
        if is_cloud_provider_configured(system_settings):
            emitted = False
            try:
                async for chunk in _stream_cloud_content(recommendation, system_settings):
                    if chunk:
                        emitted = True
                        yield chunk
            except (httpx.HTTPError, KeyError, TypeError, ValueError, json.JSONDecodeError):
                emitted = False
            if emitted:
                return
        async for chunk in fallback_chunks(recommendation.content):
            yield chunk
        return

    emitted = False
    try:
        async for chunk in _stream_ollama_content(recommendation, system_settings):
            if chunk:
                emitted = True
                yield chunk
    except (httpx.HTTPError, KeyError, TypeError, ValueError, json.JSONDecodeError):
        emitted = False

    if not emitted:
        async for chunk in fallback_chunks(recommendation.content):
            yield chunk


async def _stream_ollama_content(
    recommendation: Recommendation,
    system_settings: SystemSettings,
) -> AsyncIterator[str]:
    async with httpx.AsyncClient(base_url=settings.ollama_base_url, timeout=None) as client:
        async with client.stream(
            "POST",
            "/api/generate",
            json={
                "model": system_settings.generation_model,
                "system": SYSTEM_PROMPT,
                "prompt": _build_prompt(recommendation),
                "stream": True,
                "options": {"temperature": 0.3},
            },
        ) as response:
            response.raise_for_status()
            async for line in response.aiter_lines():
                if not line:
                    continue
                payload = json.loads(line)
                chunk = payload.get("response", "")
                if chunk:
                    yield chunk
                if payload.get("done"):
                    break


async def _stream_cloud_content(
    recommendation: Recommendation,
    system_settings: SystemSettings,
) -> AsyncIterator[str]:
    async for chunk in stream_chat_completion(
        system_settings,
        [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": _build_prompt(recommendation)},
        ],
        temperature=0.3,
    ):
        yield chunk


async def fallback_chunks(text: str, size: int = 4) -> AsyncIterator[str]:
    for index in range(0, len(text), size):
        yield text[index : index + size]


def _build_prompt(recommendation: Recommendation) -> str:
    basis = "\n".join(f"- {item}" for item in recommendation.basis) or "- 暂无额外记忆依据"
    return (
        f"建议领域：{recommendation.domain.value}\n"
        f"已生成的安全基线建议：{recommendation.content}\n"
        f"可引用的家庭记忆依据：\n{basis}\n\n"
        "请输出一段 1-2 句中文建议，必须保留基线建议中的关键安全约束，"
        "并自然体现记忆依据。只输出正文。"
    )
