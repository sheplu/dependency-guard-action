# dependency-guard-action

A GitHub Action that runs [`@sheplu/dependency-guard`][cli] against your repo to surface outdated, deprecated, or stale npm dependencies — with policy enforcement (`fail-on`, `max-age-days`) and an automatic Markdown summary on every workflow run.

[cli]: https://github.com/sheplu/dependency-guard

## Quickstart

```yaml
# .github/workflows/dependency-guard.yml
name: Dependency Guard

on:
  pull_request:
  schedule:
    - cron: '0 6 * * 1' # weekly, Mondays 06:00 UTC

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: sheplu/dependency-guard-action@v1
```

That's it — the action reads `./package.json`, queries the npm registry, and writes a Markdown report to the run's job summary.

## Examples

### Enforce a policy on PRs

Fail the PR if any production dependency needs a major bump or is older than 18 months:

```yaml
- uses: sheplu/dependency-guard-action@v1
  with:
    fail-on: major
    max-age-days: 540
    filter: prod
```

### Scan a monorepo workspace

```yaml
- uses: sheplu/dependency-guard-action@v1
  with:
    working-directory: packages/api
    include-transitive: 'true'
```

### Scheduled auto-update PR (advanced)

Combine with `peter-evans/create-pull-request` to open a PR that bumps minor versions:

```yaml
- uses: sheplu/dependency-guard-action@v1
  with:
    update-level: minor
    dry-run: 'false'        # actually rewrite package.json
    fail-on: ''             # don't fail the job on outdated deps
- uses: peter-evans/create-pull-request@v6
  with:
    title: 'chore(deps): minor updates'
    branch: deps/minor-updates
```

> **Heads up:** `update-level` rewrites `package.json` in place. Always pair it with `dry-run: 'true'` first, and never combine it with auto-merge.

## Inputs

| Input                | Default   | Description                                                                         |
| -------------------- | --------- | ----------------------------------------------------------------------------------- |
| `version`            | `latest`  | Version spec of `@sheplu/dependency-guard` to fetch via `npx`. Accepts any spec npm understands: an exact version (`0.1.0`), a semver range (`^0.1.0`), a dist-tag (`latest`, `next`), or a git/file URL. |
| `working-directory`  | `.`       | Directory containing `package.json`. Ignored if `path` is set.                      |
| `path`               | —         | Explicit path to a `package.json`. Overrides `working-directory`.                   |
| `format`             | `table`   | Output format printed to the action log: `table`, `json`, or `markdown`.            |
| `fail-on`            | —         | Fail the job at this update level: `major`, `minor`, `patch`, `any`, `deprecated`.  |
| `max-age-days`       | —         | Fail if any dependency version is older than N days.                                |
| `only`               | —         | Comma-separated package names to analyze (e.g. `react,lodash`).                     |
| `ignore-scopes`      | —         | Comma-separated npm scopes to skip (e.g. `@internal,@private`).                     |
| `filter`             | —         | Buckets to include: `prod`, `dev`, `peer`, `optional`, `overrides`, `resolutions`, `pnpm-overrides`. |
| `include-transitive` | `false`   | Expand analysis via lockfile to include transitive dependencies.                    |
| `registry`           | —         | Custom npm registry URL.                                                            |
| `no-cache`           | `false`   | Disable registry response cache.                                                    |
| `cache-clear`        | `false`   | Clear the registry cache before running.                                            |
| `cache-ttl`          | —         | Cache TTL in minutes.                                                               |
| `sort`               | —         | Sort by `age`, `status`, or `name`.                                                 |
| `all-columns`        | `false`   | Table format: show empty patch/minor/major columns.                                 |
| `update-level`       | —         | **Rewrites `package.json`.** One of `patch`, `minor`, `major`, `all`.               |
| `dry-run`            | `false`   | Preview `update-level` changes without writing.                                     |
| `quiet`              | `false`   | Suppress the summary line in non-JSON formats.                                      |
| `summary`            | `true`    | Write a Markdown report to `$GITHUB_STEP_SUMMARY`.                                  |

## Outputs

| Output           | Description                                                                  |
| ---------------- | ---------------------------------------------------------------------------- |
| `total`          | Total dependencies analyzed.                                                 |
| `up-to-date`     | Count of up-to-date dependencies.                                            |
| `patch-updates`  | Count needing patch updates.                                                 |
| `minor-updates`  | Count needing minor updates.                                                 |
| `major-updates`  | Count needing major updates.                                                 |
| `deprecated`     | Count of deprecated dependencies.                                            |
| `policy-passed`  | `"true"` if exit was 0; `"false"` if `fail-on`/`max-age-days` tripped.       |
| `report-json`    | Full JSON report from `dependency-guard`.                                    |

Use the outputs in downstream steps:

```yaml
- id: guard
  uses: sheplu/dependency-guard-action@v1
  with:
    fail-on: major
- if: steps.guard.outputs.major-updates != '0'
  run: echo "::warning::${{ steps.guard.outputs.major-updates }} dep(s) need a major bump"
```

## How it works

The action is a thin TypeScript wrapper bundled with [esbuild][esbuild]. It does **not** vendor the CLI — instead, on each run it invokes:

```
npx --yes @sheplu/dependency-guard@<version> [flags]
```

The action and CLI version independently — much like `actions/setup-node` and Node itself. The action's git tag (e.g. `@v1`) controls the wrapper's behavior; the `version` input controls which CLI release you run. For reproducible builds, pin both:

```yaml
- uses: sheplu/dependency-guard-action@v1
  with:
    version: 0.1.0
```

The `version` input takes any spec npm accepts — exact, semver range, dist-tag, or a git/file URL — so you can also float on `^0.1` or test a fork via `git+https://...` without retagging the action. The action handles input validation, output extraction, and step-summary rendering; the CLI does the actual analysis.

[esbuild]: https://esbuild.github.io

## Roadmap

- Sticky PR comments (`@actions/github`)
- Inline file annotations via `core.warning()`
- SARIF output for the GitHub Security tab
- Cross-run cache via `actions/cache`

## Development

```sh
npm ci           # install
npm run lint     # oxlint
npm run typecheck
npm test         # node --test via tsx
npm run build    # esbuild → dist/index.js
npm run package  # build + verify dist/ is committed
```

The bundled `dist/index.js` **must** be committed — GitHub Actions executes it directly from the ref the user specifies.

## License

MIT — see [LICENSE](./LICENSE).
