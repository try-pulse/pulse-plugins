# Entity write reference

Field-level detail for every `pulse_save_*` / `pulse_delete_*` tool: settable fields, `clear_*` flags, enums and validation rules. Loaded on demand from [../SKILL.md](../SKILL.md); the same facts are in the `pulse://references/*` resources.

## Project Writes

Use:
- `pulse_save_project`
- `pulse_delete_project`

Project mutations can set or clear:
- team
- owner
- initiative
- `status`, `priority`, `progress`
- `start_date`, `target_date`
- labels
- dependency links: `depends_on`, `blocks`, `blocked_by`

Notes:
- Project lifecycle `status` is `idea | discovery | proposal | accepted | ready | in_progress | paused | maintenance | completed | canceled` and defaults to `idea`. Do not reuse issue statuses such as `backlog`, `todo`, `qa`, or `done`.
- Project health is separate: post `on_track | at_risk | off_track` through `pulse_save_status_update`, never in the lifecycle `status` field.
- `owner_name` can use aliases like `me`
- dependency project names should be resolved before summarizing the result

### Personal Projects

- Set `is_personal=true` on `pulse_save_project` for a project that is private to the current user.
- Forbidden fields: `team_id`/`team_name`, `initiative_id`/`initiative_name` (MCP rejects them when `is_personal=true`).
- `owner_id` defaults to the current authenticated user, whose id is in the SESSION block.
- Visibility: backend RLS hides the project from everyone except the owner.
- Allowed: status, priority, dates, progress, labels, and project-to-project dependency links (`depends_on`, `blocks`, `blocked_by`).
- `is_personal` cannot be changed by `pulse_save_project`. To switch a project's scope, recreate it.
- Filter with `is_personal=true|false` on `pulse_list_projects`.

## Objective Writes

Use:
- `pulse_save_objective`
- `pulse_delete_objective`

An **Objective** is the strategic OKR layer above initiatives. It belongs to one team, optionally rolls up to a North Star, and owns one or more Key Results that drive its progress.

Objective mutations can set or clear:
- `team_id` / `team_name` (required at create)
- `owner_id` / `owner_name` (defaults to caller; clear with `clear_owner`)
- `north_star_id` / `north_star_name` (clear with `clear_north_star`)
- `initiative_id` / `initiative_name` (delivery context; clear with `clear_initiative`)
- `title` (2–200), `description` (up to 2000 chars of markdown — long context lives here, not in a separate document), `weight` (0–100)
- `status`: `active | planned | completed | canceled` (defaults to `planned`)
- `start_date`, `end_date` (ISO / YYYY-MM-DD / today/tomorrow; `end_date` must be after `start_date`; clear with `clear_start_date` / `clear_end_date`)

Notes:
- `progress` is server-computed from the weighted average of the objective's key results — never write it.
- Deleting an objective cascades to all of its key results. Treat delete as ownership-sensitive: confirm twice before calling `pulse_delete_objective` on an objective you don't own.
- Key results are NOT created in the objective payload. Create the objective first, then attach KRs with `pulse_save_key_result` using `objective_id` or `objective_name`.

## Key Result Writes

Use:
- `pulse_save_key_result`
- `pulse_delete_key_result`

A **Key Result** is the measurable outcome under exactly one objective. `objective_id` is required at create and immutable afterward — to "move" a KR, delete and recreate.

Key result mutations can set or clear:
- `objective_id` / `objective_name` (required at create; immutable on update)
- `title` (2–200), `description` (up to 2000 chars of markdown), `weight` (0–100, importance within the parent objective)
- `status`: `on_track | at_risk | off_track | completed`
- `target_type`: how progress is computed
  - `final_value` (default): only the final `current_value` matters
  - `stepwise`, `cumulative`, `average_based`: REQUIRE `period_type` (`weekly|monthly`); `stepwise` also accepts `step_targets[]`
  - `threshold_based`: REQUIRES `min_threshold`
  - `growth_rate`: percentage growth from baseline
  - `boolean`: 0% or 100%
- `value_type`: `number | percentage | currency | custom` (display)
- `value_unit` (≤20 chars): free-text suffix like `%`, `$`, `users`. Clear with `clear_value_unit`.
- `baseline`, `target_value`, `current_value`
- `min_threshold` (clear with `clear_min_threshold`), `period_type` (clear with `clear_period_type`), `step_targets[]`
- `owner_id` / `owner_name` (clear with `clear_owner`)
- `metric_id` (clear with `clear_metric`) — when set, `current_value`, `baseline`, and `value_unit` auto-sync from the metric and manual `current_value` writes are ignored
- `metric_name` is accepted anywhere `metric_id` is accepted; MCP resolves it through `pulse_list_metrics`
- `initiative_ids` / `initiative_names` (m:n; clear with `clear_initiatives`)

Notes:
- The conditional rules (`threshold_based ⇒ min_threshold`; `stepwise|cumulative|average_based ⇒ period_type`) are validated by MCP before the API call — schema errors come back without a network round-trip.
- Recording progress = setting `current_value`. If a metric is linked, update the metric (or detach with `clear_metric`) instead.
- Changing `target_type` may invalidate previously stored `min_threshold` / `period_type` / `step_targets`. Pair the type change with the right new conditional fields.
- `progress` is server-computed; never write it. Updating `current_value` triggers a recalculation and may produce an objective progress snapshot.
- Status transitions to `at_risk` or `off_track` should be paired with a comment explaining why; healthy regressions still need a paper trail.

