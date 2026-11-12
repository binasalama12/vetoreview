'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const { createAuditStore, auditKey } = require('../src/audit/store');

test('append + list returns entries oldest first', async () => {
  const store = createAuditStore();
  await store.append('DEMO-1', { decision: 'allow', score: 0 });
  await store.append('DEMO-1', { decision: 'veto', score: 120 });
  const entries = await store.list('DEMO-1');
  assert.equal(entries.length, 2);
  assert.equal(entries[0].decision, 'allow');
  assert.equal(entries[1].decision, 'veto');
});

test('logs are isolated per issue', async () => {
  const store = createAuditStore();
  await store.append('AAA-1', { decision: 'allow' });
  await store.append('BBB-2', { decision: 'veto' });
  assert.equal(await store.count('AAA-1'), 1);
  assert.equal(await store.count('BBB-2'), 1);
  assert.equal((await store.list('AAA-1'))[0].decision, 'allow');
});

test('stored entries are frozen and listed entries are copies (append-only)', async () => {
  const store = createAuditStore();
  const stored = await store.append('DEMO-1', { decision: 'hold-for-review' });
  assert.ok(Object.isFrozen(stored));
  const listed = await store.list('DEMO-1');
  listed[0].decision = 'allow'; // mutating the copy must not rewrite history
  assert.equal((await store.list('DEMO-1'))[0].decision, 'hold-for-review');
});

test('latest returns the newest entry, or null for an unknown issue', async () => {
  const store = createAuditStore();
  assert.equal(await store.latest('NOPE-0'), null);
  await store.append('DEMO-1', { decision: 'allow' });
  await store.append('DEMO-1', { decision: 'veto' });
  assert.equal((await store.latest('DEMO-1')).decision, 'veto');
});

test('auditKey uses the audit:<issueKey> storage key shape', () => {
  assert.equal(auditKey('DEMO-1'), 'audit:DEMO-1');
  assert.equal(auditKey(undefined), 'audit:UNKNOWN');
});
