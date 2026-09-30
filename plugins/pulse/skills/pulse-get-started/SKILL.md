---
name: pulse-get-started
description: "Use this when the user chooses Set up for Pulse, has just installed the Pulse plugin, or asks to get started with or connect Pulse. Confirms sign-in, the workspace and teams, then offers read-only first steps. Writes nothing. Not for doing Pulse work itself: the other pulse-* skills own triage, reviews and writes."
---

# Set up Pulse

Get the user from "installed" to a first useful answer: confirm Pulse is
connected, say who they are and which workspace they are in, and point at a
first read-only task. For name resolution, filters and deferred tools, the
pulse-use-mcp base skill applies ($pulse-use-mcp; file: ../pulse-use-mcp/SKILL.md) —
this skill does not repeat it.

Report only what tools and the server instructions returned. Never claim a
workspace, team or repository you did not read.

## 1. Find the Pulse tools

If no `pulse_*` tool is listed and a `tool_search` tool is, call
`tool_search("pulse current workspace")`. If there is still no `pulse_*` tool,
the Pulse server is not connected: tell the user to sign in to the `pulse` MCP
server (in a terminal: `codex mcp login pulse`; hosts with browser sign-in ask
on first use), then start a new thread. Stop there.

## 2. Read who and where

Read the SESSION block at the end of the Pulse server instructions (inside the
`tool_search` description when tools are deferred). It names the user, the
active workspace and its teams. Only if there is no SESSION block, call
`pulse_get_current_workspace` once. An authentication error means the sign-in
did not take: give the same sign-in instruction as step 1 and stop.

## 3. Settle the workspace

- One workspace, or one active: state it by name.
- Several and none active: list them and ask which one to use. Never pick one
  yourself. Once the user answers, pass that `workspace_id` on every later call.

Ask one question at a time, and only this one if it is needed.

## 4. Confirm what you found

In two or three lines: the user's name, the workspace, and its teams (from
SESSION; call `pulse_list_teams` only if SESSION did not list them).

## 5. Offer a first step

Offer these read-only starters and let the user pick:

- $pulse:pulse-issue-triage — review a team's backlog and surface blocked work.
- $pulse:pulse-project-risk-review — find at-risk projects and why.
- $pulse:pulse-cadence — check what is drifting and whether an update is due.

Say that Pulse writes (creating, updating, deleting) always ask first.

Optionally call `pulse_list_repos` to tell the user whether code questions will
work. An empty list means the workspace has not granted repository access — not
a broken install.

## 6. Hand back

If the plugin was installed in the middle of a task, continue that task now.
Make no writes unless the user asks for one.
