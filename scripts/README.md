# Bug reproductions

Run from the project after installing dependencies:

```sh
npm run reproduce:bugs
# or
yarn reproduce:bugs
```

The script builds the current source, verifies a normal release and a dry-run
control, then exercises the 11 findings from the project audit. Each result shows
the observed behavior and the expected correct behavior. Node.js matching the
project's engine requirement, Git, and npm must be installed.

`REPRODUCED` means the bug exists. Exit code **0** means all selected bugs were
reproduced; exit code **1** means at least one result differed or a harness error
occurred. This is an opt-in audit tool, not a correctness test suite. A future fix
can make a case report `NOT REPRODUCED`; inspect its observations before concluding
that the issue is fixed. `ERROR` means the scenario could not be evaluated.

Case 10 uses the project's current commit-message hook and legacy configuration
when present. It checks both valid and invalid commits, so a modern Husky migration
can be verified directly. Its fixture links to the project's installed dependencies.

All release writes, commits, tags, and hook setup occur in fresh temporary Git
repositories. No remotes are configured and nothing is pushed or published. Git
and npm user configuration is isolated. The shell-injection probe only executes
a harmless `echo`. Worker output is captured; the report contains synthetic
fixture observations rather than environment values or project file contents.

Fixtures and `results.json` are retained at the printed temporary path so their
files, commits, and tags can be inspected. Each run uses a new directory.

```sh
# Run a single finding, with numbering matching the audit.
node scripts/reproduce-bugs.mjs --case 3

# Run two findings without rebuilding an already current dist directory.
node scripts/reproduce-bugs.mjs --skip-build --case 1 --case 8

# Show all case names and options.
node scripts/reproduce-bugs.mjs --help
```

To isolate the filename bug from other cases, the temporary parent path must not
contain spaces or shell metacharacters. If your system temporary directory does,
provide an existing plain directory with `--temp-dir PATH`. Case 1 explicitly
creates a repository with spaces and uses a platform-specific shell probe.

| Case | Severity | Reproduction |
| --- | --- | --- |
| 1 | P1 | Spaces break Git arguments; filename shell operators execute `echo`. |
| 2 | P1 | `npm run release --dry` performs a real release; `-- --dry` is the control. |
| 3 | P1 | Releasing target 5.0.0 from caller 1.0.0 writes target 1.0.1. |
| 4 | P1 | Explicit `dry: false` creates a 1.0.1 tag containing package version 1.0.0. |
| 5 | P1 | `--type typo` writes an empty version and creates tag `v`. |
| 6 | P2 | `--path` writes the changelog in the caller directory. |
| 7 | P2 | Relative `--path child` changes files, then fails during Git operations. |
| 8 | P2 | Lockfile versions 2 and 3 keep stale `packages[""].version` metadata. |
| 9 | P2 | The custom Feature commit receives a patch recommendation. |
| 10 | P2 | Current Husky configuration accepts a commit rejected by direct commitlint (fixed by the Husky 9 migration). |
| 11 | P3 | Help fails outside a package; missing/malformed packages exit successfully. |

Case 10 copies the current commit-msg hook into its fixture and checks both invalid and valid commits. After the Husky 9 migration, it should report `NOT REPRODUCED`: the hook rejects the invalid message and accepts the valid one. As described above, that result makes this audit command exit with code 1.
