from hashlib import blake2b
from math import sqrt


EMBEDDING_DIMENSION = 512


def build_text_embedding(text: str, dimensions: int = EMBEDDING_DIMENSION) -> list[float]:
    """Build a deterministic local embedding placeholder with stable dimensions."""
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


def cosine_similarity(left: list[float], right: list[float]) -> float:
    if not left or not right or len(left) != len(right):
        return 0.0
    left_norm = sqrt(sum(value * value for value in left))
    right_norm = sqrt(sum(value * value for value in right))
    if left_norm == 0 or right_norm == 0:
        return 0.0
    return sum(a * b for a, b in zip(left, right, strict=True)) / (left_norm * right_norm)
