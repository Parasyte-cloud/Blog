# Verification report - 13 October 2026

## Delivered scope

A standalone D1/R2 Blog implementation and a separate checksum-guarded patch for the uploaded RA-Workspace source. No remote repository push, Cloudflare deployment, D1 schema application, Supabase migration or domain mutation was performed.

## Passing checks

- **Blog:** 71/71 Node tests pass. The suite exercises real SQLite operations through a D1-shaped adapter, an in-memory R2 store, and a simulated upstream workspace identity HTTP service.
- **Blog build:** `npm run check` and `npm run build` pass. The Pages Function entrypoint is import-tested; assets/routes are built into dist. `npm ci` succeeds with the delivered dependency-free lockfile.
- **Workspace integration:** 12/12 Blog Studio policy/contract tests pass, covering trusted origins, token handling, role rules, Lagos scheduling, navigation integration and the access migration's scope/guards.
- **Workspace syntax:** the six changed TypeScript/TSX application files pass TypeScript transpilation syntax diagnostics. This is NOT a full production typecheck.
- **Patch utility:** 5/5 tests pass for no-write check, application/reapplication, conflict protection, wrong repository and tampered bundle.
- **Visual checks:** local server HTML was rendered offline in Chromium at 1440, 768, 390 and 320 pixels. Homepage/article had no horizontal overflow, broken image decodes or JavaScript page errors. Reduced-motion disables the hero animation and the keyboard skip link is focusable. Local server search output was also rendered and checked.

The browser environment blocked HTTP navigation to localhost with ERR_BLOCKED_BY_ADMINISTRATOR. For visual inspection, local HTML and its CSS/JavaScript/images were provided directly to Chromium. This checks the rendered layout, not real browser navigation through Cloudflare, CORS, Auth or R2.

## Workspace verification limitation

The original upload excluded node_modules. Package-registry DNS/network access was unavailable in this runtime. The original whole-workspace suite produced **42/54 passing suites before changes**, and **43/55 after adding Blog Studio**. The same 12 existing suites failed to load missing dependencies:

- backup-health.test.mjs
- calendar-logic.test.mjs
- chat-attachments.test.mjs
- chat-calls.test.mjs
- chat-voice-export.test.mjs
- finance-sheets.test.mjs
- late-booking.test.mjs
- push-notifications.test.mjs
- room7-admission.test.mjs
- room7-guest-ready.test.mjs
- signin-recovery.test.mjs
- workspace-nav.test.mjs

Full `npm run typecheck` fails because React, Supabase, Vite and their declarations are not installed here. A production intranet build was therefore not claimed. Run npm ci, npm test, npm run typecheck and npm run build in the original workspace with its dependencies installed. The navigation test expectation is changed from 32 to 33 because Blog Studio adds one section.

## Self-review findings and fixes

Review was performed by the author; no independent reviewer/subagent was available.

- Confirmed: no browser-provided role or employee ID determines article authorization; current identity comes from the existing workspace RPC.
- Confirmed: failed/revoked/inactive identity checks fail closed and are not cached.
- Confirmed: public list/article/feed/image reads check publication status and timestamp.
- Confirmed: version conflicts prevent overwrites; D1 revision triggers record saves in the same database operation and deletion/audit use a batch.
- Confirmed: Markdown escapes HTML and rejects executable/protocol-relative links; query text and metadata are escaped.
- Confirmed: upload originals stay in private R2; only published-cover references are served publicly.
- Fixed with failing-then-passing regression checks: Node command-line scripts now convert file URLs to filesystem paths for chdir; category cover fallbacks and the added navigation count are covered.
- Confirmed: copied integration paths are individually checked against the original ZIP and new bundle hashes; unknown local changes prevent application.

## Decisions and costs

1. **New Blog implementation:** Earlier Blog source could not be retrieved, so the deliverable is not a verified delta against that source. Cost: existing Blog routes/content/schema must be inspected before replacement; older articles are not automatically migrated.
2. **Keep content on D1/R2:** The existing workspace identity database gains access tables only. Cost: both deployments must reference the same correct identity project. The excluded .env means that project ID cannot be verified from the source upload.
3. **No remote mutation:** All source, tests and package work is local. Cost: production is not connected or live until the owner completes deployment, migrations and acceptance checks.
4. **Preserve unrelated modules:** Existing dependency-blocked tests were not rewritten or suppressed. Cost: the normal workspace environment must complete the full build and regression suite before merge/deployment.

## Deliberate deferrals

- App-wide unsaved-navigation blocking across unrelated intranet modules. In-studio article/tab changes and browser unload warn; save before leaving Blog Studio through the surrounding sidebar.
- Unused-image deletion/garbage collection and historical revision-retention policy.
- A separate review branch for edits to an already-published article; saving Published updates the live story immediately.
- Large-scale sitemap pagination/full-text search (current sitemap limit 5,000; RSS latest 50).

These are not hidden production claims. See docs/ACCEPTANCE.md for mandatory real-environment checks, especially actual Supabase RPC execution, individual grant/revoke, Cloudflare D1/R2 behavior and signed-out LinkedIn previews.
