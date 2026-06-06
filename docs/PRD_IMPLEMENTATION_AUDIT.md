# FamilyAssister PRD Implementation Audit

Last updated: 2026-06-06

This audit maps PRD v1.0 requirements to current implementation evidence. It is a working checklist, not a final product sign-off.

## Evidence Gates

- Full regression gate: `powershell -ExecutionPolicy Bypass -File scripts\self-check.ps1`
- Optional deployment smoke: `powershell -ExecutionPolicy Bypass -File scripts\deploy-smoke.ps1`
- Manual acceptance checklist: `docs\MANUAL_ACCEPTANCE.md`
- Deployment entrypoint: `README.md`, `docker-compose.yml`
- Backend API: `backend/app/main.py`
- Data stores: `backend/app/data.py`, `backend/app/store.py`
- Frontend admin: `frontend/src/admin/pages/*`
- Frontend mobile PWA: `frontend/src/mobile/pages/*`, `frontend/src/mobile/offline/*`

## PRD Coverage

| PRD area | Current evidence | Status |
| --- | --- | --- |
| Text quick notes | Mobile quick-note page posts `/api/notes`; backend returns `202` and starts `BackgroundTasks`. Self-check verifies async note extraction and `<300ms` submission. | Covered |
| Voice quick notes | `QuickNote.tsx` uses `SpeechRecognition` / `webkitSpeechRecognition` and appends transcript as `source: "voice"`. | Covered by code wiring; device/browser compatibility still needs manual mobile testing |
| Photo quick notes | `QuickNote.tsx` uses `input accept="image/*" capture="environment"` and records photo metadata in note text. | Covered for capture metadata; no OCR or binary archive by PRD scope |
| Offline quick notes | IndexedDB queue in `noteQueue.ts`; online listener syncs queued notes; failed items remain queued while later items continue. Self-check covers cache and queue wiring. | Covered |
| LLM extraction | `llm_extractor.py` calls Ollama JSON schema or cloud OpenAI-compatible providers, validates with Pydantic, retries, and falls back to manual-review candidate only for review UI. | Covered, but implementation uses Ollama JSON schema rather than literal GBNF |
| Failed extraction handoff | `DatabaseDataStore.extract_memory_from_note` uses `build_extracted_candidate`; when extraction fails, note remains `understanding`. Self-check covers this handoff. | Covered |
| Memory metadata | `Memory` has `source_note_id`, `confidence`, `expires_at`, `domain`, embedding. Admin memory library shows source and expiry and can edit expiry. | Covered |
| Memory CRUD and review | Admin review page approves/rejects candidates; memory library filters by member/domain/type and edits/deletes memories. | Covered |
| Semantic dedupe | Backend uses deterministic and embedding similarity dedupe with configurable threshold; self-check covers alias and semantic duplicate behavior. | Covered |
| Expired episode filtering | Memory list and vector recommendation paths filter expired memories; cleanup action is exposed in settings. | Covered |
| Three-domain advice | Backend supports dressing/diet/exercise recommendation batch and domain endpoints; mobile renders all three. | Covered |
| Weather context | QWeather adapter with local estimate fallback; provider status shows weather source. | Covered |
| SSE streaming | `/api/recommendations/{domain}/stream` streams chunks; mobile updates content as chunks arrive. Self-check covers first token under 5s. | Covered |
| Traceable recommendation basis | Recommendations include `basis_refs` with `memory_id` and `source_note_id`; mobile can open the original note. | Covered |
| Feedback learning | Feedback endpoint creates episode memory with accepted/rejected text and weather context; self-check covers write-back. | Covered |
| Member management | Admin members page creates, edits, deletes members and all PRD health profile fields. | Covered |
| Pairing QR login | Admin creates 5-minute one-time hashed token and QR; mobile scans with `BarcodeDetector` or manual token; JWT is member/device-bound and revocable. | Covered |
| Member data isolation | Backend scopes member routes by JWT payload; self-check covers forbidden cross-member access and revoked sessions. | Covered |
| Settings | Admin settings configure LLM provider, generation/embedding models, weather key/city, extraction retries, dedupe threshold, cleanup, embedding rebuild, and provider diagnostics. Secrets are masked on API reads. | Covered |
| PWA install/offline shell | Manifest, service worker shell cache, install prompt, and update refresh are wired. | Covered |
| Deployment | `docker-compose.yml` defines postgres, ollama, model bootstrap, backend, nginx. README documents startup and database backup/restore. | Covered |
| Performance smoke | Self-check covers quick-note submit `<300ms`, memory retrieval `<500ms`, and recommendation first token `<5s` under local smoke conditions. | Covered as smoke test, not a production benchmark |

## Residual Risks

- Literal GBNF is not implemented; Ollama JSON schema constrained generation plus Pydantic validation is the current guardrail.
- Voice recognition support still depends on real mobile browser Web Speech behavior and should be manually tested on target Android/iOS browsers using `docs\MANUAL_ACCEPTANCE.md`.
- Full `docker compose up` with model pulls is heavier than the default self-check. Use `scripts\deploy-smoke.ps1`; use `-SkipModelPull` for a faster container-build smoke.
- LLM extraction quality target `>=80%` is inherently subjective; current automation checks representative scenarios and fallback behavior, and `docs\MANUAL_ACCEPTANCE.md` defines the manual sampling protocol.
- Photo support captures metadata and user description, not image OCR or long-term binary storage.
