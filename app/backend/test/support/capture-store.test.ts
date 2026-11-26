import { mkdtemp, readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadCapture } from './capture-store.ts';
import { startRecordingProxy, type RecordingProxy } from './recording-proxy.ts';
import { startReplayServer, type ReplayServer } from './replay-server.ts';

// Tests of our own capture tooling. The "upstream" below is a local test server standing in for
// any HTTP origin; it is not an OpenRouter mock and its bytes are never used as OpenRouter data.
const closers: Array<() => Promise<void>> = [];
afterEach(async () => { while (closers.length) await closers.pop()!(); });

async function localUpstream(handler: Parameters<typeof createServer>[1]) {
  const server = createServer(handler);
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  closers.push(() => new Promise((r) => server.close(() => r())));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

describe('recording proxy', () => {
  it('forwards a request, streams the response through and saves it verbatim without the Authorization header', async () => {
    const upstream = await localUpstream((req, res) => {
      res.writeHead(200, { 'content-type': 'text/event-stream', 'x-upstream': 'yes' });
      res.write('data: {"a":1}\n\n');
      res.end('data: [DONE]\n\n');
    });
    const dir = await mkdtemp(join(tmpdir(), 'cap-'));
    const proxy: RecordingProxy = await startRecordingProxy({ upstream, captureDir: dir });
    closers.push(() => proxy.close());

    proxy.nextCaptureName('stream-sample');
    const res = await fetch(`${proxy.url}/api/v1/chat/completions`, {
      method: 'POST',
      headers: { authorization: 'Bearer sk-or-secret', 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'm', messages: [{ role: 'user', content: [{ type: 'image_url', image_url: { url: 'data:image/jpeg;base64,' + 'A'.repeat(5000) } }] }] }),
    });
    expect(await res.text()).toBe('data: {"a":1}\n\ndata: [DONE]\n\n');
    await proxy.flush();

    const cap = await loadCapture(dir, 'stream-sample');
    expect(cap.meta.response.status).toBe(200);
    expect(cap.meta.response.headers['x-upstream']).toBe('yes');
    expect(cap.body.toString()).toBe('data: {"a":1}\n\ndata: [DONE]\n\n');
    expect(cap.meta.request.path).toBe('/api/v1/chat/completions');
    const raw = await readFile(join(dir, 'stream-sample.meta.json'), 'utf8');
    expect(raw).not.toContain('sk-or-secret');
    expect(raw.toLowerCase()).not.toContain('authorization');
    expect(raw).not.toContain('A'.repeat(100)); // image data summarized, not stored
    expect(raw).toContain('base64, 5000 chars');
  });
});

describe('replay server', () => {
  it('serves a saved capture byte-for-byte and records incoming requests', async () => {
    const upstream = await localUpstream((_req, res) => { res.writeHead(201, { 'content-type': 'application/json' }); res.end('{"ok":true}'); });
    const dir = await mkdtemp(join(tmpdir(), 'cap-'));
    const proxy = await startRecordingProxy({ upstream, captureDir: dir });
    closers.push(() => proxy.close());
    proxy.nextCaptureName('json-sample');
    await (await fetch(`${proxy.url}/x`, { method: 'POST', body: '{}' })).text();
    await proxy.flush();

    const replay: ReplayServer = await startReplayServer();
    closers.push(() => replay.close());
    replay.enqueue(await loadCapture(dir, 'json-sample'));
    const res = await fetch(`${replay.url}/api/v1/chat/completions`, { method: 'POST', body: '{"model":"m"}' });
    expect(res.status).toBe(201);
    expect(await res.text()).toBe('{"ok":true}');
    expect(replay.requests).toHaveLength(1);
    expect(replay.requests[0]!.path).toBe('/api/v1/chat/completions');
    expect(JSON.parse(replay.requests[0]!.body)).toEqual({ model: 'm' });
  });

  it('answers 500 with a clear error when no capture is queued', async () => {
    const replay = await startReplayServer();
    closers.push(() => replay.close());
    const res = await fetch(`${replay.url}/anything`, { method: 'POST' });
    expect(res.status).toBe(500);
    expect(await res.text()).toContain('no capture queued');
  });
});
