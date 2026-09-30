---
name: pulse-initiative-snapshot
description: "Use this when the user wants a strategic view of Pulse initiatives: 'initiative snapshot', 'status of our workstreams', 'initiatives at risk', 'by owner or team', or drilling from an initiative to its projects, objective and key results. Not for project-level risk (pulse-project-risk-review) or issue triage (pulse-issue-triage)."
---

# Snapshot Pulse Initiatives

Load the pulse-use-mcp skill first ($pulse-use-mcp; file: ../pulse-use-mcp/SKILL.md).

Whether something warrants being an initiative at all, and whether each project under it can name the key result it moves, is `pulse://guides/methodology` §3. Drift between an objective's stated intent and what actually shipped is §6.

Primary resources:
- `pulse://guides/domain-model`
- `pulse://references/initiatives-filters`
- `pulse://references/objectives` (when the user asks about the OKRs an initiative ladders up to)
- `pulse://references/key-results` (when the user asks how a KR is tracking)

## When To Use

- Strategic portfolio review
- Team-level initiative summary
- Owner-level initiative review
- Initiative-to-project follow-through checks
- Drill from an initiative up to its parent objective and the linked key results, to explain what the initiative is actually moving

## Workflow

1. Start with `pulse_list_initiatives`.
2. Use `team_names` or `owner_names` when the user gives human-readable scope.
3. Review each initiative through:
   - `status`
   - owner
   - team
   - target date
   - any returned strategic context in the result set
4. If the user wants the OKR side of the story (which objective the initiative serves, which KRs it moves), use `pulse_list_objectives` (scoped by team) and `pulse_list_key_results` (filter by `objective_name`). KR `status`, `current_value` vs `target_value`, and `progress` answer "are we tracking?".
5. If delivery follow-through matters, use the resolved initiative IDs to query `pulse_list_projects`.
6. Keep the summary grounded in:
   - `facets`
   - `applied_filters`
   - `name_resolution`
   - `result_entities`

## What To Deliver

- Short strategic summary
- Initiative-by-initiative highlights
- Gaps in ownership, target-date confidence, or delivery follow-through
- If needed, the next project-level query to run

## Trend & Rollup Tools

When the user wants a chart, distribution, or trajectory rather than a list:

- Objective progress over time (one objective): `pulse_objective_progress_history { kind:"chart", objective_name, chartType:"line", measure:{field:"progress", aggregation:"avg"}, timeGrouping:"week" }`.
- Compare progress across many objectives at once: same tool with `kind:"batch_chart"` and `objective_names` (up to 50). `mode:"multi_line"` for one curve per objective; `mode:"aggregated"` for a single averaged trend.
- KR trend: `pulse_key_result_measurement_history`.
- Initiative-level rollups (count by status, count by team): `pulse_analytics_stats { entity:"initiatives" }` is **not** available — initiatives don't have a `/stats` endpoint; aggregate at the project layer instead with `pulse_analytics_stats { entity:"projects", filters:[{field:"initiative_id", operator:"eq", value:"<initiative>"}] }`.

## Important Notes

- Initiative is a strategic workstream; do not confuse it with a project (delivery unit) or an objective (the OKR layer above)
- If the user really wants pure OKR review (objectives + KRs without delivery context), drive `pulse_list_objectives` / `pulse_list_key_results` directly — no need to enter through initiatives
- If the user really wants delivery risk, transition into `pulse-project-risk-review`
- If the user really wants execution detail, transition into `pulse-issue-triage`
