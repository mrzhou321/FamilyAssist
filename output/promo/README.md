# FamilyAssister Promo Video

Generated artifact:

- `familyassister-promo.webm` - 24s, 1920x1080, browser-recorded promo video.
- `familyassister-product-walkthrough.webm` - 28s, 1920x1080, product-focused walkthrough with more UI screens and less marketing copy.

Source scripts:

- `design/promo-video.html` - editable storyboard page.
- `scripts/render-promo-canvas-video.mjs` - renders the final WebM without ffmpeg.
- `scripts/render-product-walkthrough-video.mjs` - renders the product walkthrough WebM without ffmpeg.
- `scripts/render-promo-video.mjs` - Playwright video recorder path, requires Playwright ffmpeg.
- `scripts/capture-promo-frames.mjs` - captures still storyboard frames.

Core message:

1. FamilyAssister turns family care experience into an AI memory system.
2. It supports quick text, voice, photo notes, offline caching, and member isolation.
3. AI extracts structured, reviewable, traceable family memories.
4. Weather plus memories produce explainable dressing, diet, and exercise advice.
5. The stack is self-hosted by default: React PWA, FastAPI, PostgreSQL/pgvector, Ollama.

Regenerate:

```powershell
node scripts\render-promo-canvas-video.mjs
node scripts\render-product-walkthrough-video.mjs
```
