from hashlib import blake2b
from math import sqrt

import httpx

from .core.config import settings


EMBEDDING_DIMENSION = 512
DEFAULT_EMBEDDING_MODEL = "qllama/bge-small-zh-v1.5"


def build_text_embedding(text: str, dimensions: int = EMBEDDING_DIMENSION) -> list[float]:
    """Build a deterministic local embedding fallback with stable dimensions."""
    vector = [0.0] * dimensions
    normalized = " ".join(text.lower().split())
    if not normalized:
        return vector

    for index, char in enumerate(normalized):
        digest = blake2b(f"{index}:{char}".encode("utf-8"), digest_size=8).digest()
        bucket = int.from_bytes(digest[:4], "big") % dimensions
        sign = 1.0 if digest[4] % 2 == 0 else -1.0
        vector[bucket] += sign

    magnitude = sqrt(sum(value * value for value in vector))
    if magnitude == 0:
        return vector
    return [round(value / magnitude, 6) for value in vector]


async def build_text_embedding_async(
    text: str,
    model: str = DEFAULT_EMBEDDING_MODEL,
    dimensions: int = EMBEDDING_DIMENSION,
) -> list[float]:
    normalized = " ".join(text.split())
    if not normalized:
        return [0.0] * dimensions
    try:
        return await build_ollama_text_embedding(normalized, model, dimensions)
    except (httpx.HTTPError, KeyError, TypeError, ValueError):
        return build_text_embedding(normalized, dimensions)


async def build_ollama_text_embedding(
    text: str,
    model: str = DEFAULT_EMBEDDING_MODEL,
    dimensions: int = EMBEDDING_DIMENSION,
) -> list[float]:
    async with httpx.AsyncClient(base_url=settings.ollama_base_url, timeout=20.0) as client:
        response = await client.post(
            "/api/embed",
            json={"model": model, "input": text, "dimensions": dimensions},
        )
        response.raise_for_status()
    data = response.json()
    raw_embedding = data.get("embeddings", data.get("embedding"))
    if isinstance(raw_embedding, list) and raw_embedding and isinstance(raw_embedding[0], list):
        raw_embedding = raw_embedding[0]
    return normalize_embedding(raw_embedding, dimensions)


async def check_ollama_embedding_model(model: str, dimensions: int = EMBEDDING_DIMENSION) -> bool:
    vector = await build_ollama_text_embedding("embedding provider health check", model, dimensions)
    return len(vector) == dimensions


def normalize_embedding(values: object, dimensions: int = EMBEDDING_DIMENSION) -> list[float]:
    if not isinstance(values, list) or len(values) != dimensions:
        raise ValueError("embedding dimension mismatch")
    vector = [float(value) for value in values]
    magnitude = sqrt(sum(value * value for value in vector))
    if magnitude == 0:
        raise ValueError("empty embedding")
    return [round(value / magnitude, 6) for value in vector]


def cosine_similarity(left: list[float], right: list[float]) -> float:
    if not left or not right or len(left) != len(right):
        return 0.0
    left_norm = sqrt(sum(value * value for value in left))
    right_norm = sqrt(sum(value * value for value in right))
    if left_norm == 0 or right_norm == 0:
        return 0.0
    return sum(a * b for a, b in zip(left, right, strict=True)) / (left_norm * right_norm)
