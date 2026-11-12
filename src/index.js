/**
 * VetoReview — Forge function handlers (entry point referenced by manifest.yml).
 * assessRisk is fully wired to the pure rules engine. requestApproval and
 * logVerdict run their real core logic (approval-card rendering with a
 * hold-only gate; append-only audit logging via src/audit/store.js), and
 * panelResolver now reads the latest verdict from the audit store via
 * src/panel/resolver.js. What still needs a live site is swapping in the
 * Forge backends: the Jira REST comment POST and the Forge-storage audit
 * backend (src/audit/forge-backend.js, one line at startup). The local
 * verdict pipeline (src/pipeline.js) exercises the same path end to end.
 */

'use strict';

const { assessRisk } = require('./actions/assess-risk');
const { requestApproval } = require('./actions/request-approval');
const { logVerdict } = require('./actions/log-verdict');
const { resolvePanel } = require('./panel/resolver');
const { defaultStore } = require('./audit/store');

/**
 * Resolver for the Jira issue panel: returns the panel view model for the
 * issue in context — latest verdict + audit summary — built from the
 * audit store. `store` is injectable for tests; the live Forge resolver
 * call passes only `req`, and the store behind it is the Forge-backed
 * one once the wiring in src/audit/forge-backend.js is switched on.
 */
async function panelResolver(req, store = defaultStore) {
  const issueKey = req?.context?.extension?.issue?.key ?? null;
  return resolvePanel(store, issueKey);
}

module.exports = { assessRisk, requestApproval, logVerdict, panelResolver };
