import assert from "node:assert/strict";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";

const PROJECT_ROOT = process.cwd();
const API_SERVER_SCRIPT = path.join(PROJECT_ROOT, "scripts", "local-api-dev-server.mjs");
const REPORT_DIR = path.join(PROJECT_ROOT, "quality", "reports");
const SYSTEM_REPORT_PATH = path.join(REPORT_DIR, "latest-system-summary.json");
const PROVIDERS = ["openai", "google", "ali", "byte", "minimax", "zhipu"];

const clearProviderEnv = {
  OPENAI_KEY: "",
  OPENAI_API_KEY: "",
  OPENAI_KEYS: "",
  GOOGLE_KEY: "",
  GOOGLE_API_KEY: "",
  GEMINI_API_KEY: "",
  GOOGLE_KEYS: "",
  GEMINI_KEYS: "",
  ALI_KEY: "",
  ALI_API_KEY: "",
  ALI_KEYS: "",
  BYTE_KEY: "",
  BYTE_API_KEY: "",
  BYTE_KEYS: "",
  DOUBAO_API_KEY: "",
  DOUBAO_KEYS: "",
  MINIMAX_KEY: "",
  MINIMAX_API_KEY: "",
  MINIMAX_KEYS: "",
  ZHIPU_KEY: "",
  ZHIPU_API_KEY: "",
  ZHIPU_KEYS: "",
};

let passed = 0;
let failed = 0;
const caseResults = [];

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const getFreePort = async () =>
  new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : null;
      server.close((err) => {
        if (err) return reject(err);
        if (!port) return reject(new Error("failed to resolve free port"));
        resolve(port);
      });
    });
  });

const toHeadersObject = (headers) => {
  const output = {};
  headers.forEach((value, key) => {
    output[String(key).toLowerCase()] = value;
  });
  return output;
};

const requestJson = async ({ method = "GET", url, body, headers = {} }) => {
  const requestHeaders = { ...headers };
  const init = { method, headers: requestHeaders };

  if (body !== undefined) {
    init.body = typeof body === "string" ? body : JSON.stringify(body);
    if (!Object.keys(requestHeaders).some((key) => key.toLowerCase() === "content-type")) {
      requestHeaders["Content-Type"] = "application/json";
    }
  }

  const response = await fetch(url, init);
  const text = await response.text();
  let json = null;

  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  return {
    status: response.status,
    headers: toHeadersObject(response.headers),
    text,
    json,
  };
};

const ensureTrace = (response) => {
  const traceHeader = response.headers["x-trace-id"];
  assert.equal(typeof traceHeader, "string", "missing x-trace-id header");
  assert.ok(traceHeader.startsWith("tr_"), `invalid x-trace-id: ${traceHeader}`);
  assert.equal(response.json?.traceId, traceHeader, "traceId in body/header mismatch");
};

const ensureRateHeaders = (response) => {
  assert.ok(response.headers["x-ratelimit-limit"], "missing x-ratelimit-limit");
  assert.ok(response.headers["x-ratelimit-remaining"], "missing x-ratelimit-remaining");
  assert.ok(response.headers["x-ratelimit-reset"], "missing x-ratelimit-reset");
};

const runCase = async (section, name, fn) => {
  const startedAt = Date.now();
  try {
    await fn();
    const durationMs = Date.now() - startedAt;
    passed += 1;
    caseResults.push({
      section,
      name,
      status: "passed",
      durationMs,
    });
    console.log(`PASS [${section}] ${name}`);
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    failed += 1;
    caseResults.push({
      section,
      name,
      status: "failed",
      durationMs,
      error: String(error?.message || error),
    });
    console.error(`FAIL [${section}] ${name}`);
    console.error(error?.stack || error);
  }
};

const writeReport = (report) => {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.writeFileSync(SYSTEM_REPORT_PATH, JSON.stringify(report, null, 2));
};

