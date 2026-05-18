# Codex Plugin Catalogue

This repository is a source catalogue for reusable Codex agent plugins. It keeps
plugin source, documentation, and validation expectations in one place so a
plugin can be reviewed, reused, and packaged consistently.

For Codex packaging details, treat the official documentation as the source of
truth: <https://developers.openai.com/codex/plugins>.

## Catalogue Layout

Store each plugin under `plugins/<plugin-slug>/`.

```text
plugins/
  <plugin-slug>/
    .codex-plugin/
      plugin.json
    README.md
    skills/
    .app.json
    .mcp.json
    assets/
    examples/
    tests/
```

Every plugin should include:

- `plugins/<plugin-slug>/.codex-plugin/plugin.json` as the required Codex
  plugin manifest.
- `plugins/<plugin-slug>/README.md` as the human-readable overview.

Add optional entries only when they are useful:

- `skills/` for bundled skill instructions.
- `.app.json` for app or connector mappings.
- `.mcp.json` for MCP server configuration.
- `assets/` for icons, logos, screenshots, and other install-surface assets.
- `examples/` and `tests/` for catalogue maintenance and validation.

Keep only `plugin.json` inside `.codex-plugin/`. Keep `skills/`, `assets/`,
`.app.json`, and `.mcp.json` at the plugin root.

## Add a Plugin

1. Create `plugins/<plugin-slug>/` using a stable, lowercase slug with hyphens.
2. Add `.codex-plugin/plugin.json` with the plugin name, version, description,
   bundled entry points, and install-surface metadata.
3. Add `README.md` explaining what the plugin does, when to use it, how to
   configure it, and any important limitations.
4. Add `skills/`, `.app.json`, `.mcp.json`, `assets/`, `examples/`, or `tests/`
   only when the plugin needs them.
5. Check that the plugin README and manifest describe the same capabilities,
   requirements, and bundled files.

## Validation

This repository currently has no package tooling, schemas, or generated
validation. For README-only and catalogue-structure changes:

- Run `git diff --check`.
- Confirm paths use `plugins/<plugin-slug>/` consistently.
- Confirm Codex manifests use `.codex-plugin/plugin.json`.
- Confirm README files, manifests, examples, and tests do not contradict each
  other.

When package scripts or schemas are added later, run the closest available
quality gates in this order: lint, typecheck, tests, then build.

## Project Docs

- `AGENTS.md` defines contribution and agent-working instructions.
- `ARCHITECTURE.md` explains the catalogue model, discovery flow, lifecycle, and
  manifest expectations.
