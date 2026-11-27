#!/usr/bin/env node
/**
 * T19 — probe the REAL running backend and record verbatim responses of our own API
 * (status, headers, raw body / SSE bytes) for frontend unit tests (AGENTS.md mock rule,
 * ADR-004 D2). Also logs SSE event order and first-token latency (ADR-001 TAC-001-01;
 * agents may not use curl).
 *
 * Usage (backend must be running):
 *   node app/scripts/sse-probe.mjs --base http://127.0.0.1:8080 --mode normal
 *   node app/scripts/sse-probe.mjs --base http://127.0.0.1:8080 --mode invalid-key   # backend started with an invalid key
 *   node app/scripts/sse-probe.mjs --base http://localhost:4200 --mode stream-only   # incremental delivery through the dev proxy
 *
 * Photos: only assets/example-images/ (never described to the model). Form data is invented.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const IMAGES = join(ROOT, 'assets', 'example-images');
const OUT = join(ROOT, 'app', 'frontend', 'src', 'testing', 'captures');

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1]]] : acc), []),
);
const BASE = args.base ?? 'http://127.0.0.1:8080';
const MODE = args.mode ?? 'normal';
const SAVE = args.save !== 'false';

function today(offsetDays = 0) {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Warsaw' }));
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function parseSse(text) {
  return text
    .split(/\n\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const ev = /^event: (.*)$/m.exec(block)?.[1];
      const data = /^data: (.*)$/m.exec(block)?.[1];
      return { event: ev, data: data ? JSON.parse(data) : null };
    });
}

/** Sends a request and captures status, headers and raw body bytes, timing each SSE event. */
async function exchange(name, url, init, requestSummary) {
  const started = performance.now();
  const res = await fetch(url, init);
  const headers = {};
  res.headers.forEach((v, k) => { headers[k] = v; });
  const timeline = [];
  let raw = '';
  if (res.body) {
    const decoder = new TextDecoder();
    for await (const chunk of res.body) {
      const text = decoder.decode(chunk, { stream: true });
      raw += text;
      for (const m of text.matchAll(/^event: (.*)$/gm)) timeline.push({ event: m[1], ms: Math.round(performance.now() - started) });
    }
  }
  const capture = {
    name,
    capturedAt: new Date().toISOString(),
    target: BASE,
    request: requestSummary,
    response: { status: res.status, headers, body: raw },
    note: 'Verbatim response of the real backend (T19). Frontend unit tests replay this; do not edit by hand.',
  };
  if (SAVE) {
    await mkdir(OUT, { recursive: true });
    await writeFile(join(OUT, `${name}.json`), JSON.stringify(capture, null, 2) + '\n');
  }
  const firstToken = timeline.find((t) => t.event === 'token');
  console.log(`[${name}] ${res.status} ${headers['content-type'] ?? ''} events=${timeline.map((t) => `${t.event}@${t.ms}ms`).join(' → ') || '-'}${firstToken ? ` firstToken=${firstToken.ms}ms` : ''}`);
  return { status: res.status, raw, events: parseSse(raw), headers };
}

async function photoBlob(file) {
  return new Blob([await readFile(join(IMAGES, file))], { type: 'application/octet-stream' });
}

async function submit(name, fields, photoFile) {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  if (photoFile) form.append('photo', await photoBlob(photoFile), photoFile);
  return exchange(name, `${BASE}/api/cases`, { method: 'POST', body: form }, { method: 'POST', path: '/api/cases', fields, photo: photoFile ?? null });
}

async function chat(name, caseId, content, signal) {
  return exchange(
    name,
    `${BASE}/api/cases/${caseId}/messages`,
    { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ content }), signal },
    { method: 'POST', path: '/api/cases/{id}/messages', body: { content } },
  );
}

