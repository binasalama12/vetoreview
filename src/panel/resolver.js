/**
 * Panel view-model resolver for the Jira issue panel.
 *
 * Pure logic, no Forge runtime imports: given an audit store (any backend)
 * and an issue key, it reads the issue's audit log and shapes it into the
 * view model the panel renders — the latest verdict, a tally of all
 * verdicts for the issue, and how many log entries exist in total.
 *
 * The panel is a window onto the audit log, never a second source of
 * truth: everything here is derived from store data on each call.
 */

'use strict';

const DECISIONS = ['allow', 'hold-for-review', 'veto'];

/** Zeroed tally so the panel can render counts even for a fresh issue. */
function emptyTally() {
  return { allow: 0, 'hold-for-review': 0, veto: 0 };
}

/**
 * Build the panel view model for one issue.
 *
 * @param {object} store     audit store (src/audit/store.js shape)
 * @param {string} issueKey  Jira issue key (undefined → 'UNKNOWN' bucket)
 * @returns {Promise<object>} one of:
 *   { status: 'ready', issueKey, hasVerdict: true,  latest, tally, totalEntries }
 *   { status: 'ready', issueKey, hasVerdict: false, latest: null, tally, totalEntries: 0 }
 */
async function resolvePanel(store, issueKey) {
  const key = issueKey ?? 'UNKNOWN';
  const entries = await store.list(key);

  const tally = emptyTally();
  for (const entry of entries) {
    if (Object.prototype.hasOwnProperty.call(tally, entry.decision)) {
      tally[entry.decision] += 1;
    }
  }

  if (entries.length === 0) {
    return {
      status: 'ready',
      issueKey: key,
      hasVerdict: false,
      latest: null,
      tally,
      totalEntries: 0,
    };
  }

  const latest = entries[entries.length - 1];
  return {
    status: 'ready',
    issueKey: key,
    hasVerdict: true,
    latest: {
      decision: latest.decision,
      score: latest.score,
      actionType: latest.actionType,
      sourceType: latest.sourceType,
      actorType: latest.actorType,
      matchedPatterns: latest.matchedPatterns ?? [],
      reasons: latest.reasons ?? [],
      at: latest.at,
    },
    tally,
    totalEntries: entries.length,
  };
}

module.exports = { resolvePanel, emptyTally, DECISIONS };
