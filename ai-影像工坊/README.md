# AI 影像工坊

前后端分离版本（Vite 前端 + Vercel Functions 后端网关）。

## 1. 现在的核心架构

- 前端只负责 UI、工作流、模型选择，不持有生产密钥。
- 后端 `api/ai.js` 负责：
  - 厂商路由（OpenAI / Google / 阿里 / 字节 / MiniMax / 智谱）
  - 文本模型和生图模型分离路由
  - 多 Key 轮询 + 降级重试
  - 上游超时控制 + IP 维度限流（可选鉴权）
- 路由策略在 `config/ai-routing.json` 维护：
  - `text.models.<provider>[]`
  - `image.models.<provider>[]`
  - `providerOrder`

## 2. 超简配置模型（你要的模式）

Vercel 只需要配置 6 个变量（每个厂商 1 个）：

- `OPENAI_KEY`
- `GOOGLE_KEY`
- `ALI_KEY`
- `BYTE_KEY`
- `MINIMAX_KEY`
- `ZHIPU_KEY`

后端会自动：

- 按模型路由到对应厂商
- 用内置默认 Base URL 调用
- 自动重试与厂商降级

如果某家厂商有特殊网关地址，再额外填 `*_BASE_URL` 覆盖即可（可选，不是必填）。

## 3. 本地开发

1. 安装依赖

```bash
npm install
```

2. 复制环境变量

```bash
cp .env.example .env.local
```

3. 至少填一家的 key（建议先填 OpenAI 或 Google）

4. 启动

```bash
npm run dev
```

## 4. Vercel 部署（傻瓜步骤）

1. Project Settings -> Build & Deployment
- Node.js Version: `22.x`
- Install Command: `npm ci`（不行再用 `npm install`）
- Build Command: `npm run build`
- Output Directory: `dist`

2. Project Settings -> Environment Variables（Production + Preview 都勾上）

必填（建议）：

- `AI_GATEWAY_TOKEN`（生产默认要求；前端设置里填同一个令牌）
- `OPENAI_KEY`
- `GOOGLE_KEY`
- `ALI_KEY`
- `BYTE_KEY`
- `MINIMAX_KEY`
- `ZHIPU_KEY`
- `BLOB_READ_WRITE_TOKEN`（开启全站历史回溯必填）

可选（高级）：

- `AI_UPSTREAM_TIMEOUT_MS=25000`
- `AI_GOOGLE_TIMEOUT_MS=25000`
- `AI_RATE_LIMIT_RPM=120`
- `AI_ALLOW_ANON_IN_PROD=0`（默认 0；设成 1 才允许生产匿名访问，不推荐）
- `HISTORY_GATEWAY_TOKEN=`（不填则复用 `AI_GATEWAY_TOKEN`）
- `HISTORY_ALLOW_ANON_IN_PROD=0`
- `HISTORY_MAX_BODY_BYTES=12582912`
- `HISTORY_MAX_FRAMES_PER_RECORD=80`
- `HISTORY_MAX_IMAGE_BYTES=8388608`
- `HISTORY_MAX_TOTAL_IMAGE_BYTES=50331648`
- `EDGE_CONFIG=`（可选，开启历史运行时策略）
- `HISTORY_EDGE_CONFIG_CACHE_MS=10000`
- `OPENAI_BASE_URL / ALI_BASE_URL / BYTE_BASE_URL / MINIMAX_BASE_URL / ZHIPU_BASE_URL`

字节（Ark）建议：

- 如果报 `InvalidEndpointOrModel.NotFound`，通常需要用「接入点 ID（ep-xxx）」而不是展示名。
- 在仓库文件 `config/ai-runtime-aliases.json` 里配置映射，例如：
  - `{"byte":{"doubao-seed-2-0-pro":"ep-2026xxxx","doubao-seedream-5-0-lite":"ep-2026yyyy"}}`
  - 前端仍显示 `doubao-seed-2-0-pro`，后端会自动替换成 `ep-...` 调用。

3. 重新部署（Redeploy）

## 5. 代表性模型（默认已内置）

文本模型：

- OpenAI: `gpt-5.1` / `gpt-5` / `gpt-5-mini`
- Google: `gemini-2.5-pro` / `gemini-2.5-flash` / `gemini-3-pro-preview`
- 阿里: `qwen-max` / `qwen-plus` / `qwen-turbo`
- 字节: `doubao-1-5-pro-32k-250115` / `doubao-1-5-lite-32k-250115` / `doubao-seed-2-0-pro`
- MiniMax: `MiniMax-M2.5` / `MiniMax-M2.5-highspeed` / `MiniMax-M2.1`
- 智谱: `glm-4.7` / `glm-4.6` / `glm-4.5-flash`

生图模型：

- OpenAI: `gpt-image-1` / `dall-e-3` / `dall-e-2`
- Google: `gemini-3-pro-image-preview` / `gemini-2.5-flash-image`
- 阿里: `wan2.2-t2i-plus` / `wan2.2-t2i-flash` / `wanx2.1-t2i-plus`
- 字节: `doubao-seedream-4-0-250828` / `doubao-seedream-3-0-t2i-250415` / `doubao-seedream-5-0-lite`
- MiniMax: `image-01`
- 智谱: `glm-image` / `cogview-4` / `cogview-3-flash`

## 6. 后端接口参数（最小集）

