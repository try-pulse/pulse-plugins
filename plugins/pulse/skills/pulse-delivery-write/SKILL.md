---
name: pulse-delivery-write
description: "Use this when the task is to create, update or delete Pulse work — objectives, key results, metrics, initiatives, projects, issues, milestones, documents: 'create an issue', 'move to QA', 'reassign', 'record KR progress', 'attach doc', 'delete duplicate'. Resolves names server-side, checks duplicates, confirms before mutating. Not for reviews or for a whole structure (pulse-plan-bootstrap)."
---

# Create / Update / Delete Delivery Objects

Load the pulse-use-mcp skill first ($pulse-use-mcp; file: ../pulse-use-mcp/SKILL.md).

This skill writes one record correctly. *Where* a new thing belongs — initiative versus project, how finely to break work down, which milestone it sits under — is `pulse://guides/methodology` §3–§4. Standing up a whole structure, rather than one record, belongs to `pulse-plan-bootstrap`.

Write tools: one `pulse_save_*` per entity (objective, key result, metric, initiative, project, milestone, issue, request, document) creates without an id/query and updates with one; `pulse_record_metric_value(s)`, `pulse_act_on_request`, `pulse_attach_document` / `pulse_detach_document` and the `pulse_delete_*` tools cover the rest.

## Write Workflow

**Default path — one call.** Call the write tool directly with human names
(`team_name`, `project_name`, `assignee_name` / `owner_name` — `"me"` works —
`objective_name`, `key_result_name`, `initiative_name`, `parent_issue_query`,
`milestone_query`, label names). The server resolves them **concurrently, with
a 5-minute cache**. Pre-resolving with `pulse_list_teams` / `pulse_list_users` /
`pulse_list_project_options` turns one round trip into four and is strictly
slower. After the write, read `name_resolution` in the response and echo what
actually got linked.

Scope is already known: the SESSION block at the end of the Pulse server instructions (or inside the
`tool_search` description when tools are deferred) names the
current user, the active workspace and its teams. Do not call
`pulse_get_current_workspace` / `pulse_get_current_user` to rediscover it. A caller
with one workspace needs no `workspace_id` at all.

