---
name: pulse-issue-triage
description: "Use this when the user wants to triage Pulse issues: backlog cleanup, bug review, sprint or cycle review, assignee load, 'what should we work on next', 'show blocked bugs', 'find owner gaps'. Interprets priority, type, status, sub-issue and assignee semantics. Not for project health (pulse-project-risk-review) or repairing tracking structure (pulse-workspace-audit)."
---

# Triage Pulse Issues

Load the pulse-use-mcp skill first ($pulse-use-mcp; file: ../pulse-use-mcp/SKILL.md).

Triage reads a backlog as it is. When the finding is that the structure itself is wrong — issues with no home, milestones that mean nothing, lifecycle states nobody honors — that is `pulse://guides/methodology` §4–§5, and `pulse-workspace-audit` owns repairing it.

Primary resource:
- `pulse://references/issues-filters`

## When To Use

- Backlog cleanup
- Bug triage
- Cycle or sprint review
- Assignee/ownership gaps
- Project-level execution audit

## Workflow

1. Establish team scope.
   - If unclear, use the teams listed in the SESSION block of the Pulse server instructions (or of the `tool_search` description when tools are deferred).
2. Resolve project context when needed.
   - Pass the project name to `pulse_list_issues`; only fall back to `pulse_list_project_options` if it comes back ambiguous.
3. Query `pulse_list_issues`.
   - Use `team_names`, `assignee_names`, `reporter_names` when the user gives human names.
   - Use `project_ids` after project resolution.
   - Use `milestone_ids` to triage issues belonging to a specific project milestone (resolve via `pulse_list_milestones`; the milestone list returns `name`, derived `status` / `is_current`, and `stats.total_issues / done_issues / progress` rolled up from these same issues).
   - Use `dependency_states=['blocked']` to find work with a blocker relation — but read it as "has a dependency", not "is stuck": the backend derives it from the relation arrays alone, so every blocker may already be `done`. Confirm against the blockers' own statuses before reporting anything as blocked.
   - Use the date bounds instead of paging and filtering client-side: `due_before` for overdue/upcoming, `completed_after` for what shipped since a date, `updated_before` for stale work.
   - Use `include_sub_issues=true` when parent/child execution structure matters.
   - For "top" / "most important" issues, use `sort="priority"` and
     `sort_order="asc"` (`urgent -> high -> medium -> low -> no_priority`).
     Do not start with descending and issue a second corrective read.
   - Use one list call per requested view. Multiple calls are intentional only
     for explicitly different filters or comparisons (such as priority versus
     recency); preserve each of those result sets.
4. Read the issue set through these lenses:
   - Urgency: `priority`
   - Flow state: `status`
   - Nature of work: `type`
   - Ownership: `assignee`, `reporter`, missing assignee
   - Execution structure: `parent`, sub-issues, blocked/blocking links
   - Time pressure: `due_date`, `time_estimate`
5. Use `facets`, `applied_filters`, `name_resolution`, and `result_entities` to verify the summary.
6. For "what blocks this" or "what does this depend on" questions on a specific issue, call `pulse_knowledge_neighbors` with `entity_type=issue`, `entity_id=<id>`. Use `direction=inbound` for "what blocks X", `outbound` for "what does X block / depend on". Edge types: `blocks`, `blocked_by`, `depends_on`, `parent_of`, `child_of`, `part_of`, `contains`, `related_to`, `mentions`, `mentioned_by` (`mentioned_by` answers "which docs, issues or comments link to X").
7. For project- or milestone-wide narrative ("explain the picture across these issues"), call `pulse_knowledge_context` on the parent project / initiative seed instead of reading each issue body separately.

## Good Default Slices

- Focused active backlog: `todo`, `in_progress`, `qa`, `release`
- Bug triage: `type=bug` plus `priority in urgent/high`
- Ownership audit: active statuses + missing assignee or uneven assignee distribution
- Project execution review: filter by one resolved project and include sub-issues
- Milestone progress check: `pulse_list_milestones` for the project (read `stats`), then `pulse_list_issues` with `milestone_ids=[<id>]` to enumerate the issues behind a `progress` number

## Aggregate Triage (analytics)

When the question is "how is the backlog distributed" rather than "show me the rows", prefer `pulse_analytics_stats` / `pulse_analytics_chart` (entity=`issues`):

- Assignee load: `stats:[{aggregation:"count", group_by:"assignee_id"}]` with a `team_id` or `project_id` filter.
- Bug distribution: `stats:[{aggregation:"count", group_by:"priority"}]` plus `filters:[{field:"type", operator:"eq", value:"bug"}]`.
- Status × priority heatmap: `pulse_analytics_chart { chartType:"bar", slice:"status", segment:"priority" }`.
- Note: `issues` analytics support count-only (no numeric measure field). For per-row inspection of cycle-time or recent throughput, fall back to `pulse_list_issues` with date filters.
- For a current-cycle review, call `pulse_list_cycles(status="active")` first. Use its issue counts for progress and its returned id in `pulse_list_issues(cycle_ids:[id])` for rollover candidates. If no active cycle exists—or multiple teams have one—say so or ask which team; never treat a workspace-wide issue list as a cycle.

## Story Quality Lens

When triaging stories and features, also check:

- **Missing "so that"**: issues of type=story or feature without a benefit clause are incomplete — flag them; the "so that" is the proof of user value
- **INVEST health**: flag stories that are too large (not Small — can't fit one sprint), vague (not Testable — no acceptance criteria), or tightly coupled to another story (not Independent)
- **Split candidates**: flag for splitting when a story has multiple distinct outcomes, covers more than one persona, or the team consistently can't estimate it
- **Acceptance criteria gap**: story/feature issues with no main doc are incomplete; they should not move to `in_progress` without attached Gherkin criteria
- **Orphaned tasks**: type=task issues with no parent story and no project link → likely need re-homing or a cleanup decision
- **Horizontal slice smell**: if you see separate issues for "UI for X", "API for X", "DB for X" at the same level, they should be sub-issues under one parent story, not sibling issues

## Relationship Notes

- If issue structure matters, include parent/sub-issue context
- If sequencing matters, inspect `blocks` and `blocked_by`
- If the user refers to a parent issue by title or code, resolve it before proposing updates

## Deliverable

- Short backlog summary
- Highest-priority or blocked work
- Ambiguous tickets that need clarification
- Ownership gaps
- One suggested next query if the current page is not enough

## Mutation Follow-Up

If the user wants action after triage:
- use `pulse_save_issue` for status/assignee/priority/project/cycle/parent cleanup
- use `pulse_save_issue` for missing follow-up work
- use `pulse_delete_issue` only when the target issue is unambiguous
