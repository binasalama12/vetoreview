/**
 * log-verdict action handler (rovo:action `log-verdict`).
 * SKELETON: defines the audit-log entry shape. Persistence uses Forge
 * storage (@forge/api storage.set under key `audit:<issueKey>`) — TODO
 * until the app runs on a live site. Entries are append-only by design:
 * an audit log an agent can rewrite is not an audit log.
 */

'use strict';

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

async function logVerdict(req) {
  const payload = (req && req.payload) || {};
  const verdict = JSON.parse(payload.verdictJson || '{}');
  const entry = buildAuditEntry(payload.issueKey ?? 'UNKNOWN', verdict, new Date().toISOString());

  // TODO(forge): storage.set(`audit:${entry.issueKey}`, [...existing, entry])
  return { status: 'skeleton', entry };
}

module.exports = { logVerdict, buildAuditEntry };
