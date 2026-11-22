---
name: affinity-workflow
description: Use when previewing, editing or automating a document in the Affinity desktop app, or building and saving Affinity scripts.
---

# Affinity desktop workflows

1. Use `list_sdk_documentation` to check the connection and discover the available topics. If the server is unavailable, ask the user to open Affinity, enable **Settings → Model Context Protocol → Enable MCP server**, and start a new Codex chat.
2. Before calling `execute_script`, read the SDK preamble and the topics relevant to the task with `read_sdk_documentation_topic`. Use the current tool schemas and SDK docs for script syntax and inputs.
3. Start with a read-only inspection script to identify the intended document, spread and objects. Resolve an ambiguous target before editing. For previews, pass the document's session UUID to `render_selection` or pass the UUID and a zero-based spread index to `render_spread`.
4. Keep edits within the requested scope. For visual edits, render the affected spread or selection after running the script. Report what changed and whether the document was saved or exported.
5. Use the Affinity script library when the task calls for it. Verify new scripts against the intended document or selection and check existing names before replacing a library entry. Use generic SDK questions when searching shared hints. Get explicit authorisation before sharing hints or filing an SDK report.
