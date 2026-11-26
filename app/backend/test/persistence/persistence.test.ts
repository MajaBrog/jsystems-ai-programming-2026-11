import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { openDatabase } from '../../src/persistence/database.ts';
import { transaction } from '../../src/persistence/transaction.ts';
import { createCaseRepository, type CaseRecord } from '../../src/persistence/case-repository.ts';
import { createAssessmentRepository, type NewAssessment } from '../../src/persistence/assessment-repository.ts';
import { createMessageRepository, type NewMessage } from '../../src/persistence/message-repository.ts';
import { checkInvariants } from '../support/invariants.ts';

let dataDir: string;
let db: DatabaseSync;

beforeEach(async () => {
  dataDir = await mkdtemp(join(tmpdir(), 'copilot-persistence-'));
});
afterEach(async () => {
  try {
    db?.close();
  } catch {
    /* already closed */
  }
  await rm(dataDir, { recursive: true, force: true });
});

const CASE_ID = '3f2b8c1e-5d4a-4e6b-9c7d-1a2b3c4d5e6f';

function caseRecord(over: Partial<CaseRecord> = {}): CaseRecord {
  return {
    id: CASE_ID,
    caseType: 'COMPLAINT',
    deviceCategory: 'LAPTOP',
    modelName: 'Testbook Żółć 15',
    purchaseDate: '2026-10-01',
    description: 'Pęknięty ekran: ąęłńóśźż',
    photoPath: `uploads/${CASE_ID}.jpg`,
    imageAnalysis: { damage: ['crack'], nested: { score: 0.5 } },
    currentCategory: 'NEEDS_REVIEW',
    visionModel: 'vision-x',
    decisionModel: 'decision-y',
    createdAt: '2026-11-25T10:15:30.123Z',
    ...over,
  };
}
function assessment(over: Partial<NewAssessment> = {}): NewAssessment {
  return {
    caseId: CASE_ID,
    category: 'NEEDS_REVIEW',
    previousCategory: null,
    source: 'INITIAL',
    justification: [{ ruleId: 'C1', text: 'Uszkodzenie mechaniczne' }],
    nextSteps: ['Zanieś do serwisu', 'Zachowaj paragon'],
    guardApplied: null,
    createdAt: '2026-11-25T10:15:30.123Z',
    ...over,
  };
}
function message(over: Partial<NewMessage> = {}): NewMessage {
  return {
    caseId: CASE_ID,
    role: 'AGENT',
    content: 'Dzień dobry',
    assessmentId: null,
    createdAt: '2026-11-25T10:15:30.123Z',
    ...over,
  };
}
async function withPhoto(id = CASE_ID): Promise<void> {
  await mkdir(join(dataDir, 'uploads'), { recursive: true });
  await writeFile(join(dataDir, 'uploads', `${id}.jpg`), 'jpeg');
}

describe('openDatabase (TAC-003-01, TAC-003-05)', () => {
  it('creates the data dir, copilot.db and all tables in a fresh empty directory', () => {
    const fresh = join(dataDir, 'does', 'not', 'exist');
    db = openDatabase(fresh);
    expect(existsSync(join(fresh, 'copilot.db'))).toBe(true);
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
      .all()
      .map((r) => r.name);
    expect(tables).toEqual(['assessments', 'cases', 'messages']);
  });

  it('activates pragmas', () => {
    db = openDatabase(dataDir);
    expect(db.prepare('PRAGMA foreign_keys').get()).toEqual({ foreign_keys: 1 });
    expect(db.prepare('PRAGMA journal_mode').get()).toEqual({ journal_mode: 'wal' });
    expect(db.prepare('PRAGMA busy_timeout').get()).toEqual({ timeout: 5000 });
    expect(db.prepare('PRAGMA synchronous').get()).toEqual({ synchronous: 1 });
  });

  it('is idempotent: reopening keeps data and does not fail', () => {
    db = openDatabase(dataDir);
    createCaseRepository(db).insert(caseRecord());
    db.close();
    db = openDatabase(dataDir);
    expect(createCaseRepository(db).findById(CASE_ID)?.modelName).toBe('Testbook Żółć 15');
  });
});

