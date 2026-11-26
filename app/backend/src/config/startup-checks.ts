import { access, constants, mkdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

/** Ensures APP_DATA_DIR and uploads/ exist and are writable (ADR-001 §3 StartupChecks). */
export async function runStartupChecks(opts: { dataDir: string }): Promise<void> {
  const uploads = join(opts.dataDir, 'uploads');
  try {
    await mkdir(uploads, { recursive: true });
    if (!(await stat(opts.dataDir)).isDirectory()) throw new Error('not a directory');
    await access(uploads, constants.W_OK);
  } catch {
    throw new Error(`APP_DATA_DIR is not a writable directory: ${opts.dataDir}`);
  }
}
