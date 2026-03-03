import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const PROVIDERS = ['openai', 'google', 'ali', 'byte', 'minimax', 'zhipu'];
const handlerModuleUrl = pathToFileURL(path.join(process.cwd(), 'api', 'ai.js')).href;

const loadHandler = async (envOverrides = {}) => {
  const touched = [];
  for (const [key, value] of Object.entries(envOverrides)) {
    touched.push([key, process.env[key]]);
    if (value === undefined || value === null) {
      delete process.env[key];
    } else {
      process.env[key] = String(value);
    }
  }

  const mod = await import(`${handlerModuleUrl}?case=${Date.now()}-${Math.random()}`);

  for (const [key, previous] of touched) {
    if (previous === undefined) delete process.env[key];
    else process.env[key] = previous;
  }

  return mod.default;
};

const invoke = async (handler, reqOverrides = {}) => {
  const req = {
    method: 'GET',
    query: {},
    body: {},
    headers: {},
    socket: { remoteAddress: '127.0.0.1' },
    ...reqOverrides,
  };

  const result = {
    status: 200,
    headers: {},
    body: null,
  };

  const res = {
    setHeader(name, value) {
      result.headers[name] = value;
    },
    status(code) {
      result.status = code;
      return this;
    },
    json(payload) {
      result.body = payload;
      return this;
    },
    end(payload) {
      result.body = payload ?? result.body;
      return this;
    },
  };

  await handler(req, res);
  return result;
};

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

const expectRateHeaders = (headers) => {
  assert.ok(headers['X-RateLimit-Limit'], 'missing X-RateLimit-Limit header');
  assert.ok(headers['X-RateLimit-Remaining'], 'missing X-RateLimit-Remaining header');
  assert.ok(headers['X-RateLimit-Reset'], 'missing X-RateLimit-Reset header');
};

const expectTrace = (res) => {
  assert.equal(typeof res.headers['X-Trace-Id'], 'string', 'missing X-Trace-Id header');
  assert.ok(String(res.headers['X-Trace-Id']).startsWith('tr_'));
  assert.equal(typeof res.body?.traceId, 'string', 'missing traceId in body');
  assert.equal(res.body.traceId, res.headers['X-Trace-Id']);
};

test('GET health returns stable provider shape', async () => {
  const handler = await loadHandler({
    AI_GATEWAY_TOKEN: undefined,
    OPENAI_KEY: undefined,
    GOOGLE_KEY: undefined,
    ALI_KEY: undefined,
    BYTE_KEY: undefined,
    MINIMAX_KEY: undefined,
    ZHIPU_KEY: undefined,
  });

  const res = await invoke(handler, { method: 'GET', query: { action: 'health' } });
  assert.equal(res.status, 200);
  assert.equal(res.body?.ok, true);
  expectRateHeaders(res.headers);
  expectTrace(res);

  for (const provider of PROVIDERS) {
    assert.ok(res.body?.providers?.[provider], `missing provider ${provider}`);
    assert.equal(typeof res.body.providers[provider].enabled, 'boolean');
    assert.equal(typeof res.body.providers[provider].configured, 'boolean');
    assert.equal(typeof res.body.providers[provider].validated, 'boolean');
    assert.equal(typeof res.body.providers[provider].ready, 'boolean');
    assert.equal(typeof res.body.providers[provider].hasKey, 'boolean');
  }

  assert.equal(typeof res.body?.defaults?.textModel, 'string');
  assert.equal(typeof res.body?.defaults?.imageModel, 'string');
});

test('GET models returns catalog and grouped providers', async () => {
  const handler = await loadHandler({
    AI_GATEWAY_TOKEN: undefined,
  });

  const res = await invoke(handler, { method: 'GET', query: { action: 'models' } });
  assert.equal(res.status, 200);
  assert.equal(res.body?.ok, true);
  expectRateHeaders(res.headers);
  expectTrace(res);

  assert.ok(Array.isArray(res.body?.textModels), 'textModels must be an array');
  assert.ok(Array.isArray(res.body?.imageModels), 'imageModels must be an array');
  assert.ok(res.body.textModels.includes('gpt-5.1'));
  assert.ok(res.body.imageModels.includes('gpt-image-1'));

  for (const provider of PROVIDERS) {
    assert.ok(res.body?.textModelsByProvider?.[provider], `missing textModelsByProvider.${provider}`);
    assert.ok(res.body?.imageModelsByProvider?.[provider], `missing imageModelsByProvider.${provider}`);
  }
});

