'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const { createAuditStore, createMemoryBackend } = require('../src/audit/store');
const { createForgeBackend } = require('../src/audit/forge-backend');

/**
 * Minimal fake with the @forge/api storage shape: async get/set over a
 * Map, returning undefined for missing keys (as Forge storage does).
 * This is the ONLY stand-in for Forge storage in the repo — the real
 * wiring passes `require('@forge/api').storage` (see forge-backend.js).
 */
function createFakeForgeStorage() {
  const data = new Map();
  return {
    async get(key) {
      return data.get(key);
    },
    async set(key, value) {
      data.set(key, value);
    },
    _data: data,
  };
}

/**
 * The backend contract every audit-store backend must satisfy. The same
 * assertions run against the in-memory backend and the Forge adapter —
 * if both pass, swapping backends behind the store changes nothing.
 */
async function assertBackendContract(t, makeBackend) {
  await t.test('get of a missing key resolves to undefined', async () => {
    const backend = makeBackend();
    assert.equal(await backend.get('audit:NOPE-0'), undefined);
  });

  await t.test('set then get returns the stored value', async () => {
    const backend = makeBackend();
    await backend.set('audit:X-1', [{ decision: 'allow' }]);
    assert.deepEqual(await backend.get('audit:X-1'), [{ decision: 'allow' }]);
  });

  await t.test('set overwrites the previous value under the same key', async () => {
    const backend = makeBackend();
    await backend.set('k', [1]);
    await backend.set('k', [1, 2]);
    assert.deepEqual(await backend.get('k'), [1, 2]);
  });

  await t.test('keys are independent', async () => {
    const backend = makeBackend();
    await backend.set('audit:A-1', ['a']);
    await backend.set('audit:B-2', ['b']);
    assert.deepEqual(await backend.get('audit:A-1'), ['a']);
    assert.deepEqual(await backend.get('audit:B-2'), ['b']);
  });
}

test('backend contract — in-memory backend', async (t) => {
  await assertBackendContract(t, () => createMemoryBackend());
});

test('backend contract — Forge storage adapter over a fake', async (t) => {
  await assertBackendContract(t, () => createForgeBackend(createFakeForgeStorage()));
});

test('audit store behaves identically on the Forge adapter backend', async () => {
  const store = createAuditStore(createForgeBackend(createFakeForgeStorage()));
  await store.append('DEMO-1', { decision: 'allow', score: 0 });
  await store.append('DEMO-1', { decision: 'veto', score: 120 });
  assert.equal(await store.count('DEMO-1'), 2);
  assert.equal((await store.latest('DEMO-1')).decision, 'veto');
  const listed = await store.list('DEMO-1');
  listed[0].decision = 'veto'; // copies — history must not change
  assert.equal((await store.list('DEMO-1'))[0].decision, 'allow');
});

test('createForgeBackend rejects objects without the storage shape', () => {
  assert.throws(() => createForgeBackend(null), TypeError);
  assert.throws(() => createForgeBackend({}), TypeError);
  assert.throws(() => createForgeBackend({ get: async () => undefined }), TypeError);
});
