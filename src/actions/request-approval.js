/**
 * request-approval action handler (rovo:action `request-approval`).
 * Builds the human approval card for a HOLD verdict. Only hold-for-review
 * verdicts get a card — an allow needs no human, and a veto must not be
 * overrideable by one. Posting the card as a Jira comment uses @forge/api
 * (api.asApp().requestJira) — that one call is still TODO because it can
 * only be exercised on a live site.
 */

'use strict';

/** Render a verdict as a human-readable approval card (Jira wiki markup). */
function renderApprovalCard(verdict) {
  const lines = [
    'h3. ⛔ VetoReview — human approval required',
    `*Decision:* ${verdict.decision}  *Risk score:* ${verdict.score}/100`,
    `*Action under review:* ${verdict.actionType} (requested via ${verdict.sourceType}, actor: ${verdict.actorType})`,
    '',
    '*Why this was flagged:*',
    ...verdict.reasons.map((r) => `- ${r}`),
    '',
    'A human must approve or reject this action. VetoReview does not execute it.',
  ];
  return lines.join('\n');
}

async function requestApproval(req) {
  const payload = (req && req.payload) || {};
  const verdict = JSON.parse(payload.verdictJson || '{}');

  if (verdict.decision !== 'hold-for-review') {
    return {
      status: 'not-required',
      decision: verdict.decision ?? null,
      issueKey: payload.issueKey ?? null,
    };
  }

  const card = renderApprovalCard(verdict);

  // TODO(forge): POST /rest/api/3/issue/{issueKey}/comment with `card`
  // via @forge/api, then return the comment id.
  return { status: 'card-rendered', issueKey: payload.issueKey ?? null, cardPreview: card };
}

module.exports = { requestApproval, renderApprovalCard };
