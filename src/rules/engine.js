/**
 * VetoReview — risk classification engine (pure, no Atlassian imports).
 *
 * Given a *planned action* by an agent/automation (or a human) plus the
 * content that requested it, decide one of:
 *
 *   allow            – proceed, nothing suspicious found
 *   hold-for-review  – pause; a human approval card is posted
 *   veto             – refuse; the action must not execute as requested
 *
 * Design rules (fail-closed, explainable):
 *  1. Every point of score comes with a human-readable reason.
 *  2. A hard-veto pattern (instruction override, admin grant, mass delete,
 *     concealment) combined with a destructive action => veto, regardless
 *     of the numeric total.
 *  3. A destructive action requested from UNTRUSTED content (issue body,
 *     comment, tool output, webhook) is never auto-allowed: minimum hold,
 *     even with zero pattern matches. Content is data, not instructions.
 *  4. The engine never executes anything. It only judges.
 */

'use strict';

const { PATTERNS, PERSONAL_EMAIL_DOMAINS } = require('./patterns');

// Base risk of the action itself, independent of the requesting text.
const ACTION_RISK = {
  comment: 0,
  'add-label': 0,
  transition: 5,
  assign: 5,
  'edit-fields': 10,
  'add-watcher': 10,
  'close-issue': 15,
  'share-external': 25,
  'delete-attachment': 30,
  'change-permissions': 35,
  'delete-issue': 40,
  'delete-page': 40,
  'bulk-close': 45,
  'bulk-delete': 55,
};

// Actions whose effects are destructive, irreversible, or cross a trust
// boundary. Used by hard rules 2 and 3.
const HIGH_IMPACT_ACTIONS = new Set([
  'share-external',
  'delete-attachment',
  'change-permissions',
  'delete-issue',
  'delete-page',
  'bulk-close',
  'bulk-delete',
]);

// Sources whose text must be treated as untrusted data. Only a direct
// prompt from an authenticated human session counts as trusted intent.
const UNTRUSTED_SOURCES = new Set([
  'issue-description',
  'comment',
  'tool-output',
  'webhook',
  'email',
  'unknown',
]);

const HOLD_THRESHOLD = 30;
const VETO_THRESHOLD = 70;

function excerptAround(text, index, matchLength) {
  const start = Math.max(0, index - 30);
  const end = Math.min(text.length, index + matchLength + 30);
  return (start > 0 ? '…' : '') + text.slice(start, end).replace(/\s+/g, ' ').trim() + (end < text.length ? '…' : '');
}

/**
 * @param {object} request
 * @param {string} request.actionType        see ACTION_RISK keys
 * @param {string} [request.contentText]     text that requested the action
 * @param {string} [request.sourceType]      user-prompt | issue-description | comment | tool-output | webhook | email | unknown
 * @param {string} [request.actorType]       agent | automation | human
 * @param {string[]} [request.externalRecipients] emails/domains the action sends data to
 * @returns {{decision:string, score:number, reasons:string[], matches:object[]}}
 */
function assess(request) {
  const {
    actionType = 'comment',
    contentText = '',
    sourceType = 'unknown',
    actorType = 'agent',
    externalRecipients = [],
  } = request || {};

  const reasons = [];
  const matches = [];
  let score = 0;

  const baseRisk = ACTION_RISK[actionType] ?? 10;
  if (baseRisk > 0) {
    score += baseRisk;
    reasons.push(`Action "${actionType}" carries base risk ${baseRisk} (impact/irreversibility).`);
  }

  const untrusted = UNTRUSTED_SOURCES.has(sourceType);
  const highImpact = HIGH_IMPACT_ACTIONS.has(actionType);

  // --- pattern scan over the requesting content ---------------------------
  let sawHardVeto = false;
  let sawInjection = false;
  if (contentText) {
    for (const pattern of PATTERNS) {
      const m = pattern.regex.exec(contentText);
      if (!m) continue;
      score += pattern.weight;
      if (pattern.hardVeto) sawHardVeto = true;
      if (pattern.category === 'injection') sawInjection = true;
      matches.push({
        id: pattern.id,
        category: pattern.category,
        weight: pattern.weight,
        excerpt: excerptAround(contentText, m.index, m[0].length),
      });
      reasons.push(`${pattern.reason} (+${pattern.weight})`);
    }
  }

  // --- agent acting on instructions planted in untrusted content ----------
  if (sawInjection && untrusted && actorType !== 'human') {
    score += 15;
    reasons.push(
      'An agent/automation is about to act on instruction-like text found in untrusted content (not a direct human prompt). (+15)'
    );
  }

  // --- external recipients --------------------------------------------------
  for (const recipient of externalRecipients) {
    const domain = String(recipient).split('@').pop().trim().toLowerCase();
    if (PERSONAL_EMAIL_DOMAINS.has(domain)) {
      score += 20;
      reasons.push(`External recipient "${recipient}" is a personal mailbox domain — work content leaving to a personal address needs a human look. (+20)`);
    } else if (domain && domain.includes('.')) {
      score += 10;
      reasons.push(`Action sends data to external domain "${domain}". (+10)`);
    }
  }

  // --- hard rules -------------------------------------------------------------
  let decision;
  if (sawHardVeto && highImpact) {
    decision = 'veto';
    reasons.push('HARD RULE: a hard-veto pattern (override / admin grant / mass deletion / concealment) is combined with a high-impact action — vetoed regardless of score.');
  } else if (score >= VETO_THRESHOLD) {
    decision = 'veto';
  } else if (score >= HOLD_THRESHOLD) {
    decision = 'hold-for-review';
  } else {
    decision = 'allow';
  }

  // Fail-closed floor: destructive action sourced from untrusted content
  // is never silently allowed, even when no pattern fired. The floor covers
  // the whole class: whenever it applies, it is recorded in the reasons and
  // the decision can never drop below hold-for-review.
  if (highImpact && untrusted) {
    if (decision === 'allow') decision = 'hold-for-review';
    reasons.push('FAIL-CLOSED FLOOR: high-impact action requested from untrusted content is never auto-allowed; minimum outcome is human review.');
  }

  // A hard-veto pattern in the text always earns at least a human look,
  // even attached to a low-impact action from a trusted source.
  if (decision === 'allow' && sawHardVeto) {
    decision = 'hold-for-review';
    reasons.push('Hard-veto pattern present in requesting text — held for human review.');
  }

  return { decision, score, reasons, matches, actionType, sourceType, actorType };
}

module.exports = { assess, ACTION_RISK, HIGH_IMPACT_ACTIONS, HOLD_THRESHOLD, VETO_THRESHOLD };
