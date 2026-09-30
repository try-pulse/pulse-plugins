---
name: pulse-project-risk-review
description: "Use this when the user asks which Pulse projects are risky and why: 'review project health', 'portfolio summary', 'what is off track', 'deadline risk', 'dependency review', 'initiative delivery status'. Keeps lifecycle status and health separate. Not for deciding whether to post an update (pulse-cadence) or for triaging issues (pulse-issue-triage)."
---

# Review Project Risk

Load the pulse-use-mcp skill first ($pulse-use-mcp; file: ../pulse-use-mcp/SKILL.md).

This skill answers which projects are risky and why. For whether a finding warrants a status update, and for reading health from key results and metrics rather than dates alone, see `pulse://guides/methodology` §9 and §13 — `pulse-cadence` owns that pass.

Primary resources:
- `pulse://guides/domain-model`
- `pulse://references/projects-filters`

## Core Rule

Never conflate project lifecycle `status` with project `health_status`.

- `status` says where work is in the flow
- `health_status` says how risky delivery is

## Workflow

1. Choose the entry point.
   - Strategy framing or initiative names: start with `pulse_list_initiatives`
   - Delivery/risk framing: start with `pulse_list_projects`
2. Scope the portfolio.
   - Filter by `team_names`, `owner_names`, or `initiative_names` when possible.
3. Query projects with risk-first thinking.
   - Prefer `health_statuses` when the user asks what is risky (values only — this field takes no is/is_not operator).
   - For schedule pressure use `target_date` with `target_date_operator` (`lt`/`lte`/`gt`/`gte`). There is no progress FILTER — read `progress` off the returned rows, or `sort="progress"` to rank by it.
4. Inspect why each risky project is risky.
   - `health_status`
   - `target_date` and `start_date`
   - `progress`
   - `priority`
   - missing owner/team context
   - dependency edges: `depends_on`, `blocked_by`, `blocks`
5. Use `result_entities` and returned dependency projects to explain cross-project risk clearly.
6. For graph-shaped questions ("what blocks this project", "what initiative is this part of", "what depends on this"), call `pulse_knowledge_neighbors` with the seed entity. Use `direction=inbound` for "what blocks / depends on X", `outbound` for "what does X depend on / block".
7. For initiative drill-down or portfolio narrative across many linked projects, prefer `pulse_knowledge_context` (depth 2, max_nodes ~20) on the initiative seed over many sequential `pulse_read_knowledge` calls. Watch `total_chars` and tighten `depth` / `max_nodes` if the bundle is large.

## Good Default Slices

- Risk scan: `health_statuses=at_risk,off_track`
- Deadline pressure: `target_date_operator="lte"` with a near-term date, then read `progress` on the rows
- Team portfolio: one team, grouped by owner or initiative
- Initiative drill-down: resolve initiative, then inspect linked projects

## Portfolio Rollups (analytics)

For the "how does the whole portfolio look" framing, use `pulse_analytics_stats` / `pulse_analytics_chart` instead of paging through `pulse_list_projects`:

- Status distribution: `pulse_analytics_stats { entity:"projects", stats:[{aggregation:"count", group_by:"status"}], filters:[{field:"team_id", operator:"eq", value:"<team>"}] }`
- Health distribution and progress average: stack a count-by-status with `{field:"progress", aggregation:"avg"}` in one call.
- Visual: `pulse_analytics_chart { entity:"projects", chartType:"bar", measure:{aggregation:"count"}, slice:"status", segment:"priority" }`
- Created/closed cadence: `slice:"created_at"` + `timeGrouping:"week"`.

Filter values accept team/owner/initiative names — MCP resolves them before the call.

## Deliverable

- Concise portfolio summary
- Highest-risk projects and why
- Dependency or sequencing concerns
- Date pressure or ownership gaps
- Recommended next drill-down, usually into one initiative or one project's issues

## Useful Follow-Through

When root cause is inside execution:
- resolve the project
- switch to `pulse_list_issues` filtered by that project
