'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const { createLiveRuntime } = require('../src/forge-runtime');
const { cardToAdf, requestApproval } = require('../src/actions/request-approval');
const index = require('../src/index');

/** Fake @forge/api: storage over a Map + requestJira capturing its call. */
function createFakeForgeApi({ commentStatus = 201, commentId = '10042' } = {}) {
  const data = new Map();
  const calls = [];
  const api = {
    storage: {
      async get(key) {
        return data.get(key);
      },
      async set(key, value) {
        data.set(key, value);
      },
    },
    route(strings, ...values) {
      return strings.reduce((acc, s, i) => acc + s + (values[i] ?? ''), '');
    },
    asApp() {
      return {
        async requestJira(url, options) {
          calls.push({ url, options });
          return {
            status: commentStatus,
            async json() {
              return { id: commentId };
            },
          };
        },
      };
    },
  };
  return { api, calls, data };
}

const HOLD_VERDICT = {
  decision: 'hold-for-review',
  score: 60,
  actionType: 'delete-issue',
  sourceType: 'comment',
  actorType: 'agent',
  reasons: ['Destructive action requested from untrusted content.'],
};

test('createLiveRuntime rejects mis-shaped api objects', () => {
  assert.throws(() => createLiveRuntime(null), TypeError);
  assert.throws(() => createLiveRuntime({}), TypeError);
  assert.throws(() => createLiveRuntime({ asApp: () => ({}) }), TypeError);
});

test('live runtime store persists audit entries in Forge storage', async () => {
  const { api, data } = createFakeForgeApi();
  const runtime = createLiveRuntime(api);
  await runtime.store.append('DEMO-7', { decision: 'veto', score: 120 });
  assert.equal(await runtime.store.count('DEMO-7'), 1);
  assert.equal(data.get('audit:DEMO-7')[0].decision, 'veto');
});

test('postJiraComment posts ADF to the issue comment endpoint and returns the id', async () => {
  const { api, calls } = createFakeForgeApi();
  const runtime = createLiveRuntime(api);
  const adf = cardToAdf(HOLD_VERDICT);
  const id = await runtime.postJiraComment('DEMO-7', adf);
  assert.equal(id, '10042');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, '/rest/api/3/issue/DEMO-7/comment');
  assert.equal(calls[0].options.method, 'POST');
  assert.deepEqual(JSON.parse(calls[0].options.body), { body: adf });
});

test('postJiraComment throws on a non-201 response', async () => {
  const { api } = createFakeForgeApi({ commentStatus: 403 });
  const runtime = createLiveRuntime(api);
  await assert.rejects(() => runtime.postJiraComment('DEMO-7', cardToAdf(HOLD_VERDICT)), /403/);
});

test('cardToAdf produces a valid ADF structure carrying the verdict facts', () => {
  const adf = cardToAdf(HOLD_VERDICT);
  assert.equal(adf.type, 'doc');
  assert.equal(adf.version, 1);
  const texts = [];
  (function walk(node) {
    if (node.type === 'text') texts.push(node.text);
    (node.content || []).forEach(walk);
  })(adf);
  const joined = texts.join(' ');
  assert.match(joined, /hold-for-review/);
  assert.match(joined, /60\/100/);
  assert.match(joined, /delete-issue/);
  assert.match(joined, /Destructive action requested/);
  const list = adf.content.find((n) => n.type === 'bulletList');
  assert.equal(list.content.length, 1);
});

test('requestApproval posts the card when a comment poster is injected', async () => {
  const posted = [];
  const res = await requestApproval(
    { payload: { issueKey: 'DEMO-7', verdictJson: JSON.stringify(HOLD_VERDICT) } },
    {
      postComment: async (issueKey, adf) => {
        posted.push({ issueKey, adf });
        return '10042';
      },
    }
  );
  assert.equal(res.status, 'card-posted');
  assert.equal(res.commentId, '10042');
  assert.equal(posted[0].issueKey, 'DEMO-7');
  assert.equal(posted[0].adf.type, 'doc');
});

test('requestApproval still refuses cards for veto verdicts even with a poster', async () => {
  let called = false;
  const res = await requestApproval(
    {
      payload: {
        issueKey: 'DEMO-7',
        verdictJson: JSON.stringify({ ...HOLD_VERDICT, decision: 'veto' }),
      },
    },
    {
      postComment: async () => {
        called = true;
        return 'x';
      },
    }
  );
  assert.equal(res.status, 'not-required');
  assert.equal(called, false);
});

test('index handlers fall back to in-memory wiring outside Forge', async () => {
  // No @forge/api in the test environment: logVerdict must still work
  // end to end on the default store, and panelResolver must read it back.
  const verdictJson = JSON.stringify({ ...HOLD_VERDICT, decision: 'allow', score: 0 });
  const logged = await index.logVerdict({
    payload: { issueKey: 'WIRE-1', verdictJson },
  });
  assert.equal(logged.status, 'logged');
  const view = await index.panelResolver({
    context: { extension: { issue: { key: 'WIRE-1' } } },
  });
  assert.equal(view.hasVerdict, true);
  assert.equal(view.latest.decision, 'allow');
});
