# Release verification — 21 October 2026

## Current revision

### Replit persistence update

Runtime revision `f2f518e8cc70e38ad64025a2d17bac153b958f2f` adds
PostgreSQL storage and `.replit` build/run/port configuration. Its
[Linux CI run](https://github.com/iftiikhaarr-glitch/fairhold/actions/runs/39586856144)
passed **47 tests**, lint, TypeScript/Vite build, the zero-finding dependency
audit, and protected production smoke. PostgreSQL 16 was a real isolated CI
service. Coverage includes rollback, rental/event/hash/replay persistence after
reopening, competing capture/release on independent app instances, and pending
reconciliation visible to another instance. Successful HTTP mutation responses
wait for COMMIT. Database advisory locks coordinate rental mutations; JSON
remains available for local zero-key setup. Local Windows checks passed 41
tests with the PostgreSQL suite explicitly skipped because no dedicated local
test database was configured.

Hosted acceptance is in progress; these checks do not establish a published app
or new external payment verification. The earlier baseline follows for context.

### Earlier dependency and protected-demo baseline

- Node.js 24.15.0; Vite 7.3.7; Tailwind CSS and its Vite plugin 4.3.3.
- Compatible dependency fixes followed by a reviewed Tailwind 4 migration
  removed the previously reported advisory chain. Unused inspection tooling
  and the old PostCSS configuration were removed. Lockfile refreshed.
- `npm run check` passed: lint, **40 tests**, TypeScript/Vite production build,
  and `npm audit --audit-level=low` with **zero findings** on this date.
- `npm run smoke` passed protected production startup, public health endpoint,
  authenticated HTML/JS/CSS, unauthenticated API refusal, and fixture labels.
  The script stops its own server and makes no external integration calls.
- Browser check on the rebuilt UI passed: sample $60 rental, simulated
  approval, fixture proposal with quote flags, owner confirmation of $18.50,
  and a correctly labeled completed receipt. This was not a new external
  sandbox transaction. The prior real journey is in VERIFICATION_LIVE.md.
- Added shared demo access, cross-site write refusal, production configuration
  checks, sandbox reset refusal (including when credentials are removed),
  per-rental mutation locking, and failure without overwrite on corrupt data.
  These behavior changes have regression coverage.
- GitHub CI repeats installation, all release checks, and the production smoke
  test. DEPLOYMENT.md and render.yaml define a proposed protected server with
  durable storage. Hosting has not been provisioned or verified.
- A fresh local Git clone passed `npm ci`, all 40 tests, lint, build, the zero-
  finding audit, and protected production smoke. GitHub's first Linux CI run
  also passed. Its deprecated action-runtime warning was addressed by pinning
  current official checkout/setup-node releases using Node 24 and selecting
  Ubuntu 24.04 explicitly; the workflow records the current run's result.

Zero audit findings is a point-in-time registry result, not a guarantee of
security. Real tenant accounts, webhooks, broader threat
review, and deployed acceptance testing remain outside this prototype check.
No dependency warning is suppressed with an override or ignored audit severity.

## Earlier packaging check (historical, superseded)

The following records the state before dependency remediation. Its 20 audit
findings were subsequently resolved in the current revision above.

This check used a separate copy of the source with no `.env`, stored rentals,
Git history, preinstalled dependencies, or existing build output. It made no
external payment or AI calls and did not repeat the earlier sandbox captures.

## Results

- Windows, Node.js 24.15.0.
- `npm ci --no-fund`: installed 572 packages from the existing lockfile.
- `npm test`: 31 passed, 0 failed, 0 skipped.
- `npm run build`: TypeScript and Vite 7.3.0 build passed.
- Built application boot: `/` returned HTTP 200 and built asset references;
  `/api/health` returned `ok: true`, simulated PayPal, fixture AI, and prompt
  version `assessment.v1.3`. The temporary validation server was stopped.
- Source scan found no configured PayPal client ID/secret, AI API key, or
  private test rental role keys. The archive excludes `.env`, `server/data/`,
  `node_modules/`, `dist/`, local work files, and Git history. `.env.example`
  is included with placeholders.

This verifies installation, automated behavior, compilation, and HTTP startup.
It is not a new full browser walkthrough. The actual external journey is
documented separately in `VERIFICATION_LIVE.md`.

### Earlier dependency audit

`npm audit --json` returned a nonzero exit status with **20 findings**:
1 low, 3 moderate, and 16 high; 0 critical. These are npm dependency advisory
counts, not a finding that all are exploitable in this app. Exploitability and
deployment relevance have not been established individually.

| Rating | Reported package entries |
|---|---|
| High | brace-expansion, braces, chokidar, fast-glob, flatted, js-yaml, lodash, micromatch, minimatch, nanoid, picomatch, postcss, rollup, source-map-js, tailwindcss, vite |
| Moderate | @humanfs/node, ajv, postcss-selector-parser |
| Low | @babel/core |

The audit reports available fixes; for some entries it proposes Tailwind 4,
a major change from the current Tailwind 3 setup. No dependency upgrade was
applied during this packaging check. The lockfile and application behavior
remain the verified versions.

Before public hosting, review these advisories, apply compatible fixes in a
separate change, plan any required styling migration, and repeat tests, build,
and affected browser checks. Do not treat this archive as approved for public
production deployment or run `npm audit fix --force` without reviewing changes.

### Earlier submission status

Source and documentation are packaged for review. Public repository creation,
judge access, video recording/upload, entrant attestations, and final Devpost
submission are pending. Check the organizer's current requirements before
submission. No worldwide uniqueness claim is established.
