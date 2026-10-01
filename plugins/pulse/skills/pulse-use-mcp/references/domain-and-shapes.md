# Pulse domain model, response shapes and content rules

The long form behind the short lists in [../SKILL.md](../SKILL.md). Read the part you need; `pulse://guides/domain-model` covers the same ground over MCP.

## Domain Model

- Planning hierarchy: `North Star -> Objective -> Key Result -> Initiative`
- Strategic (OKR) layer:
  - `North Star`: an organization-level objective other objectives roll up to.
  - `Objective`: a team-owned strategic goal. Lifecycle status is `active | planned | completed | canceled`. Progress is server-computed from the weighted average of its key results — never set it manually.
  - `Key Result`: a measurable outcome under exactly one objective (`objective_id` is required and immutable). Health status is `on_track | at_risk | off_track | completed`. Each KR carries a `target_type` (how progress is computed: `final_value | stepwise | cumulative | average_based | threshold_based | growth_rate | boolean`), a `value_type` (`number | percentage | currency | custom`), and `baseline` / `target_value` / `current_value`. KRs can link to one or more initiatives (m:n) and optionally to a metric (`metric_id` / `metric_name`) — when a metric is linked, current_value/baseline/value_unit auto-sync from the metric and manual current_value writes are ignored.
  - `Metric`: a KPI source of truth. Metrics have a free-form unit, current value, append-only value history, and can drive one or more KRs. Recording a metric value cascades KR, objective, and initiative progress.
- Delivery layer:
  - `Initiative`: strategic workstream (goal spanning multiple epics). Links upward to one objective and m:n to key results.
  - `Project`: delivery unit / epic (container for related stories)
  - `Issue`: execution item — user story, task, or bug
  - `Sub-issue`: task within a story (one level deep only)
  - `Request`: intake object, read-only over MCP (`pulse_list_requests`, `pulse_get_request`)

## PM Concept Mapping

| PM Term | Pulse Entity | Usage Rule |
|---|---|---|
| Strategic Goal / Theme | Initiative | Only when spanning ≥2 epics with an OKR connection |
| Epic | Project | Container for related stories; one coherent product area |
| User Story | Issue (type=story or feature) | "As a [role], I want [action] so that [benefit]" |
| Task / Bug | Issue (type=task or bug) | Internal work or defect; no user-story framing needed |
| Sub-task | Sub-issue | One implementation unit within a story; vertically sliced |
| Acceptance Criteria | Main doc (type=document) | Gherkin format: Given / When / Then |

## When to Choose Each Entity

- **Initiative** — work represents a strategic outcome that ≥2 epics contribute to (e.g., "Launch mobile onboarding")
- **Project (Epic)** — coherent product area or feature set that will be broken into 3+ related stories (e.g., "Auth redesign")
- **Issue type=story** — user-facing outcome deliverable in one sprint; must satisfy INVEST
- **Issue type=feature** — larger user-facing capability; use story if it fits one sprint, feature if borderline
- **Issue type=task** — internal work with no direct user benefit, or a cross-cutting concern
- **Issue type=bug** — an existing behavior is broken
- **Sub-issue** — a story has multiple distinct implementation steps that benefit from independent tracking

## Critical Distinctions

- Project `status` is lifecycle state: `idea | discovery | proposal | accepted | ready | in_progress | paused | maintenance | completed | canceled` (default `idea`)
- Project `health_status` is delivery risk
- `Project` (epic) is broader delivery scope; `Issue` (story/task/bug) is execution scope
- Objective `progress` and Key Result `progress` are server-computed — never write them directly. Move a Key Result's `current_value` instead, and the parent objective's progress recalculates.
- Objective `status` is lifecycle (`active|planned|completed|canceled`); Key Result `status` is health (`on_track|at_risk|off_track|completed`). They are independent — an `active` objective can carry an `at_risk` key result.
- If the user talks about OKRs, strategy, or "what are we trying to achieve", enter through `pulse_list_objectives`; drill into the measurable side with `pulse_list_key_results` filtered by `objective_name`.
- If the user starts from a strategic workstream that bundles delivery, enter through `initiative` (which links to one objective and m:n key results)
- If the user starts from risk, dates, dependencies, or roadmap, enter through `project`
- If the user starts from backlog, bugs, assignment, or sprint work, enter through `issue`

