import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createCaseViaApi, createHarness, examplePhoto, jsonOf, VALID_COMPLAINT_FIELDS, type Harness } from './support.ts';

let h: Harness;
beforeEach(async () => {
  h = await createHarness();
});
afterEach(async () => {
  expect(h.invariants()).toEqual([]);
  await h.close();
});

describe('GET /api/cases/:id', () => {
  it('returns the CaseView without the image analysis (ADR-001 §4)', async () => {
    const id = await createCaseViaApi(h, VALID_COMPLAINT_FIELDS, 'phone-2.jpeg');
    const res = await fetch(`${h.baseUrl}/api/cases/${id}`);
    expect(res.status).toBe(200);
    const view = await jsonOf(res);
    expect(Object.keys(view).sort()).toEqual(
      ['assessments', 'caseType', 'createdAt', 'currentCategory', 'description', 'deviceCategory', 'id', 'messages', 'modelName', 'photoUrl', 'purchaseDate'],
    );
    expect(view).toMatchObject({
      id,
      caseType: 'COMPLAINT',
      deviceCategory: 'LAPTOP',
      modelName: 'ThinkPad X1',
      purchaseDate: '2026-11-20',
      description: 'Ekran przestał działać po tygodniu.',
      photoUrl: `/api/cases/${id}/photo`,
      currentCategory: 'ACCEPT',
    });
    expect(view.assessments).toHaveLength(1);
    expect(Object.keys(view.assessments[0]).sort()).toEqual(['category', 'createdAt', 'justification', 'nextSteps', 'previousCategory', 'source']);
    expect(view.assessments[0]).toMatchObject({ category: 'ACCEPT', previousCategory: null, source: 'INITIAL' });
    expect(view.messages).toHaveLength(1);
    expect(view.messages[0]).toMatchObject({ role: 'AGENT', assessmentCategory: 'ACCEPT' });
    expect(view.messages[0].content).toContain('Wstępna ocena: Przyjęte wstępnie');
    expect(JSON.stringify(view)).not.toMatch(/imageAnalysis|image_analysis|observations|likelyCause/);
  });

  it('404 CASE_NOT_FOUND for unknown and malformed ids', async () => {
    for (const id of ['0b6f1c1e-47f0-4d9b-9c36-5b8f5d1c2a11', 'nie-uuid', '..%2Fetc', '1%27%20OR%201%3D1']) {
      const res = await fetch(`${h.baseUrl}/api/cases/${id}`);
      expect(res.status, id).toBe(404);
      expect((await jsonOf(res)).code).toBe('CASE_NOT_FOUND');
    }
  });
});

describe('GET /api/cases/:id/photo', () => {
  it('serves the stored compressed JPEG with a private cache header', async () => {
    const id = await createCaseViaApi(h, undefined, 'laptop-2.webp');
    const res = await fetch(`${h.baseUrl}/api/cases/${id}/photo`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/jpeg');
    expect(res.headers.get('cache-control')).toBe('private, max-age=3600');
    const bytes = Buffer.from(await res.arrayBuffer());
    expect(bytes.subarray(0, 3)).toEqual(Buffer.from([0xff, 0xd8, 0xff]));
    expect(bytes).toEqual(await h.photoStore.read(`uploads/${id}.jpg`));
    // the original WEBP was not stored (ADR-001 D2)
    expect(bytes.length).not.toBe((await examplePhoto('laptop-2.webp')).bytes.length);
  });

  it('404 for unknown / malformed ids', async () => {
    for (const id of ['0b6f1c1e-47f0-4d9b-9c36-5b8f5d1c2a11', 'nie-uuid']) {
      expect((await fetch(`${h.baseUrl}/api/cases/${id}/photo`)).status).toBe(404);
    }
  });

  it('404 when the case row exists but the file is gone', async () => {
    const id = await createCaseViaApi(h);
    await h.photoStore.delete(`uploads/${id}.jpg`);
    expect((await fetch(`${h.baseUrl}/api/cases/${id}/photo`)).status).toBe(404);
    // restore I4 for afterEach
    h.db.exec('PRAGMA foreign_keys=ON');
    h.db.prepare('DELETE FROM cases WHERE id = ?').run(id);
  });
});
