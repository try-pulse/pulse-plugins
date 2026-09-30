#!/usr/bin/env bash
# One-time GitHub settings for try-pulse/pulse-plugins. Run it once by hand
# after the repository exists and main has been pushed. It needs `gh` signed in
# as an org owner or a repository admin. Safe to re-run: every call sets a value
# rather than adding one, except the rulesets, which are skipped if one with the
# same name already exists.
#
#   scripts/setup-repo.sh            # try-pulse/pulse-plugins
#   scripts/setup-repo.sh owner/repo # another repository
set -euo pipefail

repo="${1:-try-pulse/pulse-plugins}"
echo "Configuring ${repo}"

# Listing: description, homepage and topics. Only Issues is on; the wiki,
# projects and discussions would split where people look for help.
gh repo edit "${repo}" \
  --description "Public Codex plugin marketplace for Pulse: the Pulse MCP server plus skills for triage, planning and delivery." \
  --homepage "https://www.trypulse.tech/" \
  --add-topic codex,codex-plugin,openai-codex,mcp,model-context-protocol,agent-skills,project-management,pulse \
  --enable-issues \
  --enable-wiki=false \
  --enable-projects=false \
  --enable-discussions=false \
  --enable-squash-merge \
  --enable-merge-commit=false \
  --enable-rebase-merge=false \
  --delete-branch-on-merge

# Security: private vulnerability reporting (SECURITY.md links to it), secret
# scanning with push protection, and Dependabot security updates.
gh api -X PUT "repos/${repo}/private-vulnerability-reporting" >/dev/null
gh repo edit "${repo}" --enable-secret-scanning --enable-secret-scanning-push-protection
gh api -X PUT "repos/${repo}/vulnerability-alerts" >/dev/null
gh api -X PUT "repos/${repo}/automated-security-fixes" >/dev/null

# Actions: the default token is read-only. sync.yml asks for contents: write in
# its own job, which is the only write this repository needs.
gh api -X PUT "repos/${repo}/actions/permissions/workflow" \
  -f default_workflow_permissions=read \
  -F can_approve_pull_request_reviews=false >/dev/null

# Rulesets. main and the release tags can never be force-pushed or deleted, and
# a release tag can never be moved. Pull requests are deliberately NOT required
# on main: the sync workflow pushes each release commit with GITHUB_TOKEN, and a
# required-PR rule would block it.
ruleset() {
  local name="$1" body="$2"
  if gh api "repos/${repo}/rulesets" --jq '.[].name' | grep -qx "${name}"; then
    echo "Ruleset '${name}' already exists; leaving it as it is"
    return
  fi
  gh api -X POST "repos/${repo}/rulesets" --input - <<<"${body}" >/dev/null
  echo "Created ruleset '${name}'"
}

ruleset "main" '{
  "name": "main",
  "target": "branch",
  "enforcement": "active",
  "conditions": { "ref_name": { "include": ["~DEFAULT_BRANCH"], "exclude": [] } },
  "rules": [ { "type": "deletion" }, { "type": "non_fast_forward" } ]
}'

ruleset "release tags" '{
  "name": "release tags",
  "target": "tag",
  "enforcement": "active",
  "conditions": { "ref_name": { "include": ["refs/tags/pulse/v*"], "exclude": [] } },
  "rules": [ { "type": "deletion" }, { "type": "non_fast_forward" }, { "type": "update" } ]
}'

echo "Done. Check Settings > Rules and Settings > Code security for ${repo}."
