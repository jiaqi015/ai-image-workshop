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

## 2. 厂商、模型、密钥关系

- `模型 -> 厂商`：由 `config/ai-routing.json` 决定，并由后端返回给前端。
- `厂商 -> 密钥池`：由 Vercel 环境变量决定（每家可配置多个 key）。
- `请求 -> 使用哪个 key`：后端按 round-robin 从该厂商 key 池选取，失败会冷却并重试下一个 key/厂商。

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

- 公共前端：
  - `VITE_USE_BACKEND=1`

- 多厂商 Key（支持逗号分隔多个）：
  - `OPENAI_KEYS`
  - `GOOGLE_KEYS`
  - `ALI_KEYS`
  - `BYTE_KEYS`
  - `MINIMAX_KEYS`
  - `ZHIPU_KEYS`

- OpenAI 兼容 Base URL（按需填）：
  - `OPENAI_BASE_URL=https://api.openai.com/v1`
  - `ALI_BASE_URL`
  - `BYTE_BASE_URL`
  - `MINIMAX_BASE_URL`
  - `ZHIPU_BASE_URL`

- 网关稳定性/安全参数（建议）：
  - `AI_UPSTREAM_TIMEOUT_MS=25000`
  - `AI_GOOGLE_TIMEOUT_MS`（可空，默认跟上面一致）
  - `AI_RATE_LIMIT_RPM=120`
  - `AI_GATEWAY_TOKEN`（可选，不填则不启用鉴权）

3. 重新部署（Redeploy）

## 5. 关键文件

- `api/ai.js`：后端统一网关（多厂商/多 key/重试）
- `config/ai-routing.json`：模型路由策略（文本与生图分离）
- `services/api/client.ts`：前端基础设施层（后端优先、可选前端兜底）
- `vercel.json`：Function Runtime + SPA 路由重写
