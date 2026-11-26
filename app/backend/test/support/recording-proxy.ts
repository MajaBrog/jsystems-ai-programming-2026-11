import { createServer, type IncomingMessage } from 'node:http';
import type { AddressInfo } from 'node:net';
import { saveCapture, safeHeaders, summarizeRequestBody } from './capture-store.ts';

export type RecordingProxy = {
  url: string;
  /** Name for the next captured exchange (required before each request). */
  nextCaptureName(name: string, note?: string): void;
  /** Resolves when every finished exchange has been written to disk. */
  flush(): Promise<void>;
  close(): Promise<void>;
};

const HOP_BY_HOP = new Set(['host', 'connection', 'content-length', 'transfer-encoding', 'keep-alive', 'accept-encoding']);

async function readBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  return Buffer.concat(chunks);
}

/**
 * Local HTTP proxy that forwards every request to `upstream` (e.g. https://openrouter.ai), streams the
 * response back unchanged and saves it verbatim (ADR-005 replacement for WireMock record mode).
 */
export async function startRecordingProxy(opts: { upstream: string; captureDir: string }): Promise<RecordingProxy> {
  const pending: Promise<void>[] = [];
  let next: { name: string; note?: string } | null = null;

  const server = createServer(async (req, res) => {
    const target = next;
    next = null;
    const reqBody = await readBody(req);
    const headers: Record<string, string> = {};
    for (const [k, v] of Object.entries(req.headers)) {
      if (v !== undefined && !HOP_BY_HOP.has(k)) headers[k] = Array.isArray(v) ? v.join(', ') : v;
    }
    const url = new URL(req.url ?? '/', opts.upstream);
    let upstreamRes: Response;
    try {
      upstreamRes = await fetch(url, {
        method: req.method,
        headers,
        body: reqBody.length && req.method !== 'GET' ? reqBody : undefined,
      });
    } catch (e) {
      res.writeHead(502, { 'content-type': 'text/plain' });
      res.end(`recording proxy: upstream failed: ${(e as Error).message}`);
      return;
    }
    const respHeaders: Record<string, string> = {};
    upstreamRes.headers.forEach((v, k) => { if (!HOP_BY_HOP.has(k) && k !== 'content-encoding') respHeaders[k] = v; });
    res.writeHead(upstreamRes.status, respHeaders);

    const chunks: Buffer[] = [];
    if (upstreamRes.body) {
      for await (const chunk of upstreamRes.body) {
        const b = Buffer.from(chunk);
        chunks.push(b);
        res.write(b);
      }
    }
    res.end();

    if (!target) return; // unnamed exchanges are forwarded but not saved
    const summary = summarizeRequestBody(reqBody.toString('utf8'));
    const model = summary && typeof summary === 'object' && 'model' in summary ? String((summary as { model: unknown }).model) : null;
    pending.push(
      saveCapture(opts.captureDir, {
        meta: {
          name: target.name,
          capturedAt: new Date().toISOString(),
          target: url.origin,
          model,
          ...(target.note ? { note: target.note } : {}),
          request: { method: req.method ?? 'GET', path: url.pathname, headers: safeHeaders(req.headers), body: summary },
          response: { status: upstreamRes.status, headers: safeHeaders(respHeaders) },
        },
        body: Buffer.concat(chunks),
      }),
    );
  });

  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return {
    url,
    nextCaptureName(name, note) { next = note === undefined ? { name } : { name, note }; },
    async flush() { await Promise.all(pending); },
    close: () => new Promise((r) => server.close(() => r())),
  };
}
