/**
 * VetoReview — detection pattern packs.
 *
 * Each pattern is a small, explainable heuristic. Patterns are deliberately
 * transparent (plain regexes with names and reasons) instead of a black-box
 * score: a veto that a human cannot understand is a veto nobody trusts.
 *
 * Pattern shape:
 *   id          stable identifier, used in verdicts and the audit log
 *   category    injection | exfiltration | privilege | destruction | concealment
 *   weight      risk points contributed when matched (0–100 scale overall)
 *   hardVeto    when true, a match combined with a high-risk action vetoes
 *               outright regardless of total score (see engine.js)
 *   regex       tested against the content that requested the action
 *   reason      human-readable explanation shown on the approval card
 */

'use strict';

const PATTERNS = [
  // ---------------------------------------------------------------- injection
  {
    id: 'inj-ignore-instructions',
    category: 'injection',
    weight: 45,
    hardVeto: true,
    regex:
      /\b(ignore|disregard|forget|override)\b[^.\n]{0,40}\b(previous|prior|above|earlier|system|original)\b[^.\n]{0,20}\b(instruction|prompt|rule|direction)/i,
    reason:
      'Text tries to override prior/system instructions ("ignore previous instructions"-style phrasing).',
  },
  {
    id: 'inj-new-persona',
    category: 'injection',
    weight: 30,
    hardVeto: false,
    regex:
      /\b(you are now|act as if you|pretend to be|from now on you|new instructions?:)/i,
    reason: 'Text attempts to re-role the agent or inject a new instruction set.',
  },
  {
    id: 'inj-reveal-system',
    category: 'injection',
    weight: 35,
    hardVeto: true,
    regex:
      /\b(reveal|show|print|repeat|leak)\b[^.\n]{0,30}\b(system prompt|your instructions|your prompt|internal rules)/i,
    reason: 'Text asks the agent to reveal its system prompt or internal instructions.',
  },
  {
    id: 'inj-authority-claim',
    category: 'injection',
    weight: 30,
    hardVeto: false,
    regex:
      /\b(as an? (admin|system|developer|atlassian)|this is (a )?system (message|notice)|official (instruction|order) from)\b/i,
    reason: 'Untrusted content claims elevated authority (fake admin/system notice).',
  },
  {
    id: 'inj-urgency-pressure',
    category: 'injection',
    weight: 15,
    hardVeto: false,
    regex:
      /\b(immediately|urgent(ly)?|right now|without delay)\b[^.\n]{0,60}\b(approve|delete|close|share|send|grant)\b/i,
    reason: 'Text pressures the agent to act immediately on a consequential verb.',
  },

  // ------------------------------------------------------------- exfiltration
  {
    id: 'exf-send-out',
    category: 'exfiltration',
    weight: 40,
    hardVeto: true,
    regex:
      /\b(send|forward|email|post|upload|export|copy)\b[^.\n]{0,60}\b(to|into)\b[^.\n]{0,40}(https?:\/\/|@|[a-z0-9.-]+\.(com|net|io|xyz|top|info)\b)/i,
    reason: 'Text instructs sending/exporting content to an external destination.',
  },
  {
    id: 'exf-dump-all',
    category: 'exfiltration',
    weight: 35,
    hardVeto: false,
    regex:
      /\b(export|download|dump|extract|collect)\b[^.\n]{0,30}\b(all|every|entire|full)\b[^.\n]{0,30}\b(issue|ticket|page|user|customer|record|data|attachment)/i,
    reason: 'Text requests bulk extraction of issues, pages, users or attachments.',
  },
  {
    id: 'exf-encode-hide',
    category: 'exfiltration',
    weight: 25,
    hardVeto: false,
    regex: /\b(base64|encode|encrypt|obfuscate)\b[^.\n]{0,40}\b(before|then|and)\b[^.\n]{0,20}\b(send|post|upload)/i,
    reason: 'Text asks to encode/obfuscate data before sending it out (concealed exfiltration).',
  },

  // ---------------------------------------------------------------- privilege
  {
    id: 'prv-grant-admin',
    category: 'privilege',
    weight: 45,
    hardVeto: true,
    regex:
      /\b(grant|give|add|make|promote)\b[^.\n]{0,40}\b(admin|administrator|site-admin|org admin|full access|unrestricted)/i,
    reason: 'Text requests granting administrator-level access.',
  },
  {
    id: 'prv-loosen-permissions',
    category: 'privilege',
    weight: 35,
    hardVeto: false,
    regex:
      /\b(remove|disable|lift|open up|make public)\b[^.\n]{0,30}\b(restriction|permission|access control|security level|protection)/i,
    reason: 'Text requests removing restrictions or making restricted content public.',
  },

  // -------------------------------------------------------------- destruction
  {
    id: 'dst-delete-all',
    category: 'destruction',
    weight: 45,
    hardVeto: true,
    regex:
      /\b(delete|remove|purge|wipe|destroy|close|trash)\b[^.\n]{0,30}\b(all|every|entire)\b[^.\n]{0,30}\b(issue|ticket|page|attachment|comment|file|record)/i,
    reason: 'Text requests mass deletion/closure of issues, pages or attachments.',
  },
  {
    id: 'dst-delete-single',
    category: 'destruction',
    weight: 20,
    hardVeto: false,
    regex: /\b(delete|remove|purge)\b[^.\n]{0,30}\b(this|the)\b[^.\n]{0,20}\b(issue|ticket|page|attachment|comment|file)\b/i,
    reason: 'Text requests deleting an issue, page or attachment (irreversible).',
  },

  // -------------------------------------------------------------- concealment
  {
    id: 'con-hide-from-user',
    category: 'concealment',
    weight: 35,
    hardVeto: true,
    regex:
      /\b(don'?t|do not|never)\b[^.\n]{0,30}\b(tell|inform|notify|mention|alert)\b[^.\n]{0,20}\b(user|anyone|admin|owner|human)/i,
    reason: 'Text instructs the agent to hide the action from the user/admin ("do not tell anyone").',
  },
  {
    id: 'con-silent-act',
    category: 'concealment',
    weight: 25,
    hardVeto: false,
    regex: /\b(silently|secretly|quietly|without (any )?(notice|notification|trace|log))\b[^.\n]{0,40}\b(delete|approve|send|share|change|close|grant)/i,
    reason: 'Text instructs acting silently / without notification or trace.',
  },
];

/**
 * Free / personal mailbox domains. Sharing work content to these from an
 * agent action is treated as a suspicious external recipient signal —
 * not proof of malice, but always worth a human look.
 */
const PERSONAL_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'yahoo.com',
  'yahoo.co.id',
  'hotmail.com',
  'outlook.com',
  'proton.me',
  'protonmail.com',
  'icloud.com',
]);

module.exports = { PATTERNS, PERSONAL_EMAIL_DOMAINS };
