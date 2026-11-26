import { mkdtemp, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createPhotoStore } from '../../src/imaging/photo-store.ts';
import { examplePhoto } from './fixtures.ts';

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'photostore-'));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('createPhotoStore', () => {
  const id = '3f2b8c1e-0000-4000-8000-000000000001';

  it('saves to uploads/{caseId}.jpg, creating uploads/, and reads it back', async () => {
    const store = createPhotoStore(dir);
    const jpeg = await examplePhoto('phone-2.jpeg');
    const rel = await store.save(id, jpeg);
    expect(rel).toBe(`uploads/${id}.jpg`);
    expect((await stat(join(dir, rel))).isFile()).toBe(true);
    expect(await store.read(rel)).toEqual(jpeg);
  });
  it('never overwrites an existing photo', async () => {
    const store = createPhotoStore(dir);
    await store.save(id, Buffer.from([1]));
    await expect(store.save(id, Buffer.from([2]))).rejects.toThrow();
    expect(await store.read(`uploads/${id}.jpg`)).toEqual(Buffer.from([1]));
  });
  it('deletes a photo (rollback) and tolerates a missing one', async () => {
    const store = createPhotoStore(dir);
    const rel = await store.save(id, Buffer.from([1]));
    await store.delete(rel);
    expect(await readdir(join(dir, 'uploads'))).toEqual([]);
    await expect(store.delete(rel)).resolves.toBeUndefined();
  });
  it('rejects path traversal and absolute paths on read and delete', async () => {
    const store = createPhotoStore(dir);
    for (const bad of ['../copilot.db', 'uploads/../copilot.db', '/etc/passwd', 'uploads/../../x.jpg', 'copilot.db', 'uploads']) {
      await expect(store.read(bad)).rejects.toThrow(/invalid photo path/i);
      await expect(store.delete(bad)).rejects.toThrow(/invalid photo path/i);
    }
  });
  it('rejects case ids that are not plain file names', async () => {
    const store = createPhotoStore(dir);
    await expect(store.save('../evil', Buffer.from([1]))).rejects.toThrow(/invalid case id/i);
  });
});
