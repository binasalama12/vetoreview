/**
 * assess-risk action handler (rovo:action `assess-risk`).
 * Delegates 1:1 to the pure rules engine — this function contains no
 * judgement of its own, so the exact code path judges use is unit-tested
 * in test/rules-engine.test.js.
 */

'use strict';

const { assess } = require('../rules');

/**
 * @param {{payload?: object}} req  Forge action invocation payload
 * @returns {Promise<object>} verdict { decision, score, reasons, matches, ... }
 */
async function assessRisk(req) {
  const payload = (req && req.payload) || {};
  const verdict = assess({
    actionType: payload.actionType,
    contentText: payload.contentText,
    sourceType: payload.sourceType,
    actorType: payload.actorType,
    externalRecipients: payload.externalRecipients,
  });
  return verdict;
}

module.exports = { assessRisk };
