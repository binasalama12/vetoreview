/**
 * VetoReview — Forge function handlers (entry point referenced by manifest.yml).
 * SKELETON: assessRisk is fully wired to the pure rules engine today.
 * requestApproval / logVerdict contain TODOs for the live Forge APIs
 * (@forge/api Jira REST + Forge storage) — they need a real site to test.
 */

'use strict';

const { assessRisk } = require('./actions/assess-risk');
const { requestApproval } = require('./actions/request-approval');
const { logVerdict } = require('./actions/log-verdict');

/** Resolver for the Jira issue panel: returns the latest verdict summary. */
async function panelResolver(req) {
  // TODO(forge): read the latest verdict for req.context.extension.issue.key
  // from Forge storage (see actions/log-verdict.js) and return it for display.
  return {
    status: 'skeleton',
    message: 'VetoReview panel — wire to Forge storage audit log.',
    issueKey: req?.context?.extension?.issue?.key ?? null,
  };
}

module.exports = { assessRisk, requestApproval, logVerdict, panelResolver };
