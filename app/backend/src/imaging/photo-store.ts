import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { isAbsolute, join, normalize } from 'node:path';

export interface PhotoStore {
  save(caseId: string, jpeg: Buffer): Promise<string>;
  read(relativePath: string): Promise<Buffer>;
  delete(relativePath: string): Promise<void>;
}

const CASE_ID = /^[A-Za-z0-9_-]+$/;
const REL_PATH = /^uploads\/[A-Za-z0-9_-]+\.jpg$/;

/** Layout (ADR-003 §5): {dataDir}/uploads/{caseId}.jpg; the DB stores `uploads/{caseId}.jpg`. */
export function createPhotoStore(dataDir: string): PhotoStore {
  const resolve = (rel: string): string => {
    if (isAbsolute(rel) || normalize(rel) !== rel || !REL_PATH.test(rel)) {
      throw new Error(`Invalid photo path: ${rel}`);
    }
    return join(dataDir, rel);
  };
  return {
    async save(caseId, jpeg) {
      if (!CASE_ID.test(caseId)) throw new Error(`Invalid case id: ${caseId}`);
      const rel = `uploads/${caseId}.jpg`;
      await mkdir(join(dataDir, 'uploads'), { recursive: true });
      await writeFile(resolve(rel), jpeg, { flag: 'wx' }); // never overwrite
      return rel;
    },
    async read(rel) {
      return readFile(resolve(rel));
    },
    async delete(rel) {
      await rm(resolve(rel), { force: true });
    },
  };
}
