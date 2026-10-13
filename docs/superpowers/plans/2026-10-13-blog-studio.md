# RideArrivo Blog Studio Implementation Plan

> For agentic workers: execute inline with executing-plans and test-driven-development.

**Goal:** A deployable D1/R2 blog plus native, individually authorized Blog Studio in RA-Workspace.
**Architecture:** Pages Functions, server rendering and a workspace identity RPC; React uses existing session.
**Tech Stack:** ES modules, Web APIs, D1/SQLite, R2, React/TypeScript, Supabase Postgres access RPCs.
**Spec:** ../specs/2026-10-13-blog-studio.md

## Global Constraints
Keep D1 articles and R2 media. No production writes, no credential sharing, no automatic editorial rights, exact-origin CORS, zero blog runtime npm dependencies. Do not change unrelated intranet modules. Source baseline is the uploaded ZIP.

## Review Focus
- Revoked/disabled staff with still-valid access tokens must fail next protected request.
- Writers must not mutate another owner's draft or a previously published article.
- Concurrent updates must not overwrite; side-effect audit rows must be atomic.
- Draft media, draft URLs and future scheduled content must not leak.
- Original privileged intranet navigation and login behavior must remain intact.

### Task 1: D1 API and authorization
Files: src/server/{policy,auth,content,app}.mjs, migrations/0001_blog_studio.sql, tests/{policy,api}.test.mjs.
Interfaces: handleRequest(Request, Env), authorize(Request, Env), validatePost(input, current, identity), D1 prepared/batch APIs.
- [ ] Write failing policy/API behavior tests, then run npm test and retain failures.
- [ ] Implement validation, authorization, persistence, scheduling, media privacy and audit.
- [ ] Run complete Blog test suite and record outcomes.

### Task 2: Public journal
Files: src/server/render.mjs, public/{journal.css,journal.js}, tests/render.test.mjs, scripts/{build,dev,check}.mjs, functions/[[path]].js.
Interfaces: renderHome({posts,total,query,category,page}), renderArticle(post), renderMarkdown(string), use canonical configured URL only.
- [ ] Write render/XSS/SEO and routing tests; observe missing behavior.
- [ ] Implement accessible visual experience and real backend search/RSS/sitemap.
- [ ] Build and inspect desktop/mobile, keyboard and reduced motion.

### Task 3: RA-Workspace access and workstation
Files: src/modules/BlogStudio.tsx, src/lib/blogStudio.ts, src/blog-studio.css, App.tsx, lazy-routes.tsx, workspaceNav.ts; Supabase migration 20261013130000_blog_studio_access.sql.
Interfaces: workspace_blog_identity, workspace_blog_people, workspace_blog_set_access, workspace_blog_access_log RPCs. Client uses VITE_BLOG_API_ORIGIN + existing access_token.
- [ ] Add unit/contract tests for endpoint allowlist, role gates, safe patch integration, RPC scope.
- [ ] Implement RPC grant checks, native editor/uploads/access UI and grant-aware navigation.
- [ ] Verify TypeScript syntax and available complete workspace tests; report unexecuted integration checks.

### Task 4: Delivery
Files: DEPLOYMENT.md, CHANGELOG.md, verification report, checksum-guarded apply script and source ZIPs.
- [ ] Self-review final diff, fix important findings with regression tests.
- [ ] Package changed-file patch, full Blog source and instructions with exact Cloudflare settings.
- [ ] Verify archives/paths and state remote deployment and database work still required.