const startProcess = ({ name, command, args, env = {} }) => {
  const child = spawn(command, args, {
    cwd: PROJECT_ROOT,
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout.on("data", (chunk) => process.stdout.write(`[${name}] ${String(chunk)}`));
  child.stderr.on("data", (chunk) => process.stderr.write(`[${name}:err] ${String(chunk)}`));
  child.on("error", (error) => process.stderr.write(`[${name}:err] spawn error: ${String(error)}\n`));

  return child;
};

const waitForExit = (child, timeoutMs = 2500) =>
  new Promise((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      resolve();
    };

    const timer = setTimeout(() => done(), timeoutMs);
    child.once("exit", () => {
      clearTimeout(timer);
      done();
    });
  });

const stopProcess = async (child) => {
  if (!child) return;
  if (child.exitCode !== null) return;
  try {
    child.kill("SIGTERM");
  } catch {
    return;
  }
  await waitForExit(child, 2000);
  if (child.exitCode === null) {
    try {
      child.kill("SIGKILL");
    } catch {
      return;
    }
    await waitForExit(child, 1000);
  }
};

const waitForHttp = async (url, timeoutMs = 20000) => {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.status >= 200 && response.status < 500) return;
    } catch {
      // keep waiting
    }
    await delay(250);
  }
  throw new Error(`timeout waiting for ${url}`);
};

