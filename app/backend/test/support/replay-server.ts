import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Capture } from './capture-store.ts';

export type RecordedRequest = { method: string; path: string; headers: Record<string, string>; body: string };

export type ReplayOptions = {
  /** Wait before sending headers (derived variant: delay). */
  delayMs?: number;
  /** Send only the first N body bytes, then destroy the socket (derived variant: truncation). */
  truncateAfterBytes?: number;
  /** Pause between SSE events (`\n\n`-separated) to make streaming observable. */
  chunkDelayMs?: number;
};

export type ReplayServer = {
  url: string;
  /** Every request received, in order (for request assertions such as TAC-001-04). */
  requests: RecordedRequest[];
  enqueue(capture: Capture, options?: ReplayOptions): void;
  close(): Promise<void>;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Serves queued real captures (or variants derived from them) to the code under test, FIFO. */
export async function startReplayServer(): Promise<ReplayServer> {
  const queue: Array<{ capture: Capture; options: ReplayOptions }> = [];
  const requests: RecordedRequest[] = [];

  const server = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    const headers: Record<string, string> = {};
    for (const [k, v] of Object.entries(req.headers)) if (v !== undefined) headers[k] = Array.isArray(v) ? v.join(', ') : v;
    requests.push({ method: req.method ?? 'GET', path: req.url ?? '/', headers, body: Buffer.concat(chunks).toString('utf8') });

    const item = queue.shift();
    if (!item) {
      res.writeHead(500, { 'content-type': 'text/plain' });
      res.end('replay server: no capture queued for this request');
      return;
    }
    const { capture, options } = item;
    if (options.delayMs) await sleep(options.delayMs);
    if (res.destroyed) return;
    const outHeaders = { ...capture.meta.response.headers };
    delete outHeaders['content-length'];
    res.writeHead(capture.meta.response.status, outHeaders);

    const body = options.truncateAfterBytes === undefined ? capture.body : capture.body.subarray(0, options.truncateAfterBytes);
    if (options.chunkDelayMs) {
      for (const part of body.toString('utf8').split(/(?<=\n\n)/)) {
        if (res.destroyed) return;
        res.write(part);
        await sleep(options.chunkDelayMs);
      }
    } else {
      res.write(body);
    }
    if (options.truncateAfterBytes !== undefined) res.destroy();
    else res.end();
  });

  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  return {
    url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    requests,
    enqueue(capture, options = {}) { queue.push({ capture, options }); },
    close: () => new Promise((r) => { server.closeAllConnections(); server.close(() => r()); }),
  };
}
