/**
 * VetoReview — Atlassian MCP exposure (SKELETON, pending capability check).
 *
 * When the `rovo:mcp` module in manifest.yml is enabled (after verifying it
 * is available on the free Atlassian Cloud Developer license), external
 * agents — e.g. a coding agent — can call VetoReview's assess-risk as an
 * MCP tool BEFORE performing an action in Jira/Confluence:
 *
 *   tool: vetoreview.assess_risk
 *   args: { actionType, contentText, sourceType, actorType, externalRecipients }
 *   returns: { decision, score, reasons, matches }
 *
 * The tool is the same rules-engine code path as the Rovo action
 * (src/actions/assess-risk.js). No separate judgement logic lives here —
 * one engine, two doors (Rovo agent inside Atlassian, MCP for outsiders).
 */

'use strict';

const TOOL_DEFINITIONS = [
  {
    name: 'vetoreview.assess_risk',
    description:
      'Assess whether a planned Jira/Confluence action should be allowed, held for human review, or vetoed. Call BEFORE executing consequential actions.',
    inputSchema: {
      type: 'object',
      required: ['actionType'],
      properties: {
        actionType: { type: 'string' },
        contentText: { type: 'string' },
        sourceType: { type: 'string' },
        actorType: { type: 'string' },
        externalRecipients: { type: 'array', items: { type: 'string' } },
      },
    },
    handler: 'assess-risk', // manifest action key
  },
];

module.exports = { TOOL_DEFINITIONS };
