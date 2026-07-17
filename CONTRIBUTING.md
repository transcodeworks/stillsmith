# Contributing to stillsmith

This page covers how contributions work here and how to get a development
environment running.

## Before you write code

**Bug fixes, docs, and typos:** open a pull request directly. You don't need to
file an issue first if the PR itself explains the bug.

**Features and API changes need an issue first.** The project has a design
direction, written up in [DESIGN.md](./DESIGN.md) and
[DESIGN-TOURS.md](./DESIGN-TOURS.md), and a feature that cuts against it won't
be merged no matter how good the code is. Describe the problem you want to
solve and the API you have in mind, then wait for a maintainer to agree on the
direction before starting work.

## Getting set up

You need Node and pnpm. The pnpm version is pinned in `package.json` under
`devEngines.packageManager`, so with corepack enabled you get the right one
automatically. For Node, use the version CI uses (see
[`.github/workflows/ci.yml`](./.github/workflows/ci.yml)).

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm --filter @stillsmith/capture exec playwright install --with-deps chromium
```

The Playwright step downloads the Chromium build the e2e tests drive. You only
run it once.

Day to day:

```bash
pnpm dev                  # rebuild @stillsmith/capture on change
pnpm example capture      # capture the example app's scenes
pnpm example start        # run the example app in a browser
pnpm docs dev             # run the documentation site
```

## Before you push

Every PR has to pass the same gate CI runs:

```bash
pnpm check:fix            # Biome lint + format, with writes
pnpm check                # confirm clean
pnpm typecheck
pnpm build && pnpm test   # tests run against the built output
```

The order matters: the e2e suite exercises the built runtime (the Vite plugin
serves files from `dist/`), so run `pnpm build` before `pnpm test` whenever
you've changed package source.

Fix Biome findings rather than suppressing them. If a rule really is wrong for
a particular line, suppress it there and say why in the PR.

## Commits and pull requests

Commit messages and PR titles follow
[Conventional Commits](https://www.conventionalcommits.org/):

```
feat(tour): add advance-on-hover trigger
fix(capture): await web fonts before the shutter
docs: clarify target resolution order
```

Common types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`. Use the
package name as the scope where it helps (`capture`, `tour`, `annotate`,
`docs`, `example`).

One logical change per PR. Behavior changes should come with a test that would
have caught the regression. If you change the public API, update the relevant
guide under `docs/` and the package README in the same PR.

## What ships where

| Path | What |
| --- | --- |
| `packages/capture` | `@stillsmith/capture`: CLI, Vite plugin, scene runtime, capture pipeline, authoring GUI, MCP server. |
| `packages/tour` | `@stillsmith/tour`: the production tour runtime. |
| `packages/annotate` | `@stillsmith/annotate`: the shared annotation core. |
| `examples/rock-app` | A real consumer; doubles as the e2e fixture. |
| `docs` | The documentation site (Starlight). |

## Licensing

stillsmith is [MIT licensed](./LICENSE). By submitting a contribution you agree
that it may be distributed under the same license.

## Conduct

Participation in this project is covered by our
[Code of Conduct](./CODE_OF_CONDUCT.md).
