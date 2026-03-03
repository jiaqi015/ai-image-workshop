import http from "node:http";
import { URL } from "node:url";
import handler from "../api/ai.js";

const PORT = Number(process.env.LOCAL_API_PORT || 3001);

const parseJsonBody = async (req) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString("utf8").trim();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
};

const createQuery = (url) => {
  const output = {};
  for (const [k, v] of url.searchParams.entries()) output[k] = v;
  return output;
};

const sendJson = (res, status, payload) => {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
};

const setCors = (res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-gateway-token");
};

const server = http.createServer(async (req, res) => {
  const startedAt = Date.now();
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

  if (url.pathname !== "/api/ai") {
    setCors(res);
    sendJson(res, 404, { ok: false, error: "Not Found" });
    return;
  }

  if (req.method === "OPTIONS") {
    setCors(res);
    res.statusCode = 204;
    res.end();
    console.log(`[api] OPTIONS ${url.pathname} -> 204 (${Date.now() - startedAt}ms)`);
    return;
  }

  try {
    const body = req.method === "POST" ? await parseJsonBody(req) : {};
    const action = String((req.method === "POST" ? body?.action : url.searchParams.get("action")) || "health");

    const mockReq = {
      method: req.method,
      query: createQuery(url),
      body,
      headers: req.headers,
      socket: req.socket,
      connection: req.socket,
    };

    const mockRes = {
      statusCode: 200,
      headers: {},
      setHeader(key, value) {
        this.headers[key] = value;
      },
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        setCors(res);
        for (const [k, v] of Object.entries(this.headers)) {
          res.setHeader(k, v);
        }
        sendJson(res, this.statusCode, payload);
        return this;
      },
      end(payload) {
        setCors(res);
        for (const [k, v] of Object.entries(this.headers)) {
          res.setHeader(k, v);
        }
        res.statusCode = this.statusCode;
        res.end(payload);
        return this;
      },
    };

    await handler(mockReq, mockRes);
    const ms = Date.now() - startedAt;
    console.log(`[api] ${req.method} ${url.pathname}?action=${action} -> ${res.statusCode} (${ms}ms)`);
  } catch (error) {
    const ms = Date.now() - startedAt;
    console.error(`[api] ${req.method} ${url.pathname} -> 500 (${ms}ms)`, error);
    sendJson(res, 500, { ok: false, error: error instanceof Error ? error.message : "Unknown error" });
  }
});

server.listen(PORT, () => {
  console.log(`[api] local gateway ready on http://127.0.0.1:${PORT}/api/ai`);
});
