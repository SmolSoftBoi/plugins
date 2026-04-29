# Agent Instructions

## Purpose

This repository is a source catalogue for reusable Codex agent plugins. Keep
every catalogue entry portable, reviewable, and clear enough for another agent
or maintainer to reuse without hidden context.

## Working Principles

- Use concise English (UK) and active voice.
- Make small, reviewable changes that match the existing catalogue structure.
- Prefer direct, readable implementations over clever abstractions.
- Resolve discoverable facts from the repository before asking questions.
- Use repository inspection and available tools when they materially improve
  correctness or completeness; do not skip prerequisite checks just because the
  intended end state seems obvious.
- Document assumptions when you proceed without complete information.
- If required context is missing and cannot be retrieved, do not guess; state
  the missing context explicitly and choose the most reversible path.
- Avoid drive-by refactors and unrelated formatting churn.

## Catalogue Layout

Store each reusable plugin under `plugins/<plugin-slug>/`.
Treat the official Codex plugin documentation as the source of truth when
package conventions change.
Each plugin entry should include:

- `plugins/<plugin-slug>/.codex-plugin/plugin.json` as the required Codex
  plugin manifest.
- `plugins/<plugin-slug>/README.md` as the human-readable overview and usage
  guide.
- Optional `skills/`, `.app.json`, `.mcp.json`, and `assets/` entries when the
  plugin bundles skills, app mappings, MCP servers, or install-surface assets.
- Optional `examples/` and `tests/` directories when source examples or
  validation fixtures make the plugin easier to maintain.

Keep only `plugin.json` inside `.codex-plugin/`. Keep `skills/`, `assets/`,
`.mcp.json`, and `.app.json` at the plugin root.

Future shared validation schemas should live under a root-level `schemas/`
directory. Do not add schema files until the manifest shape has stabilised or a
task explicitly asks for them.

## Plugin Entry Expectations

When adding or updating a plugin entry:

- Keep `.codex-plugin/plugin.json` and `README.md` aligned.
- Describe the plugin's purpose, capabilities, inputs, outputs, and limits.
- Name owners or maintainers where known.
- List runtime requirements, environment variables, and compatibility metadata.
- Point manifest fields to bundled skills, apps, MCP servers, and assets using
  paths relative to the plugin root.
- Include examples for non-obvious workflows.
- Keep assets small and relevant.
- Avoid generated artefacts unless they are the source material for the plugin.

## Dependencies and Secrets

- Use the repository's existing package manager when scripts or package files
  exist.
- Check for existing dependencies before proposing new ones.
- Ask before adding production dependencies.
- Never hard-code tokens, credentials, API keys, or private URLs.
- Use environment variables for secrets and document required variables in the
  relevant plugin README.
- Add or update `.env.example` only when the repository introduces environment
  configuration.

## Validation

Run the closest available quality gates after making changes, in this order:

1. Lint.
2. Typecheck.
3. Tests.
4. Build.

If no scripts exist, validate the changed Markdown and catalogue paths manually.
At minimum, check that references use `plugins/<plugin-slug>/` consistently and
that plugin manifests, READMEs, and examples do not contradict each other.
Treat the task as incomplete until the requested files are updated and the
relevant checks are either run or explicitly marked as blocked.

## Review Readiness

Before finalising a change:

- Confirm the diff is limited to the requested scope.
- Check that Markdown headings and links are valid.
- Ensure new plugin entries have a clear manifest contract.
- Run a brief verification pass for correctness, consistency, and formatting.
- State any checks you could not run.
- Summarise assumptions and follow-up work separately from completed changes.
