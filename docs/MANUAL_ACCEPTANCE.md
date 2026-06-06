# FamilyAssister Manual Acceptance Checklist

Use this checklist for PRD items that cannot be fully proven by local automated self-checks.

## Mobile Device Checks

- Open `http://<host>/mobile/` on a target Android browser and an iOS browser.
- Pair the device from `/admin/pairing`; confirm QR scanning fills the token and manual token entry also works.
- Add a text quick note and confirm it appears in recent notes.
- Use voice input on the quick-note page; confirm speech is transcribed into the note text and submits as a voice note.
- Use photo input on the quick-note page; confirm the camera/gallery opens, a preview appears, and photo metadata is appended to the note.
- Turn off network, add a quick note, restore network, and confirm the queued note syncs.

## Deployment Smoke

- Start Docker Desktop or the Docker service.
- Run `powershell -ExecutionPolicy Bypass -File scripts\deploy-smoke.ps1 -SkipModelPull`.
- For full deployment validation, run `powershell -ExecutionPolicy Bypass -File scripts\deploy-smoke.ps1` and allow model pulls to finish.
- Confirm `/mobile/`, `/admin/`, `/health`, and same-origin `/api` are reachable through nginx.

## LLM Quality Sampling

- Submit at least 20 representative quick notes across allergies, dislikes, thermal preference, injury, recent discomfort, diet, dressing, and exercise.
- In `/admin/review`, compare original notes with extracted candidates.
- Count a case as accepted when the candidate captures the correct member, domain, type, content, and confidence is plausible.
- Record the acceptance rate; PRD target is at least 80% on the sampled notes.
- For failed cases, confirm the note remains available for manual review or correction.

## Recommendation Sampling

- Generate all three advice domains for at least two members with different profiles.
- Confirm dressing advice reflects weather and thermal sensitivity.
- Confirm diet advice avoids known allergies and restrictions.
- Confirm exercise advice respects injury history and recent episode memories.
- Open each displayed basis item and confirm source-note tracing works when `source_note_id` exists.
- Submit accepted and rejected feedback and confirm new episode memories are created.
