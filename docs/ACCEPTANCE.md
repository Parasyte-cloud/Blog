# Pre-launch acceptance checklist

These checks have NOT been performed against the user's live Cloudflare/Supabase resources. Use a separate test deployment and existing test employees where possible. Never grant arbitrary employees test access without permission.

## Infrastructure

- [ ] The Blog repository builds on Cloudflare with root functions/, `npm run build`, output `dist`, Node 22.
- [ ] Blog DB binding points to the intended existing D1 database; MEDIA is a private bucket.
- [ ] The namespaced D1 schema was reviewed/applied and any older content migration was handled separately.
- [ ] The one workspace access migration runs on the actual intranet identity project.
- [ ] Blog runtime and intranet VITE_BLOG_API_ORIGIN values match the deployed origins.
- [ ] Main domain and TLS are active; preview domains are not indexed and do not mutate production resources.

## Authentication and role isolation

- [ ] A signed-out visitor cannot list drafts, upload, edit, publish, delete or enumerate employees.
- [ ] An active employee without a blog grant receives no editorial access.
- [ ] An active workspace administrator can manage grants but cannot publish until explicitly assigned a blog role.
- [ ] A writer creates and edits their own unpublished article; a second writer cannot read/edit that draft or preview its private image.
- [ ] A writer cannot change status to published, scheduled or archived through UI OR direct API input.
- [ ] An editor can review other authors, publish, schedule and archive, but cannot permanently delete or manage access.
- [ ] A Blog administrator manages individual grants; grant/revoke events are visible in access activity.
- [ ] Remove a grant while that employee has an open tab: their next protected action is denied.
- [ ] Deactivate an employee in the existing workspace: their next protected Blog call is denied.
- [ ] Invalid/expired sessions and identity service failures fail closed rather than returning old privileged data.

## Editorial workflow

- [ ] Import the supplied JSON, preview, add cover/alt and save as a draft.
- [ ] Unsaved edits are protected during in-studio tab/article changes; always save before changing to an unrelated intranet module.
- [ ] Two editors open the same article: after one saves, the other receives a version conflict and does not overwrite it.
- [ ] Published slug is immutable and existing shared link remains valid.
- [ ] Saving Published updates the live article immediately, as labelled. Use draft/review for new unpublished stories.
- [ ] Schedule uses Lagos UTC+1, not the testing device's local timezone; it stays private until due.
- [ ] Archive makes article/unused cover unavailable to public requests; local/social caches are not recalled.
- [ ] Hard delete requires archived state, current version and exact slug confirmation. Audit/revision records remain.
- [ ] Revision view shows previous versions; text can be copied back into the editor and saved as a new version.

## Upload and public experience

- [ ] JPEG, PNG and WebP uploads work with real R2 and appear via private authorized previews.
- [ ] Oversized, SVG and MIME-spoofed uploads fail without publishing or leaking an image.
- [ ] Published covers are available signed out; draft covers return 404 publicly.
- [ ] Mobile and desktop rendering, keyboard navigation, pause motion and reduced-motion work in real browser navigation.
- [ ] Search, category filters and pagination work; missing/draft/future URLs return 404.
- [ ] RSS/sitemap contain only visible articles. Canonical/OG URLs use the real blog domain.
- [ ] LinkedIn Post Inspector sees the final article title, description and image after publication.
- [ ] Full RA-Workspace test/typecheck/build pass in the normal dependency-installed environment.
