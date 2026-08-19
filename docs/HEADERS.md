# Response headers

Set in `public/_headers`, which Vite copies into `dist/` and Netlify reads, the same
way `_redirects` already works.

**Measured against the live site, not copied from a template.** Recording every
request on load gives: the site itself, and `fonts.googleapis.com` for a stylesheet.

Two things the front page does not show, and both are in the policy anyway:

- **Supabase.** The app talks to it, but not until someone uses it, so it never
  appears in a page-load trace. `connect-src` allows `https://*.supabase.co` and
  `wss://*.supabase.co` — the wildcard covers the project ref and realtime, so
  rotating the project does not silently break the app.
- **Google's font files.** The stylesheet comes from `fonts.googleapis.com`, the
  fonts themselves from `fonts.gstatic.com`. Allowing only the first loads a page
  with no webfont.

`style-src` carries `'unsafe-inline'` because React writes inline style attributes,
22 of them on first paint. `script-src` does not, and must not: there are no inline
scripts.

`Strict-Transport-Security` is absent here because Netlify already sends it.
