import { mkdtemp, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { runStartupChecks } from '../../src/config/startup-checks.ts';

describe('runStartupChecks (ADR-001 §3 StartupChecks)', () => {
  it('creates the data dir and uploads/ when missing (TAC-003-01 precondition)', async () => {
    const root = await mkdtemp(join(tmpdir(), 'copilot-'));
    const dataDir = join(root, 'nested', 'data');
    await runStartupChecks({ dataDir });
    expect((await stat(join(dataDir, 'uploads'))).isDirectory()).toBe(true);
  });

  it('fails when the data dir path is not a writable directory', async () => {
    const root = await mkdtemp(join(tmpdir(), 'copilot-'));
    const file = join(root, 'not-a-dir');
    await writeFile(file, 'x');
    await expect(runStartupChecks({ dataDir: file })).rejects.toThrow(/APP_DATA_DIR/);
  });
});
