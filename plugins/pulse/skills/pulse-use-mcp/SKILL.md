---
name: pulse-use-mcp
description: "Use this before any non-trivial Pulse task through MCP — reading or changing initiatives, projects, issues, OKRs, documents, teams or users. Explains how Pulse tools resolve names, scope, filters and confirmations, how to find deferred pulse_* tools, and which reference to read when. Load it first; every other pulse-* skill builds on it."
---

# Pulse MCP Base Workflow

Use this skill before any non-trivial Pulse MCP task.

## The one rule that matters most

Avoid redundant round trips; batch independent reads and pass names directly:

- **Pass human names, not ids.** Every create/update tool takes `team_name`,
  `project_name`, `assignee_name` (`"me"` works), `objective_name`,
  `parent_issue_query`, `milestone_query` and label names, and resolves them
  **concurrently server-side with a 5-minute cache**. Call selectors only after
  `ambiguous` or `not_found`; the error lists candidates.
- **Workspace scope is already resolved; project scope is not.** The Pulse server instructions end in a SESSION
  block naming the current user, the active workspace, and that workspace's
  teams. Hosts that show MCP instructions directly put it there; hosts that
  defer MCP tools behind `tool_search` show it inside that tool's description
  under `- pulse:`. Read it; do not call `pulse_get_current_workspace` or
  `pulse_get_current_user` to rediscover it.
- **Paste URLs straight in.** `https://app.trypulse.tech/{slug}/issues/{id}` works
  as `issue_query` (and as `workspace_slug`) — the server extracts both the id
  and the workspace.
- **Share links from `app_url`.** Every entity in a result carries its finished
  link. Copy it verbatim; never build one — the path takes the backend id, not
  the code, and documents, milestones and releases have their own routes.
- **Keep linked results scannable.** For several issues, give one outcome sentence
  and a compact list with one `[CODE — short title](app_url)` link per item.
  Add status, owner or due date only when it helps answer the request. Avoid
  repeating the same introduction for every issue or dumping tool JSON. For
  one issue, make its code and title the link label and put the key outcome
  beside it. Expand only when the user asks for details.
- **Reuse reads.** Store results; emit relevant fields from one representation, not envelopes. Reread only changed/incomplete content or a fresh body needed for a write. Batch indexed entities with `pulse_read_knowledge`; attached docs with `pulse_get_document(documents:[{document_id,body_offset?},…])`. Follow every continuation. Metadata/versions/images use single-document mode.
- **Bound combined output.** Store batched reads, then emit a relevant aggregate, not every full body. Follow returned offsets/page sizes. For `RESULT_PAGE_TOO_LARGE`, apply `error.retry.arguments_patch` to the original arguments, preserving filters/detail; continue pagination to required coverage. Recover missing ranges from stored data before refetching.
- **Document in the create call.** Pass `main_document.body` to
  `pulse_save_issue` / `pulse_save_project` / … instead of a follow-up
  `pulse_save_document`.
- **Never title the body.** Pulse prints the title above every document body, so
  a leading `# Title` shows the name twice. Start at the first section and use
  `##` as the top heading level.

## Deferred tools — when no `pulse_*` tool is in your list

Some hosts do not list MCP tools up front: they expose a `tool_search` tool and
load matching tools on demand. If you see `tool_search` and no `pulse_*` tool:

- Search once per tool family with the task words plus "pulse" —
  `tool_search("pulse list issues")`, `tool_search("pulse save project")`,
  `tool_search("pulse knowledge search")`. Matching tools (named
  `mcp__pulse__pulse_…`) become callable on the next turn.
- Never use `list_mcp_resources` / `list_mcp_resource_templates` to find tools.
- A `pulse://` reference is read with `read_mcp_resource` (server `pulse`, uri
  `pulse://references/issues-filters`) — only when you need that detail.
- Everything else is unchanged: pass human names, not ids; the SESSION block is
  in the `tool_search` description under `- pulse:`.

## Reference resources — read on demand, not up front