const RETURN_FIELDS = (purchaseDate) => ({ caseType: 'RETURN', deviceCategory: 'SMARTPHONE', modelName: 'Testowy Telefon X', purchaseDate });
const COMPLAINT_FIELDS = {
  caseType: 'COMPLAINT', deviceCategory: 'LAPTOP', modelName: 'Testowy Laptop 14', purchaseDate: today(-200),
  description: 'Urządzenie przestało działać poprawnie podczas normalnego użytkowania.',
};
const caseIdOf = (r) => r.events.find((e) => e.event === 'completed')?.data?.caseId;

async function normal() {
  const health = await exchange('health', `${BASE}/api/health`, {}, { method: 'GET', path: '/api/health' });
  if (health.status !== 200) throw new Error('backend not healthy');

  await submit('submit-400-validation', { caseType: 'COMPLAINT', deviceCategory: 'LAPTOP', modelName: 'X', purchaseDate: today(1) }, 'phone-1.jpg');

  const complaint = await submit('submit-completed-complaint', COMPLAINT_FIELDS, 'laptop-1.png');
  const complaintId = caseIdOf(complaint);

  await submit('submit-photo-unusable', { ...RETURN_FIELDS(today(-3)), deviceCategory: 'TV', modelName: 'Testowy Telewizor 55' }, 'phone-2.jpeg');

  // Find a RETURN case whose initial category is not REJECT, so the physical-store statement can change it (AC-28).
  let returnId = null;
  for (const photo of ['phone-1.jpg', 'phone-3.jpeg', 'laptop-2.webp']) {
    const r = await submit(`submit-completed-return-${photo.replace(/\.[^.]+$/, '')}`, { ...RETURN_FIELDS(today(-3)), deviceCategory: photo.startsWith('laptop') ? 'LAPTOP' : 'SMARTPHONE' }, photo);
    const id = caseIdOf(r);
    if (!id) continue;
    const view = await exchange(`case-view-return-${photo.replace(/\.[^.]+$/, '')}`, `${BASE}/api/cases/${id}`, {}, { method: 'GET', path: '/api/cases/{id}' });
    if (JSON.parse(view.raw).currentCategory !== 'REJECT') { returnId = id; break; }
  }

  if (complaintId) {
    await exchange('case-view-200', `${BASE}/api/cases/${complaintId}`, {}, { method: 'GET', path: '/api/cases/{id}' });
    await chat('chat-unchanged', complaintId, 'Jaką datę zakupu podałem w formularzu?');
    // 409: two parallel turns on one case
    const [a, b] = await Promise.all([
      chat('chat-409-first', complaintId, 'Ile trwa rozpatrzenie zgłoszenia?'),
      new Promise((r) => setTimeout(r, 150)).then(() => chat('chat-409-conflict', complaintId, 'Drugie pytanie')),
    ]);
    console.log(`409 check: first=${a.status} second=${b.status}`);
  }
  if (returnId) {
    await chat('chat-assessment-changed', returnId, 'Chcę doprecyzować: kupiłem to urządzenie w sklepie stacjonarnym, nie przez internet.');
  } else {
    console.log('assessment_changed: NOT OBTAINED — every RETURN case started as REJECT');
  }
  await exchange('case-view-404', `${BASE}/api/cases/00000000-0000-4000-8000-000000000000`, {}, { method: 'GET', path: '/api/cases/{unknown}' });
}

async function invalidKey() {
  await submit('submit-error', COMPLAINT_FIELDS, 'phone-1.jpg');
  const caseId = args.case;
  if (caseId) await chat('chat-error', caseId, 'Ile trwa rozpatrzenie zgłoszenia?');
  else console.log('chat-error: pass --case <id of a case created with the valid key>');
}

async function streamOnly() {
  const r = await submit('proxy-stream-check', COMPLAINT_FIELDS, 'phone-3.jpeg');
  const id = caseIdOf(r);
  if (id) await chat('proxy-chat-stream-check', id, 'Ile trwa rozpatrzenie zgłoszenia?');
}

const run = { normal, 'invalid-key': invalidKey, 'stream-only': streamOnly }[MODE];
if (!run) throw new Error(`unknown --mode ${MODE}`);
await run();
