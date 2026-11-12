/**
 * Append-only audit store for verdicts, keyed per issue.
 *
 * The store sits behind a minimal async backend interface ({ get, set })
 * shaped like Forge storage, so the live wiring (SPEC roadmap, 19–30 Nov)
 * only has to supply a backend backed by @forge/api storage — no handler
 * or pipeline code changes. Locally and in tests an in-memory backend is
 * used.
 *
 * Append-only by design: the only write path is append(), which reads the
 * existing entries and writes back a NEW array with the entry added.
 * Entries are frozen on write and handed out as copies, so a caller can
 * never rewrite history through a returned reference.
 */

'use strict';

function auditKey(issueKey) {
  return `audit:${issueKey ?? 'UNKNOWN'}`;
}

/** In-memory backend with the Forge-storage shape ({ get, set }). */
function createMemoryBackend() {
  const data = new Map();
  return {
    async get(key) {
      return data.get(key);
    },
    async set(key, value) {
      data.set(key, value);
    },
  };
}

function createAuditStore(backend = createMemoryBackend()) {
  const store = {
    /** Append one entry to the issue's log. Returns the stored entry. */
    async append(issueKey, entry) {
      const key = auditKey(issueKey);
      const existing = (await backend.get(key)) || [];
      const stored = Object.freeze({ ...entry });
      await backend.set(key, [...existing, stored]);
      return stored;
    },

    /** All entries for an issue, oldest first (copies — safe to mutate). */
    async list(issueKey) {
      const entries = (await backend.get(auditKey(issueKey))) || [];
      return entries.map((e) => ({ ...e }));
    },

    /** The most recent entry for an issue, or null. (For the issue panel.) */
    async latest(issueKey) {
      const entries = await store.list(issueKey);
      return entries.length ? entries[entries.length - 1] : null;
    },

    /** Number of entries recorded for an issue. */
    async count(issueKey) {
      const entries = (await backend.get(auditKey(issueKey))) || [];
      return entries.length;
    },
  };
  return store;
}

/** Shared default store (per-process; the Forge backend replaces it live). */
const defaultStore = createAuditStore();

module.exports = { createAuditStore, createMemoryBackend, defaultStore, auditKey };