test('POST chat returns clear error when no provider key is configured', async () => {
  const handler = await loadHandler({
    AI_GATEWAY_TOKEN: undefined,
    OPENAI_KEY: undefined,
    GOOGLE_KEY: undefined,
    ALI_KEY: undefined,
    BYTE_KEY: undefined,
    MINIMAX_KEY: undefined,
    ZHIPU_KEY: undefined,
  });

  const res = await invoke(handler, {
    method: 'POST',
    body: {
      action: 'chat',
      model: 'gpt-5.1',
      messages: [{ role: 'user', content: 'ping' }],
    },
  });

  assert.equal(res.status, 500);
  assert.equal(res.body?.ok, false);
  expectTrace(res);
  assert.match(String(res.body?.error || ''), /没有可用的厂商或 Key/i);
});

test('POST image without prompt returns 400', async () => {
  const handler = await loadHandler({ AI_GATEWAY_TOKEN: undefined });
  const res = await invoke(handler, {
    method: 'POST',
    body: { action: 'image', model: 'gpt-image-1', prompt: '' },
  });
  assert.equal(res.status, 400);
  assert.equal(res.body?.ok, false);
  expectTrace(res);
  assert.match(String(res.body?.error || ''), /prompt is required/);
});

test('POST director_plan without userIdea returns 400', async () => {
  const handler = await loadHandler({ AI_GATEWAY_TOKEN: undefined });
  const res = await invoke(handler, {
    method: 'POST',
    body: { action: 'director_plan', userIdea: '' },
  });
  assert.equal(res.status, 400);
  assert.equal(res.body?.ok, false);
  expectTrace(res);
  assert.match(String(res.body?.error || ''), /userIdea is required/i);
});

test('POST director_plan returns clear error when no provider key is configured', async () => {
  const handler = await loadHandler({
    AI_GATEWAY_TOKEN: undefined,
    OPENAI_KEY: undefined,
    GOOGLE_KEY: undefined,
    ALI_KEY: undefined,
    BYTE_KEY: undefined,
    MINIMAX_KEY: undefined,
    ZHIPU_KEY: undefined,
  });

  const res = await invoke(handler, {
    method: 'POST',
    body: {
      action: 'director_plan',
      userIdea: '昏暗室内，一位女性面对镜子',
      tension: 'dramatic',
    },
  });

  assert.equal(res.status, 500);
  assert.equal(res.body?.ok, false);
  expectTrace(res);
  assert.match(String(res.body?.error || ''), /没有可用的厂商或 Key/i);
});

test('POST random_prompt returns 200 with bounded length and metadata', async () => {
  const handler = await loadHandler({ AI_GATEWAY_TOKEN: undefined });
  const res = await invoke(handler, {
    method: 'POST',
    body: { action: 'random_prompt', mode: 'pro', targetLength: 200 },
  });
  assert.equal(res.status, 200);
  assert.equal(res.body?.ok, true);
  expectTrace(res);
  assert.equal(typeof res.body?.prompt, 'string');
  assert.ok(res.body.prompt.length >= 180, `prompt too short: ${res.body.prompt.length}`);
  assert.ok(res.body.prompt.length <= 220, `prompt too long: ${res.body.prompt.length}`);
  assert.equal(typeof res.body?.metadata?.theme, 'string');
  assert.equal(typeof res.body?.metadata?.similarityToRecent, 'number');
  assert.equal(typeof res.body?.metadata?.critic?.score, 'number');
});

