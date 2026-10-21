# Deferred tool discovery without repeated catalog output

Use the host's documented schema loader when available. Otherwise, with an
execution catalog such as `ALL_TOOLS`, discover by service and operation in
`name`. Shared server descriptions mention many operations and are unsuitable
for filtering. Return names, not matching objects:

```js
text(ALL_TOOLS
  .filter(t => t.name.startsWith("mcp__pulse__pulse_") &&
    /pulse_(list_projects|get_project)$/.test(t.name))
  .map(t => t.name));
```

Load only the tool needed next. Its first definition must include its native
behavioral description and argument schema. If no dedicated loader exists,
emit that one selected entry once; do not print several full entries together:

```js
const selected = ALL_TOOLS.find(t => t.name === "mcp__pulse__pulse_list_projects");
if (!selected) throw new Error("Requested Pulse tool is unavailable");
store(selected.name, selected);
text(selected);
```

Reuse loaded definitions across calls and turns. Do not print a definition again
just to call the tool; invoke its actual `tools` method with the live arguments.
Store the result and project needed fields before emitting it. Storage APIs in
these examples are host features: use them only when documented and available.

If the behavioral description is already loaded and only the signature needs
inspection, some hosts embed a TypeScript declaration after the literal marker
`exec tool declaration:`. This is a host serialization convention, not MCP:

```js
const selected = load("mcp__pulse__pulse_list_projects");
if (!selected) throw new Error("Load the selected definition first");
const marker = "exec tool declaration:";
const start = selected.description.indexOf(marker);
if (start < 0) {
  text({ name: selected.name, declaration: "Unavailable; use the host schema loader" });
} else {
  text({ name: selected.name, declaration: selected.description.slice(start) });
}
```

The declaration can omit behavioral rules appearing before it. Never treat it
as a complete first-load definition or silently slice at `-1` when the marker
is absent. Keep tool-specific descriptions, parameter documentation, permissions
and errors. Do not invent a schema-loading API or a generic tool executor.

## Source and host boundary

The Pulse server owns `initialize.instructions`, each registered tool's
description and JSON input schema. See `src/server-factory.ts` and
`src/tools/register-*.ts`. It advertises native operations through MCP
`tools/list`; the installed plugin ships this skill and its references.

The execution host owns `ALL_TOOLS`, namespace expansion, deferred loading and
the TypeScript declaration wrapper. A host may concatenate shared server
instructions into each catalog description. Printing each entry then repeats
that text in conversation context. This guidance prevents unnecessary printing;
it does not change that host catalog or reduce its initially supplied context.

Do not remove native tool semantics, move all operations behind an executor, or
guess a shared-prefix delimiter to compensate. A server or plugin source edit
only reaches an installed session after the normal release/update and host
reload process; editing the checkout does not update an active host catalog.