Read only the relevant reference for an unknown filter/lifecycle; see
[the reference index](references/domain-and-shapes.md#reference-resource-index).
Pulse: `pulse_search_documentation(target:"tools",query:"list issues")` returns
names; an exact query with `include_definition:true` returns paged native schemas.
For other services, with `ALL_TOOLS`, match service and operation in
`name`, never shared descriptions. Return candidate names only, load selected
definitions once and reuse them. Catalog entries can repeat the entire server
guidance: never print full matching entries as a discovery result. See
[tool discovery examples and host boundaries](references/tool-discovery.md)
when using an execution catalog. For code, locate symbols then read
relevant ranges instead of concatenating many complete files.
- Updates / inbox (activity feed, unread count): `pulse://references/updates-filters`

Judgement guides (only for structural or tracking-health work): `pulse://guides/methodology`, `pulse://guides/methodology-audit`.

## Domain model — the distinctions that matter

Full model, PM-term mapping, when to pick each entity, and personal-scope rules: [references/domain-and-shapes.md](references/domain-and-shapes.md) (also `pulse://guides/domain-model`).

- Hierarchy: `North Star → Objective → Key Result → Initiative → Project (epic) → Issue → sub-issue`. Enter through objectives for strategy, initiatives for workstreams, projects for risk and dates, issues for backlog and sprint work.
- Project `status` is lifecycle (`idea … canceled`); project `health_status` is risk. Objective `status` is lifecycle; key-result `status` is health. Never mix them.
- Objective and key-result `progress` are server-computed — move a key result's `current_value` (or record a metric value) and let it recalculate.
- A key result belongs to exactly one objective (immutable); a linked metric owns its `current_value`.
- `is_personal: true` issues and projects are private to you, omit team (plus project/cycle or initiative), and cannot change scope later.
- Epic = project (3+ related stories); story, feature, task and bug are issue types; sub-issues are one level deep.


## Tool surface — where to start

`tools/list` already names every tool with its arguments; do not re-derive it
from here. This is only the entry-point map:

| The user is asking about… | Enter through |
|---|---|
| OKRs, strategy, "what are we trying to achieve" | `pulse_list_objectives` → `pulse_list_key_results` (scope with `objective_name`) |
| A KPI or its history | `pulse_list_metrics`, `pulse_record_metric_value`, `pulse_metric_value_analytics` |
| A strategic workstream spanning epics | `pulse_list_initiatives` |
| Risk, dates, dependencies, roadmap | `pulse_list_projects` (health lives in `latest_status.status`) |
| Current/past cycle scope and progress | `pulse_list_cycles` (`which="current"` / `"previous"`), then `pulse_list_issues(cycle_ids:[…])` for row-level evidence |
| Intake inbox (bugs/features filed as requests) | `pulse_list_requests` / `pulse_get_request`; write with `pulse_save_request` / `pulse_act_on_request` (team semantics: the reference) |
| Backlog, bugs, assignment, sprint work | `pulse_list_issues` / `pulse_get_issue` |
| One known issue | `pulse_get_issue` — cheaper than a list (no facets, no pagination envelope) |
| "What's new / what did I miss" | `pulse_get_unread_count`, then `pulse_list_updates` (`is_read=false`) |
| Docs on an entity | `pulse_list_documents`, `pulse_get_document` |
| Team wiki / pinned resources | `pulse_get_team_library` |
| Counts, charts, trends | `pulse_analytics_stats` / `pulse_analytics_chart` |
| Open-ended context | `pulse_discover_knowledge` → `pulse_read_knowledge(entities:[…])` |

> The server can expose a narrowed toolset (`PULSE_MCP_TOOLSETS` /
> `?toolsets=core,docs`). If a tool you expect is missing from `tools/list` (or
> from a `tool_search` for its family, on hosts that defer tools), its toolset
> is not enabled for this session — say so rather than working around it.

Notes that are not obvious from the schemas:

- For "top", "most important", or "highest priority" issues, use
  `pulse_list_issues(sort="priority", sort_order="asc")`. Priority is ranked
  `urgent -> high -> medium -> low -> no_priority`; descending is the reverse.
- Do not repeat a successful list to repair ordering. Separate families, filters,
  sorts, pages and comparison views need separate calls; retain those results.
- If one requested list is empty, report that briefly and continue with the
  other requested lists or single-entity reads. Do not repeat the empty lookup.
- `pulse_save_issue` returns `id`, `code` and
  `main_doc_id` — never follow a write with a list call just to learn the code.

## Required Workflow

Resolve the named/linked/current-task Pulse project first. A repo/workspace name
alone is insufficient. If ambiguous, ask one scope question; do not scan the
workspace to guess. Bounded discovery in relevant mapped repositories may continue.
Use supported project/team/initiative filters; expand repos only for evidenced dependencies.

1. **Scope** — read the SESSION block at the end of the Pulse server
   instructions (inside the `tool_search` description when tools are deferred). It already
   names the user, the active workspace and its teams. Only when it reports no
   active workspace (a multi-workspace token) do you pick one and pass
   `workspace_id`; the `WORKSPACE_REQUIRED` error lists the options, so you never
   need `pulse_get_current_workspace` to recover.

2. **Knowledge — when the question is open-ended.** Run
   `pulse_discover_knowledge`, then `pulse_read_knowledge` (batch the hits with
   `entities: [...]`) for: status questions, planning, portfolio or risk
   reviews, triage, writing or revising a document, and anything where you would
   otherwise be guessing at context.

   **Skip it** when the user already identified the entity (an id, a code like
   `ENG-42`, a pasted app URL, or an exact title) and the task is a direct read
   or a single-field write. A mandatory Knowledge pass on "move ENG-42 to QA" is
   two wasted turns.

   When you do use it: scope discovery first and read bodies only for material
   candidates needed for the answer/edit. Top discover hits are often unrelated.
   Never answer from discover snippets alone; read the body. If nothing matches
   and the work is genuinely new, say so and proceed from the user's input.

3. **Act** — call the primary tool with human names. Do not pre-resolve.

4. **Trust the normalized metadata** the response echoes back:
   `applied_filters`, `name_resolution` (what each name bound to),
   `result_entities` (id → name for everything on the page), `facets`.

5. **Stop on ambiguity.** If `name_resolution` reports `ambiguous` or
   `not_found`, surface the listed candidates and ask — never guess, and never
   pick by id prefix.

## When to confirm before writing

Confirm with the user before:
- any **delete**;
- mutating an entity they do **not** own;
- a **bulk** write (more than 3 entities);
- anything that changes ownership, sharing, or visibility.

Do **not** burn a confirmation turn on a single create or update the user just
asked for in their own words. Do it, then report what you did — including the
resolved ids and a workspace-scoped link.

## Updates, filters and relationships — the short list

Entry points for the inbox and the full relationship table: [references/domain-and-shapes.md](references/domain-and-shapes.md).

- Multi-select `is` → API `in`, `is_not` → `ne`; `include_sub_issues=true` mirrors the app's nested view.
- Relationship arrays REPLACE on update; `add_*` / `remove_*` change one member; `clear_*` empties the set.
- Comments and reactions use `target_type: issue` for issues — `request` is only for intake requests.


## Response shape and content rules — the short list

Per-tool `detail` tiers, `result_entities`, label catalog rules and the documentation surfaces in full: [references/domain-and-shapes.md](references/domain-and-shapes.md).

- Rows carry ids; the page-level `result_entities` carries the names. Ask for `detail: "full"` only for a field the trimmed shape drops.
- Keep `limit` at 20 unless you need more; it controls page size, not total scope. A result over ~100k characters is truncated; recover omitted detail before relying on it.
- `pulse_discover_knowledge` returns excerpts — read the hits with ONE `pulse_read_knowledge` call (`entities: [...]`, max 10) before answering, and cite them.
- Search the matching list tool before creating. Titles, labels, descriptions and document surfaces follow the linked reference.


## Output Rules

- Explicit full-workspace work covers all relevant pages/complete aggregates. Never silently narrow scope or top-N-cap required investigation; `max_nodes` is not a census.
- Filter/project/aggregate before concise output; retain full results in an available store/artifact with recoverable refs. Emit one representation. Preserve errors, warnings, permissions and examined/total/remaining coverage; unsupported conclusions are unknown.
- Retrieve the complete current body before replacement; excerpts/summaries are insufficient. Details: [context and coverage](references/domain-and-shapes.md#context-and-coverage).
- Summarize the exact scope actually used
- State the Knowledge sources used for context
- Flag weak, ambiguous, unrelated, or absent Knowledge results
- Say which human names resolved to which IDs
- Call out unresolved or ambiguous entities
- When talking about projects, keep lifecycle and health separate