describe('case repository', () => {
  beforeEach(() => {
    db = openDatabase(dataDir);
  });

  it('round-trips a case including Polish text, parsed JSON and null description', () => {
    const repo = createCaseRepository(db);
    repo.insert(caseRecord());
    expect(repo.findById(CASE_ID)).toEqual(caseRecord());
    const other = '11111111-1111-4111-8111-111111111111';
    repo.insert(caseRecord({ id: other, description: null, caseType: 'RETURN', photoPath: `uploads/${other}.jpg` }));
    expect(repo.findById(other)?.description).toBeNull();
  });

  it('returns undefined for unknown, malformed and injection-like ids', () => {
    const repo = createCaseRepository(db);
    repo.insert(caseRecord());
    expect(repo.findById('99999999-9999-4999-8999-999999999999')).toBeUndefined();
    expect(repo.findById('abc')).toBeUndefined();
    expect(repo.findById("' OR '1'='1")).toBeUndefined();
  });

  it('updateCurrentCategory returns the number of rows updated', () => {
    const repo = createCaseRepository(db);
    repo.insert(caseRecord());
    expect(repo.updateCurrentCategory(CASE_ID, 'ACCEPT')).toBe(1);
    expect(repo.findById(CASE_ID)?.currentCategory).toBe('ACCEPT');
    expect(repo.updateCurrentCategory('abc', 'ACCEPT')).toBe(0);
  });

  it('enforces CHECK constraints', () => {
    const repo = createCaseRepository(db);
    expect(() => repo.insert(caseRecord({ currentCategory: 'MAYBE' as never }))).toThrow(/constraint/i);
    expect(() => repo.insert(caseRecord({ caseType: 'EXCHANGE' as never }))).toThrow(/constraint/i);
    expect(() => repo.insert(caseRecord({ modelName: 'x' }))).toThrow(/constraint/i);
  });
});

describe('assessment repository', () => {
  beforeEach(() => {
    db = openDatabase(dataDir);
    createCaseRepository(db).insert(caseRecord());
  });

  it('round-trips with generated ids, JSON columns and guardApplied list', () => {
    const repo = createAssessmentRepository(db);
    const id1 = repo.insert(assessment());
    const id2 = repo.insert(
      assessment({ category: 'REJECT', previousCategory: 'NEEDS_REVIEW', source: 'CHAT_REVISION', guardApplied: ['G1', 'G3'] }),
    );
    expect(id2).toBeGreaterThan(id1);
    const list = repo.findByCase(CASE_ID);
    expect(list).toEqual([
      { ...assessment(), id: id1 },
      { ...assessment({ category: 'REJECT', previousCategory: 'NEEDS_REVIEW', source: 'CHAT_REVISION', guardApplied: ['G1', 'G3'] }), id: id2 },
    ]);
    expect(db.prepare('SELECT guard_applied FROM assessments WHERE id = ?').get(id2)).toEqual({ guard_applied: 'G1,G3' });
  });

  it('orders by createdAt then id, also when createdAt is equal or inserted out of order', () => {
    const repo = createAssessmentRepository(db);
    const a = repo.insert(assessment({ createdAt: '2026-11-25T10:00:00.000Z' }));
    const b = repo.insert(assessment({ createdAt: '2026-11-25T10:00:00.000Z' }));
    const c = repo.insert(assessment({ createdAt: '2026-11-25T10:00:01.000Z' }));
    expect(repo.findByCase(CASE_ID).map((r) => r.id)).toEqual([a, b, c]);
  });

  it('enforces FK to cases and CHECK on category', () => {
    const repo = createAssessmentRepository(db);
    expect(() => repo.insert(assessment({ caseId: '22222222-2222-4222-8222-222222222222' }))).toThrow(/constraint/i);
    expect(() => repo.insert(assessment({ category: 'X' as never }))).toThrow(/constraint/i);
  });
});

describe('message repository', () => {
  beforeEach(() => {
    db = openDatabase(dataDir);
    createCaseRepository(db).insert(caseRecord());
  });

  it('round-trips and links an assessment', () => {
    const aid = createAssessmentRepository(db).insert(assessment());
    const repo = createMessageRepository(db);
    const id = repo.insert(message({ assessmentId: aid }));
    expect(repo.findByCase(CASE_ID)).toEqual([{ ...message({ assessmentId: aid }), id }]);
  });

  it('orders by createdAt then id (5 messages, same millisecond)', () => {
    const repo = createMessageRepository(db);
    const ids = [1, 2, 3, 4, 5].map((n) => repo.insert(message({ content: `m${n}` })));
    expect(repo.findByCase(CASE_ID).map((m) => m.id)).toEqual(ids);
    expect(repo.findByCase(CASE_ID).map((m) => m.content)).toEqual(['m1', 'm2', 'm3', 'm4', 'm5']);
  });

  it('enforces FK and CHECK on role', () => {
    const repo = createMessageRepository(db);
    expect(() => repo.insert(message({ caseId: '22222222-2222-4222-8222-222222222222' }))).toThrow(/constraint/i);
    expect(() => repo.insert(message({ role: 'BOT' as never }))).toThrow(/constraint/i);
    expect(() => repo.insert(message({ assessmentId: 9999 }))).toThrow(/constraint/i);
  });

  it('cascades deletes from cases to assessments and messages', () => {
    createMessageRepository(db).insert(message());
    createAssessmentRepository(db).insert(assessment());
    db.prepare('DELETE FROM cases WHERE id = ?').run(CASE_ID);
    expect(createMessageRepository(db).findByCase(CASE_ID)).toEqual([]);
    expect(createAssessmentRepository(db).findByCase(CASE_ID)).toEqual([]);
  });
});

