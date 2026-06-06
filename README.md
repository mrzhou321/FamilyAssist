# FamilyAssister

FamilyAssister is a self-hosted family assistant for quick notes, structured family memories, daily advice, and mobile pairing.

## Run

For local development the compose file has safe-to-start defaults. Before using FamilyAssister for real family data, copy `.env.example` to `.env` and change at least `POSTGRES_PASSWORD`, `ADMIN_PASSWORD`, and `ADMIN_TOKEN_SECRET`.

```powershell
Copy-Item .env.example .env
docker compose up --build
```

Open:

- Mobile PWA: `http://localhost/mobile/`
- Admin console: `http://localhost/admin/`
- Backend health: `http://localhost:8000/health`

Default admin credentials in local compose are `admin` / `family-admin` only when `.env` is not set.

## Data

PostgreSQL data is stored in the Docker named volume `postgres_data`. Ollama models are stored in `ollama_data`.

The product does not provide cloud backup. Back up the database yourself before upgrades, machine migration, or destructive maintenance.

Create a backup:

```powershell
docker compose exec -T postgres pg_dump -U family -d family_assister -Fc > family_assister.dump
```

Restore a backup into a fresh database volume:

```powershell
docker compose down
docker volume rm familyassister_postgres_data
docker compose up -d postgres
Get-Content .\family_assister.dump -AsByteStream | docker compose exec -T postgres pg_restore -U family -d family_assister --clean --if-exists
docker compose up -d
```

If your Compose project name is different, confirm the volume name with:

```powershell
docker volume ls
```

## Self Check

```powershell
powershell -ExecutionPolicy Bypass -File scripts\self-check.ps1
```

Optional full Docker Compose smoke test:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\deploy-smoke.ps1
```

For a faster container-build smoke test that skips model pulls:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\deploy-smoke.ps1 -SkipModelPull
```

CI jobs without a Docker daemon can skip this optional smoke test cleanly:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\deploy-smoke.ps1 -SkipModelPull -SkipIfDockerUnavailable
```
