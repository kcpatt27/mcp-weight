# Releasing mcp-weight

Two paths. Prefer **trusted publishing**; the staged-publish flow is the manual
fallback (and what was used for 0.2.0).

## Trusted publishing (OIDC) — preferred

One-time setup (operator, on npmjs.com):

1. Open the package: npmjs.com → `mcp-weight` → **Settings** → **Trusted
   Publisher** → **GitHub Actions**.
2. Set **Repository** `kcpatt27/mcp-weight` and **Workflow filename**
   `release.yml`. New configurations (after 2026-09-03) default to allowing
   `npm stage publish` only — also enable the **`npm publish`** action so a tag
   push publishes directly.
3. Save.

After that, releasing is a tag push:

```bash
npm version patch   # or minor / major
git push --follow-tags
```

`.github/workflows/release.yml` runs on `v*` tags: `npm ci`, `npm test`, then
`npm publish --provenance --access public` using a short-lived OIDC token — no
`NPM_TOKEN`, no OTP.

Requirements: npm CLI with trusted-publishing support, Node ≥ 22.14 in CI (the
workflow pins Node 24), and a GitHub-hosted runner.

## Staged publish (manual fallback)

For when you want to review the exact tarball before it goes live, or 2FA is
device-bound:

```bash
npm version minor
npm stage publish              # uploads to the npm staging area
npm stage list                 # shows the stage id
npm stage approve <stage-id>   # completes proof-of-presence (2FA) and publishes
```

Verify:

```bash
npm view mcp-weight version
```

## After publishing

- Create the GitHub release:
  `gh release create vX.Y.Z -R kcpatt27/mcp-weight --title "vX.Y.Z" --notes "..."`.
- Update `ROADMAP.md` (flip the release item, dated) and `CURRENT_STATE.md`.