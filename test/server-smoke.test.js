import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const projectRoot = new URL('../', import.meta.url);
let child;
let dataDir;
let origin;

async function availablePort() {
  return await new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

async function waitForServer(url, attempts = 50) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(`${url}/health`);
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error('Haven test server did not become ready');
}

before(async () => {
  const port = await availablePort();
  dataDir = await mkdtemp(join(tmpdir(), 'haven-test-'));
  origin = `http://127.0.0.1:${port}`;
  child = spawn(process.execPath, ['server.js'], {
    cwd: projectRoot,
    env: {
      ...process.env,
      PORT: String(port),
      PUBLIC_DIR: fileURLToPath(projectRoot),
      DATA_DIR: dataDir,
      HAVEN_VERSION: 'test',
      KEYCLOAK_ENABLED: 'false'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  await waitForServer(origin);
});

after(async () => {
  if (child && !child.killed) child.kill();
  if (dataDir) await rm(dataDir, { recursive: true, force: true });
});

test('health endpoint is available and never cached', async () => {
  const response = await fetch(`${origin}/health`);
  assert.equal(response.status, 200);
  assert.equal(await response.text(), 'healthy\n');
  assert.equal(response.headers.get('cache-control'), 'no-store');
});

test('static responses include the security baseline', async () => {
  const response = await fetch(`${origin}/`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-security-policy'), /default-src 'self'/);
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
  assert.equal(response.headers.get('cross-origin-opener-policy'), 'same-origin');
  assert.match(response.headers.get('content-security-policy'), /object-src 'none'/);
});

test('runtime config is generated without exposing secrets', async () => {
  const response = await fetch(`${origin}/config.js`);
  const body = await response.text();
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.match(body, /"enabled":false/);
  assert.doesNotMatch(body, /setupToken|HOME_ASSISTANT_TOKEN/);
});

test('unknown API paths return JSON rather than the app shell', async () => {
  const response = await fetch(`${origin}/api/not-a-real-route`);
  assert.equal(response.status, 404);
  assert.match(response.headers.get('content-type'), /application\/json/);
  assert.deepEqual(await response.json(), {
    error: 'API endpoint not found',
    path: '/api/not-a-real-route'
  });
});

test('protected APIs reject anonymous requests', async () => {
  const response = await fetch(`${origin}/api/applications`);
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: 'Keycloak authentication required' });
});

test('diagnostics and responsibility photos remain private', async () => {
  for (const path of ['/api/diagnostics', '/api/responsibility-photo?completionId=missing']) {
    const response = await fetch(`${origin}${path}`);
    assert.equal(response.status, 401);
  }
});

test('cross-origin mutations are rejected before request handling', async () => {
  const response = await fetch(`${origin}/api/responsibilities`, { method: 'POST', headers: { Origin: 'https://malicious.example', 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: 'Request origin does not match Haven' });
});
