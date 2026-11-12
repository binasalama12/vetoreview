'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const { createAuditStore } = require('../src/audit/store');
const { logVerdict, buildAuditEntry } = require('../src/actions/log-verdict');
const { requestApproval, renderApprovalCard } = require('../src/actions/request-approval');

const HOLD_VERDICT = {
  decision: 'hold-for-review',
  score: 40,
  actionType: 'delete-issue',
  sourceType: 'user-prompt',
  actorType: 'human',
  matches: [],
  reasons: ['Action "delete-issue" carries base risk 40 (impact/irreversibility).'],
};

test('buildAuditEntry maps matches to pattern ids and keeps the verdict facts', () => {
  const verdict = {
    ...HOLD_VERDICT,
    decision: 'veto',
    score: 120,
    matches: [{ id: 'inj-override' }, { id: 'conceal-1' }],
  };
  const entry = buildAuditEntry('DEMO-1', verdict, '2026-11-12T00:00:00.000Z');
  assert.equal(entry.issueKey, 'DEMO-1');
  assert.equal(entry.at, '2026-11-12T00:00:00.000Z');
  assert.equal(entry.decision, 'veto');
  assert.deepEqual(entry.matchedPatterns, ['inj-override', 'conceal-1']);
  assert.equal(entry.actionType, 'delete-issue');
});

test('logVerdict appends to the store and reports the running total', async () => {
  const store = createAuditStore();
  const req = { payload: { issueKey: 'DEMO-1', verdictJson: JSON.stringify(HOLD_VERDICT) } };
  const first = await logVerdict(req, store);
  assert.equal(first.status, 'logged');
  assert.equal(first.totalEntries, 1);
  const second = await logVerdict(req, store);
  assert.equal(second.totalEntries, 2);
  assert.equal((await store.list('DEMO-1')).length, 2);
});

test('renderApprovalCard shows the decision, the action, and every reason', () => {
  const card = renderApprovalCard(HOLD_VERDICT);
  assert.match(card, /human approval required/);
  assert.match(card, /hold-for-review/);
  assert.match(card, /delete-issue/);
  assert.match(card, /base risk 40/);
  assert.match(card, /does not execute it/);
});

test('requestApproval renders a card only for hold-for-review verdicts', async () => {
  const hold = await requestApproval({
    payload: { issueKey: 'DEMO-1', verdictJson: JSON.stringify(HOLD_VERDICT) },
  });
  assert.equal(hold.status, 'card-rendered');
  assert.match(hold.cardPreview, /human approval required/);

  for (const decision of ['allow', 'veto']) {
    const res = await requestApproval({
      payload: { issueKey: 'DEMO-1', verdictJson: JSON.stringify({ ...HOLD_VERDICT, decision }) },
    });
    assert.equal(res.status, 'not-required');
    assert.equal(res.decision, decision);
    assert.equal(res.cardPreview, undefined);
  }
});
