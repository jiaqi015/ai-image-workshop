import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const handlerModuleUrl = pathToFileURL(path.join(process.cwd(), 'api', 'history.js')).href;

const createMemoryBlobAdapter = () => {
  const byPath = new Map();

  const buildUrl = (pathValue) => `memory://blob/${encodeURIComponent(pathValue)}`;
  const parsePathFromUrl = (url) => {
    const clean = String(url || '').split('?')[0];
    if (!clean.startsWith('memory://blob/')) return null;
    const encoded = clean.slice('memory://blob/'.length);
    try {
      return decodeURIComponent(encoded);
    } catch {
      return null;
    }
  };

  const put = async (pathname, body, options = {}) => {
    const rawPath = String(pathname || '').trim();
    if (!rawPath) throw new Error('path is required');

    let finalPath = rawPath;
    if (options?.addRandomSuffix) {
      const suffix = Math.random().toString(36).slice(2, 8);
      const match = rawPath.match(/^(.*?)(\.[a-zA-Z0-9]+)$/);
      finalPath = match ? `${match[1]}-${suffix}${match[2]}` : `${rawPath}-${suffix}`;
    }

    const buffer = Buffer.isBuffer(body) ? body : Buffer.from(String(body ?? ''), 'utf8');
    const url = buildUrl(finalPath);
    byPath.set(finalPath, { path: finalPath, url, buffer, options });
    return { url, pathname: finalPath };
  };

  const list = async ({ prefix = '', limit = 1000 } = {}) => {
    const rows = [...byPath.values()]
      .filter((item) => item.path.startsWith(prefix))
      .sort((a, b) => a.path.localeCompare(b.path));

    return {
      blobs: rows.slice(0, limit).map((item) => ({ url: item.url, pathname: item.path })),
      cursor: '',
      hasMore: rows.length > limit,
    };
  };

  const del = async (urls) => {
    const listUrls = Array.isArray(urls) ? urls : [urls];
    for (const item of listUrls) {
      const maybePath = parsePathFromUrl(item);
      if (!maybePath) continue;
      byPath.delete(maybePath);
    }
  };

  const fetch = async (url) => {
    const maybePath = parsePathFromUrl(url);
    const row = maybePath ? byPath.get(maybePath) : null;
    if (!row) {
      return {
        ok: false,
        status: 404,
        json: async () => ({}),
      };
    }
    return {
      ok: true,
      status: 200,
      json: async () => JSON.parse(row.buffer.toString('utf8')),
    };
  };

  return { put, list, del, fetch };
};

const createEdgeConfigAdapter = (items = {}) => ({
  get: async (key) => items[key],
});

const createMemoryPgAdapter = () => {
  const byId = new Map();
  const sortRows = (rows) =>
    [...rows].sort((a, b) => Number(b.updated_at || 0) - Number(a.updated_at || 0) || String(b.id || '').localeCompare(String(a.id || '')));

  const query = async (text, values = []) => {
    const sql = String(text || '').toLowerCase();

    if (sql.includes('create table') || sql.includes('create index')) {
      return { rows: [], rowCount: 0 };
    }

    if (sql.includes('select 1')) {
      return { rows: [{ '?column?': 1 }], rowCount: 1 };
    }

    if (sql.includes('insert into history_records')) {
      const row = {
        id: String(values[0] || ''),
        timestamp: Number(values[1] || 0),
        updated_at: Number(values[2] || 0),
        created_at_iso: String(values[3] || ''),
        updated_at_iso: String(values[4] || ''),
        owner_id: String(values[5] || ''),
        user_input: String(values[6] || ''),
        client_ip: String(values[7] || ''),
        task_status: String(values[8] || ''),
        source: String(values[9] || ''),
        preview_image_url: String(values[10] || ''),
        plan_json: typeof values[11] === 'string' ? JSON.parse(values[11]) : values[11],
      };
      byId.set(row.id, row);
      return { rows: [], rowCount: 1 };
    }

    if (sql.includes('from history_records') && sql.includes('where (updated_at < $1')) {
      const updatedAt = Number(values[0] || 0);
      const id = String(values[1] || '');
      const limit = Number(values[2] || 0);
      const rows = sortRows(byId.values()).filter((row) => {
        const rowUpdatedAt = Number(row.updated_at || 0);
        if (rowUpdatedAt < updatedAt) return true;
        return rowUpdatedAt === updatedAt && String(row.id || '') < id;
      });
      return { rows: rows.slice(0, limit), rowCount: Math.min(rows.length, limit) };
    }

    if (sql.includes('from history_records') && sql.includes('order by updated_at desc, id desc')) {
      const limit = Number(values[0] || 0);
      const rows = sortRows(byId.values()).slice(0, limit);
      return { rows, rowCount: rows.length };
    }

    if (sql.includes('delete from history_records')) {
      const id = String(values[0] || '');
      const existed = byId.delete(id);
      return { rows: [], rowCount: existed ? 1 : 0 };
    }

    throw new Error(`Unsupported SQL in memory pg adapter: ${sql.slice(0, 80)}`);
  };

  return {
    query,
    dump: () => [...byId.values()],
  };
};

