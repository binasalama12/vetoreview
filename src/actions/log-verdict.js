/**
 * log-verdict action handler (rovo:action `log-verdict`).
 * Appends the verdict to the per-issue audit log via the audit store
 * (src/audit/store.js). On a live site the store runs on a Forge-storage
 * backend under key `audit:<issueKey>`; locally the default in-memory
 * backend is used — the handler code is identical either way.
 * Entries are append-only by design: an audit log an agent can rewrite
 * is not an audit log.
 */

'use strict';

const { defaultStore } = require('../audit/store');

function buildAuditEntry(issueKey, verdict, nowIso) {
  return {
    issueKey,
    at: nowIso,
    decision: verdict.decision,
    score: verdict.score,
    actionType: verdict.actionType,
    sourceType: verdict.sourceType,
    actorType: verdict.actorType,
    matchedPatterns: (verdict.matches || []).map((m) => m.id),
    reasons: verdict.reasons,
  };
}

async function logVerdict(req, store = defaultStore) {
  const payload = (req && req.payload) || {};
  const verdict = JSON.parse(payload.verdictJson || '{}');
  const entry = buildAuditEntry(payload.issueKey ?? 'UNKNOWN', verdict, new Date().toISOString());
  const stored = await store.append(entry.issueKey, entry);
  const totalEntries = await store.count(entry.issueKey);
  return { status: 'logged', entry: stored, totalEntries };
}

module.exports = { logVerdict, buildAuditEntry };
