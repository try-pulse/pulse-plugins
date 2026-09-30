# Contributing

Thanks for helping improve the Pulse plugin for Codex. Everyone taking part
here follows our [code of conduct](CODE_OF_CONDUCT.md).

## What can change here

| Path | Pull requests |
|---|---|
| `plugins/` | **Not accepted.** Generated from Pulse's own source on every release, so the next release would overwrite your change. [Open an issue](https://github.com/try-pulse/pulse-plugins/issues/new/choose) instead and we will fix it at the source. |
| `README.md`, `SECURITY.md`, `CONTRIBUTING.md` | Welcome. |
| `scripts/`, `.github/` | Welcome. Please open an issue first for anything larger than a small fix. |

## Reporting a problem with the plugin

Use the [bug report form](https://github.com/try-pulse/pulse-plugins/issues/new?template=bug.yml).
It asks for the details we need: your Codex version, where you run Codex (CLI or
the ChatGPT desktop app) and how you installed the plugin.

Report security issues privately, as described in [SECURITY.md](SECURITY.md).

## Working on the scripts

The publishing script has no dependencies. You need Node.js 20 or later.

```bash
node --test scripts/
```

To check a bundle without writing anything:

```bash
node scripts/sync.mjs --index ./index.json --zip ./codex-plugin.zip --dry-run
```

Keep the checks in `scripts/sync.mjs` strict. A change that makes it accept
more (a new path in the allowlist, a looser version rule) needs a test in
`scripts/sync.test.mjs` and a sentence in the pull request saying why.

## Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/), for example
`fix(sync): reject a bundle with an empty skills directory`. Release commits
(`release: pulse X.Y.Z`) are written by the `sync` workflow only.
