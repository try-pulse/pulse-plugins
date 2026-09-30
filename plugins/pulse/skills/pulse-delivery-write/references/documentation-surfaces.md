# Documentation surfaces and mentions

The long form behind the "Documenting an entity" bullets in [../SKILL.md](../SKILL.md).

## Documenting an entity (the right surface)

This is the most common mistake. For documentation on issues, projects, initiatives, objectives, or key results, pick the correct surface:

| Need | Right surface |
|------|---------------|
| Canonical writeup of the entity (story, requirements, acceptance criteria, scope, design notes, background) | **MAIN document**. Preferred (single call): pass the inline `main_document: { body, title?, body_format?, tags?, is_public? }` field on `pulse_save_issue` / `pulse_save_project` / `pulse_save_initiative` / `pulse_save_objective` / `pulse_save_key_result` (with an id/query to update) — MCP creates/updates the entity then uploads with `is_main_doc=true` in one call. Standalone alternative: `pulse_save_document` with `attachments=[{ entity_type, entity_id, is_main_doc: true }]`, `pulse_attach_document` with `is_main_doc: true`, or `pulse_save_document` to revise an existing main doc. |
| Supplementary reference (Figma, Notion link, related spec, meeting note, appendix) | Non-main attached document (no `is_main_doc`). |
| Short discussion / question / status note / bug report / reply | A comment via `pulse_add_comment`. |
| Title-suffix shown in lists | The entity's `description` field (≤50 chars on issue/project/initiative). |

## The body must never restate the title

Pulse renders the title ABOVE the body on every surface: the entity header on an issue /
project / initiative page for a main doc, the title field on the document page for a wiki or
standalone doc. A body that opens with `# <the same title>` — or a bold line repeating it —
therefore shows the name twice, one under the other. This is the most common defect in
agent-written Pulse documents.

- Open at the first real section (`## Story`, `## Problem`, `## Scope`) or at the opening
  paragraph — never at a title.
- Use `##` as the body's top heading level and `###` below it. `#` has no place in a Pulse
  body.
- `main_document.title` already defaults to the entity's title; there is nothing to make up
  for in the body.
- On a revision, if the `body_markdown` you read back opens with a title heading, delete that
  line as part of the edit instead of carrying it forward.
- A heading that names a *section* is fine — a doc titled "Recently Deleted Recovery" may have
  a `## Recovery window` section, it just must not open with `# Recently Deleted Recovery`.

Anti-patterns to avoid:
- Opening the body with a heading that repeats the entity or document title.
- Trying to put a full story / spec into `description` — the 50-char schema will reject it.
- Creating a comment with the canonical writeup instead of a main doc.
- Calling `pulse_save_document` and attaching it WITHOUT `is_main_doc: true`, then treating that as "the doc" — the entity still has no main doc.
- Creating a new non-main document on every revision instead of editing the existing main doc.

When creating an entity that needs documentation, prefer the **single-call** path: pass `main_document: { body: "<markdown>" }` on `pulse_save_issue` / `pulse_save_project` / `pulse_save_initiative` / `pulse_save_objective` / `pulse_save_key_result`. MCP performs the entity create and the doc upload+attach (`is_main_doc=true`) in one tool call — same path as the Pulse web client. Two-call fallback: create the entity, then call `pulse_save_document` with the markdown body and `attachments=[{ entity_type, entity_id: <new id>, is_main_doc: true }]`.

For updates, the same field works on `pulse_save_*` with an id or query: pass `main_document.body`. MCP first reads the entity's current main doc and, when there is one, uploads with `content_id=<its stable root>` — the backend rolls a new **version** in place, so the root id, the attachment and `main_doc_id` all stay put. Only when the entity has no main doc yet does MCP upload with `attachments=[is_main_doc:true]` to create and pin one. The response reports which happened via `main_document_request.mode` (`version` or `create`).

Never revise a main doc by attaching a *second* document: `attach` is insert-only server-side (it 409s on an existing attachment and cannot flip `is_main_doc`), and the obvious cleanup — detaching the old doc — clears the entity's `main_doc_id`, because the server reads that decision off the attachment's own flag rather than off `main_doc_id`. Revise through `main_document.body` or `pulse_save_document`.

### Mentions & entity references in bodies

Main-doc, comment, and status-update bodies all accept two placeholders that MCP renders as chips (and round-trips on read):

- **User** — `<@USER_ID|Display Name>`. In comments/main-docs it also populates `mentioned_user_ids` (notifies). In a **status-update description it is text-only** (the endpoint has no mention-id field) — comment on the status update if you need to notify.
- **Entity** — `<#issue:ID|Label>`, `<#project:ID|Label>` or `<#document:ID|Title>` — a clickable chip linking to the issue/project/document.

Mentions are the one case that genuinely needs ids up front (`pulse_list_users`, `pulse_list_issues`, `pulse_list_projects`) — resolve, then write the placeholder inline in the Markdown. Example: `Owner <@u_123|Sam Lee>; blocked by <#issue:65f0…|Login bug>.`
