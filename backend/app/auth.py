from dataclasses import dataclass

from fastapi import Depends, Header, HTTPException

from .data import DataStore, get_data_store


@dataclass(frozen=True)
class RequestContext:
    member_id: int | None = None

    @property
    def is_member(self) -> bool:
        return self.member_id is not None


async def get_request_context(
    authorization: str | None = Header(default=None),
    data: DataStore = Depends(get_data_store),
) -> RequestContext:
    if not authorization:
        return RequestContext()

    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(status_code=401, detail="Invalid authorization header")

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
