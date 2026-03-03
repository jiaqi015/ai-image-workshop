import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const goldenPath = path.join(process.cwd(), 'quality', 'golden-prompts.v1.json');
const reportDir = path.join(process.cwd(), 'quality', 'reports');

const REQUIRED_DIMENSIONS = ['artistry', 'consistency', 'tension', 'diversity'];
const REQUIRED_SCENARIOS = [
  'portrait',
  'fashion',
  'cinematic',
  'documentary',
  'environment',
  'concept',
  'safety',
  'product',
  'narrative',
  'diversity',
  'provider-smoke',
];
const REQUIRED_PROVIDERS = ['openai', 'google', 'byte', 'zhipu'];

const providerSmokeModels = {
  openai: 'gpt-5.1',
  google: 'gemini-2.5-flash',
  ali: 'qwen-plus',
  byte: 'doubao-seed-2-0-lite',
  minimax: 'MiniMax-M2.5',
  zhipu: 'glm-4.6',
};

const providerKeyMap = {
  openai: 'OPENAI_KEY',
  google: 'GOOGLE_KEY',
  ali: 'ALI_KEY',
  byte: 'BYTE_KEY',
  minimax: 'MINIMAX_KEY',
  zhipu: 'ZHIPU_KEY',
};

const loadGolden = () => {
  const raw = fs.readFileSync(goldenPath, 'utf8');
  return JSON.parse(raw);
};

const validateGoldenSchema = (golden) => {
  assert.equal(typeof golden.version, 'string', 'missing version');
  assert.ok(Array.isArray(golden.dimensions), 'dimensions must be array');
  assert.ok(Array.isArray(golden.cases), 'cases must be array');
  assert.ok(golden.cases.length >= 20, 'golden cases should include at least 20 entries');

  const sortedExpected = [...REQUIRED_DIMENSIONS].sort().join(',');
  const sortedActual = [...golden.dimensions].sort().join(',');
  assert.equal(sortedActual, sortedExpected, 'dimension set mismatch');

  const ids = new Set();
  const scenarios = new Set();
  const providerFamilies = new Set();

  for (const item of golden.cases) {
    assert.equal(typeof item.id, 'string', 'case id must be string');
    assert.equal(typeof item.scenario, 'string', `case ${item.id} scenario missing`);
    assert.equal(typeof item.providerFamily, 'string', `case ${item.id} providerFamily missing`);
    assert.equal(typeof item.prompt, 'string', `case ${item.id} prompt missing`);
    assert.ok(item.prompt.trim().length > 0, `case ${item.id} prompt empty`);
    assert.equal(typeof item.expects, 'object', `case ${item.id} expects missing`);

    assert.ok(!ids.has(item.id), `duplicate case id: ${item.id}`);
    ids.add(item.id);
    scenarios.add(item.scenario);
    providerFamilies.add(item.providerFamily);

    for (const field of ['artistry', 'consistencyAnchor', 'tension', 'diversitySlot']) {
      assert.equal(typeof item.expects[field], 'string', `case ${item.id} expects.${field} missing`);
    }
  }

  for (const scenario of REQUIRED_SCENARIOS) {
    assert.ok(scenarios.has(scenario), `missing scenario coverage: ${scenario}`);
  }

  assert.ok(providerFamilies.has('any'), 'providerFamily should include any');
  for (const provider of REQUIRED_PROVIDERS) {
    assert.ok(providerFamilies.has(provider), `provider smoke case missing: ${provider}`);
  }

  return {
    totalCases: golden.cases.length,
    scenarios: [...scenarios].sort(),
    providerFamilies: [...providerFamilies].sort(),
  };
};

const invoke = async (handler, reqOverrides = {}) => {
  const req = {
    method: 'POST',
    query: {},
    body: {},
    headers: {},
    socket: { remoteAddress: '127.0.0.1' },
    ...reqOverrides,
  };

  const result = { status: 200, body: null, headers: {} };
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

const runLiveProviderSmoke = async () => {
  if (process.env.RUN_LIVE_PROVIDER_SMOKE !== '1') {
    return { enabled: false, executed: 0, passed: 0, skipped: Object.keys(providerKeyMap).length };
  }

  const handlerModuleUrl = pathToFileURL(path.join(process.cwd(), 'api', 'ai.js')).href;
  const mod = await import(`${handlerModuleUrl}?live=${Date.now()}-${Math.random()}`);
  const handler = mod.default;

  let executed = 0;
  let passed = 0;
  let skipped = 0;
  const details = [];

  for (const [provider, envKey] of Object.entries(providerKeyMap)) {
    const hasKey = Boolean(String(process.env[envKey] || '').trim());
    if (!hasKey) {
      skipped += 1;
      details.push({ provider, status: 'skipped', reason: `${envKey} not set` });
      continue;
    }

    executed += 1;
    const model = providerSmokeModels[provider];

    const res = await invoke(handler, {
      method: 'POST',
      body: {
        action: 'chat',
        model,
        messages: [{ role: 'user', content: 'Return compact JSON: {"status":"ok"}' }],
      },
    });

    if (res.status === 200 && typeof res.body?.text === 'string' && res.body.text.trim().length > 0) {
      passed += 1;
      details.push({ provider, status: 'passed', model });
    } else {
      details.push({
        provider,
        status: 'failed',
        model,
        httpStatus: res.status,
        error: String(res.body?.error || '').slice(0, 200),
      });
    }
  }

  if (executed > 0 && passed !== executed) {
    const failed = details.filter((d) => d.status === 'failed');
    const summary = failed.map((f) => `${f.provider}:${f.httpStatus} ${f.error}`).join(' | ');
    throw new Error(`Live provider smoke failed: ${summary}`);
  }

  return { enabled: true, executed, passed, skipped, details };
};

const writeReport = (report) => {
  fs.mkdirSync(reportDir, { recursive: true });
  const target = path.join(reportDir, 'latest-regression-summary.json');
  fs.writeFileSync(target, JSON.stringify(report, null, 2));
};

const main = async () => {
  const started = Date.now();
  const golden = loadGolden();
  const structural = validateGoldenSchema(golden);
  const live = await runLiveProviderSmoke();

  const report = {
    timestamp: new Date().toISOString(),
    durationMs: Date.now() - started,
    structural,
    live,
  };

  writeReport(report);

  console.log('Golden schema: PASS');
  console.log(`Golden cases: ${structural.totalCases}`);
  console.log(`Scenarios covered: ${structural.scenarios.join(', ')}`);
  console.log(`Provider families: ${structural.providerFamilies.join(', ')}`);

  if (!live.enabled) {
    console.log('Live provider smoke: SKIPPED (set RUN_LIVE_PROVIDER_SMOKE=1 to enable)');
  } else {
    console.log(`Live provider smoke: ${live.passed}/${live.executed} passed, ${live.skipped} skipped`);
  }
};

try {
  await main();
} catch (error) {
  console.error('Golden suite failed');
  console.error(error);
  process.exit(1);
}
