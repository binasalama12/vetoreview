/**
 * VetoReview — Forge function handlers (entry point referenced by manifest.yml).
 * assessRisk is fully wired to the pure rules engine. requestApproval and
 * logVerdict now run their real core logic (approval-card rendering with a
 * hold-only gate; append-only audit logging via src/audit/store.js) — what
 * still needs a live site is swapping in the Forge backends: the Jira REST
 * comment POST and the Forge-storage audit backend. The local verdict
 * pipeline (src/pipeline.js) exercises the same path end to end.
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