## Metric Writes

Use:
- `pulse_save_metric`
- `pulse_delete_metric`
- `pulse_record_metric_value`

A **Metric** is the source of truth for a numeric KPI. It has a name, free-form `unit`, optional owner/team, `current_value`, and append-only value history.

Common examples:
- Create: `create metric "Weekly Active Users" unit users initial 12000`
- Record: `record metric value 13500 for Weekly Active Users today`
- Delete: `delete metric Weekly Active Users` — only after unlinking KRs

Metric mutations can set or clear:
- `name` (2–200)
- `description` (up to 1000 chars)
- `unit` (free-form, up to 50 chars)
- `owner_id` / `owner_name` (clear with `clear_owner`)
- `team_id` / `team_name` (clear with `clear_team`)

Notes:
- Do not use `pulse_save_metric` to change a value. Use `pulse_record_metric_value`; every call appends an immutable MetricValue record.
- Recording a metric value updates linked KRs automatically, creates KR measurements, recalculates KR progress, and cascades objective/initiative progress.
- Changing `unit` propagates to `value_unit` on all linked KRs.
- Deleting a linked metric returns 409. First run `pulse_list_metric_key_results`, then detach each KR with `pulse_save_key_result clear_metric=true` or delete the KRs.

## Initiative Writes

Use:
- `pulse_save_initiative`
- `pulse_delete_initiative`

Initiative mutations can set or clear:
- team
- owner
- objective
- key results
- linked projects
- `status`, `progress`
- `target_date`
- `icon_code`, `icon_color` — a Linear icon name or an emoji; catalog and palette in `pulse://references/entity-icons`

Notes:
- initiative `status` is lifecycle state (`proposed|planned|active|completed|canceled`); health is tracked separately through `latest_status`. Priority uses the shared enum.
- the frontend often links initiatives through `key_result_ids`, with objective context derived from those links
- updates support `clear_objective`, `clear_key_results`, `clear_projects`, `clear_target_date`, and `clear_progress`

## Issue Writes

Use:
- `pulse_save_issue`
- `pulse_delete_issue`

Issue mutations can set or clear:
- team
- project
- cycle
- assignee
- parent issue
- `status`, `priority`, `type`
- `due_date`, `time_estimate`
- labels
- dependency links: `blocks`, `blocked_by`

Notes:
- `assignee_name` can use aliases like `me`
- `cycle_name` resolution may depend on team/project context
- updates support `clear_*` flags; use them instead of sending fake empty values

### Personal Issues

- Set `is_personal=true` on `pulse_save_issue` for an issue that is private to the current user.
- Forbidden fields: `team_id`/`team_name`, `project_id`/`project_name`, `cycle_id`/`cycle_name` (MCP rejects them when `is_personal=true`).
- `assignee_id` defaults to the current authenticated user, whose id is in the SESSION block.
- Visibility: backend RLS hides the issue from everyone except the assignee/creator.
- Allowed: status, priority, type, due date, time estimate, labels, parent issue (only under another personal issue), and `blocks`/`blocked_by` issue links.
- `is_personal` cannot be changed by `pulse_save_issue`. To switch an issue's scope, recreate it.
- Filter with `is_personal=true|false` on `pulse_list_issues`.

## Document Writes

Use:
- `pulse_save_document`
- `pulse_delete_document`
- `pulse_attach_document`
- `pulse_detach_document`

Document mutations can:
- create a new `link` (pass `url`) or `document` (pass `body` — MCP wraps it in the same Plate.js JSON the web editor uses and uploads via `/content/documents/upload`)
- update `title`, `description`, `url`, `tags`, `is_public`, and for `type=document` also `body`
- soft-delete a document by ID
- attach to any of `project`, `initiative`, `objective`, `key_result`, `issue`
- detach from a single entity
- mark the document as an entity's main doc via `is_main_doc: true` on an attach call

Notes:
- There is no separate "set main doc" tool. `pulse_attach_document` with `is_main_doc: true` pins a document that has no main doc yet. Attach is insert-only: it 409s on an existing attachment and never demotes the previous main doc — revise an existing main doc through `main_document.body` or `pulse_save_document`, and note that detaching a main-flagged row clears `main_doc_id`.
- The same document can be main for one entity and non-main for another at the same time.
- Each attachment ref accepts `entity_id` or `entity_name`. Name resolution runs against the entity's own list tool (`pulse_list_projects`, `pulse_list_initiatives`, `pulse_list_issues`, etc.).
- For `type=document`, pass `body` (markdown or plain text — default format splits lines into paragraph nodes; `body_format=plate_json` accepts a raw Plate.js JSON array). Every body change rolls a new server-side version.
- `pulse_save_document` with `body` sends the stable `content_id`; pulse-api versions the document in place and preserves attachments/directory memberships server-side. Entity attachments are not required.
- `image` and `video` types need real file bytes: use `pulse_upload_file` (`file_path` for a file on your machine — over a remote connection it returns a one-time `curl` upload command to run — `source_url`, `text`, or `content_base64` up to 256 KB), not `pulse_save_document`.
- `pulse_delete_document` is soft-delete; attachments disappear with the document.
