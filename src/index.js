/**
 * VetoReview — Forge function handlers (entry point referenced by manifest.yml).
 *
 * Live wiring (slice 4): handlers resolve their dependencies through
 * src/forge-runtime.js. Inside the Forge runtime that yields the audit
 * store backed by Forge storage and the real Jira comment POST for
 * approval cards; outside it (local dev, tests, demo) everything falls
 * back to the in-memory defaults with identical handler code. Explicitly
 * injected dependencies (tests) always win over the live runtime.
 */

'use strict';

const { assessRisk } = require('./actions/assess-risk');
const { requestApproval } = require('./actions/request-approval');
const { logVerdict } = require('./actions/log-verdict');
const { resolvePanel } = require('./panel/resolver');
const { defaultStore } = require('./audit/store');
const { getLiveRuntime } = require('./forge-runtime');

/** The audit store to use: injected > live Forge storage > in-memory. */
function resolveStore(injected) {
  if (injected) return injected;
  const live = getLiveRuntime();
  return live ? live.store : defaultStore;
}

/**
 * Resolver for the Jira issue panel: returns the panel view model for the
 * issue in context — latest verdict + audit summary — built from the
 * audit store (live Forge storage on a real site).
 */
async function panelResolver(req, store) {
  const issueKey = req?.context?.extension?.issue?.key ?? null;
  return resolvePanel(resolveStore(store), issueKey);
}

/** log-verdict handler with the store resolved through the live wiring. */
async function logVerdictHandler(req, store) {
  return logVerdict(req, resolveStore(store));
}

/**
 * request-approval handler: on a live site the approval card is posted
 * to the issue as a real Jira comment (status 'card-posted'); without a
 * live runtime it returns the rendered card ('card-rendered').
 */
async function requestApprovalHandler(req, deps) {
  if (deps && typeof deps.postComment === 'function') {
    return requestApproval(req, deps);
  }
  const live = getLiveRuntime();
  return requestApproval(req, live ? { postComment: live.postJiraComment } : {});
}

module.exports = {
  assessRisk,
  requestApproval: requestApprovalHandler,
  logVerdict: logVerdictHandler,
  panelResolver,
};
