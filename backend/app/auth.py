from dataclasses import dataclass
from hashlib import sha256
from hmac import compare_digest, new as hmac_new
from secrets import token_urlsafe
from time import time

from fastapi import Depends, Header, HTTPException

from .core.config import settings
from .data import DataStore, get_data_store


@dataclass(frozen=True)
class RequestContext:
    member_id: int | None = None
    is_admin: bool = False

    @property
    def is_member(self) -> bool:
        return self.member_id is not None


async def get_request_context(
    authorization: str | None = Header(default=None),
    data: DataStore = Depends(get_data_store),
) -> RequestContext:
    if not authorization:
        raise HTTPException(status_code=401, detail="Login required")

    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(status_code=401, detail="Invalid authorization header")

    if is_valid_admin_token(token):
        return RequestContext(is_admin=True)

    session = await data.validate_member_token(token)
    if session is None:
        raise HTTPException(status_code=401, detail="Invalid or revoked member token")
    return RequestContext(member_id=session.member_id)


def scoped_member_id(requested_member_id: int | None, context: RequestContext) -> int | None:
    if not context.is_member:
        return requested_member_id
    if requested_member_id is None or requested_member_id == context.member_id:
        return context.member_id
    raise HTTPException(status_code=403, detail="Member token cannot access another member")


def assert_member_payload(member_id: int | None, context: RequestContext) -> None:
    if not context.is_member:
        return
    if member_id is not None and member_id != context.member_id:
        raise HTTPException(status_code=403, detail="Member token cannot write another member")


def create_admin_token() -> str:
    issued_at = str(int(time()))
    nonce = token_urlsafe(16)
    payload = f"admin:{issued_at}:{nonce}"
    signature = hmac_new(settings.admin_token_secret.encode("utf-8"), payload.encode("utf-8"), sha256).hexdigest()
    return f"{payload}:{signature}"


def is_valid_admin_token(token: str) -> bool:
    parts = token.split(":")
    if len(parts) != 4 or parts[0] != "admin":
        return False
    payload = ":".join(parts[:3])
    expected = hmac_new(settings.admin_token_secret.encode("utf-8"), payload.encode("utf-8"), sha256).hexdigest()
    return compare_digest(expected, parts[3])


async def require_admin(authorization: str | None = Header(default=None)) -> None:
    if not authorization:
        raise HTTPException(status_code=401, detail="Admin login required")
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token or not is_valid_admin_token(token):
        raise HTTPException(status_code=401, detail="Invalid admin token")


def verify_admin_credentials(username: str, password: str) -> bool:
    return compare_digest(username, settings.admin_username) and compare_digest(password, settings.admin_password)
