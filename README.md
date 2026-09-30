# Pulse plugins

[![check](https://github.com/try-pulse/pulse-plugins/actions/workflows/check.yml/badge.svg)](https://github.com/try-pulse/pulse-plugins/actions/workflows/check.yml)
[![sync](https://github.com/try-pulse/pulse-plugins/actions/workflows/sync.yml/badge.svg)](https://github.com/try-pulse/pulse-plugins/actions/workflows/sync.yml)
[![release](https://img.shields.io/github/v/release/try-pulse/pulse-plugins?label=pulse)](https://github.com/try-pulse/pulse-plugins/releases/latest)
[![license](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/try-pulse/pulse-plugins/badge)](https://scorecard.dev/viewer/?uri=github.com/try-pulse/pulse-plugins)

The public [Codex](https://developers.openai.com/codex) plugin marketplace for
[Pulse](https://www.trypulse.tech/). The `pulse` plugin connects Codex to your
Pulse workspace. It adds the Pulse MCP server (issues, projects, initiatives,
OKRs, documents and analytics) and skills for onboarding, triage, planning, delivery
and status reviews.

## Install

```bash
codex plugin marketplace add try-pulse/pulse-plugins
codex plugin add pulse@pulse
codex mcp login pulse
```

`codex mcp login pulse` opens your browser to sign in to Pulse with OAuth, so
there are no keys to paste. Requires Codex 0.147 or later.

## Get started

Start a new Codex thread after installing.

- **ChatGPT desktop app:** choose **Set up** on the Pulse plugin.
- **Codex CLI:** type `$pulse:pulse-get-started`.

The setup skill checks that you are signed in, confirms your workspace and
teams, and suggests a few read-only starting points. It changes nothing in
Pulse. After that, ask in your own words, for example:

- *"Use Pulse to triage my team's backlog and surface blocked work."*
- *"Use Pulse to find at-risk projects and explain the deadline pressure."*
- *"Use Pulse to create an issue for the login timeout bug."*

The skills confirm with you before they write to Pulse, and delete tools are
marked as destructive so Codex asks before running them.

Plugins load in the Codex CLI and in Codex inside the ChatGPT desktop app. The
Codex IDE extension (VS Code, JetBrains) does not load plugins. There you can
register the MCP server alone, without the skills:

```bash
codex mcp add pulse --url https://mcp.trypulse.tech/mcp --oauth-resource https://mcp.trypulse.tech/mcp
```

## Update

Codex does not refresh third-party marketplaces by itself. To get a new release:

```bash
codex plugin marketplace upgrade pulse
```

Codex reinstalls an installed plugin only when its version changes. Every
release here carries a new version.

## Pin a release

Every release is tagged `pulse/vX.Y.Z` (see [tags](https://github.com/try-pulse/pulse-plugins/tags)).
To stay on one release:

```bash
codex plugin marketplace add try-pulse/pulse-plugins --ref pulse/vX.Y.Z
```

Replace `X.Y.Z` with a version from the tags list.

## Already installed with the Pulse CLI?

`pulse install --codex` installs the same plugin under a different id,
`pulse@personal`. Use one install or the other, not both; with both you get two
copies of the Pulse server and its skills. To switch to this marketplace, first run:

```bash
pulse uninstall --codex
```

## What is in this repository

| Path | What it is |
|---|---|
| `.agents/plugins/marketplace.json` | The marketplace, named `pulse`, so the plugin id is `pulse@pulse` |
| `plugins/pulse/` | The plugin: `plugin.json` and `mcp.json` (the portable manifest and the MCP server), `.codex-plugin/plugin.json` (the same plugin for older Codex), `skills/`, `assets/` |
| `scripts/setup-repo.sh` | One-time GitHub settings for maintainers (rulesets, security features) |
| `scripts/sync.mjs` | Publishes each Pulse release into `plugins/pulse/` after its checks pass |
| `.github/workflows/` | `sync` (hourly and on demand; also creates the GitHub Release), `check` (the sync tests), `codeql` and `scorecard` (security analysis) |

### How releases get here

`plugins/pulse/` is generated. Pulse publishes the plugin as a zip whose sha256 is
listed in [`index.json`](https://mcp.trypulse.tech/cli/bundles/index.json). Every
hour the `sync` workflow downloads that zip and publishes it after these checks:

- the sha256 matches the index;
- every file is on an allowlist (`.codex-plugin/plugin.json`, `plugin.json`,
  `mcp.json`, `skills/**`, `assets/*.png`, with no dot-files);
- the plugin is named `pulse` and its MCP server is `https://mcp.trypulse.tech/mcp`
  with no credentials in it;
- no file contains credentials (auth headers, access keys, private keys);
- the version is newer than the published one.

Each release is one commit, `release: pulse X.Y.Z`, an annotated tag
`pulse/vX.Y.Z` and a [GitHub Release](https://github.com/try-pulse/pulse-plugins/releases)
listing the skills and the bundle's sha256. If any check fails, nothing is published.

## Contributing and support

This repository is generated from Pulse's own source, so pull requests that
change `plugins/` cannot be merged; the next release would overwrite them.
Please [open an issue](https://github.com/try-pulse/pulse-plugins/issues/new/choose) or
write to [support@trypulse.tech](mailto:support@trypulse.tech) instead. See
[CONTRIBUTING.md](CONTRIBUTING.md) for what can change here, and
[SECURITY.md](SECURITY.md) to report a vulnerability privately.

## License

The manifests, skills and scripts are released under the [MIT License](LICENSE).
The Pulse name and logos are trademarks and are not covered by that license.
See [NOTICE](NOTICE).
