from collections.abc import AsyncIterator
import json

import httpx

from .schemas import Recommendation, SystemSettings


PROVIDER_DEFAULTS = {
    "deepseek": {
        "base_url": "https://api.deepseek.com",
        "model": "deepseek-v4-flash",
    },
    "qwen": {
        "base_url": "https://dashscope.aliyuncs.com/compatible-mode/v1",
        "model": "qwen-plus",
    },
}

STREAM_TIMEOUT = httpx.Timeout(connect=2.0, read=4.0, write=5.0, pool=5.0)


def provider_base_url(system_settings: SystemSettings) -> str:
    return (
        system_settings.cloud_llm_base_url.strip().rstrip("/")
        or PROVIDER_DEFAULTS.get(system_settings.llm_provider, {}).get("base_url", "")
    )


def provider_model(system_settings: SystemSettings) -> str:
    return (
        system_settings.cloud_generation_model.strip()
        or PROVIDER_DEFAULTS.get(system_settings.llm_provider, {}).get("model", "")
    )


def is_cloud_provider_configured(system_settings: SystemSettings) -> bool:
    return bool(
        system_settings.llm_provider in PROVIDER_DEFAULTS
        and system_settings.cloud_llm_risk_acknowledged
        and system_settings.cloud_llm_api_key.strip()
        and provider_base_url(system_settings)
        and provider_model(system_settings)
    )


async def create_chat_completion(
    system_settings: SystemSettings,
    messages: list[dict[str, str]],
    *,
    response_format: dict[str, str] | None = None,
    temperature: float = 0.2,
) -> str:
    response = await _post_chat_completion(
        system_settings,
        {
            "model": provider_model(system_settings),
            "messages": messages,
            "stream": False,
            "temperature": temperature,
            **({"response_format": response_format} if response_format else {}),
        },
        timeout=30.0,
    )
    return _extract_message_content(response.json())


async def stream_chat_completion(
    system_settings: SystemSettings,
    messages: list[dict[str, str]],
    *,
    temperature: float = 0.3,
) -> AsyncIterator[str]:
    headers = _headers(system_settings)
    async with httpx.AsyncClient(base_url=provider_base_url(system_settings), timeout=STREAM_TIMEOUT) as client:
        async with client.stream(
            "POST",
            "/chat/completions",
            json={
                "model": provider_model(system_settings),
                "messages": messages,
                "stream": True,
                "temperature": temperature,
            },
            headers=headers,
        ) as response:
            response.raise_for_status()
            async for line in response.aiter_lines():
                if not line or not line.startswith("data: "):
                    continue
                payload = line.removeprefix("data: ").strip()
                if payload == "[DONE]":
                    break
                chunk = _extract_stream_delta(json.loads(payload))
                if chunk:
                    yield chunk


async def check_cloud_chat(system_settings: SystemSettings) -> bool:
    content = await create_chat_completion(
        system_settings,
        [
            {"role": "system", "content": "Reply with JSON only."},
            {"role": "user", "content": "Return JSON: {\"ok\": true}"},
        ],
        response_format={"type": "json_object"},
        temperature=0,
    )
    return bool(content)


async def _post_chat_completion(
    system_settings: SystemSettings,
    payload: dict,
    *,
    timeout: float | None,
) -> httpx.Response:
    async with httpx.AsyncClient(base_url=provider_base_url(system_settings), timeout=timeout) as client:
        response = await client.post("/chat/completions", json=payload, headers=_headers(system_settings))
        response.raise_for_status()
        return response


def _headers(system_settings: SystemSettings) -> dict[str, str]:
    return {
        "Authorization": f"Bearer {system_settings.cloud_llm_api_key.strip()}",
        "Content-Type": "application/json",
    }


def _extract_message_content(payload: dict) -> str:
    choices = payload.get("choices", [])
    if not choices:
        raise ValueError("missing chat completion choices")
    message = choices[0].get("message", {})
    content = message.get("content")
    if not isinstance(content, str):
        raise ValueError("missing chat completion content")
    return content


def _extract_stream_delta(payload: dict) -> str:
    choices = payload.get("choices", [])
    if not choices:
        return ""
    delta = choices[0].get("delta", {})
    content = delta.get("content")
    return content if isinstance(content, str) else ""
