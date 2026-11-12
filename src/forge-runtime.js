/**
 * Forge runtime wiring — the ONE place that touches @forge/api.
 *
 * Everything else in this repo is pure/injectable so it can be unit
 * tested outside the Forge runtime. This module:
 *
 *   - lazily requires @forge/api (it only exists inside Forge; a failed
 *     require outside Forge yields null, never a crash at load time),
 *   - builds the live audit store on Forge storage
 *     (createAuditStore + createForgeBackend — slice 2 adapters),
 *   - exposes postJiraComment(), the real Jira REST comment POST used
 *     by the request-approval action to post approval cards.
 *
 * Handlers (src/index.js) ask getLiveRuntime() for the live runtime and
 * fall back to the in-memory defaults when it returns null (local dev,
 * tests, demo). Tests inject a fake api object into createLiveRuntime()
 * instead of touching this loader.
 */

'use strict';

const { createAuditStore } = require('./audit/store');
const { createForgeBackend } = require('./audit/forge-backend');

let cachedApi;
let cachedRuntime;

/** Lazily load @forge/api; returns null outside the Forge runtime. */
function loadForgeApi() {
  if (cachedApi !== undefined) return cachedApi;
  try {
    // eslint-disable-next-line global-require
    cachedApi = require('@forge/api');
  } catch {
    cachedApi = null;
  }
  return cachedApi;
}

/**
 * Build the live runtime from a @forge/api-shaped object.
 * Throws TypeError early on a mis-shaped api — wiring mistakes must
 * fail loudly at startup, not at verdict time.
 */
function createLiveRuntime(api) {
  if (
    !api ||
    typeof api.asApp !== 'function' ||
    typeof api.route !== 'function' ||
    !api.storage ||
    typeof api.storage.get !== 'function' ||
    typeof api.storage.set !== 'function'
  ) {
    throw new TypeError(
      'createLiveRuntime requires a @forge/api-shaped object ({ asApp, route, storage })'
    );
  }

  const store = createAuditStore(createForgeBackend(api.storage));

  /**
   * Post an ADF document as a comment on a Jira issue, as the app.
   * Resolves to the created comment id; throws on a non-201 response.
   */
  async function postJiraComment(issueKey, adfBody) {
    const response = await api
      .asApp()
      .requestJira(api.route`/rest/api/3/issue/${issueKey}/comment`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ body: adfBody }),
      });
    if (response.status !== 201) {
      throw new Error(
        `Jira comment POST for ${issueKey} failed with status ${response.status}`
      );
    }
    const data = await response.json();
    return data.id;
  }

  return { store, postJiraComment };
}

/** Singleton live runtime, or null when @forge/api is unavailable. */
function getLiveRuntime() {
  if (cachedRuntime !== undefined) return cachedRuntime;
  const api = loadForgeApi();
  cachedRuntime = api ? createLiveRuntime(api) : null;
  return cachedRuntime;
}

module.exports = { loadForgeApi, createLiveRuntime, getLiveRuntime };
