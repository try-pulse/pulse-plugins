# Security policy

## Reporting a vulnerability

Please report security issues privately. Do not open a public issue.

- **Preferred:** [report a vulnerability](https://github.com/try-pulse/pulse-plugins/security/advisories/new)
  through GitHub's private vulnerability reporting.
- **Or** email [support@trypulse.tech](mailto:support@trypulse.tech) with
  "Security" in the subject line.

Include what you found, how to reproduce it and the plugin version (the
`version` in `plugins/pulse/.codex-plugin/plugin.json`). We will acknowledge
your report and keep you updated until it is resolved.

## Scope

This repository holds the plugin manifests, the skills and the publishing
scripts. In scope:

- the files under `plugins/pulse/`, for example a skill that tells Codex to do
  something unsafe;
- `scripts/sync.mjs` and the workflows under `.github/workflows/`, for example
  a way to get an unchecked bundle published.

The Pulse MCP server (`https://mcp.trypulse.tech/mcp`) and the Pulse app are
not in this repository. Report problems with them through the same channels;
we will route them to the right team.

## Supported versions

Only the latest release receives fixes. Run
`codex plugin marketplace upgrade pulse` to get it.
