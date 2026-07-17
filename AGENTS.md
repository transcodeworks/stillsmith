# Agent instructions

## Lint and format (required)

This repo uses **Biome** for lint and format. Before you finish any change that touches code or config:

1. Format and auto-fix: `pnpm check:fix`
2. Confirm clean: `pnpm check`

Do not open or update a PR while `pnpm check` fails. Prefer fixing Biome findings over disabling rules.

Useful commands:

| Command | Purpose |
| --- | --- |
| `pnpm check:fix` | Lint + format with writes |
| `pnpm check` | Lint + format check (CI gate) |
| `pnpm lint` | Lint only |
| `pnpm format` | Format only (`--write`) |
| `pnpm typecheck` | TypeScript across the workspace |
| `pnpm test` | Package tests (requires `pnpm build` first) |

Hooks also format on edit and re-check Biome when the agent stops. Still run `pnpm check` yourself after substantive edits.

## Development

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm typecheck
pnpm test
```

Playwright Chromium is installed by the cloud environment `install` script. If capture/tests fail with a missing browser, run:

```bash
pnpm --filter @stillsmith/capture exec playwright install --with-deps chromium
```
