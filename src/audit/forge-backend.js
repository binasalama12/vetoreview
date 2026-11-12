/**
 * Forge storage backend adapter for the audit store.
 *
 * The audit store (src/audit/store.js) only ever talks to a backend
 * shaped { get(key), set(key, value) }. This adapter wraps the Forge
 * storage API from @forge/api — `storage.get(key)` / `storage.set(key,
 * value)` — behind exactly that shape, so on a live site the store runs
 * on Forge storage with zero changes to handlers, pipeline, or panel.
 *
 * @forge/api is deliberately NOT required at module load: it only exists
 * inside the Forge runtime, and requiring it here would break local
 * development and tests. The storage object is injected instead —
 * locally by tests (a fake), on a live site by createForgeBackend().
 *
 * LIVE WIRING POINT (19–30 Nov window, needs a dev site): in the Forge
 * entry point, build the backend once and swap it into the store the
 * handlers use:
 *
 *   const { storage } = require('@forge/api');
 *   const backend = createForgeBackend(storage);
 *   const store = createAuditStore(backend);
 *
 * Until then, everything runs on the in-memory backend.
 */

'use strict';

/**
 * Adapt a Forge-style storage object ({ get, set }) to the audit-store
 * backend interface. Throws early if the injected object does not have
 * the expected shape — a miswired backend must fail loudly at startup,
 * not silently lose audit entries at verdict time.
 */
function createForgeBackend(storage) {
  if (!storage || typeof storage.get !== 'function' || typeof storage.set !== 'function') {
    throw new TypeError(
      'createForgeBackend requires a storage object with get(key) and set(key, value) functions'
    );
  }
  return {
    async get(key) {
      const value = await storage.get(key);
      // Forge storage returns undefined for missing keys; normalise to
      // undefined (the store treats both as "no entries yet").
      return value ?? undefined;
    },
    async set(key, value) {
      await storage.set(key, value);
    },
  };
}

module.exports = { createForgeBackend };