## Personal vs Team Scope

Issues and projects each have an `is_personal` boolean. It splits the entity into two mutually exclusive scopes:

- **Team scope** (`is_personal=false`, default): the standard model — belongs to a team, visible to that team. Issues may also link to a project and cycle; projects may link to an initiative.
- **Personal scope** (`is_personal=true`): private to a single user. Backend RLS hides personal items from teammates and admins — only the creator (assignee for issues, owner for projects) can see them.

Rules when `is_personal=true`:

- **Personal issue**: must omit `team_id`/`team_name`, `project_id`/`project_name`, and `cycle_id`/`cycle_name`. `assignee_id` defaults to the current authenticated user. Sub-issue / blocks / blocked_by relationships still work.
- **Personal project**: must omit `team_id`/`team_name` and `initiative_id`/`initiative_name`. `owner_id` defaults to the current authenticated user. depends_on / blocks / blocked_by between projects still work.
- **Other fields are unchanged**: status, priority, type, dates, labels, progress, time estimates all behave the same.

Lifecycle:

- `is_personal` is accepted only on create (`pulse_save_issue` / `pulse_save_project` without an id or query) and **cannot** be changed on update. To "convert" an item, recreate it with the desired scope.

Filtering and listing:

- `pulse_list_issues` and `pulse_list_projects` accept `is_personal: true | false` (eq only, no operator).
- `true` → only the caller's personal items. `false` → only team-scoped items. Omit → both within the caller's RLS scope.
- For "my personal tasks", pass `assignee_name: "me"` / `owner_name: "me"` — the SESSION block already names you; do not call `pulse_get_current_user`.

## Response Shape Defaults (token efficiency)

- **Rows carry ids; `result_entities` carries the names.** At `minimal` and `standard`, list and get tools no longer repeat a full `team` / `project` / `parent` / `assignee` / `reporter` object on every row — each distinct one is listed once in the page-level `result_entities` index as `{id, name}`. Look ids up there. (`detail: "full"` still returns the raw API shape, signed avatar URLs and all — only ask for it when you genuinely need a field the trimmed shape drops.)
- `pulse_list_issues`, `pulse_get_issue`, `pulse_get_sub_issues` default to `detail: "standard"`: scalars, ids, `attachments_count`, and a lean `resources[]` catalog (`id`, `title`, `type`, `is_main_doc`, optional link `url`) showing the main writeup vs supplementary Resources. Use `detail: "minimal"` for bulk id lookups.
- **`limit` is a real cost.** The default 20 is usually right; raise it deliberately. A result over ~100k characters is truncated with a note telling you to narrow the query.
- `include_facets` defaults to `false`. `applied_filters` is always echoed back, so you still know what was filtered.
- `pulse_list_documents` omits `access_url` by default. If you need the binary, call `pulse_get_document` with the `id` — you'll get a fresh `access_url` plus `body_markdown` for type=document.
- `pulse_list_metrics` defaults to `detail: "standard"`; use `minimal` for cheap KPI browsing and `full` only when raw owner/team fields are needed. `pulse_record_metric_value return_detail="full"` fetches affected linked KRs.
- Analytics tools (`pulse_analytics_stats` / `pulse_analytics_chart` / `pulse_*_history`) accept `detail: "minimal" | "standard" | "full"`. `minimal` flattens chart segments to `{name, value}`; `standard` (default) preserves segment columns; `full` returns the raw API payload. Filter values accept human names (team/owner/initiative/objective/metric) and are resolved before the call — check `name_resolution` in the response.
- `pulse_discover_knowledge` returns excerpts only. Never answer from discover snippets alone; call `pulse_read_knowledge` for full Markdown content and cite `entity_type`, `entity_id`, and `title`. Read several hits in ONE call with `entities: [{entity_type, entity_id}, …]` (max 10, fetched concurrently) — never one tool call per hit.
- Need one issue? Use **`pulse_get_issue`** (by `issue_id` or `issue_query` — same resolution as `pulse_save_issue`). Cheaper than `pulse_list_issues` because there's no filter catalog, no pagination envelope, no facets. Supports the same `detail` and `include_content` params.
- `pulse_save_issue` returns `id`, `code`, `main_doc_id`, and all scalar fields — you do **not** need to follow up with a `pulse_list_issues` just to learn the new code.
- `pulse_list_comments` returns `data` plus pagination; each top-level item may include `recent_replies` (up to 3) and `reactions_summary`.
- `labels` on create/update references the team's existing label catalog — pass label names or 24-hex label ids (e.g. `["backend"]` or `["66f0...id"]`), which the MCP resolves to `label_ids`. An unknown name fails with the available labels listed. Discover labels with `pulse_list_labels`, and create new ones with `pulse_save_label`. Labels in a group are mutually exclusive: an entity carries at most one per group. Labels belong to a team (or the whole workspace — those resolve for every team) and separate per entity type (an issue label ≠ a project label ≠ a request label), and `entity_type` is required — omitting it on the API returns an empty catalog rather than everything. The same applies to the `labels` filter on `pulse_list_issues` / `pulse_list_projects`: pass names (resolved against the single filtered team) or ids.

