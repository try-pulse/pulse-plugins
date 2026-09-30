---
name: pulse-wiki
description: "Use this when the task touches a team's pinned resources or wiki in Pulse: folders, ordered pins, the team Overview pin, folder Overview and Linked badges, creating, editing, moving, reordering, unpinning or deleting wiki documents, and shares. Confirms before mutations. Not for an entity's main document (pulse-delivery-write) or for knowledge search."
---

# Pulse Wiki / Directory

Load the pulse-use-mcp skill first ($pulse-use-mcp; file: ../pulse-use-mcp/SKILL.md).

When a team's tracking conventions need to live somewhere the next session will actually read them, this library is where that document goes — see `pulse://guides/methodology` §5.

This skill covers Team Detail **Pinned resources**: a hidden immutable root collection for loose documents, visible nested folders (\`DirectoryCollection\`), ordered pin rows (\`DirectoryMembership\`), actual Content documents, folder Overview (\`home_content_id\`), Linked ownership (\`content_source\`), and manual shares. Read \`pulse://references/wiki-directory\` before a multi-step change.

## Tool map by intent

| Intent | Tool |
|---|---|
| Load the whole bounded Team Detail tree | \`pulse_get_team_library\` |
| List team root folders | \`pulse_list_directory_children\` (parent_id="") |
| Drill into a sub-folder | \`pulse_list_directory_children\` (parent_id=… or parent_path=…) |
| Inspect one folder | \`pulse_get_directory_collection\` |
| List docs inside a folder | \`pulse_list_directory_memberships\` |
| Read a wiki doc body | \`pulse_get_document\` (include_body=true) |
| Create a folder | \`pulse_save_directory_collection\` |
| Create a wiki doc inside a folder | \`pulse_save_wiki_document\` |
| Create a loose top-level team doc | \`pulse_save_wiki_document\` (to_team_root=true) |
| File one/many existing docs into a folder | \`pulse_pin_wiki_document\` |
| Show / hide a doc on the team Overview | \`pulse_pin_team_overview\` (pinned_to_overview=true/false) |
| What the team Overview shows | \`pulse_list_directory_memberships\` (team_name, pinned_to_overview=true) |
| A team's Documents page (library + project docs) | \`pulse_list_documents\` (scope="team_documents", team_name) |
| Edit a wiki doc | \`pulse_save_wiki_document\` |
| Rename / move / reorder / change visibility on a folder | \`pulse_save_directory_collection\` |
| Set or clear a folder overview | \`pulse_save_directory_collection\` (home_content_id=… or clear_home_content=true) |
| Move or reorder a pinned doc | \`pulse_update_directory_membership\` |
| Move by source folder + document id | \`pulse_move_wiki_document\` |
| Detach a doc from a folder (Content stays) | \`pulse_update_directory_membership\` (remove=true, confirm=true) |
| Delete a folder + subtree | \`pulse_delete_directory_collection\` (confirm=true) |
| Audit shares | \`pulse_list_directory_shares\` |
| Grant a share | \`pulse_share_directory\` |
| Revoke a share | \`pulse_share_directory\` (revoke_share_id, confirm=true) |

## Confirmation-First Workflow

**Before any create / update / delete / share-mutation:**

1. Establish workspace, resolve the target team, then read the current tree with \`pulse_get_team_library\` (or a narrower collection/membership read).
2. Build a short summary of the planned operation and show it to the user.
3. Wait for explicit approval.
4. Then call the write tool, and report the canonical IDs it returns.

Sample confirmation:
> **Planned action:** Create wiki document
> Folder: \`Engineering/Onboarding\` (team Engineering)
> Title: "New-hire orientation"
> Body: ~1.2 KB Markdown (headings, checklist)
> Pin as folder overview: yes
> **Proceed?**

## Hard rules

- **Never delete a folder, share, or membership without an explicit user confirmation.** All three writes already require \`confirm=true\` — do not auto-fill it from inferred intent.
- **Pass \`team_name\`.** Every folder tool resolves it server-side; only when it reports \`ambiguous\` does \`pulse_list_teams\` (with \`search\`) pick the id — then ask the user which one.
- **Membership id ≠ document id.** \`pulse_update_directory_membership\` and shares of \`resource_kind="membership"\` take the membership row id from \`pulse_list_directory_memberships\` — not the Content id.
- **Hidden root ≠ visible top-level folder.** The hidden \`kind="root"\` collection stores loose docs and is immutable. Visible top-level folders have \`parent_id=""\`.
- **Library membership ≠ team Overview.** New and filed documents start unpinned. Put one on the team page only when asked, with \`pulse_pin_team_overview\`; unpinning keeps it in the library, so never remove a membership to hide it from the Overview.
- **Overview ≠ entity main doc.** Overview is the folder's \`home_content_id\`; entity main-doc state is an attachment flag. \`content_source\` drives the Linked badge. A row may be both Overview and Linked.
- **Folder and document order are separate.** Reorder only one homogeneous sibling list at a time, normally to \`10,20,30,...\`.
- **Version in place.** Wiki/body edits must use a tool that sends \`content_id\`; never create a new Content merely to edit an existing document.
- **The body never restates the title.** The wiki page renders \`title\` above the body, so a body opening with \`# <the same title>\` shows the name twice. Start at the first section, use \`##\` as the top heading level, and when editing an existing body drop a title heading it carries.
- **Pin before Overview.** Make the Content a membership of the target folder, then set \`home_content_id\`.
- **Soft delete cascades on folders.** Deleting a folder removes its memberships and revokes its shares for the whole subtree, but the underlying Content rows survive — they can still be reattached or read by id.

## Discovering ids

If you only have human names:

\`\`\`
pulse_get_team_library { team_name: "<team name>" }
  -> hidden root id + loose docs + ordered recursive visible folders
pulse_list_directory_memberships { collection_id: "<folder id>" }
  -> pin rows (id=membership id, content_id=document root id)
\`\`\`

The path-aware tools (\`*_path\`) accept slash-separated names like \`Engineering/Onboarding/2026 Plans\` and walk the tree internally.

## Cleaning up

If the user asks "remove this doc from the wiki entirely":
1. Inspect the Team tree/folders and \`pulse_update_directory_membership\` (remove=true) for every pin the user wants removed.
2. \`pulse_delete_document\` to soft-delete the underlying Content.

If they only want it out of one folder, just step 1.
