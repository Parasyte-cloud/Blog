# Deployment and connection guide

## 1. Keep the two repositories separate

**This Blog folder:** https://github.com/Parasyte-cloud/Blog.git

**Separate RA-Workspace patch:** apply to the existing intranet source, normally `~/RA-workspace`. Do not upload the entire intranet into Blog.

No remote push, database change, domain change or deployment has been performed by this delivery.

## 2. Verify this folder locally

```sh
cd /path/to/Blog
node --version
npm ci
npm run check
npm test
npm run build
npm run dev -- --demo
```

Open http://127.0.0.1:8788. Stop the local preview with Ctrl+C.

## 3. Push to the GitHub repository

For a genuinely EMPTY remote repository, run inside this delivered Blog folder:

```sh
git init -b main
git add .gitignore .dev.vars.example package.json package-lock.json README.md DEPLOYMENT.md wrangler.example.toml src public functions scripts migrations content docs tests
git status --short
git diff --cached --stat
git commit -m "Build RideArrivo Journal and workspace-authorized Blog Studio API"
git remote add origin https://github.com/Parasyte-cloud/Blog.git
git push -u origin main
```

If GitHub already contains a README or application history, do not force-push or reset it. Clone that repository into a new folder, create a branch, and review how this new implementation replaces the existing one. Copying the new source over unknown old functions can leave conflicting routes. Keep the existing history; review removals and open a pull request. Never use `--force` to work around a rejection.

```sh
git clone https://github.com/Parasyte-cloud/Blog.git "$HOME/Documents/Blog-review"
cd "$HOME/Documents/Blog-review"
git switch -c feat/journal-workspace-studio
git status --short
# Inspect the existing application before copying/replacing files.
# Once the reviewed changes are in this clone:
# npm ci && npm run check && npm test && npm run build
# git add -- <only the reviewed Blog paths>
# git commit -m "Integrate RideArrivo Journal and Blog Studio"
# git push -u origin feat/journal-workspace-studio
```

## 4. Cloudflare Pages build screen

| Field | Value |
| --- | --- |
| Repository | Parasyte-cloud/Blog |
| Production branch | main, after review/merge |
| Project | Keep the existing blog-3h5 project |
| Framework preset | None |
| Build command | npm run build |
| Build output directory | dist |
| Root directory | Leave blank: repository root |
| Node environment variable | NODE_VERSION = 22 |

The root `functions/` directory must be committed. This is NOT a static-only site. `dist` holds assets; Cloudflare Pages compiles Functions separately. Do not deploy by uploading only `dist` through a static drag-and-drop flow.

Keep the working Pages project. Do not delete its existing database or bucket.

## 5. Bind the EXISTING D1 database and private R2 bucket

In the Pages project, **Settings > Bindings**, add/select:

| Type | Binding name, exact case | Resource |
| --- | --- | --- |
| D1 database | DB | The existing blog D1 database |
| R2 bucket | MEDIA | A private blog cover-image bucket |

If an R2 bucket does not yet exist, create one in R2 and then bind it. Creating R2 storage can involve a billing setup in Cloudflare. Keep public bucket access and public custom-domain serving OFF; the application controls draft/public image access. Do not use your production D1 or image bucket for untrusted preview branches.

Use separate preview bindings for branch tests, or leave preview writes unconfigured. Redeploy after changing bindings or runtime variables.

## 6. Inspect, back up and apply the D1 schema

Authenticate with your own Cloudflare account locally. Never paste tokens here or commit them.

```sh
npx wrangler@4 login
npx wrangler@4 d1 list
```

Replace `YOUR_EXISTING_BLOG_D1_NAME` below with the actual database name from that list. Do not create a new D1 database just to follow this guide.

```sh
npx wrangler@4 d1 execute "YOUR_EXISTING_BLOG_D1_NAME" --remote \
  --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"

mkdir -p "$HOME/Desktop/RideArrivo-Blog-Backups"
npx wrangler@4 d1 export "YOUR_EXISTING_BLOG_D1_NAME" --remote \
  --output "$HOME/Desktop/RideArrivo-Blog-Backups/blog-before-studio-$(date +%Y%m%d-%H%M%S).sql"
```

Review the table list and this migration. If any `ra_blog_*` tables already exist, inspect their columns and data before proceeding. This source has not been compared with any earlier Blog database schema. The migration does not copy older article tables.

Then apply only this file:

```sh
npx wrangler@4 d1 execute "YOUR_EXISTING_BLOG_D1_NAME" --remote \
  --file migrations/0001_blog_studio.sql
```

There is no automatic sample-content seed. A successful command changes the database, so read its output and stop on errors.

## 7. Reuse the EXISTING RA-Workspace identity project

Articles remain in D1; images remain in R2. The workspace database stores ONLY blog roles and their access audit, alongside its existing employee accounts.

The source upload excluded `.env`, so the current workspace project ID was not verified. Do not assume the earlier standalone blog Supabase URL is the intranet's project. On your laptop or the intranet's deployment settings, look up the current `VITE_SUPABASE_URL` and publishable/anon key. Use that same project.

Apply the one file supplied in the separate integration patch:

`supabase/migrations/20261013130000_blog_studio_access.sql`

