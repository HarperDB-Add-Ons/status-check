import { suite, test, before, after } from 'node:test';
import { strictEqual, ok } from 'node:assert/strict';
import { setupHarperWithFixture, teardownHarper, type ContextWithHarper } from '@harperfast/integration-testing';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createRequire } from 'node:module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = resolve(__dirname, '..');

// harper's `exports` only exposes ".", so 'harper/dist/bin/harper.js' is not resolvable.
// Resolve the CLI from the (exported) main entry and pass it explicitly.
const require = createRequire(import.meta.url);
const harperBinPath = resolve(dirname(require.resolve('harper')), 'bin/harper.js');

function authFetch(ctx: ContextWithHarper, path: string, init: RequestInit & { headers?: Record<string, string> } = {}) {
    const { headers = {}, ...rest } = init;
    const creds = Buffer.from(`${ctx.harper.admin.username}:${ctx.harper.admin.password}`).toString('base64');
    return fetch(`${ctx.harper.httpURL}${path}`, { ...rest, headers: { Authorization: `Basic ${creds}`, ...headers } });
}

void suite('status-check component', (ctx: ContextWithHarper) => {
    before(async () => {
        await setupHarperWithFixture(ctx, FIXTURE_PATH, { harperBinPath });
    });

    after(async () => {
        await teardownHarper(ctx);
    });

    void test('GET /status returns 200 and a message by default', async () => {
        const res = await fetch(`${ctx.harper.httpURL}/status`);
        strictEqual(res.status, 200, `expected HTTP 200, got ${res.status}`);
        const body = await res.text();
        ok(body.length > 0, 'expected non-empty response body');
    });

    void test('POST /status (authenticated) sets node to online and GET returns 200', async () => {
        // First set offline via DELETE
        const delRes = await authFetch(ctx, '/status', { method: 'DELETE' });
        ok([200, 204].includes(delRes.status), `DELETE expected 200/204, got ${delRes.status}`);

        // Now restore to online via POST
        const postRes = await authFetch(ctx, '/status', { method: 'POST' });
        ok([200, 204].includes(postRes.status), `POST expected 200/204, got ${postRes.status}`);

        // GET should now return 200
        const getRes = await fetch(`${ctx.harper.httpURL}/status`);
        strictEqual(getRes.status, 200, `expected HTTP 200 after POST, got ${getRes.status}`);
    });

    void test('DELETE /status (authenticated) sets node to offline and GET returns 404', async () => {
        // Ensure we start online
        await authFetch(ctx, '/status', { method: 'POST' });

        // Set offline via DELETE
        const delRes = await authFetch(ctx, '/status', { method: 'DELETE' });
        ok([200, 204].includes(delRes.status), `DELETE expected 200/204, got ${delRes.status}`);

        // GET should now return 404
        const getRes = await fetch(`${ctx.harper.httpURL}/status`);
        strictEqual(getRes.status, 404, `expected HTTP 404 after DELETE, got ${getRes.status}`);
    });

    void test('GET /status is unauthenticated (no auth header required)', async () => {
        // Ensure online first
        await authFetch(ctx, '/status', { method: 'POST' });

        // Fetch without auth
        const res = await fetch(`${ctx.harper.httpURL}/status`);
        strictEqual(res.status, 200, `unauthenticated GET should return 200, got ${res.status}`);
    });

    void test('POST /status is authenticated (no auth header returns 401/403)', async () => {
        const res = await fetch(`${ctx.harper.httpURL}/status`, { method: 'POST' });
        ok([401, 403].includes(res.status), `unauthenticated POST should be rejected, got ${res.status}`);
    });

    void test('DELETE /status is authenticated (no auth header returns 401/403)', async () => {
        const res = await fetch(`${ctx.harper.httpURL}/status`, { method: 'DELETE' });
        ok([401, 403].includes(res.status), `unauthenticated DELETE should be rejected, got ${res.status}`);
    });
});
