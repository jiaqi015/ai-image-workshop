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

- `OPENAI_KEY`
- `GOOGLE_KEY`
- `ALI_KEY`
- `BYTE_KEY`
- `MINIMAX_KEY`
- `ZHIPU_KEY`

可选（高级）：

- `AI_UPSTREAM_TIMEOUT_MS=25000`
- `AI_GOOGLE_TIMEOUT_MS=25000`
- `AI_RATE_LIMIT_RPM=120`
- `AI_GATEWAY_TOKEN=`（不填则不开鉴权）
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
- 字节: `doubao-seed-2-0-pro` / `doubao-seed-2-0-lite` / `doubao-seed-1-8`
- MiniMax: `MiniMax-M2.5` / `MiniMax-M2.5-highspeed` / `MiniMax-M2.1`
- 智谱: `glm-4.7` / `glm-4.6` / `glm-4.5-flash`

生图模型：

- OpenAI: `gpt-image-1` / `dall-e-3` / `dall-e-2`
- Google: `gemini-3-pro-image-preview` / `gemini-2.5-flash-image`
- 阿里: `wan2.2-t2i-plus` / `wan2.2-t2i-flash` / `wanx2.1-t2i-plus`
- 字节: `doubao-seedream-5-0-lite` / `doubao-seedream-4-5` / `doubao-seedream-4-0-250828`
- MiniMax: `image-01`
- 智谱: `glm-image` / `cogview-4` / `cogview-3-flash`

## 6. 后端接口参数（最小集）

`POST /api/ai`

- 文本对话：`{ "action":"chat", "model":"gpt-5.1", "messages":[{"role":"user","content":"..."}] }`
- 生图：`{ "action":"image", "model":"gpt-image-1", "prompt":"..." }`
- 通用生成：`{ "action":"generate", "model":"...", "contents":"..." }`

`GET /api/ai?action=models` 返回全量模型目录 + 当前可用状态。  
`GET /api/ai?action=health` 返回各厂商就绪状态。

## 7. 关键文件

- `api/ai.js`：后端统一网关（多厂商/多 key/重试）
- `config/ai-routing.json`：模型路由策略（文本与生图分离）
- `config/ai-runtime-aliases.json`：运行时模型别名（展示模型名 -> 厂商真实调用 ID）
- `services/api/client.ts`：前端基础设施层（后端优先、可选前端兜底）
- `vercel.json`：Function Runtime + SPA 路由重写