const withEnv = async (overrides, fn) => {
  const previous = new Map();
  for (const [key, value] of Object.entries(overrides)) {
    previous.set(key, process.env[key]);
    if (value === undefined || value === null) delete process.env[key];
    else process.env[key] = String(value);
  }

  try {
    return await fn();
  } finally {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
};

const invokeHistory = async (handler, reqOverrides = {}) => {
  const req = {
    method: "GET",
    query: {},
    body: {},
    headers: {},
    socket: { remoteAddress: "127.0.0.1" },
    ...reqOverrides,
  };

  const out = { status: 200, headers: {}, body: null };
  const res = {
    setHeader(name, value) {
      out.headers[String(name).toLowerCase()] = value;
    },
    status(code) {
      out.status = code;
      return this;
    },
    json(payload) {
      out.body = payload;
      return this;
    },
    end(payload) {
      out.body = payload ?? out.body;
      return this;
    },
  };

  await handler(req, res);
  return out;
};

const runGatewayNoAuthSuite = async (baseUrl) => {
  const section = "Gateway-NoAuth";

  await runCase(section, "GET health returns provider shape with trace + rate headers", async () => {
    const response = await requestJson({ url: `${baseUrl}/api/ai?action=health` });
    assert.equal(response.status, 200);
    assert.equal(response.json?.ok, true);
    ensureTrace(response);
    ensureRateHeaders(response);
    for (const provider of PROVIDERS) {
      const status = response.json?.providers?.[provider];
      assert.ok(status, `missing provider ${provider}`);
      for (const field of ["enabled", "configured", "validated", "ready", "hasKey"]) {
        assert.equal(typeof status[field], "boolean", `${provider}.${field} must be boolean`);
      }
    }
  });

  await runCase(section, "GET models returns grouped catalog with defaults", async () => {
    const response = await requestJson({ url: `${baseUrl}/api/ai?action=models` });
    assert.equal(response.status, 200);
    assert.equal(response.json?.ok, true);
    ensureTrace(response);
    ensureRateHeaders(response);
    assert.ok(Array.isArray(response.json?.textModels));
    assert.ok(Array.isArray(response.json?.imageModels));
    assert.ok(response.json.textModels.includes("gpt-5.1"));
    assert.ok(response.json.imageModels.includes("gpt-image-1"));
    for (const provider of PROVIDERS) {
      assert.ok(Array.isArray(response.json?.textModelsByProvider?.[provider]), `missing textModelsByProvider.${provider}`);
      assert.ok(Array.isArray(response.json?.imageModelsByProvider?.[provider]), `missing imageModelsByProvider.${provider}`);
    }
  });

  await runCase(section, "GET metrics returns telemetry snapshot", async () => {
    const response = await requestJson({ url: `${baseUrl}/api/ai?action=metrics` });
    assert.equal(response.status, 200);
    assert.equal(response.json?.ok, true);
    ensureTrace(response);
    ensureRateHeaders(response);
    assert.equal(typeof response.json?.telemetry?.requests?.total, "number");
    assert.equal(typeof response.json?.telemetry?.routing?.fallbackTriggered, "number");
  });

  await runCase(section, "GET dashboard supports day and week period", async () => {
    const day = await requestJson({ url: `${baseUrl}/api/ai?action=dashboard&period=day` });
    assert.equal(day.status, 200);
    assert.equal(day.json?.ok, true);
    ensureTrace(day);
    ensureRateHeaders(day);
    assert.equal(day.json?.dashboard?.period, "day");
    assert.equal(typeof day.json?.dashboard?.traffic?.totalRequests, "number");

    const week = await requestJson({ url: `${baseUrl}/api/ai?action=dashboard&period=week` });
    assert.equal(week.status, 200);
    assert.equal(week.json?.ok, true);
    ensureTrace(week);
    ensureRateHeaders(week);
    assert.equal(week.json?.dashboard?.period, "week");
  });

  await runCase(section, "GET alerts returns threshold evaluation", async () => {
    const response = await requestJson({ url: `${baseUrl}/api/ai?action=alerts&period=day` });
    assert.equal(response.status, 200);
    assert.equal(response.json?.ok, true);
    ensureTrace(response);
    ensureRateHeaders(response);
    assert.equal(typeof response.json?.alerts?.healthy, "boolean");
    assert.ok(Array.isArray(response.json?.alerts?.alerts));
    assert.equal(typeof response.json?.thresholds?.successRateMin, "number");
  });

  await runCase(section, "POST random_prompt returns bounded output and metadata", async () => {
    const response = await requestJson({
      method: "POST",
      url: `${baseUrl}/api/ai`,
      body: { action: "random_prompt", mode: "pro", targetLength: 200 },
    });
    assert.equal(response.status, 200);
    assert.equal(response.json?.ok, true);
    ensureTrace(response);
    ensureRateHeaders(response);
    const prompt = String(response.json?.prompt || "");
    assert.ok(prompt.length >= 180, `prompt too short: ${prompt.length}`);
    assert.ok(prompt.length <= 220, `prompt too long: ${prompt.length}`);
    assert.equal(typeof response.json?.metadata?.theme, "string");
    assert.equal(typeof response.json?.metadata?.critic?.score, "number");
  });

  await runCase(section, "POST director_plan missing userIdea returns 400", async () => {
    const response = await requestJson({
      method: "POST",
      url: `${baseUrl}/api/ai`,
      body: { action: "director_plan", userIdea: "" },
    });
    assert.equal(response.status, 400);
    assert.equal(response.json?.ok, false);
    ensureTrace(response);
    ensureRateHeaders(response);
    assert.match(String(response.json?.error || ""), /userIdea is required/i);
  });

  await runCase(section, "POST image missing prompt returns 400", async () => {
    const response = await requestJson({
      method: "POST",
      url: `${baseUrl}/api/ai`,
      body: { action: "image", model: "gpt-image-1", prompt: "" },
    });
    assert.equal(response.status, 400);
    assert.equal(response.json?.ok, false);
    ensureTrace(response);
    ensureRateHeaders(response);
    assert.match(String(response.json?.error || ""), /prompt is required/i);
  });

  await runCase(section, "POST chat without provider keys returns 500", async () => {
    const response = await requestJson({
      method: "POST",
      url: `${baseUrl}/api/ai`,
      body: { action: "chat", model: "gpt-5.1", messages: [{ role: "user", content: "ping" }] },
    });
    assert.equal(response.status, 500);
    assert.equal(response.json?.ok, false);
    ensureTrace(response);
    ensureRateHeaders(response);
    assert.match(String(response.json?.error || ""), /Key/i);
  });

  await runCase(section, "POST generate compatibility action returns structured error without keys", async () => {
    const response = await requestJson({
      method: "POST",
      url: `${baseUrl}/api/ai`,
      body: { action: "generate", model: "gpt-5.1", contents: "ping" },
    });
    assert.equal(response.status, 500);
    assert.equal(response.json?.ok, false);
    ensureTrace(response);
    ensureRateHeaders(response);
  });

  await runCase(section, "POST validate returns health payload", async () => {
    const response = await requestJson({
      method: "POST",
      url: `${baseUrl}/api/ai`,
      body: { action: "validate" },
    });
    assert.equal(response.status, 200);
    assert.equal(response.json?.ok, true);
    ensureTrace(response);
    ensureRateHeaders(response);
    assert.ok(response.json?.providers?.openai);
  });

  await runCase(section, "POST unsupported action returns 400", async () => {
    const response = await requestJson({
      method: "POST",
      url: `${baseUrl}/api/ai`,
      body: { action: "unsupported-action" },
    });
    assert.equal(response.status, 400);
    assert.equal(response.json?.ok, false);
    ensureTrace(response);
    ensureRateHeaders(response);
    assert.match(String(response.json?.error || ""), /Unsupported action/i);
  });

  await runCase(section, "PUT returns 405", async () => {
    const response = await requestJson({
      method: "PUT",
      url: `${baseUrl}/api/ai?action=health`,
    });
    assert.equal(response.status, 405);
    assert.equal(response.json?.ok, false);
    ensureTrace(response);
    ensureRateHeaders(response);
    assert.match(String(response.json?.error || ""), /Method Not Allowed/i);
  });

  await runCase(section, "OPTIONS preflight returns 204", async () => {
    const response = await requestJson({
      method: "OPTIONS",
      url: `${baseUrl}/api/ai`,
    });
    assert.equal(response.status, 204);
  });
};

const runGatewayAuthRateSuite = async (baseUrl) => {
  const section = "Gateway-AuthRate";

  await runCase(section, "unauthorized request returns 401", async () => {
    const response = await requestJson({ url: `${baseUrl}/api/ai?action=health` });
    assert.equal(response.status, 401);
    assert.equal(response.json?.ok, false);
    ensureTrace(response);
    assert.match(String(response.json?.error || ""), /Unauthorized/i);
  });

  await runCase(section, "x-gateway-token authorizes request", async () => {
    const response = await requestJson({
      url: `${baseUrl}/api/ai?action=health`,
      headers: { "x-gateway-token": "token-abc" },
    });
    assert.equal(response.status, 200);
    assert.equal(response.json?.ok, true);
    ensureTrace(response);
    ensureRateHeaders(response);
  });

  await runCase(section, "bearer token authorizes request", async () => {
    const response = await requestJson({
      url: `${baseUrl}/api/ai?action=health`,
      headers: { Authorization: "Bearer token-abc" },
    });
    assert.equal(response.status, 200);
    assert.equal(response.json?.ok, true);
    ensureTrace(response);
    ensureRateHeaders(response);
  });

  await runCase(section, "rate limit triggers 429 on third request", async () => {
    const headers = { "x-gateway-token": "token-abc" };
    const first = await requestJson({ url: `${baseUrl}/api/ai?action=models`, headers });
    const second = await requestJson({ url: `${baseUrl}/api/ai?action=models`, headers });
    const third = await requestJson({ url: `${baseUrl}/api/ai?action=models`, headers });
    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    assert.equal(third.status, 429);
    ensureTrace(third);
    ensureRateHeaders(third);
    assert.match(String(third.json?.error || ""), /Rate limit exceeded/i);
  });
};

const runFrontendProxySuite = async ({ frontendBaseUrl }) => {
  const section = "Frontend-Proxy-E2E";

  await runCase(section, "frontend shell returns HTML page", async () => {
    const response = await fetch(frontendBaseUrl);
    const html = await response.text();
    assert.equal(response.status, 200);
    assert.match(html, /id=\"root\"/i);
    assert.match(html, /type=\"module\"/i);
  });

  await runCase(section, "proxy GET health works", async () => {
    const response = await requestJson({ url: `${frontendBaseUrl}/api/ai?action=health` });
    assert.equal(response.status, 200);
    assert.equal(response.json?.ok, true);
    ensureTrace(response);
    ensureRateHeaders(response);
  });

  await runCase(section, "proxy GET models works", async () => {
    const response = await requestJson({ url: `${frontendBaseUrl}/api/ai?action=models` });
    assert.equal(response.status, 200);
    assert.equal(response.json?.ok, true);
    ensureTrace(response);
    ensureRateHeaders(response);
    assert.ok(Array.isArray(response.json?.textModels));
  });

  await runCase(section, "proxy POST random_prompt works", async () => {
    const response = await requestJson({
      method: "POST",
      url: `${frontendBaseUrl}/api/ai`,
      body: { action: "random_prompt", mode: "basic", targetLength: 120 },
    });
    assert.equal(response.status, 200);
    assert.equal(response.json?.ok, true);
    ensureTrace(response);
    ensureRateHeaders(response);
    assert.equal(typeof response.json?.prompt, "string");
  });

  await runCase(section, "proxy POST chat preserves backend 500 semantics", async () => {
    const response = await requestJson({
      method: "POST",
      url: `${frontendBaseUrl}/api/ai`,
      body: {
        action: "chat",
        model: "gpt-5.1",
        messages: [{ role: "user", content: "hello" }],
      },
    });
    assert.equal(response.status, 500);
    assert.equal(response.json?.ok, false);
    ensureTrace(response);
    ensureRateHeaders(response);
    assert.match(String(response.json?.error || ""), /Key/i);
  });
};

const runHistoryDegradeSuite = async () => {
  const section = "History-Degrade";
  const historyModuleUrl = pathToFileURL(path.join(PROJECT_ROOT, "api", "history.js")).href;
  const { default: historyHandler } = await import(`${historyModuleUrl}?case=${Date.now()}`);

  await runCase(section, "GET health without token reports disconnected storage", async () => {
    await withEnv({ BLOB_READ_WRITE_TOKEN: "" }, async () => {
      const response = await invokeHistory(historyHandler, { method: "GET", query: { action: "health" } });
      assert.equal(response.status, 200);
      assert.equal(response.body?.ok, true);
      assert.equal(response.body?.storage?.provider, "vercel_blob");
      assert.equal(response.body?.storage?.configured, false);
      assert.equal(response.body?.storage?.connected, false);
    });
  });

  await runCase(section, "GET list without token returns 503", async () => {
    await withEnv({ BLOB_READ_WRITE_TOKEN: "" }, async () => {
      const response = await invokeHistory(historyHandler, { method: "GET", query: { action: "list" } });
      assert.equal(response.status, 503);
      assert.equal(response.body?.ok, false);
      assert.match(String(response.body?.error || ""), /BLOB_READ_WRITE_TOKEN/i);
    });
  });

  await runCase(section, "POST upsert without token returns 503", async () => {
    await withEnv({ BLOB_READ_WRITE_TOKEN: "" }, async () => {
      const response = await invokeHistory(historyHandler, {
        method: "POST",
        body: { action: "upsert", item: { id: "demo", userInput: "x" } },
      });
      assert.equal(response.status, 503);
      assert.equal(response.body?.ok, false);
      assert.match(String(response.body?.error || ""), /BLOB_READ_WRITE_TOKEN/i);
    });
  });

  await runCase(section, "OPTIONS preflight returns 204", async () => {
    await withEnv({ BLOB_READ_WRITE_TOKEN: "" }, async () => {
      const response = await invokeHistory(historyHandler, { method: "OPTIONS" });
      assert.equal(response.status, 204);
    });
  });

  await runCase(section, "unsupported action returns 400 when token exists", async () => {
    await withEnv({ BLOB_READ_WRITE_TOKEN: "dummy-token" }, async () => {
      const response = await invokeHistory(historyHandler, {
        method: "GET",
        query: { action: "unsupported" },
      });
      assert.equal(response.status, 400);
      assert.equal(response.body?.ok, false);
      assert.match(String(response.body?.error || ""), /Unsupported action/i);
    });
  });
};

const main = async () => {
  const startedAt = Date.now();
  const runningProcesses = [];

  try {
    const apiPortA = await getFreePort();
    const apiA = startProcess({
      name: "api-no-auth",
      command: "node",
      args: [API_SERVER_SCRIPT],
      env: {
        LOCAL_API_PORT: String(apiPortA),
        AI_GATEWAY_TOKEN: "",
        AI_GATEWAY_REQUIRE_TOKEN: "0",
        AI_RATE_LIMIT_RPM: "120",
        ...clearProviderEnv,
      },
    });
    runningProcesses.push(apiA);
    const apiBaseA = `http://127.0.0.1:${apiPortA}`;
    await waitForHttp(`${apiBaseA}/api/ai?action=health`);
    await runGatewayNoAuthSuite(apiBaseA);
    await stopProcess(apiA);

    const apiPortB = await getFreePort();
    const apiB = startProcess({
      name: "api-auth-rate",
      command: "node",
      args: [API_SERVER_SCRIPT],
      env: {
        LOCAL_API_PORT: String(apiPortB),
        AI_GATEWAY_TOKEN: "token-abc",
        AI_GATEWAY_REQUIRE_TOKEN: "1",
        AI_RATE_LIMIT_RPM: "2",
        ...clearProviderEnv,
      },
    });
    runningProcesses.push(apiB);
    const apiBaseB = `http://127.0.0.1:${apiPortB}`;
    await waitForHttp(`${apiBaseB}/api/ai?action=health`);
    await runGatewayAuthRateSuite(apiBaseB);
    await stopProcess(apiB);

    const apiPortC = await getFreePort();
    const frontendPort = await getFreePort();

    const apiC = startProcess({
      name: "api-proxy-target",
      command: "node",
      args: [API_SERVER_SCRIPT],
      env: {
        LOCAL_API_PORT: String(apiPortC),
        AI_GATEWAY_TOKEN: "",
        AI_GATEWAY_REQUIRE_TOKEN: "0",
        AI_RATE_LIMIT_RPM: "120",
        ...clearProviderEnv,
      },
    });
    runningProcesses.push(apiC);
    const apiBaseC = `http://127.0.0.1:${apiPortC}`;
    await waitForHttp(`${apiBaseC}/api/ai?action=health`);

    const vite = startProcess({
      name: "vite-proxy",
      command: "npm",
      args: ["run", "dev", "--", "--host", "127.0.0.1", "--port", String(frontendPort)],
      env: {
        VITE_BACKEND_DEV_URL: apiBaseC,
      },
    });
    runningProcesses.push(vite);
    const frontendBaseUrl = `http://127.0.0.1:${frontendPort}`;
    await waitForHttp(frontendBaseUrl);
    await runFrontendProxySuite({ frontendBaseUrl });

    await stopProcess(vite);
    await stopProcess(apiC);

    await runHistoryDegradeSuite();
  } finally {
    for (let i = runningProcesses.length - 1; i >= 0; i -= 1) {
      await stopProcess(runningProcesses[i]);
    }
  }

  const total = passed + failed;
  const durationMs = Date.now() - startedAt;
  const seconds = (durationMs / 1000).toFixed(2);
  const sections = caseResults.reduce((acc, item) => {
    const entry = acc[item.section] || { total: 0, passed: 0, failed: 0 };
    entry.total += 1;
    if (item.status === "passed") entry.passed += 1;
    if (item.status === "failed") entry.failed += 1;
    acc[item.section] = entry;
    return acc;
  }, {});

  const report = {
    timestamp: new Date().toISOString(),
    durationMs,
    totals: { total, passed, failed },
    sections,
    cases: caseResults,
  };
  writeReport(report);

  console.log("\nFull system suite summary");
  console.log(`Cases: ${total}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Duration: ${seconds}s`);
  console.log(`Report: ${path.relative(PROJECT_ROOT, SYSTEM_REPORT_PATH)}`);

  if (failed > 0) process.exitCode = 1;
};

await main();
