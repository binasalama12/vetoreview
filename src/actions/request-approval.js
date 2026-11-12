/**
 * request-approval action handler (rovo:action `request-approval`).
 * Builds the human approval card for a HOLD verdict. Only hold-for-review
 * verdicts get a card — an allow needs no human, and a veto must not be
 * overrideable by one.
 *
 * Posting: when a `postComment` dependency is injected (on a live site,
 * src/forge-runtime.js supplies the real Jira REST POST), the card is
 * posted to the issue as an ADF comment and the comment id returned.
 * Without it (local dev, tests, demo), the handler returns the rendered
 * card with status 'card-rendered' — same gate, no silent fake post.
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

function adfText(text) {
  return { type: 'text', text };
}

function adfParagraph(content) {
  return { type: 'paragraph', content };
}

/**
 * The same approval card as an Atlassian Document Format (ADF) document —
 * the body format the Jira Cloud REST API (v3) requires for comments.
 * Pure and structural: heading, decision line, context line, the reasons
 * as a bullet list, and the closing human-decides line.
 */
function cardToAdf(verdict) {
  return {
    type: 'doc',
    version: 1,
    content: [
      { type: 'heading', attrs: { level: 3 }, content: [adfText('⛔ VetoReview — human approval required')] },
      adfParagraph([
        { type: 'text', text: 'Decision: ', marks: [{ type: 'strong' }] },
        adfText(`${verdict.decision}  `),
        { type: 'text', text: 'Risk score: ', marks: [{ type: 'strong' }] },
        adfText(`${verdict.score}/100`),
      ]),
      adfParagraph([
        { type: 'text', text: 'Action under review: ', marks: [{ type: 'strong' }] },
        adfText(`${verdict.actionType} (requested via ${verdict.sourceType}, actor: ${verdict.actorType})`),
      ]),
      adfParagraph([{ type: 'text', text: 'Why this was flagged:', marks: [{ type: 'strong' }] }]),
      {
        type: 'bulletList',
        content: (verdict.reasons || []).map((r) => ({
          type: 'listItem',
          content: [adfParagraph([adfText(String(r))])],
        })),
      },
      adfParagraph([adfText('A human must approve or reject this action. VetoReview does not execute it.')]),
    ],
  };
}

/**
 * @param {object} req  Forge action request ({ payload: { issueKey, verdictJson } })
 * @param {object} [deps]
 * @param {(issueKey: string, adf: object) => Promise<string>} [deps.postComment]
 *   Live comment poster; when present and the verdict is a hold, the card
 *   is posted and the result status is 'card-posted' with the comment id.
 */
async function requestApproval(req, deps = {}) {
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

  if (typeof deps.postComment === 'function' && payload.issueKey) {
    const commentId = await deps.postComment(payload.issueKey, cardToAdf(verdict));
    return { status: 'card-posted', issueKey: payload.issueKey, commentId };
  }

  return { status: 'card-rendered', issueKey: payload.issueKey ?? null, cardPreview: card };
}

module.exports = { requestApproval, renderApprovalCard, cardToAdf };
