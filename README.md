# RideArrivo Journal + Blog Studio API

A dynamic, server-rendered journal for **blog.ridearrivo.com**, with protected editorial APIs for the native **RA-Workspace Blog Studio**. Articles, revisions and editorial audit events live in Cloudflare D1. Cover images live in a private Cloudflare R2 bucket. Employee login and individual blog grants use the existing RA-Workspace identity project.

## Start here

1. Read `DEPLOYMENT.md`. It has the exact GitHub, Cloudflare and identity settings.
2. Apply the separate RA-workspace-blog-integration patch to the intranet repository, not this repository.
3. Set up the existing D1 and private R2 bindings, then apply the one namespaced D1 schema.
4. Apply the single access migration to the existing RA-Workspace identity database.
5. Deploy both applications and complete `docs/ACCEPTANCE.md` before sharing a public link.

**Important:** This is a new, self-contained implementation, not a verified patch to the earlier Blog source, which was not available for comparison. It creates only `ra_blog_*` D1 tables. It does not migrate any older articles, change existing unknown tables, or replace a Supabase content database. Back up and inspect the existing blog/database before replacing an earlier deployment.

## Local verification

Requires Node.js 22.16+ (22 LTS recommended). There are no production npm dependencies.

```sh
npm ci
npm run check
npm test
npm run build
npm run dev -- --demo
```

Open http://127.0.0.1:8788. Demo stories live in memory and disappear when the process stops. They are not shipped to production or silently inserted into D1. Local protected APIs still require a real workspace session and configured workspace identity. No development login bypass is provided.

`npm run dev` without `--demo` starts an empty persistent local SQLite database in `.local/`. It uses the same application handler as production, but local SQLite/R2 adapters are not a substitute for testing actual Cloudflare bindings. Use the optional Wrangler configuration in `DEPLOYMENT.md` for that.

## Features

- Server-rendered homepage and article URLs, category filters, database-backed search and pagination.
- Navy/amber branding, original supplied RideArrivo logo/assets, cinematic hero, light sweep, card effects, reduced-motion and pause controls.
- Markdown-based editing, draft/review/published/scheduled/archived workflow, private editorial notes, accuracy confirmation, cover alt text.
- Native intranet editor, image library, role management and audit view (separate integration patch).
- Writers edit only their own unpublished drafts. Editors publish/schedule/archive. Blog administrators can also delete and manage access.
- Active workspace administrators may bootstrap grants, but receive no automatic publication rights.
- Each protected request checks the employee's current active status and blog grant. Revoking a grant takes effect on the next protected request.
- Revision/version checks prevent silent overwrites. Publication locks the slug to preserve shared links. Scheduled content appears by timestamp; no cron is required.
- PNG/JPEG/WebP upload, up to 5 MiB, MIME/signature checks. SVG and arbitrary files rejected. Private image previews use authorization; public images are served only while referenced by a public article.
- Canonical tags, Open Graph/Twitter card metadata, BlogPosting structured data, RSS, sitemap and LinkedIn sharing.
- No email subscription form that pretends to work, fake metrics, sample production publications or front-end service-role secrets.

## Included editorial content

`content/uber-next-chapter.article.json` is ready to import in Blog Studio as an unpublished draft. The readable article and proposed LinkedIn copy are beside it. Review the facts, brand wording and image rights before publishing. The intended URL is:

`https://blog.ridearrivo.com/stories/uber-has-left-nigeria-what-comes-next`

It is not live merely because these files exist.

## Repository map

- `functions/[[path]].js`: Pages Function entrypoint.
- `src/server/`: protected API, validation, D1 persistence and public HTML renderer.
- `public/`: deployable branded assets, CSS/JavaScript, routing and static headers.
- `migrations/`: namespaced D1 schema.
- `scripts/`: build, local preview and syntax checks.
- `tests/`: Node test runner; real SQLite with a D1-shaped adapter, in-memory R2 and simulated upstream identity HTTP responses.
- `docs/verification/`: test report, logs and offline Chromium screenshots of local demo content.

## Deliberate limits

This version does not include external-user invitations, document uploads, comments, email subscriptions, image deletion/garbage collection, full-text indexing at large scale, analytics, or a separate unpublished revision branch for an already-live article. Saving a published article updates the public article immediately. Revision records remain after a confirmed article deletion. User tokens retain the normal lifetime of the workspace Auth provider; employee deactivation and blog-grant revocation are checked separately on every protected call.

The public sitemap currently includes up to 5,000 articles and RSS the latest 50. Add sitemap pagination before exceeding that scale. Draft upload storage can accumulate; plan a separately reviewed cleanup policy rather than deleting objects implicitly.

See `docs/VERIFICATION.md` for what was tested locally and what still requires real deployment verification.