## Content Quality Standards

- **Titles**: short (max 5–7 words), no status/priority/label/date in the title.
- **Descriptions**: issues, initiatives, and projects have a hard 50-character description limit in MCP and the Pulse UI — `description` is a UI title-suffix only, NOT documentation. Keep it to one short fragment that completes the title. Objectives and Key Results are the exception: their `description` accepts up to 2000 characters of markdown, so strategic context (rationale, how progress is measured, decision history) does live in the description there.
- **Status**: always in the `status` field — never embedded in titles.
- **Labels**: classify cross-cutting concerns, but only with labels that already exist in the team's catalog — discover them with `pulse_list_labels` and pass names or ids. Create a new one with `pulse_save_label` only when nothing fits.
- **Issues**: one concern per issue. Use parent + sub-issues for multi-part work. Use user story format for `story`/`feature` types.
- **Initiatives**: only for strategic workstreams spanning multiple projects.
- **Search before creating**: run one keyword `search` on the matching list tool before creating a new entity. One call, and it catches the most common user regret.
- **Knowledge before judgement calls**: run Knowledge discover/read before deciding a title, type, labels, scope, acceptance criteria, summary, status narrative, or document body — anything where you would otherwise be inventing context. Skip it for a mechanical edit to an entity the user already named (see Required Workflow step 2).
- **Relevance over forced linking**: never attach unrelated Knowledge to a task just because discover returned it. Use Knowledge as context only when the full body is genuinely aligned with the user's request.
- **Auto-assign**: if context implies the current user's work, pass `assignee_name: "me"` / `owner_name: "me"` — or the user id from the SESSION block. Do not call `pulse_get_current_user` for it.
- **Confirm before writing**: only for deletes, entities the user does not own, and bulk writes (>3 entities) — see "When to confirm before writing". A single create/update the user asked for goes straight through.
- **Ownership sensitivity**: for entities not owned by the current user, require explicit confirmation before mutating or deleting.
- **Documenting an entity (issue / project / initiative / objective / key_result)** — use the right surface:
  - **MAIN doc** (`main_document` on create/update, or `pulse_save_document` / `pulse_attach_document` with `is_main_doc: true`): the canonical writeup — story, requirements, acceptance criteria, scope, design notes, background. THIS is where primary documentation lives.
  - **Resources / non-main attachments** (omit `is_main_doc` / `false`): supplementary only — integration guide, runbook, Figma/Notion link, related spec, appendix. Same as the app Resources chips. NOT the primary writeup.
  - **On read**: `pulse_get_issue` / `pulse_get_project` / `pulse_get_initiative` / `pulse_get_request` (and matching list tools) return `main_doc_id` + lean `resources[]` (`id`, `title`, `type`, `is_main_doc`, optional `url`). Read bodies with `pulse_get_document`. List Resources alone with `pulse_list_documents` + `exclude_main_doc: true` (issue/project/initiative; request → use `resources[].id` + get_document).
  - **On create with both**: (1) `pulse_save_*({ …, main_document: { body } })` for the canonical writeup; (2) then `pulse_save_document({ title, type: "document"|"link", body|url, attachments: [{ entity_type, entity_id }] })` for each supplementary Resource — never put those in `main_document`.
  - **Comment** (`pulse_add_comment`): short discussion only. NEVER a substitute for the main doc.
  - **`description` field**: UI title-suffix only (≤50 chars on issue/project/initiative). NEVER for documentation.
  - **Mentions in a body**: `<@USER_ID|Display Name>` and `<#issue:ID|Label>` / `<#project:ID|Label>` / `<#document:ID|Title>`. Mentions are the one case that genuinely needs ids up front — resolve them with `pulse_list_users` / `pulse_list_issues` first.
  - **Revise main doc**: pass `main_document` again on the same `pulse_save_*` tool with the id, or `pulse_save_document` with `body`.
  - **Body opening (the most common defect)**: NEVER open a body with the entity's or document's own title. Pulse renders the title above the body — the entity header on an issue/project/initiative page, the title field on a wiki or standalone document page — so a leading `# <same title>` shows the name twice. Start at the first real section (`## Story`, `## Problem`, `## Scope`) or the opening paragraph, and use `##` as the body's top heading level. `main_document.title` already defaults to the entity title. On a revision, drop a title heading the existing `body_markdown` carries instead of preserving it.