describe('transaction helper', () => {
  beforeEach(() => {
    db = openDatabase(dataDir);
  });
  const counts = () => ({
    cases: db.prepare('SELECT COUNT(*) AS n FROM cases').get()?.n,
    assessments: db.prepare('SELECT COUNT(*) AS n FROM assessments').get()?.n,
    messages: db.prepare('SELECT COUNT(*) AS n FROM messages').get()?.n,
  });

  it('commits and returns the callback result', () => {
    const result = transaction(db, () => {
      createCaseRepository(db).insert(caseRecord());
      return 42;
    });
    expect(result).toBe(42);
    expect(counts().cases).toBe(1);
    expect(db.isTransaction).toBe(false);
  });

  it('rolls back everything and rethrows when the callback throws (TAC-003-03)', () => {
    expect(() =>
      transaction(db, () => {
        createCaseRepository(db).insert(caseRecord());
        const aid = createAssessmentRepository(db).insert(assessment());
        createMessageRepository(db).insert(message({ assessmentId: aid }));
        createMessageRepository(db).insert(message({ role: 'BOT' as never })); // forced failure
      }),
    ).toThrow(/constraint/i);
    expect(counts()).toEqual({ cases: 0, assessments: 0, messages: 0 });
    expect(db.isTransaction).toBe(false);
  });

  it('rethrows the original error for non-DB failures and stays usable', () => {
    expect(() =>
      transaction(db, () => {
        throw new Error('boom');
      }),
    ).toThrow('boom');
    transaction(db, () => createCaseRepository(db).insert(caseRecord()));
    expect(counts().cases).toBe(1);
  });
});

describe('invariants helper (TAC-003-02)', () => {
  async function seedValid(): Promise<void> {
    db = openDatabase(dataDir);
    await withPhoto();
    transaction(db, () => {
      createCaseRepository(db).insert(caseRecord());
      const aid = createAssessmentRepository(db).insert(assessment());
      const messages = createMessageRepository(db);
      messages.insert(message({ assessmentId: aid }));
      messages.insert(message({ role: 'CUSTOMER', content: 'Pytanie' }));
      messages.insert(message({ role: 'AGENT', content: 'Odpowiedź' }));
    });
  }

  it('reports no violations for a consistent state', async () => {
    await seedValid();
    expect(checkInvariants(db, dataDir)).toEqual([]);
  });

  it('detects deliberately broken states (controlled mutation), then passes after revert', async () => {
    await seedValid();
    // I2 broken: current_category drifts from the latest assessment
    db.prepare("UPDATE cases SET current_category = 'ACCEPT' WHERE id = ?").run(CASE_ID);
    expect(checkInvariants(db, dataDir).some((v) => v.startsWith('I2'))).toBe(true);
    db.prepare("UPDATE cases SET current_category = 'NEEDS_REVIEW' WHERE id = ?").run(CASE_ID);
    expect(checkInvariants(db, dataDir)).toEqual([]);

    // I4 broken: photo file missing
    await rm(join(dataDir, 'uploads', `${CASE_ID}.jpg`));
    expect(checkInvariants(db, dataDir).some((v) => v.startsWith('I4'))).toBe(true);
    await withPhoto();
    expect(checkInvariants(db, dataDir)).toEqual([]);

    // I3 broken: two AGENT messages in a row
    const extra = createMessageRepository(db).insert(message({ role: 'AGENT', content: 'dubel' }));
    expect(checkInvariants(db, dataDir).some((v) => v.startsWith('I3'))).toBe(true);
    db.prepare('DELETE FROM messages WHERE id = ?').run(extra);
    expect(checkInvariants(db, dataDir)).toEqual([]);

    // I1 broken: case without any assessment/messages
    const bare = '44444444-4444-4444-8444-444444444444';
    await withPhoto(bare);
    createCaseRepository(db).insert(caseRecord({ id: bare, photoPath: `uploads/${bare}.jpg` }));
    expect(checkInvariants(db, dataDir).filter((v) => v.startsWith('I1')).length).toBeGreaterThan(0);
    db.prepare('DELETE FROM cases WHERE id = ?').run(bare);
    expect(checkInvariants(db, dataDir)).toEqual([]);
  });
});
