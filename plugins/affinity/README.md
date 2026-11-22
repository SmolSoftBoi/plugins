# Affinity for Codex

An unofficial plugin maintained by Kristian Matthews-Kennington. It connects
Codex to Affinity by Canva on the same computer. Use it to preview a spread or
selection, automate document edits with Affinity's JavaScript SDK, and work with
reusable scripts in the Scripting panel. Codex discovers the tools from Affinity
at runtime. [Affinity's official integration guide](https://www.affinity.studio/integrations)

## Requirements

- A local Codex desktop or CLI session and Node.js 22 or later available on its `PATH`.
- Affinity by Canva with **Model Context Protocol** settings. The supplied
  Claude extension documents Affinity 3.2 or later. This bridge was verified
  with Affinity 3.3.3 on macOS.
- Affinity running on the same machine with MCP enabled. The bridge uses the
  app's loopback endpoint at `http://localhost:6767/sse` and MCP protocol version
  `2025-11-25`. Affinity manages sign-in and permissions for files, network access,
  saved scripts and other optional capabilities.

Node.js runs the adapter directly using its standard library. The adapter uses
the running Affinity app for document and SDK operations.

## Setup

1. In Affinity, open **Settings → Model Context Protocol**, turn on **Enable MCP
   server**, and restart Affinity. Leave it running when using the plugin.
2. Open this repository in Codex and install **Affinity** from the
   **SmolSoftBoi Plugins** marketplace. To select this checkout explicitly
   from the CLI, run the following from the repository root.

   ```sh
   codex plugin add affinity@smolsoftboi-plugins \
     -c 'marketplaces.smolsoftboi-plugins.source_type="local"' \
     -c "marketplaces.smolsoftboi-plugins.source=\"$(pwd -P)\""
   ```

3. Start a new Codex chat with Affinity enabled and ask it to list the Affinity
   SDK documentation topics. This check only reads documentation metadata.

For local marketplace discovery and installation, see the
[Codex plugin guide](https://developers.openai.com/plugins/build/plugins#install-a-local-plugin-manually).

## Examples

- “Show me a preview of the selected objects in my active Affinity document.”
  Requires a selection and returns a JPEG preview.
- “Give the layers in this Affinity document descriptive names.” Uses the
  active document and reports which layers changed.
- “Create an Affinity script that lays out the selected shapes in a grid.”
  Builds a script for the current selection. Ask Codex to save it to the
  Scripting panel if you want it in the library.

Read the installed SDK topics before writing automation. The public reference
also lists the versioned API and type declarations. [Affinity SDK](https://sdk.affinity.studio/)

## Troubleshooting

If the tools are unavailable, check that Node.js is visible to Codex and that
Affinity is running with MCP enabled, then start a new Codex chat. If Affinity
restarts or the connection drops during an edit, inspect the document before
trying the edit again. The bridge sends each request at most once.
