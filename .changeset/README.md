# Changesets

Versioning and publishing for `@stillsmith/*` go through
[Changesets](https://github.com/changesets/changesets).

On a PR that should release:

```bash
pnpm changeset
```

Pick the affected packages (or any of the fixed group — they version together),
choose patch / minor / major, and write a short summary. Commit the file under
`.changeset/` with your code.

On `main`, CI opens a **Version Packages** PR that bumps versions and updates
changelogs. Merging that PR publishes to npm.
