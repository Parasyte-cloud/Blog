# RideArrivo Blog Studio design

## Intent
Provide a polished dynamic blog at blog.ridearrivo.com and an editorial workstation inside the uploaded RA-Workspace. Retain Cloudflare D1 for articles and private R2 for image originals. Reuse RA-Workspace authentication, active employee approval and individual editorial grants. No separate employee passwords, no automatic editorial access based on email domain.

## Source boundaries
The uploaded RA-workspace-blog-integration-20261013-124408.zip is the integration baseline. Earlier Blog source was not retained in the current filesystem or Library; the GitHub contents endpoint returned 404 and direct git networking is unavailable. The Blog deliverable is a new, self-contained implementation, not a verified patch to that earlier draft. New ra_blog_* D1 tables do not overwrite unknown tables. No deployment or remote mutation is performed.

## Architecture
Native Cloudflare Pages Functions (server modules, zero production npm dependencies), server-rendered public pages, D1 content and revisions, private R2 images. Native React BlogStudio module in RA-Workspace calls the blog API with the existing staff access token. Cloudflare forwards it only to the configured RA-Workspace Supabase RPC, which verifies active employee and current per-person grants. The workspace database stores identity/access only, never article bodies or media. A workspace administrator can bootstrap/manage grants but cannot edit/publish unless explicitly granted a blog role.

## Roles
Writer: create drafts, edit own draft/review entries, upload and see own unused images. No publication, archive, hard delete or grant management.
Editor: edit all, publish/schedule/archive, see all media. No hard delete or grant management.
Blog administrator: all editorial actions plus individual access management. Active workspace administrators may manage access only without a blog grant. All endpoints enforce authorization server-side. Revocation takes effect at the next protected request; no auth-result cache. Existing identity access tokens retain the workspace provider's normal lifetime.

## Workflows
Articles: title, slug, excerpt, Markdown body, category, cover image/alt, editorial note, draft/review/scheduled/published/archived status, publication time, versioned updates. Slugs are immutable after first publication to preserve shared links. Scheduled articles appear at their publication timestamp without a cron task. Editing a currently published article changes the live article immediately (clearly labelled); no unpublished revision branch.
Uploads: JPEG/PNG/WebP, up to 5 MiB, signature validation, owner recorded; private previews require authorization. Public media only if referenced as a cover by a publicly visible post. No SVG or arbitrary document uploads in this version. Optimistic version checks prevent silent overwrite. Audit/revision records remain after deletion; hard delete requires explicit typed confirmation and version.
Access: search existing active employees, grant/change/revoke role, audit changes. No new external account invitations in scope.

## Public UI
Navy/amber original brand imagery, cinematic hero, animated aircraft/route motif, glass header, restrained card lift, reading progress and reduced-motion support. Search/categories/pagination, semantic article pages, Open Graph and canonical metadata, XML sitemap/RSS, LinkedIn/share links. No fake email subscription form. Public pages require the D1 binding; no sample content is silently published.

## Verification
Behavioral unit/integration tests using real SQLite with a D1 adapter and an R2 test store. Mock only the upstream identity HTTP service. Exercise negative role/ownership checks, revoked access, malformed inputs, public draft/media isolation, scheduling, version conflicts, XSS, CORS, persistence and audit. Inspect public pages on desktop/mobile in Chromium. Run uploaded workspace suite before and after; report missing dependencies/build limitations separately. No claim of production/remote-database verification.