The simplest scoped route is the existing workspace project's **SQL Editor**: review and run this file only. It creates two access tables and four restricted RPCs; it does not alter article storage or existing employee roles.

For the Supabase CLI workflow, inside the ORIGINAL linked RA-Workspace directory:

```sh
npx supabase migration list --linked
npx supabase db push --linked --dry-run
```

Proceed with `npx supabase db push --linked` only after confirming the dry-run includes exactly the intended new migration and no unrelated pending changes. Do not repair migration history or push old migrations blindly. When using SQL Editor, reconcile the CLI migration history deliberately before a later full `db push`.

## 8. Set the blog's runtime variables

In the Blog Pages project **Settings > Variables and Secrets**, set:

| Variable | Value |
| --- | --- |
| SITE_URL | https://blog.ridearrivo.com |
| WORKSPACE_ORIGIN | https://intranet.ridearrivo.com |
| WORKSPACE_SUPABASE_URL | The actual existing RA-Workspace Supabase URL |
| WORKSPACE_SUPABASE_ANON_KEY | That workspace project's publishable/anon key |

Use server/runtime variables, not a bundled JS config. Do NOT use `service_role`, `sb_secret_*`, database passwords, or Cloudflare API tokens. The user identity comes from the existing logged-in staff member's bearer token; the server checks it through the workspace RPC for every protected operation.

On the intranet's frontend deployment, add:

`VITE_BLOG_API_ORIGIN=https://blog.ridearrivo.com`

This URL is not secret. Rebuild and deploy the intranet after adding it. For deliberate tests against the named Pages host, the client also permits `https://blog-3h5.pages.dev`. No wildcard Pages origins are trusted.

## 9. Apply the intranet patch safely

Unzip the separate `RA-workspace-blog-integration.zip`. From its extracted folder:

```sh
python3 apply_patch.py --target "$HOME/RA-workspace" --check
python3 apply_patch.py --target "$HOME/RA-workspace" --apply
cd "$HOME/RA-workspace"
npm ci
node --test scripts/blog-studio.test.mjs
npm test
npm run typecheck
npm run build
```

The patch compares original SHA-256 hashes before writing. If your current source has changed since the upload, it stops without overwriting files. Review and merge those changes instead. It creates a backup outside the repository before writing changed files.

Review the scoped `git diff`, stage only the files listed in the patch README, then commit/push the intranet separately according to your existing deployment workflow. Neither this script nor the Blog package commits, pushes or deploys anything automatically.

## 10. Add blog.ridearrivo.com

In the Blog Pages project open **Custom domains > Set up a custom domain**, enter `blog.ridearrivo.com`, and complete Cloudflare's checks. Because the domain is managed in Cloudflare, let the Pages custom-domain flow create the correct DNS record. Do not merely create a CNAME without associating the hostname with the Pages project.

Wait for certificate and domain status to become active. Then redeploy and check:

```sh
curl -I https://blog.ridearrivo.com/
curl -sS https://blog.ridearrivo.com/api/health
curl -I https://blog.ridearrivo.com/stories/does-not-exist
```

Expected: homepage 200, health JSON with `ok:true`, nonexistent story 404. Health confirms D1 connectivity and that an R2 binding is configured; it does not prove every role/upload flow. Finish the acceptance checklist below.

## 11. Bootstrap staff access and publish the supplied article

Sign in to the intranet as an existing active **workspace administrator**. Open **Company > Blog Studio > Access management**. Give yourself an explicit **Blog administrator** role, then assign selected individuals Writer, Editor or Blog administrator. New grantees reload the workspace to see Blog Studio in the navigation.

A workspace administrator without an editorial grant can manage access, but cannot create or publish articles. A department manager/CTO is not automatically a Blog administrator.

Open **Articles > Import article** and choose `content/uber-next-chapter.article.json` from this Blog folder. It opens as a draft. Review it, upload a licensed cover, add alt text, confirm accuracy, save, and then publish with an editor/administrator account.

Open the URL in a signed-out browser before sharing it:

`https://blog.ridearrivo.com/stories/uber-has-left-nigeria-what-comes-next`

Check its LinkedIn preview in LinkedIn Post Inspector after publication. Use `content/linkedin-post.md` as the proposed social caption. The article contains the requested call to get more information on RideArrivo's main website.

## 12. Security and operational checks

Complete `docs/ACCEPTANCE.md` with real test users. Configure Cloudflare request limits/bot protection suitable for your traffic and account plan. Avoid caching `/api/studio/*` and private image responses. Do not weaken exact-origin CORS, copy workspace access tokens into URLs, or embed a service-role key in the browser.

Publishing/unpublishing takes effect on subsequent server reads. Browsers and social networks that already fetched a public image may keep their own copy; archiving cannot recall previously downloaded public content.

## Official reference documentation

- Pages bindings: https://developers.cloudflare.com/pages/functions/bindings/
- Pages build configuration: https://developers.cloudflare.com/pages/configuration/build-configuration/
- Pages custom domains: https://developers.cloudflare.com/pages/configuration/custom-domains/
- D1 commands: https://developers.cloudflare.com/d1/wrangler-commands/
- Supabase row-level security: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase functions: https://supabase.com/docs/guides/database/functions
