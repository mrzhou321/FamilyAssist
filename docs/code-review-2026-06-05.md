# FamilyAssister Frontend Review Status

Review date: 2026-06-05
Status updated: 2026-06-06

This file keeps the original frontend review as a status ledger. The early MVP findings have been re-checked against the current codebase so the document does not keep advertising stale P0 risks.

## Closed Findings

| Original finding | Current evidence |
| --- | --- |
| Mobile pages used hard-coded `member_id=1` | Mobile pages read the paired member from `frontend/src/mobile/session/index.ts`; self-check covers member scoping and forbidden cross-member access. |
| Mock data was embedded directly in pages | Shared mocks live in `frontend/src/shared/mocks/index.ts`; mobile pages gate fallback data behind pairing/offline states. |
| SSE errors were swallowed | `frontend/src/shared/api/index.ts` exposes stream errors through `onError` and checks missing response bodies. |
| Auth keys were raw localStorage strings | Auth storage keys are centralized in `frontend/src/shared/constants/index.ts`; self-check rejects raw auth key literals. |
| Repeated domain strings and labels | Domain constants, labels, and icons are centralized in `frontend/src/shared/constants/index.ts`. |
| QuickNote did not use React Query mutation | Quick note submission uses `useCreateNote`; offline queueing avoids 401/403 auth failures. |
| TodayAdvice made separate recommendation requests | Mobile advice uses the batch `/api/recommendations` endpoint, then streams per-domain content. |
| Offline queue did not auto-sync on `online` | `QuickNote.tsx` listens for `online` and triggers queued note sync; failed items stay queued while later notes continue. |
| PWA shell was missing | Manifest, service worker shell cache, install prompt, and update refresh are wired and checked by `scripts/self-check.ps1`. |

## Remaining Intentional Tradeoffs

- Tokens still use browser storage. This is acceptable for the current self-hosted LAN target, with admin token TTL, member session revocation, and automatic 401 cleanup in place. A future hardened deployment can move to HttpOnly cookies or a refresh-token flow.
- Voice recognition still needs real Android/iOS browser testing because Web Speech support is device/browser-specific.
- The PWA uses a checked-in service worker rather than `vite-plugin-pwa`; this keeps the current deployment simple and is covered by self-check.

## Current Verification

Run the full gate before treating the review as current:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\self-check.ps1
```

The active implementation audit lives in `docs/PRD_IMPLEMENTATION_AUDIT.md`.