**Context before deciding content.** When the write requires judgement — a new
issue's title/type/scope, acceptance criteria, a status narrative, anything
where you would otherwise be guessing — run `pulse_discover_knowledge` and read
the relevant hits with `pulse_read_knowledge`, batching them in ONE call:
`entities: [{entity_type, entity_id}, …]`. For blocker/parent checks use
`pulse_knowledge_neighbors`; for initiative-wide context use
`pulse_knowledge_context`. Skip Knowledge entirely when the user named the exact
entity and the change is mechanical ("move ENG-42 to QA", "set the due date to
Friday").

**Duplicate check before creating** — a keyword `search` on the matching list
tool. Cheap, and it catches the most common user regret.

### When to confirm

Confirm and wait before:
- any **delete**;
- mutating an entity the user does **not** own or is not assigned to;
- a **bulk** write (more than 3 entities);
- anything that changes ownership, sharing, or visibility.

Do **not** spend a confirmation turn on a single create or update the user just
asked for in their own words — do it and report the result. The user asking
"create a bug for the login timeout" has already confirmed it.

When you do confirm, show the resolved plan, not a question:

> **Planned action:** Create issue
> Title: "Fix login timeout" · bug · high · backlog
> Assignee: Sam Lee (u_123) · Project: Auth Service (p_456)
> Main doc: acceptance criteria included in the same call
> **Proceed?**

### Ownership sensitivity

The SESSION block already tells you who you are — compare against the entity's
`owner_id` / `assignee_id` / `reporter_id` rather than calling
`pulse_get_current_user`. For a delete on an entity the user does not own,
confirm twice: once showing exactly what will be deleted, once asking outright.

### Safety rules

- If the target entity is ambiguous, narrow the scope — never guess, never pick
  by id prefix or creation order.
- `name_resolution` reporting `ambiguous` / `not_found` lists the candidates:
  surface them, then retry with the chosen id.
- Relationship arrays REPLACE on update; use `clear_*` flags to null a field.
- Do not force a Knowledge match. If the results do not fit the requested work,
  treat the work as new or ask which candidate is relevant.

## Title Rules (applies to all entity types)

- Titles must be short: max 5–7 words.
- Never put status, dates, priority, or labels in the title.
- Good: "Fix login timeout" — Bad: "Fix login timeout bug [HIGH PRIORITY] - started April"
- Status belongs in the `status` field. Labels belong in the `labels` field.

## Description Rules

- For issues, initiatives, and projects, `description` is a hard-limited UI **title-suffix**: max 50 characters. It is NOT documentation — it just completes the title in list views. Keep it to one short fragment.
- Intake requests are the exception on the delivery side: `pulse_save_request` `description` may be up to 500 characters (the request body).
- Objectives and Key Results are the exception: their `description` accepts up to 2000 characters of markdown. Put strategic context (rationale, how progress is measured, decision history) directly in the description rather than attaching a separate document.

## Documenting an entity (the right surface)

The most common mistake. Detail, anti-patterns and versioning behaviour: [references/documentation-surfaces.md](references/documentation-surfaces.md).

- **Canonical writeup** (story, requirements, acceptance criteria, scope, design notes) → the MAIN document: pass `main_document: { body }` on `pulse_save_issue` / `pulse_save_project` / `pulse_save_initiative` / `pulse_save_objective` / `pulse_save_key_result` — one call creates or updates the entity and its main doc; with an id/query it rolls a new version in place.
- **Supplementary reference** (Figma, Notion, spec, meeting note) → `pulse_save_document` with `attachments: [{ entity_type, entity_id }]` and no `is_main_doc`.
- **Short discussion** → `pulse_add_comment`. **Title suffix** → `description` (≤50 chars). Never a full spec in either.
- Never revise a main doc by attaching a second document: attach is insert-only (409) and detaching the old one clears `main_doc_id`. Revise through `main_document.body` or `pulse_save_document`.
- **Never open a body with its own title.** Pulse renders the title above the body (the entity header for a main doc, the title field on a document page), so a leading `# Title` shows the name twice. Start at the first section and use `##` as the top heading level; on a revision, drop a title heading the existing body carries.
- Mentions in bodies: `<@USER_ID|Display Name>` (notifies in comments and main docs, text-only in status updates) and `<#issue:ID|Label>` / `<#project:ID|Label>` / `<#document:ID|Title>`. They are the one case that needs ids first — resolve with `pulse_list_users` / `pulse_list_issues` / `pulse_list_projects` / `pulse_list_documents`.


## Label Conventions

Labels are per team (or workspace-wide) and per entity type. Find them with `pulse_list_labels`, pass names or ids (an unknown name fails and lists the options); `pulse_save_label` only when nothing fits. Prefer `type` over a `bug` label.

## Auto-Assign

- If the context implies the entity belongs to the current user ("create an issue for me", "my task"), pass `assignee_name: "me"` / `owner_name: "me"` — the SESSION block already names you; do not call `pulse_get_current_user`.

## Issue-Specific Rules

INVEST, Gherkin, splitting signals and milestone field semantics: [references/issue-rules.md](references/issue-rules.md).

- Type: `story` (user-facing, one sprint, INVEST) · `feature` (larger user-facing; story if it fits a sprint) · `task` (internal, no direct user benefit) · `bug` (existing behaviour broken).
- Stories and features: `As a [persona], I want [action] so that [benefit]` — the "so that" is mandatory; acceptance criteria in Gherkin (`Given / When / Then`) go in the main doc. Split when a story has more than one independent outcome or persona; split vertically, never by layer.
- Sub-issues are HOW a story gets built: one completable unit each, one level deep, team, project, cycle and milestone all inherited from the parent (never send them on a sub-issue — set them on the parent); assignee, labels and estimate are its own.
- Milestones: `milestone_id` or `milestone_query` on `pulse_save_issue` (must belong to the issue's project; sub-issues and personal issues cannot carry one); `pulse_save_milestone` needs only `name` — `status`, `is_current`, `sort_order` and `stats` are derived from the linked issues; `pulse_delete_milestone` unlinks issues, it does not delete them.
- A project is an epic for 3+ related stories; never bundle unrelated stories in one.


## Entity write reference

One `pulse_save_*` tool per entity creates (no id) or updates (with an id or query); `pulse_delete_*` removes. Field-level detail — every settable field, `clear_*` flag, enum and validation rule — is in [references/entity-writes.md](references/entity-writes.md) and in the `pulse://references/*` resources; read the entry before an unfamiliar write.

| Entity | Tools | Rules that are easy to get wrong |
|---|---|---|
| Project (epic) | `pulse_save_project`, `pulse_delete_project` | Lifecycle `status` is `idea … canceled` (default `idea`), never an issue status; health is posted with `pulse_save_status_update`; `owner_name: "me"` works. |
| Issue | `pulse_save_issue`, `pulse_delete_issue` | `assignee_name: "me"`; `cycle_name` may need team/project context; relationship arrays replace on update — use `clear_*`, never fake empty values. |
| Initiative | `pulse_save_initiative`, `pulse_delete_initiative` | `status` is lifecycle, health is `latest_status`; links to one objective and m:n key results; `clear_objective` / `clear_key_results` / `clear_projects` / `clear_target_date`. |
| Objective | `pulse_save_objective`, `pulse_delete_objective` | `team_name` required at create; `description` takes 2000 chars of Markdown; `progress` is server-computed — never write it; delete cascades to its key results (confirm twice if not yours); key results are created separately. |
| Key result | `pulse_save_key_result`, `pulse_delete_key_result` | `objective_name` required at create and immutable; `stepwise|cumulative|average_based` need `period_type`, `threshold_based` needs `min_threshold` (validated before the call); a linked metric owns `current_value`. |
| Metric | `pulse_save_metric`, `pulse_record_metric_value` (one value, or `entries` for several), `pulse_delete_metric` | Never change a value through `pulse_save_metric` — record one; deleting a linked metric returns 409 until its key results are detached (`pulse_list_metric_key_results`). |
| Document | `pulse_save_document`, `pulse_attach_document`, `pulse_detach_document`, `pulse_delete_document` | Main doc = `main_document` on the save tool, or attach with `is_main_doc: true` (attach is insert-only: it never demotes an existing main doc, so revise through `main_document.body`); a body update rolls a new version in place; images, videos and files go through `pulse_upload_file`; delete is soft. |
| Intake request | `pulse_save_request`, `pulse_act_on_request` | `team` is the TARGET (handles it); `requester_team` is the sender. New requests start in `triage` (target court); `pending` is the requester's court. Accept/reject/complete/triage-state: target-team manager only. Accept does not create work — then `pulse_save_issue` / `pulse_save_project` with `request_ids` (ObjectId, code, or app URL). |
| Personal scope | `is_personal: true` on `pulse_save_issue` / `pulse_save_project` | Omit team plus project/cycle (issue) or initiative (project); assignee/owner default to you; the flag cannot change later — recreate to switch scope. |

## Recommended Mutation Workflow

1. Establish scope and identify the target entity.
2. When the content needs judgement, search Knowledge (`pulse_discover_knowledge`) and read the best sources in one batched `pulse_read_knowledge({entities: [...]})` before deciding title, type, labels, scope, or acceptance criteria. Skip it for a mechanical change to a named entity.
3. Search for duplicates (list + keyword) — skip creation if one already exists.
4. Pass the referenced names straight to the write tool — it resolves them concurrently.
5. Build and present the confirmation summary to the user, including Knowledge sources used and any low-confidence or unrelated Knowledge results.
6. Wait for user approval.
7. Perform the write with the smallest explicit change set.
8. If the entity needs a full doc (spec, background, acceptance criteria), create a `type=document` and attach as main doc.
9. Check returned `name_resolution` and normalized entity payload.
10. Summarize: what changed, what stayed unresolved, any important linked entities, any relationships replaced or cleared.

## Relationship-Safe Mutation Rules

- Creating or updating an objective may affect:
  - `north_star`
  - `initiative`
  - downstream `key_results[]` (server-computed progress recalculates whenever child KR `current_value`s change)
- Creating or updating a key result may affect:
  - parent `objective` (its progress recalculates)
  - linked `initiatives[]` (m:n)
  - linked `metric` (controls current_value/baseline/value_unit when set)
- Creating or updating a project may affect:
  - `initiative`
  - `depends_on`
  - `blocks`
  - `blocked_by`
- Creating or updating an initiative may affect:
  - `objective`
  - `key_results`
  - `projects`
- Creating or updating an issue may affect:
  - `project`
  - `cycle`
  - `assignee`
  - `parent`
  - `blocks`
  - `blocked_by`
- Creating or attaching a document may affect the entity's `main_doc`, and detaching the main doc clears `main_doc_id` — see "Documenting an entity" above.
