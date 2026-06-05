from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from .schemas import (
    HealthStatus,
    Member,
    MemberCreate,
    MemberUpdate,
    Memory,
    Note,
    NoteCreate,
    Recommendation,
    RecommendationDomain,
)
from .store import store

app = FastAPI(title="FamilyAssister API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", response_model=HealthStatus)
async def health() -> HealthStatus:
    return HealthStatus()


@app.get("/api/members", response_model=list[Member])
async def list_members() -> list[Member]:
    return store.list_members()


@app.post("/api/members", response_model=Member, status_code=201)
async def create_member(payload: MemberCreate) -> Member:
    return store.create_member(payload)


@app.patch("/api/members/{member_id}", response_model=Member)
async def update_member(member_id: int, payload: MemberUpdate) -> Member:
    member = store.update_member(member_id, payload)
    if member is None:
        raise HTTPException(status_code=404, detail="Member not found")
    return member


@app.delete("/api/members/{member_id}", status_code=204)
async def delete_member(member_id: int) -> None:
    if not store.delete_member(member_id):
        raise HTTPException(status_code=404, detail="Member not found")


@app.post("/api/notes", response_model=Note, status_code=202)
async def create_note(payload: NoteCreate) -> Note:
    return store.create_note(payload)


@app.get("/api/memories", response_model=list[Memory])
async def list_memories(member_id: int | None = Query(default=None)) -> list[Memory]:
    return store.list_memories(member_id)


@app.get("/api/recommendations/{domain}", response_model=Recommendation)
async def get_recommendation(
    domain: RecommendationDomain,
    member_id: int | None = Query(default=None),
) -> Recommendation:
    return store.make_recommendation(domain, member_id)
