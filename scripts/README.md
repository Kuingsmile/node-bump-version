# Release verification

```bash
yarn test:regressions
# Reuse an existing build:
node scripts/reproduce-bugs.mjs --skip-build --verify-fixed
```

This verifies all 11 findings from the previous audit in temporary Git repositories. `--verify-fixed` exits 0 only when
every selected case reports `FIXED`. A reproduced bug, unexpected result, or harness error exits 1.

For investigation, the legacy mode (`yarn reproduce:bugs`) expects bugs to reproduce and exits 0 only if every selected
case reproduces. Use `--verify-fixed` for correctness checks and CI.

```bash
node scripts/reproduce-bugs.mjs --skip-build --verify-fixed --case 1 --case 8
node scripts/reproduce-bugs.mjs --help
```

The cases cover literal Git filenames, npm dry-run argument forwarding, target package versions, explicit `dry:false`,
invalid release types, changelog paths, relative package paths, npm lockfile v2/v3 metadata, feature recommendations,
Husky enforcement, and help/startup errors. Case 10 copies the current commit-msg hook and checks invalid and valid
messages; successful enforcement reports `FIXED`.

All writes, commits, tags, and hook setup occur in fresh temporary repositories with isolated Git/npm configuration and
no remotes. The filename probe uses a harmless `echo` marker. Output describes synthetic fixtures without exposing
environment values or project contents. Fixtures and `results.json` are retained at the printed path. Each run uses a
new directory. If the system temporary path contains spaces or shell metacharacters, pass an existing plain path with
`--temp-dir PATH`.

## Package installation check

```bash
yarn build
yarn test:package
```

This packs the current build, verifies the publication allowlist, and installs the tarball into an isolated consumer.
Registry access is required. It checks public imports, confirms optional integrations are absent, and runs a preview and
release in a temporary repository with no remotes. Its temporary directory is removed after completion.

The regular `yarn test` suite needs Git but does not install packages from the registry. All commands require Node
matching the package engine range; repository builds use Yarn 1.22.22.
