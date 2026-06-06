import base64
import json
from hashlib import sha256
from hmac import compare_digest, new as hmac_new
from secrets import token_urlsafe
from time import time

from .core.config import settings


def create_member_token(member_id: int, device_name: str) -> str:
    issued_at = int(time())
    payload = {
        "sub": str(member_id),
        "member_id": member_id,
        "device": device_name[:160],
        "iat": issued_at,
        "jti": token_urlsafe(16),
    }
    header = {"alg": "HS256", "typ": "JWT"}
    signing_input = f"{_b64_json(header)}.{_b64_json(payload)}"
    signature = _b64_bytes(hmac_new(settings.admin_token_secret.encode("utf-8"), signing_input.encode("utf-8"), sha256).digest())
    return f"{signing_input}.{signature}"


def decode_member_token(token: str) -> dict | None:
    parts = token.split(".")
    if len(parts) != 3:
        return None
    signing_input = ".".join(parts[:2])
    expected = _b64_bytes(hmac_new(settings.admin_token_secret.encode("utf-8"), signing_input.encode("utf-8"), sha256).digest())
    if not compare_digest(expected, parts[2]):
        return None
    try:
        payload = json.loads(_b64_decode(parts[1]).decode("utf-8"))
    except (ValueError, json.JSONDecodeError):
        return None
    if not isinstance(payload.get("member_id"), int) or not payload.get("jti") or not payload.get("device"):
        return None
    return payload


def _b64_json(payload: dict) -> str:
    return _b64_bytes(json.dumps(payload, separators=(",", ":"), ensure_ascii=False).encode("utf-8"))


def _b64_bytes(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("ascii")


def _b64_decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode((value + padding).encode("ascii"))
