# FamilyAssister

Public GitHub: [https://github.com/mrzhou321/FamilyAssist](https://github.com/mrzhou321/FamilyAssist)

## 这是什么

FamilyAssister 是一个面向家庭照护场景的自托管 AI 助手：家人随手记录饮食忌口、过敏、冷热偏好、近期不适和运动习惯，系统把碎片速记沉淀成可追溯的家庭记忆，再结合天气生成穿衣、饮食、运动三类个性化建议。

核心目标很朴素：让照顾家人的经验不再只靠一个人记在脑子里，而是变成全家可持续积累、可审核、可解释、越用越懂家的记忆系统。

## 怎么跑

1. Clone 仓库：

```powershell
git clone https://github.com/mrzhou321/FamilyAssist.git
cd FamilyAssist
```

2. 配置本地部署密钥：

```powershell
Copy-Item .env.example .env
```

打开 `.env`，至少修改：

```env
POSTGRES_PASSWORD=change-this-postgres-password
ADMIN_PASSWORD=change-this-admin-password
ADMIN_TOKEN_SECRET=change-this-long-random-token-secret
```

3. 启动完整自托管服务：

```powershell
docker compose up --build
```

首次启动会拉取 Postgres、Ollama、后端和前端镜像，并由 `ollama-models` 服务拉取默认生成模型与向量模型。模型下载较慢是正常现象。

4. 打开应用：

- Mobile PWA: `http://localhost/mobile/`
- Admin console: `http://localhost/admin/`
- Backend health: `http://localhost:8000/health`

本地 compose 未设置 `.env` 时的默认管理员账号是 `admin` / `family-admin`，真实使用前务必改掉。

## 用了什么

- LLM: 默认本地 Ollama `qwen2.5:3b`，也可在设置页切换到 DeepSeek / 通义千问等 OpenAI-compatible 云端 Provider。
- Embedding: 默认 `qllama/bge-small-zh-v1.5`，记忆向量维度 512。
- Backend: FastAPI + SQLAlchemy async + Alembic。
- Database: PostgreSQL + pgvector，HNSW 向量索引。
- Frontend: React + Vite + PWA，分为 `/mobile/` 家人端和 `/admin/` 管理端。
- Deployment: Docker Compose，包括 postgres、ollama、模型 bootstrap、backend、nginx。

主要功能：

- 文本、语音、拍照速记，移动端 PWA 可离线暂存并联网同步。
- LLM 结构化抽取家庭记忆，Pydantic 校验，失败后进入人工审核。
- 记忆库支持成员、领域、类型筛选，包含来源速记、置信度、过期时间。
- 语义去重，避免“讨厌香菜 / 不吃香菜”一类重复事实污染记忆。
- 天气上下文 + 家庭记忆生成穿衣、饮食、运动三域建议。
- SSE 流式建议展示，并显示可点击的依据来源。
- 采纳 / 不合适反馈回写 episode 记忆，形成学习闭环。
- 管理端成员档案、配对二维码、设备会话撤销、Provider 设置和验收证据导出。

## 自测与验收

完整回归自检：

```powershell
powershell -ExecutionPolicy Bypass -File scripts\self-check.ps1
```

该脚本会先检查 `backend\.venv\Scripts\python.exe` 是否能导入 Python 标准库；如果提示 `encodings` 缺失，请安装完整 Python 3.11+ 并重新创建 `backend\.venv` 后再跑。
也可以临时指定解释器：`$env:FA_BACKEND_PYTHON="C:\Path\To\python.exe"`。

移动端 PWA 视口烟测。脚本会构建前端，用接近 nginx fallback 的临时静态服务承载产物，并用真实 headless Chrome/Edge 手机视口检查 `/mobile/`、`/mobile/pair`、`/mobile/advice`、`/mobile/memory`：

```powershell
powershell -ExecutionPolicy Bypass -File scripts\mobile-viewport-smoke.ps1
```

LLM 抽取质量基线。默认 deterministic 模式会跑 20 条代表性速记样本，并按 PRD `>=80%` 目标判定：

```powershell
powershell -ExecutionPolicy Bypass -File scripts\llm-quality-sample.ps1
```

使用真实 Provider 抽样并保存 JSON 证据：

```powershell
powershell -ExecutionPolicy Bypass -File scripts\llm-quality-sample.ps1 -Mode provider -OutputPath docs\llm-quality-provider-sample.json
```

云端 Provider 会发送速记文本到第三方 API。使用 `-Provider deepseek` 或 `-Provider qwen` 时，请先在设置页确认数据出境风险，再加 `-AllowCloud`。

Docker Compose 烟测：

```powershell
powershell -ExecutionPolicy Bypass -File scripts\deploy-smoke.ps1
```

更快的容器构建烟测，跳过 Ollama 模型拉取：

```powershell
powershell -ExecutionPolicy Bypass -File scripts\deploy-smoke.ps1 -SkipModelPull
```

无 Docker daemon 的 CI 环境可以显式跳过这项外部烟测：

```powershell
powershell -ExecutionPolicy Bypass -File scripts\deploy-smoke.ps1 -SkipModelPull -SkipIfDockerUnavailable
```

Android/iOS 真机权限仍需人工验收：语音输入、相机捕获、二维码扫描的浏览器权限弹窗无法完全由桌面自动化证明。请按 `docs\MANUAL_ACCEPTANCE.md` 操作，并在 `/admin/settings` 导出验收 JSON 证据。

## 数据与备份

PostgreSQL 数据存放在 Docker named volume `postgres_data`，Ollama 模型存放在 `ollama_data`。项目不提供云备份，升级、迁移或破坏性维护前请自行备份数据库。

创建备份：

```powershell
docker compose exec -T postgres pg_dump -U family -d family_assister -Fc > family_assister.dump
```

恢复到新的数据库卷：

```powershell
docker compose down
docker volume rm familyassister_postgres_data
docker compose up -d postgres
Get-Content .\family_assister.dump -AsByteStream | docker compose exec -T postgres pg_restore -U family -d family_assister --clean --if-exists
docker compose up -d
```

如果 Compose project name 不同，先确认实际 volume 名称：

```powershell
docker volume ls
```

## 为什么值得看

这个项目不是一个“聊天窗口套壳”，而是把家庭照护里最容易丢失的经验做成了完整闭环：低成本采集、结构化记忆、可解释推荐、反馈学习、成员隔离、自托管部署和可复跑验收。它更像一个给家庭长期使用的小型记忆基础设施。
