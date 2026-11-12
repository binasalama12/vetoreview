/**
 * Panel renderer for the Jira issue panel (Custom UI frontend).
 *
 * Pure view-model → HTML-string rendering, deliberately free of DOM and
 * Forge runtime imports so it is fully testable in node:test. The browser
 * page (src/panel/index.html) loads this same file and injects the result
 * into its mount element — one rendering implementation for tests and for
 * the live panel.
 *
 * SECURITY: every view-model field that can carry issue content (reasons,
 * matched pattern ids, action/source/actor types, the issue key, the
 * timestamp) is HTML-escaped before interpolation. Issue text is
 * attacker-controllable by design in this product — a reason string must
 * never be able to inject markup into the panel.
 *
 * The `vr-*` classes emitted here are styled by the <style> block in
 * src/panel/index.html.
 */

'use strict';

const DECISION_META = {
  allow: { label: 'Allowed', icon: '✅', className: 'vr-allow' },
  'hold-for-review': { label: 'Held for human review', icon: '✋', className: 'vr-hold' },
  veto: { label: 'Vetoed', icon: '⛔', className: 'vr-veto' },
};

const UNKNOWN_META = { label: 'Unknown verdict', icon: '❔', className: 'vr-unknown' };

/** Escape a value for safe interpolation into HTML text/attribute context. */
function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Display metadata for a decision; unknown decisions get a safe fallback. */
function decisionMeta(decision) {
  return DECISION_META[decision] ?? UNKNOWN_META;
}

/**
 * Normalise one matched-pattern entry to its display id. Audit entries
 * store plain string ids; verdict objects carry { id, ... } — accept both.
 */
function patternLabel(pattern) {
  if (typeof pattern === 'string') return pattern;
  if (pattern && typeof pattern === 'object') {
    return pattern.id ?? pattern.name ?? 'unknown-pattern';
  }
  return 'unknown-pattern';
}

function renderReasons(reasons) {
  if (!Array.isArray(reasons) || reasons.length === 0) return '';
  const items = reasons.map((r) => `      <li>${escapeHtml(r)}</li>`).join('\n');
  return `    <h4>Why</h4>\n    <ul class="vr-reasons">\n${items}\n    </ul>`;
}

function renderPatterns(patterns) {
  if (!Array.isArray(patterns) || patterns.length === 0) return '';
  const items = patterns
    .map((p) => `      <li><code>${escapeHtml(patternLabel(p))}</code></li>`)
    .join('\n');
  return `    <h4>Matched patterns</h4>\n    <ul class="vr-patterns">\n${items}\n    </ul>`;
}

function renderTally(tally, totalEntries) {
  const t = tally ?? {};
  const count = (k) => (Number.isFinite(t[k]) ? t[k] : 0);
  const total = Number.isFinite(totalEntries) ? totalEntries : 0;
  return [
    '    <h4>Audit log</h4>',
    `    <p class="vr-total">${total} verdict${total === 1 ? '' : 's'} recorded for this issue</p>`,
    '    <ul class="vr-tally">',
    `      <li>✅ Allowed: ${count('allow')}</li>`,
    `      <li>✋ Held for review: ${count('hold-for-review')}</li>`,
    `      <li>⛔ Vetoed: ${count('veto')}</li>`,
    '    </ul>',
  ].join('\n');
}

function renderLatest(latest) {
  const meta = decisionMeta(latest.decision);
  const decisionText =
    latest.decision && !DECISION_META[latest.decision]
      ? `${meta.label} (${escapeHtml(latest.decision)})`
      : meta.label;
  const lines = [
    `    <p class="vr-verdict ${meta.className}">${meta.icon} ${decisionText}</p>`,
  ];
  if (Number.isFinite(latest.score)) {
    lines.push(`    <p class="vr-score">Risk score: ${latest.score}</p>`);
  }
  const context = [
    ['Action', latest.actionType],
    ['Requested via', latest.sourceType],
    ['Actor', latest.actorType],
  ].filter(([, v]) => v != null && v !== '');
  if (context.length > 0) {
    const items = context
      .map(([k, v]) => `      <li>${k}: ${escapeHtml(v)}</li>`)
      .join('\n');
    lines.push(`    <ul class="vr-context">\n${items}\n    </ul>`);
  }
  if (latest.at) {
    lines.push(
      `    <p class="vr-at">Latest verdict: <time datetime="${escapeHtml(latest.at)}">${escapeHtml(latest.at)}</time></p>`
    );
  }
  const reasons = renderReasons(latest.reasons);
  if (reasons) lines.push(reasons);
  const patterns = renderPatterns(latest.matchedPatterns);
  if (patterns) lines.push(patterns);
  return lines.join('\n');
}

function renderEmpty() {
  return [
    '    <p class="vr-verdict vr-empty">No verdicts yet</p>',
    '    <p class="vr-empty-note">VetoReview has not reviewed any action on this issue yet. ' +
      'When an agent or automation asks for a review, the latest verdict will appear here.</p>',
  ].join('\n');
}

/**
 * Render the panel view model (src/panel/resolver.js output) to an HTML
 * fragment string. Tolerates missing fields — the panel must render a
 * safe empty state rather than crash on a partial view model.
 *
 * @param {object} view  resolver view model
 * @returns {string} HTML fragment
 */
function renderPanel(view) {
  const v = view ?? {};
  const issueKey = v.issueKey ?? 'UNKNOWN';
  const body = v.hasVerdict && v.latest ? renderLatest(v.latest) : renderEmpty();
  return [
    `<section class="vr-panel" data-issue="${escapeHtml(issueKey)}">`,
    `  <h3>VetoReview — ${escapeHtml(issueKey)}</h3>`,
    body,
    renderTally(v.tally, v.totalEntries),
    '</section>',
  ].join('\n');
}

const api = { renderPanel, escapeHtml, patternLabel, decisionMeta, DECISION_META };

if (typeof module !== 'undefined' && module.exports) {
  module.exports = api;
} else if (typeof window !== 'undefined') {
  window.VetoReviewPanel = api;
}
