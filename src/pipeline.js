/**
 * VetoReview verdict pipeline — the single orchestration path behind the
 * Rovo agent, automations, and (later) MCP callers:
 *
 *   assess → (hold? render the approval card) → append audit entry
 *
 * The engine judges; the pipeline only routes. Every verdict — allow,
 * hold, and veto alike — is written to the audit log: an allow that
 * leaves no trace is how silent failures start.
 *
 * VetoReview is a checkpoint, never an executor: this pipeline returns a
 * verdict, an optional approval card, and the audit entry. It never
 * performs the reviewed action.
 */

'use strict';

const { assess } = require('./rules');
const { renderApprovalCard } = require('./actions/request-approval');
const { buildAuditEntry } = require('./actions/log-verdict');
const { defaultStore } = require('./audit/store');

/**
 * @param {object} input  assess() input plus `issueKey`
 * @param {object} [options]
 * @param {object} [options.store]   audit store (default: shared in-memory)
 * @param {string} [options.nowIso]  timestamp override (tests)
 * @returns {Promise<{verdict:object, approvalCard:string|null,
 *                    auditEntry:object, auditCount:number}>}
 */
async function reviewAction(input, options = {}) {
  const store = options.store || defaultStore;
  const issueKey = (input && input.issueKey) ?? 'UNKNOWN';

  const verdict = assess(input || {});
  const approvalCard =
    verdict.decision === 'hold-for-review' ? renderApprovalCard(verdict) : null;

  const entry = buildAuditEntry(issueKey, verdict, options.nowIso || new Date().toISOString());
  const auditEntry = await store.append(issueKey, entry);
  const auditCount = await store.count(issueKey);

  return { verdict, approvalCard, auditEntry, auditCount };
}

module.exports = { reviewAction };