const loadHandler = async ({ envOverrides = {}, blobAdapter = null, fetchAdapter = null, edgeConfigAdapter = null, pgAdapter = null } = {}) => {
  for (const [key, value] of Object.entries(envOverrides)) {
    if (value === undefined || value === null) delete process.env[key];
    else process.env[key] = String(value);
  }

  const prevBlob = globalThis.__HISTORY_BLOB_ADAPTER__;
  const prevFetch = globalThis.__HISTORY_FETCH_ADAPTER__;
  const prevEdgeConfig = globalThis.__HISTORY_EDGE_CONFIG_ADAPTER__;
  const prevPg = globalThis.__HISTORY_PG_ADAPTER__;

  if (blobAdapter) globalThis.__HISTORY_BLOB_ADAPTER__ = blobAdapter;
  else delete globalThis.__HISTORY_BLOB_ADAPTER__;

  if (fetchAdapter) globalThis.__HISTORY_FETCH_ADAPTER__ = fetchAdapter;
  else delete globalThis.__HISTORY_FETCH_ADAPTER__;

  if (edgeConfigAdapter) globalThis.__HISTORY_EDGE_CONFIG_ADAPTER__ = edgeConfigAdapter;
  else delete globalThis.__HISTORY_EDGE_CONFIG_ADAPTER__;

  if (pgAdapter) globalThis.__HISTORY_PG_ADAPTER__ = pgAdapter;
  else delete globalThis.__HISTORY_PG_ADAPTER__;

  const mod = await import(`${handlerModuleUrl}?case=${Date.now()}-${Math.random()}`);

  if (prevBlob === undefined) delete globalThis.__HISTORY_BLOB_ADAPTER__;
  else globalThis.__HISTORY_BLOB_ADAPTER__ = prevBlob;

  if (prevFetch === undefined) delete globalThis.__HISTORY_FETCH_ADAPTER__;
  else globalThis.__HISTORY_FETCH_ADAPTER__ = prevFetch;

  if (prevEdgeConfig === undefined) delete globalThis.__HISTORY_EDGE_CONFIG_ADAPTER__;
  else globalThis.__HISTORY_EDGE_CONFIG_ADAPTER__ = prevEdgeConfig;

  if (prevPg === undefined) delete globalThis.__HISTORY_PG_ADAPTER__;
  else globalThis.__HISTORY_PG_ADAPTER__ = prevPg;

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

test('GET health reports blob unavailable when token missing', async () => {
  const handler = await loadHandler({
    envOverrides: { BLOB_READ_WRITE_TOKEN: undefined },
  });
  const res = await invoke(handler, { method: 'GET', query: { action: 'health' } });
  assert.equal(res.status, 200);
  assert.equal(res.body?.ok, true);
  assert.equal(res.body?.storage?.provider, 'vercel_blob');
  assert.equal(res.body?.storage?.configured, false);
  assert.equal(res.body?.storage?.connected, false);
});

test('GET list is rejected when blob token missing', async () => {
  const handler = await loadHandler({
    envOverrides: { BLOB_READ_WRITE_TOKEN: undefined },
  });
  const res = await invoke(handler, { method: 'GET', query: { action: 'list', limit: 1 } });
  assert.equal(res.status, 503);
  assert.equal(res.body?.ok, false);
  assert.match(String(res.body?.error || ''), /BLOB_READ_WRITE_TOKEN/i);
});

test('POST upsert rejects invalid JSON payload', async () => {
  const handler = await loadHandler({
    envOverrides: { BLOB_READ_WRITE_TOKEN: 'blob-test-token' },
  });
  const res = await invoke(handler, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{"action":"upsert","item":',
  });
  assert.equal(res.status, 400);
  assert.equal(res.body?.ok, false);
  assert.match(String(res.body?.error || ''), /json/i);
});

test('POST upsert requires item.plan object', async () => {
  const handler = await loadHandler({
    envOverrides: { BLOB_READ_WRITE_TOKEN: 'blob-test-token' },
  });
  const res = await invoke(handler, {
    method: 'POST',
    body: {
      action: 'upsert',
      item: {
        id: 'missing_plan_case',
      },
    },
  });
  assert.equal(res.status, 400);
  assert.equal(res.body?.ok, false);
  assert.match(String(res.body?.error || ''), /item\.plan/i);
});

test('upsert/list/delete roundtrip keeps task status, ip and timestamps', async () => {
  const memory = createMemoryBlobAdapter();
  const handler = await loadHandler({
    envOverrides: { BLOB_READ_WRITE_TOKEN: 'blob-test-token' },
    blobAdapter: memory,
    fetchAdapter: memory.fetch,
  });

  const baseTs = 1772546400000;
  const recordId = 'contract_history_001';

  const created = await invoke(handler, {
    method: 'POST',
    headers: { 'x-forwarded-for': '8.8.8.8, 1.1.1.1' },
    body: {
      action: 'upsert',
      item: {
        id: recordId,
        timestamp: baseTs,
        userInput: 'contract-probe',
        taskStatus: 'planning',
        plan: {
          title: 'contract probe',
          frames: ['one frame'],
        },
      },
    },
  });

  assert.equal(created.status, 200);
  assert.equal(created.body?.ok, true);
  assert.equal(created.body?.item?.id, recordId);
  assert.equal(created.body?.item?.taskStatus, 'planning');
  assert.equal(created.body?.item?.clientIp, '8.8.8.8');
  assert.equal(typeof created.body?.item?.createdAtIso, 'string');
  assert.equal(typeof created.body?.item?.updatedAtIso, 'string');
  assert.equal(created.body?.item?.source, 'vercel_blob');

  const listed = await invoke(handler, {
    method: 'GET',
    query: { action: 'list', limit: 10 },
  });
  assert.equal(listed.status, 200);
  assert.equal(listed.body?.ok, true);
  assert.ok(Array.isArray(listed.body?.items));
  assert.equal(listed.body.items.length, 1);
  assert.equal(listed.body.items[0].id, recordId);
  assert.equal(listed.body.items[0].taskStatus, 'planning');

  const updated = await invoke(handler, {
    method: 'POST',
    headers: { 'x-real-ip': '9.9.9.9' },
    body: {
      action: 'upsert',
      item: {
        id: recordId,
        timestamp: baseTs,
        userInput: 'contract-probe-finished',
        taskStatus: 'completed',
        plan: {
          title: 'contract probe done',
          frames: ['one frame', 'two frame'],
        },
      },
    },
  });

  assert.equal(updated.status, 200);
  assert.equal(updated.body?.item?.taskStatus, 'completed');
  assert.equal(updated.body?.item?.clientIp, '9.9.9.9');
  assert.ok(Number(updated.body?.item?.updatedAt) >= Number(created.body?.item?.updatedAt));

  const afterUpdate = await invoke(handler, {
    method: 'GET',
    query: { action: 'list', limit: 10 },
  });
  assert.equal(afterUpdate.status, 200);
  assert.equal(afterUpdate.body?.items?.[0]?.taskStatus, 'completed');
  assert.equal(afterUpdate.body?.items?.[0]?.plan?.frames?.length, 2);

  const removed = await invoke(handler, {
    method: 'POST',
    body: { action: 'delete', id: recordId },
  });
  assert.equal(removed.status, 200);
  assert.equal(removed.body?.ok, true);
  assert.ok(Number(removed.body?.deleted || 0) >= 2);

  const afterDelete = await invoke(handler, {
    method: 'GET',
    query: { action: 'list', limit: 10 },
  });
  assert.equal(afterDelete.status, 200);
  assert.equal(afterDelete.body?.items?.length, 0);
});

test('upsert persists renderFrames data url into blob url', async () => {
  const memory = createMemoryBlobAdapter();
  const handler = await loadHandler({
    envOverrides: { BLOB_READ_WRITE_TOKEN: 'blob-test-token' },
    blobAdapter: memory,
    fetchAdapter: memory.fetch,
  });

  const res = await invoke(handler, {
    method: 'POST',
    body: {
      action: 'upsert',
      item: {
        id: 'render_frame_blob_case',
        timestamp: 1772546400001,
        userInput: 'render frame probe',
        plan: {
          title: 'render frame probe',
          frames: ['f1'],
          renderFrames: [
            {
              id: 1,
              description: 'render one',
              status: 'completed',
              imageUrl: 'data:image/png;base64,aGVsbG8=',
            },
          ],
        },
      },
    },
  });

  assert.equal(res.status, 200);
  assert.equal(res.body?.ok, true);
  const imageUrl = String(res.body?.item?.plan?.renderFrames?.[0]?.imageUrl || '');
  assert.match(imageUrl, /^memory:\/\/blob\//);
});

test('production requires history token by default and allows explicit bypass', async () => {
  const memory = createMemoryBlobAdapter();

  const lockedHandler = await loadHandler({
    envOverrides: {
      NODE_ENV: 'production',
      BLOB_READ_WRITE_TOKEN: 'blob-test-token',
      HISTORY_GATEWAY_TOKEN: undefined,
      AI_GATEWAY_TOKEN: undefined,
      HISTORY_ALLOW_ANON_IN_PROD: undefined,
    },
    blobAdapter: memory,
    fetchAdapter: memory.fetch,
  });
  const blocked = await invoke(lockedHandler, { method: 'GET', query: { action: 'list', limit: 1 } });
  assert.equal(blocked.status, 401);
  assert.equal(blocked.body?.ok, false);

  const openHandler = await loadHandler({
    envOverrides: {
      NODE_ENV: 'production',
      BLOB_READ_WRITE_TOKEN: 'blob-test-token',
      HISTORY_GATEWAY_TOKEN: undefined,
      AI_GATEWAY_TOKEN: undefined,
      HISTORY_ALLOW_ANON_IN_PROD: '1',
    },
    blobAdapter: memory,
    fetchAdapter: memory.fetch,
  });
  const allowed = await invoke(openHandler, { method: 'GET', query: { action: 'list', limit: 1 } });
  assert.equal(allowed.status, 200);
  assert.equal(allowed.body?.ok, true);
});

test('edge config policy can enforce read-only and override auth requirement', async () => {
  const memory = createMemoryBlobAdapter();
  const edge = createEdgeConfigAdapter({
    'history.policy': {
      enabled: true,
      readOnly: true,
      allowAnonInProd: true,
      requireHistoryToken: false,
      maxBodyBytes: 1024,
    },
  });

  const handler = await loadHandler({
    envOverrides: {
      NODE_ENV: 'production',
      EDGE_CONFIG: 'https://edge-config.example/mock',
      BLOB_READ_WRITE_TOKEN: 'blob-test-token',
      HISTORY_GATEWAY_TOKEN: undefined,
      AI_GATEWAY_TOKEN: undefined,
      HISTORY_ALLOW_ANON_IN_PROD: undefined,
    },
    blobAdapter: memory,
    fetchAdapter: memory.fetch,
    edgeConfigAdapter: edge,
  });

  const health = await invoke(handler, { method: 'GET', query: { action: 'health' } });
  assert.equal(health.status, 200);
  assert.equal(health.body?.runtime?.source, 'edge_config');
  assert.equal(health.body?.runtime?.readOnly, true);
  assert.equal(health.body?.runtime?.requestBodyLimitBytes, 1024);
  assert.equal(health.body?.auth?.required, false);
  assert.equal(health.body?.edgeConfig?.connected, true);

  const listed = await invoke(handler, { method: 'GET', query: { action: 'list', limit: 1 } });
  assert.equal(listed.status, 200);
  assert.equal(listed.body?.ok, true);

  const writeAttempt = await invoke(handler, {
    method: 'POST',
    body: {
      action: 'upsert',
      item: {
        id: 'edge_config_read_only_case',
        timestamp: 1772546401000,
        userInput: 'readonly',
        plan: { title: 'readonly-case', frames: ['f1'] },
      },
    },
  });
  assert.equal(writeAttempt.status, 503);
  assert.equal(writeAttempt.body?.ok, false);
  assert.match(String(writeAttempt.body?.error || ''), /只读/i);
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
    console.log(`\nHistory Contracts: ${passed}/${tests.length} passed in ${duration}s`);
  }
};

await main();