`POST /api/ai`

- 文本对话：`{ "action":"chat", "model":"gpt-5.1", "messages":[{"role":"user","content":"..."}] }`
- 生图：`{ "action":"image", "model":"gpt-image-1", "prompt":"..." }`
- 通用生成：`{ "action":"generate", "model":"...", "contents":"..." }`
- 导演计划（结构化）：`{ "action":"director_plan", "model":"gpt-5.1", "userIdea":"...", "tension":"dramatic", "analysis":{}, "creativeBrief":{} }`

`GET /api/ai?action=models` 返回全量模型目录 + 当前可用状态。  
`GET /api/ai?action=health` 返回各厂商就绪状态。
`GET /api/ai?action=metrics` 返回网关运行遥测（请求量、错误类型、fallback统计、厂商健康快照）。
`GET /api/ai?action=dashboard&period=day|week` 返回日/周聚合看板指标。  
`GET /api/ai?action=alerts&period=day|week` 返回阈值告警结果。

## 6.1 全站历史回溯（Vercel Blob）

启用 `BLOB_READ_WRITE_TOKEN` 后，历史系统会自动切换为“云端优先”：

- `GET /api/history?action=health`：检查 Blob 连通性
- `GET /api/history?action=list&limit=60`：读取全站历史（所有用户）
- `POST /api/history` + `{ "action":"upsert", "item":{...} }`：写入/更新历史
- `POST /api/history` + `{ "action":"delete", "id":"..." }`：删除历史

安全与限额：

- 生产环境默认要求历史接口鉴权（`HISTORY_GATEWAY_TOKEN` 或复用 `AI_GATEWAY_TOKEN`）
- 历史写入默认启用请求体/单图/总图大小限制，防止 Blob 成本攻击

存储结构：

- `history/latest/*.json`：每条历史的最新快照
- `history/snapshots/*`：历史版本快照
- `history/images/*`：历史图片（自动把 data URL 上传为 Blob 公网地址）

## 6.2 Edge Config 运行时策略（可选）

若已配置 `EDGE_CONFIG`，可在 Edge Config 写入 `history.policy`（JSON 对象）动态控制历史服务，无需重新部署。

示例：

```json
{
  "enabled": true,
  "readOnly": false,
  "allowAnonInProd": false,
  "requireHistoryToken": true,
  "maxBodyBytes": 12582912,
  "maxFramesPerRecord": 80,
  "maxImageBytes": 8388608,
  "maxTotalImageBytes": 50331648
}
```

字段说明：

- `enabled=false`：直接关闭历史服务（返回 503）
- `readOnly=true`：保留查询，禁止 upsert/delete
- `allowAnonInProd`、`requireHistoryToken`：覆盖生产态鉴权策略
- `max*`：覆盖历史请求体/图片限额

调试入口：

- `GET /api/history?action=health` 会返回 `runtime` 与 `edgeConfig`，可直接确认当前是否命中 Edge Config 策略。

Provider 状态语义（重要）：

- `enabled`：路由配置层是否启用该厂商
- `configured`：已配置可运行条件（key/baseUrl）
- `validated`：运行期已实际验证通过（动态状态）
- `ready`：兼容字段，等价于 `configured`

## 7. 关键文件

- `api/ai.js`：后端统一网关（多厂商/多 key/重试）
- `api/domain/directorPlan.js`：导演计划域（prompt 编排、计划清洗、blueprint token、director packet）
- `config/ai-routing.json`：模型路由策略（文本与生图分离）
- `config/ai-runtime-aliases.json`：运行时模型别名（展示模型名 -> 厂商真实调用 ID）
- `config/ai-alert-thresholds.json`：指标告警阈值（successRate/p95/429/fallback/auth）
- `services/api/client.ts`：前端基础设施层（后端优先、可选前端兜底）
- `vercel.json`：Function Runtime + SPA 路由重写
- `docs/ITERATION_TEST_REGRESSION_PLAN.md`：迭代、测试、回归总计划

## 8. 测试与回归（已落地）

本仓库已内置质量门禁脚本与 CI：

- `npm run typecheck`
- `npm run build`
- `npm run test:contracts`（后端接口契约回归）
- `npm run test:golden`（金标回归集校验）
- `npm run test:system`（全系统链路回归：网关、鉴权/限流、前端代理、history 退化）
- `npm run report:quality`（输出回归与系统测试摘要，适配 CI Step Summary）
- `npm run quality:gate`（发布门禁总入口）
- `npm run test:all`（质量门禁 + 全系统链路回归）

报告输出：

- `quality/reports/latest-regression-summary.json`
- `quality/reports/latest-system-summary.json`

分支保护（将 `quality-gate` 设为必过检查）：

```bash
# 先预览即将应用的配置
npm run ops:protect-main:dry

# 实际应用（需要 repo admin token）
GITHUB_TOKEN=xxx npm run ops:protect-main
```

可选参数：

- `BRANCH`（默认 `main`）
- `REPO_SLUG`（默认自动从 origin 推断）
- `REQUIRED_CHECKS`（默认 `quality-gate`，多项逗号分隔）

默认 `test:golden` 只跑离线结构回归。  
若要开启真实厂商在线烟测：

```bash
RUN_LIVE_PROVIDER_SMOKE=1 npm run test:golden
```

CI 文件：

- `.github/workflows/quality-gate.yml`
