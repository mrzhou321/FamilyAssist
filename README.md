# FamilyAssister 家暖

GitHub Public 链接：[https://github.com/mrzhou321/FamilyAssist](https://github.com/mrzhou321/FamilyAssist)

## 这是什么

FamilyAssister 家暖是一个面向家庭照护场景的自托管 AI 记忆助手。

家人可以随手记录饮食忌口、过敏、冷热偏好、近期不适、运动习惯等碎片信息；系统会把这些速记沉淀成可追溯的家庭记忆，再结合天气和成员档案，生成穿衣、饮食、运动三类个性化建议。

它的核心目标不是做一个聊天窗口，而是让“照顾家人的经验”变成全家可持续积累、可审核、可解释、越用越懂家的记忆系统。

## 视频介绍

- [产品功能走查视频](output/promo/familyassister-product-walkthrough.webm)：以页面和功能为主，介绍移动端速记、今日建议、记忆库、配对流程、后台审核和系统设置。
- [宣传短片](output/promo/familyassister-promo.webm)：偏展示向的 24 秒短片，可用于作品展示页。

## 怎么跑

1. Clone 仓库：

```powershell
git clone https://github.com/mrzhou321/FamilyAssist.git
cd FamilyAssist
```

2. 配置环境变量：

```powershell
Copy-Item .env.example .env
```

打开 `.env`，至少修改以下密钥：

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

- Mobile PWA：`http://localhost/mobile/`
- Admin console：`http://localhost/admin/`
- Backend health：`http://localhost:8000/health`

本地 compose 未设置 `.env` 时，默认管理员账号是 `admin` / `family-admin`，真实使用前务必改掉。

## 用了什么

- LLM：默认本地 Ollama `qwen2.5:3b`。
- Embedding：默认 `qllama/bge-small-zh-v1.5`，记忆向量维度 512。
- Backend：FastAPI + SQLAlchemy async + Alembic。
- Database：PostgreSQL + pgvector，使用 HNSW 向量索引。
- Frontend：React + Vite + PWA，分为 `/mobile/` 家人端和 `/admin/` 管理端。
- Deployment：Docker Compose，包括 postgres、ollama、模型 bootstrap、backend、nginx。

## 主要功能

- 文本、语音、拍照速记，移动端 PWA 可离线暂存并联网同步。
- LLM 结构化抽取家庭记忆，Pydantic 校验，失败后进入人工审核。
- 记忆库支持按成员、领域、类型筛选，包含来源速记、置信度和过期时间。
- 语义去重，避免“讨厌香菜 / 不吃香菜”一类重复事实污染记忆。
- 天气上下文 + 家庭记忆生成穿衣、饮食、运动三域建议。
- SSE 流式建议展示，并显示可点击的依据来源。
- 采纳 / 不合适反馈回写 episode 记忆，形成学习闭环。
- 管理端支持成员档案、配对二维码、设备会话撤销、Provider 设置和验收证据导出。

## 产品特色

1. **不是聊天记录，而是家庭记忆库**
   每条记忆都有领域、类型、置信度、来源 note 和过期时间，方便长期维护。

2. **建议可解释**
   穿衣、饮食、运动建议会显示依据，能追溯到原始速记或种子记忆。

3. **适合家庭照护的低成本输入**
   家人不用填写复杂表单，一句话、一次语音或一张照片就能记录。

4. **默认自托管**
   家庭速记、健康档案和记忆库默认存储在自己的 PostgreSQL 中。

5. **有人工审核入口**
   LLM 抽取结果不会直接变成不可控黑盒，管理员可以审核、编辑、删除。

## 自测与验收

完整回归自检：

```powershell
powershell -ExecutionPolicy Bypass -File scripts\self-check.ps1
```

移动端 PWA 视口烟测，`scripts\mobile-viewport-smoke.ps1` 会用真实 headless Chrome/Edge 手机视口检查关键页面：

```powershell
powershell -ExecutionPolicy Bypass -File scripts\mobile-viewport-smoke.ps1
```

LLM 抽取质量基线，默认 deterministic 模式会跑 20 条代表性速记样本：

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

慢网络或仅验证项目容器链路时，可先跳过 Ollama 模型拉取：

```powershell
powershell -ExecutionPolicy Bypass -File scripts\deploy-smoke.ps1 -SkipModelPull
```

无 Docker daemon 的 CI 环境可以显式跳过这项外部烟测：

```powershell
powershell -ExecutionPolicy Bypass -File scripts\deploy-smoke.ps1 -SkipModelPull -SkipIfDockerUnavailable
```

完整烟测会先从 Docker Hub 拉取 `ollama/ollama` 镜像，再由 `ollama-models` 拉取默认生成模型和向量模型；慢网络下可用 `-ModelPullTimeoutMinutes 90` 放宽镜像拉取等待时间。若 Docker Hub token 或镜像拉取网络返回 EOF/timeout，先用 `-SkipModelPull` 跑快速部署烟测确认项目镜像、数据库、后端和 nginx 链路。

Android/iOS 真机权限仍需人工验收：语音输入、相机捕获、二维码扫描的浏览器权限弹窗无法完全由桌面自动化证明。可按 `docs\MANUAL_ACCEPTANCE.md` 操作，并在 `/admin/settings` 导出验收 JSON 证据。

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

## 作品说明

FamilyAssister 家暖关注的是一个很日常但容易被忽略的问题：家庭照护经验常常只存在某个人脑子里，换人照顾、时间一久、信息就会丢失。

这个项目尝试把这些经验做成一个小型家庭记忆基础设施：低成本采集、结构化沉淀、可解释推荐、反馈学习、成员隔离、自托管部署和可复跑验收。它更像一个给家庭长期使用的 AI 助手，而不是一次性问答工具。