test('POST unsupported action returns 400', async () => {
  const handler = await loadHandler({ AI_GATEWAY_TOKEN: undefined });
  const res = await invoke(handler, {
    method: 'POST',
    body: { action: 'unsupported-action' },
  });
  assert.equal(res.status, 400);
  assert.equal(res.body?.ok, false);
  expectTrace(res);
  assert.match(String(res.body?.error || ''), /Unsupported action/);
});

test('gateway token auth blocks unauthenticated requests and allows authenticated ones', async () => {
  const handler = await loadHandler({ AI_GATEWAY_TOKEN: 'token-abc' });

  const unauthorized = await invoke(handler, {
    method: 'GET',
    query: { action: 'health' },
    headers: {},
  });
  assert.equal(unauthorized.status, 401);
  expectTrace(unauthorized);

  const byHeader = await invoke(handler, {
    method: 'GET',
    query: { action: 'health' },
    headers: { 'x-gateway-token': 'token-abc' },
  });
  assert.equal(byHeader.status, 200);
  expectTrace(byHeader);

  const byBearer = await invoke(handler, {
    method: 'GET',
    query: { action: 'health' },
    headers: { authorization: 'Bearer token-abc' },
  });
  assert.equal(byBearer.status, 200);
  expectTrace(byBearer);
});

test('GET metrics returns telemetry snapshot', async () => {
  const handler = await loadHandler({ AI_GATEWAY_TOKEN: undefined });
  const res = await invoke(handler, { method: 'GET', query: { action: 'metrics' } });
  assert.equal(res.status, 200);
  expectRateHeaders(res.headers);
  expectTrace(res);
  assert.equal(res.body?.ok, true);
  assert.equal(typeof res.body?.telemetry?.requests?.total, 'number');
  assert.equal(typeof res.body?.telemetry?.routing?.fallbackTriggered, 'number');
});

test('GET dashboard returns day and week snapshots', async () => {
  const handler = await loadHandler({ AI_GATEWAY_TOKEN: undefined });

  const day = await invoke(handler, { method: 'GET', query: { action: 'dashboard', period: 'day' } });
  assert.equal(day.status, 200);
  expectRateHeaders(day.headers);
  expectTrace(day);
  assert.equal(day.body?.ok, true);
  assert.equal(day.body?.dashboard?.period, 'day');
  assert.equal(typeof day.body?.dashboard?.traffic?.totalRequests, 'number');
  assert.equal(typeof day.body?.dashboard?.latency?.p95LatencyMs, 'number');

  const week = await invoke(handler, { method: 'GET', query: { action: 'dashboard', period: 'week' } });
  assert.equal(week.status, 200);
  expectRateHeaders(week.headers);
  expectTrace(week);
  assert.equal(week.body?.dashboard?.period, 'week');
});

test('GET alerts returns threshold-based evaluation payload', async () => {
  const handler = await loadHandler({ AI_GATEWAY_TOKEN: undefined });
  const res = await invoke(handler, { method: 'GET', query: { action: 'alerts', period: 'day' } });

  assert.equal(res.status, 200);
  expectRateHeaders(res.headers);
  expectTrace(res);
  assert.equal(res.body?.ok, true);
  assert.equal(typeof res.body?.alerts?.healthy, 'boolean');
  assert.ok(Array.isArray(res.body?.alerts?.alerts), 'alerts.alerts should be an array');
  assert.equal(typeof res.body?.alerts?.thresholds?.successRateMin, 'number');
  assert.equal(typeof res.body?.thresholds?.successRateMin, 'number');
});

const main = async () => {
  const started = Date.now();
  let passed = 0;

  for (const t of tests) {
    try {
      await t.fn();
      passed += 1;
      console.log(`PASS ${t.name}`);
    } catch (error) {
      console.error(`FAIL ${t.name}`);
      console.error(error);
      process.exitCode = 1;
      break;
    }
  }

  if (!process.exitCode) {
    const duration = ((Date.now() - started) / 1000).toFixed(2);
    console.log(`\nContracts: ${passed}/${tests.length} passed in ${duration}s`);
  }
};

await main();
