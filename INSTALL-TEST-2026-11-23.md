# VetoReview — Fresh-Site Installation Test

**Date:** 23 Nov 2026 (±20:17–20:35 WIB)
**Tester:** Muse (subagent, no live Atlassian credentials used)
**Scope:** everything testable without a live Atlassian login; the actual
fresh-site install (CHECKLIST-INSTALL.md §1–§5) is user-side — see
"Remaining user-side steps" below.
**Result: all offline tests PASS. The live fresh-site install itself is
NOT yet done — it cannot be done from this VM without an Atlassian
login + a second dev site.**

## What "fresh-site" means here

Per CHECKLIST-INSTALL.md: install VetoReview from the shared installation
link onto a **second** Atlassian Cloud dev site (not the dev site
`bugbounty-test-lutviansyah-sec.atlassian.net`), as that site's admin,
then reproduce the 3 demo scenarios (veto / hold / allow) and verify the
panel, Rovo agent, audit persistence, and per-issue isolation.

## Test results

| # | Test | Result | Evidence |
|---|------|--------|----------|
| 1 | Unit tests, repo as-is (`npm test`) | ✅ PASS — 67/67, 0 fail | `node --test`, Node v24.22.1, ~1.2 s |
| 2 | Demo scenarios (`npm run demo`) | ✅ PASS — veto 120 / hold 60 / allow 0, audit log 3 verdicts | `src/demo.js` output |
| 3 | Fresh-clone simulation: `git clone` to a clean dir, then `npm test` + `npm run demo` with zero setup | ✅ PASS — 67/67 + same demo output | Clone of HEAD `1faa9a9`; no `npm install` needed (zero dependencies); clone dir removed afterwards so it can't pollute future test runs |
| 4 | `manifest.yml` YAML validity + cross-references | ✅ PASS | Parses clean; `app.id ari:cloud:ecosystem::app/53682c48-261e-4956-9f43-4b2b127f9ee6`; runtime `nodejs22.x`; agent actions `assess-risk/request-approval/log-verdict` match `action` keys; all 4 `function` handlers exported from `src/index.js`; `rovo:mcp` exposes `assess-risk`; panel resource `src/panel` exists; `src/agent/prompt.md` exists |
| 5 | Requested scopes = minimal set | ✅ PASS | Exactly `read:jira-work`, `write:jira-work`, `read:confluence-content.all`, `write:confluence-content`, `storage:app` — no delete/admin scopes, matches CHECKLIST-INSTALL.md §1 |
| 6 | External links reachable (HTTP 200) | ✅ PASS | Panel icon SVG (raw.githubusercontent, 449 B); privacy.html (3,407 B) + terms.html (2,901 B) on GitHub Pages; github.com/binasalama12/vetoreview; devpost.com/software/vetoreview |
| 7 | Devpost draft completeness | ✅ PASS | No `TODO` left in README / SPEC / CHECKLIST-INSTALL / DEVPOST-DRAFT; installation link + YouTube demo link + source + privacy/terms all filled in (DEVPOST-DRAFT.md was already updated, uncommitted) |
| 8 | `forge lint` (Forge CLI 15.1.0, `~/workspace/tools/forge`) | ⛔ BLOCKED — needs login | `Error: Not logged in. If a local keychain is available, run forge login, otherwise set environment variables…` — no credentials were used or requested |
| 9 | `forge deploy` / `forge install` / fresh-site install | ⛔ BLOCKED — needs login + 2nd dev site | Same login gate as #8, plus a second Atlassian Cloud site with site-admin rights |
| 10 | Installation-link validity (signed console URL) | ⚠️ NOT VERIFIABLE offline | The link exists in DEVPOST-DRAFT.md; whether the signature is still valid / the link still opens can only be checked by opening it signed in as a site admin (user-side) |

## Defects found

1. **README stale — test count (fixed).** Said "59 tests"; actual count is
   67 (SPEC.md already says 67).
2. **README stale — `rovo:mcp` (fixed).** Said the module block "is commented
   out"; it is **active** in `manifest.yml` since slice 4 (13 Nov).
3. **README stale — live status (fixed).** Said "Still pending a dev site:
   `forge register` + deploy" and "Next slice: live wiring session in the
   19–30 Nov window". The app is in fact registered, deployed to production
   (v2.0.0, 16 Nov) and to the dev site, panel verified on issue `KAN-1`.
