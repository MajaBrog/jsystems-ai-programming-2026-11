/** In-memory per-case lock (ADR-001 D4): non-blocking, single backend instance only. */
export type CaseLocks = {
  /** Returns false when a turn for this case is already running. */
  tryAcquire(caseId: string): boolean;
  release(caseId: string): void;
  isLocked(caseId: string): boolean;
};

export function createCaseLocks(): CaseLocks {
  const held = new Set<string>();
  return {
    tryAcquire(caseId) {
      if (held.has(caseId)) return false;
      held.add(caseId);
      return true;
    },
    release(caseId) {
      held.delete(caseId);
    },
    isLocked(caseId) {
      return held.has(caseId);
    },
  };
}
