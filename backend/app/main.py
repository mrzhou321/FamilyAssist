from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from .schemas import (
    HealthStatus,
    Member,
    MemberCreate,
    MemberUpdate,
    Memory,
    MemoryDraft,
    MemoryUpdate,
    Note,
    NoteCreate,
    Recommendation,
    RecommendationDomain,
    ReviewCandidate,
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


@app.get("/api/notes", response_model=list[Note])
async def list_notes() -> list[Note]:
    return store.list_notes()


@app.get("/api/review/notes/{note_id}", response_model=ReviewCandidate)
async def get_review_candidate(note_id: int) -> ReviewCandidate:
    candidate = store.build_review_candidate(note_id)
    if candidate is None:
      raise HTTPException(status_code=404, detail="Note not found")
    return candidate


@app.post("/api/review/notes/{note_id}/approve", response_model=Memory)
async def approve_review_candidate(note_id: int, payload: MemoryDraft) -> Memory:
    memory = store.approve_review_candidate(note_id, payload)
    if memory is None:
        raise HTTPException(status_code=404, detail="Note not found")
    return memory


@app.get("/api/memories", response_model=list[Memory])
async def list_memories(member_id: int | None = Query(default=None)) -> list[Memory]:
    return store.list_memories(member_id)


@app.patch("/api/memories/{memory_id}", response_model=Memory)
async def update_memory(memory_id: int, payload: MemoryUpdate) -> Memory:
    memory = store.update_memory(memory_id, payload)
    if memory is None:
        raise HTTPException(status_code=404, detail="Memory not found")
    return memory


@app.delete("/api/memories/{memory_id}", status_code=204)
async def delete_memory(memory_id: int) -> None:
    if not store.delete_memory(memory_id):
        raise HTTPException(status_code=404, detail="Memory not found")


@app.get("/api/recommendations/{domain}", response_model=Recommendation)
async def get_recommendation(
    domain: RecommendationDomain,
    member_id: int | None = Query(default=None),
) -> Recommendation:
    return store.make_recommendation(domain, member_id)