4. **Version-number inconsistency (NOT fixed — needs console check).**
   CHECKLIST-INSTALL.md §0 says the dev site "currently runs the version
   deployed 14 Nov, recorded as v2.4.0", but DEVPOST-DRAFT.md says production
   is v2.0.0 (16 Nov) and the development environment is "version 2,
   Up-to-date". One of the two numbers is stale. Verify in the Developer
   Console which version each environment actually runs before the
   fresh-site test, and correct the wrong file.
5. **Test-run pollution trap (found + cleaned up).** A copy of the repo
   placed under `hidden_files/` (or anywhere inside the repo tree) is picked
   up by bare `node --test`, doubling the count (observed 134 instead of
   67). Fresh-clone simulations must live **outside** the repo (e.g. `/tmp`
   or `~/workspace/` sibling dir), never inside it.

## Fixes applied (23 Nov 2026)

Doc-only changes to `README.md` (defects 1–3 above); no code, manifest,
or deployed-app change. Left **uncommitted** in the working tree
(`git status`: `M DEVPOST-DRAFT.md` — pre-existing, not mine;
`M README.md` — mine). Nothing was pushed, nothing deployed, no cost.

## Remaining user-side steps (exact instructions)

Do these in the main chat / on the user's own machine — they need the
Atlassian login and a second site, which this VM does not have.

### A. Verify versions in the Developer Console (5 min, fixes defect 4)

1. Open https://developer.atlassian.com/console/ and sign in as the app
   owner.
2. Open the **VetoReview** app
   (`ari:cloud:ecosystem::app/53682c48-261e-4956-9f43-4b2b127f9ee6`).
3. Check **Versions / Deployments**: note the version number + deploy date
   for the **production** environment and for the **development**
   environment.
4. Correct whichever of `CHECKLIST-INSTALL.md` (§0, "v2.4.0") or
   `DEVPOST-DRAFT.md` ("Production deployment", v2.0.0) disagrees.
5. If the code changed since the last deploy, run `forge deploy`
   (production environment) first so the installation link serves the
   current version.

### B. `forge lint` (needs the API token — user-side)

The Forge API token for this app is stored ONLY in
`~/workspace/vetoreview/hidden_files/forge-api-token.txt` (0600) — its
value is never shown in chat or reports. Steps:

```bash
export FORGE_EMAIL=<Atlassian account email for the token owner>
export FORGE_API_TOKEN=<value from ~/workspace/vetoreview/hidden_files/forge-api-token.txt>
~/workspace/tools/forge lint
```

Expected: lint clean. If it reports errors, fix them and re-deploy before
the fresh-site test.

### C. Fresh-site install test (the real test — needs a 2nd dev site)

Follow `CHECKLIST-INSTALL.md` §1–§5 verbatim, using a **second** Atlassian
Cloud dev site (create one at https://www.atlassian.com/software/jira/free
if needed — free) and a browser profile that is admin of that site only:

1. Open the installation link from `DEVPOST-DRAFT.md` ("Try it out /
   links") while signed in as the fresh site's admin.
2. Confirm the install screen names **VetoReview** and lists exactly the
   5 scopes in test #5 above — nothing more. If it shows more, STOP and
   fix the manifest.
3. Complete the install; app appears under **Apps → Manage apps**.
4. Create a test issue → VetoReview panel shows the empty state
   ("No verdicts yet…").
5. Rovo chat → VetoReview agent selectable, 3 conversation starters shown.
6. Run the 3 smoke scenarios (§3 of the checklist): veto 120, hold 60 +
   approval-card comment, allow 0; reload → verdicts persist; second issue
   → empty state.
7. Non-admin user check + uninstall/reinstall check (§4).
8. Record date + fresh-site URL in CHECKLIST-INSTALL.md §5 and confirm the
   installation link in DEVPOST-DRAFT.md is the exact link tested.

### D. After C passes

- Commit + push the README fixes (and the DEVPOST-DRAFT.md link update if
  not already pushed): the Devpost submission links to the GitHub repo.
- Internal submit ≤ 20 Dec 2026; hard deadline 23 Dec 2026, 03:00 WIB.
- Keep the app + installation link live through judging (±4 Feb 2027).

## Notes

- No deployment was made, no Devpost page was touched, no cost incurred.
- The Forge API token value was never read into chat, printed, or included
  in this file — only its storage path is recorded.