## Updates / Inbox Entry Points

| User says… | Tool |
|---|---|
| "What's new?", "What did I miss?" | `pulse_list_updates` with `is_read=false` |
| "How many unread?" | `pulse_get_unread_count` |
| "What was I assigned?" | `pulse_list_updates` with `action_types=["assigned"]` |
| "Show comments on my work" | `pulse_list_updates` with `entity_types=["comment"]` |
| "What happened on initiatives today?" | `pulse_list_updates` with `types=["initiative_activity"]` |
| "High-priority unread" | `pulse_list_updates` with `is_read=false`, `priorities=["high"]` or `important=true` |

## Filter and Relationship Semantics

- Multi-select `is` -> API `in`
- Multi-select `is_not` -> API `ne`
- `include_sub_issues=true` mirrors the Pulse app behavior for nested issue views
- Objective relationships: parent `north_star`, optional linked `initiative`, downward `key_results[]` (server-populated)
- Key result relationships: required parent `objective_id` (immutable after create), optional `metric_id`/`metric_name`, m:n `initiatives[]`
- Metric relationships: linked KRs point to the metric through `metric_id`; use `pulse_list_metric_key_results` to audit links before deleting a metric
- Initiative relationships: `objective`, `key_results`, `projects`
- Project relationships: `depends_on`, `blocks`, `blocked_by`
- Issue relationships: `parent`, sub-issues, `blocks`, `blocked_by`
- Write tools replace relationship arrays when new arrays are provided; `add_*` / `remove_*` (issue labels, blocks, blocked_by, releases; project initiatives and teams) change one member and keep the rest — never both for one relation
- Use `clear_*` flags when removing values on update
- **Intake requests:** `team_*` = incoming (the target team handles it); `requester_team_*` = outgoing. `pulse_act_on_request` (accept/reject/complete/triage/duplicate) needs a target-team manager. After accepting, create the work with `pulse_save_issue` / `pulse_save_project` + `request_ids` (a code or URL works).
- **Text limits:** titles 5–7 words, no status/priority/date; `description` on issues, projects and initiatives is a ≤50-char title suffix; objectives and key results take 2000 chars of Markdown, a request body 500.
- **Inbox filters:** `pulse_list_updates` narrows with `action_types`, `entity_types`, `types`, `priorities`, `important`.
- **Social `target_type`:** matches Pulse API enum — never use `request` for a normal issue; use `issue`. Use `request` only for intake requests.
