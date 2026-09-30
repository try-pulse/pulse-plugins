# Issue, story, sub-issue and milestone rules

The long form behind the "Issue-Specific Rules" bullets in [../SKILL.md](../SKILL.md): INVEST, Gherkin acceptance criteria, splitting signals, sub-issue and milestone semantics.

## Issue-Specific Rules

**Type correctly:**
- `story` — user-facing outcome; must fit in one sprint and satisfy INVEST
- `feature` — user-facing capability, slightly larger than story; treat as story if it fits one sprint
- `task` — internal work, infra, or cross-cutting concern with no direct user benefit
- `bug` — existing behavior is broken

### Stories & Features

**Format:** `As a [specific persona], I want [action] so that [measurable benefit].`

The "so that" clause is mandatory — it proves user value. "As a user, I want X" without a benefit is incomplete.

**INVEST checklist** — validate before creating:
- **I**ndependent — can be built without another story finishing first
- **N**egotiable — scope is a starting point, not a locked contract
- **V**aluable — delivers observable value to a real user
- **E**stimable — team can size it; if not, open a spike task first
- **S**mall — fits within one sprint; if not, split it
- **T**estable — acceptance criteria can be verified by a tester or automated test

**Acceptance criteria:** write in Gherkin and attach as main doc (type=document):
```
Given [precondition]
When [user action]
Then [observable outcome]
```
One `When/Then` pair per scenario. Multiple scenarios go as separate blocks in the same doc — not as separate stories unless each scenario is truly an independent outcome.

**Splitting signals** — suggest splitting when:
- Story has more than one independent `When/Then` outcome
- Story covers more than one distinct persona
- Story has a "simple version" and "advanced version" (defer advanced)
- Team cannot estimate it (→ spike first)
- Story touches a new data model AND a new UI that can be independently valuable

**Vertical slices only:** every split story must deliver observable end-to-end value. Never split by layer (UI story + API story + DB story = wrong).

### Sub-issues (Tasks within a story)

- Each sub-issue = one implementation unit that can be worked and completed independently
- Sub-issues represent HOW the story gets built; the parent story represents WHAT and WHY
- Any layer (UI, API, DB) is fine in a sub-issue, but each must be a completable work unit
- Never nest: sub-issues cannot have sub-issues (one level only)
- Sub-issues take team, project, cycle and milestone from the parent — never send them on a sub-issue. To put sub-issues on a milestone or cycle, set it on the parent (it propagates). Assignee, labels, estimate and status are the sub-issue's own

### Milestone link

- An issue can be checkpointed against one milestone of its project. Pass `milestone_id` (24-hex) or `milestone_query` (matches the milestone name first, then its description, scoped to the resolved project) on `pulse_save_issue`. Use `clear_milestone: true` on update to unlink.
- The milestone goes out on the create call itself, with `project_name` in the same call. Sub-issues cannot carry their own milestone: set it on the parent. Updating a sub-issue's project/cycle/milestone is refused unless `clear_parent: true` is in the same call.
- Milestones must belong to the issue's project. Personal issues cannot have a milestone. Changing or clearing `project_id` auto-clears milestone on the backend.
- Use `pulse_list_milestones` to inspect available milestones (response includes `stats.total_issues / done_issues / progress` rolled up from issues with that `milestone_id`). For milestone progress reports, prefer the stats block over re-querying issues.

### Milestone fields

- `pulse_save_milestone` needs `name` (the title, 1–255). `description` (≤500 prose) and `target_date` are optional — a milestone with no date is valid, so omit it rather than inventing one.
- `pulse_save_milestone` patches `name` / `description` / `target_date`; `clear_target_date: true` removes the date. An empty `description` string clears the prose.
- `status` (unstarted / in_progress / completed), `is_current`, `sort_order` and `stats` are derived by the backend from the linked issues — they are read-only. A milestone with no issues is `unstarted`, never `completed`. Change them by moving issues on and off the milestone, not by patching the milestone.
- `pulse_delete_milestone` unlinks the milestone's issues (clears their `milestone_id`); it does not delete them.
- **Break down properly**: if a story spans multiple concerns, create the story as parent and the concerns as sub-issues

### Projects / Epics

- A project is an epic: it groups user stories delivering a coherent product capability
- Don't create a project for a single story; use a project only when you'll have 3+ related stories
- Link to an initiative when the epic contributes to a strategic outcome
- **Never bundle** unrelated stories in one project; prefer separate focused epics
