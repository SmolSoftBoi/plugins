# Architecture

## Purpose

This repository acts as a source catalogue for reusable Codex agent plugins. It
should make plugin discovery predictable, keep plugin source material close to
its documentation, and provide enough structure for validation without requiring
a large framework up front.

## Catalogue Model

The catalogue uses a hybrid model:

- Each plugin has a source directory under `plugins/<plugin-slug>/`.
- Each plugin exposes `.codex-plugin/plugin.json` as the machine-readable Codex
  plugin manifest.
- Each plugin includes Markdown documentation for maintainers and users.
- Shared schemas and package conventions can be introduced as the catalogue
  grows.

This keeps the catalogue useful for both automated tooling and human review.
Codex plugins can bundle reusable skills, app integrations, and MCP servers.
The authoritative packaging reference is the OpenAI Codex plugin documentation:
<https://developers.openai.com/codex/plugins>.

## Recommended Plugin Layout

```text
plugins/
  <plugin-slug>/
    .codex-plugin/
      plugin.json
    README.md
    skills/
      <skill-slug>/
        SKILL.md
    .app.json
    .mcp.json
    assets/
    examples/
    tests/
schemas/
```

Only `.codex-plugin/plugin.json` and `README.md` are expected for every plugin.
Add optional entries when the plugin bundles skills, app mappings, MCP servers,
assets, examples, or tests.

Keep only `plugin.json` inside `.codex-plugin/`. Keep `skills/`, `assets/`,
`.mcp.json`, and `.app.json` at the plugin root so the layout matches Codex
plugin packaging.

Use stable, lowercase slugs with hyphens, for example
`plugins/github-review-helper/`.

## Manifest Contract

`plugins/<plugin-slug>/.codex-plugin/plugin.json` is the required Codex manifest
for a plugin. It should be explicit enough for catalogue tooling to inspect a
plugin without reading implementation files.

Expected manifest fields:

- `name`: Human-readable plugin name.
- `version`: Plugin source version.
- `description`: Short summary of the plugin's purpose.
- `author`: Maintainer or team metadata.
- `homepage`, `repository`, and `license`: Source, support, and legal metadata
  where available.
- `keywords`: Search and grouping labels.
- `skills`: Relative path to bundled skill directories.
- `mcpServers`: Relative path to `.mcp.json` when the plugin configures MCP
  servers.
- `apps`: Relative path to `.app.json` when the plugin maps apps or connectors.
- `interface`: Install-surface metadata such as display name, descriptions,
  developer name, category, capabilities, legal links, prompts, icons, logos,
  and screenshots.

Future root-level files under `schemas/` can validate this contract once the
manifest shape is stable.

## Human Documentation

`plugins/<plugin-slug>/README.md` should explain the plugin for a person who has
not seen the implementation. It should cover:

- What the plugin does.
- When to use it.
- How to configure it.
- What inputs and outputs it expects.
- Important limitations and failure modes.
- Examples for common workflows.

Keep README content aligned with the manifest. If the plugin changes behaviour,
update both files in the same change.

## Discovery Flow

Catalogue tooling should discover plugins by scanning
`plugins/*/.codex-plugin/plugin.json`. For each manifest, tooling can:

1. Validate required fields.
2. Resolve declared `skills`, `apps`, `mcpServers`, and `interface` asset
   paths.
3. Surface capabilities, keywords, author metadata, and support links.
4. Check that human documentation exists.
5. Link to the plugin README for human context.

Invalid manifests should fail validation with clear messages. Missing optional
directories or files should not fail validation unless the manifest references
them.

## Plugin Lifecycle

Reusable plugins should follow this lifecycle:

1. Propose the plugin purpose and intended audience.
2. Add source files under `plugins/<plugin-slug>/`.
3. Add or update `.codex-plugin/plugin.json` and `README.md`.
4. Add examples or tests when behaviour is non-trivial.
5. Run available validation.
6. Review for portability, least privilege, and secret safety.
7. Publish, update, or deprecate the entry.

Deprecation should keep the plugin discoverable while documenting the
replacement path.

## Design Constraints

- Keep plugins reusable across projects where practical.
- Prefer explicit inputs, outputs, permissions, and dependencies.
- Use least-privilege defaults for tools and services.
- Do not embed secrets or private credentials.
- Keep generated files out of the catalogue unless they are required source
  material.
- Add package conventions, schemas, and automation only when repeated catalogue
  work justifies them.
