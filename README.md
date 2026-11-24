# opxskills

Zero-dependency CLI to install, search, and validate portable `SKILL.md` AI agent skills for **Claude Code**, **Cursor**, **OpenAI Codex CLI**, and **Gemini CLI** from [OpxSkills](https://www.opxskills.com).

[![npm version](https://img.shields.io/npm/v/opxskills.svg)](https://www.npmjs.com/package/opxskills)
[![OpxSkills Example Badge](https://www.opxskills.com/badge/docx.svg)](https://www.opxskills.com/skills/docx)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

## Quick start (no install required)

Run directly with `npx` (Node.js 20+):

```bash
# Validate a local SKILL.md file (exits with code 1 on blocking errors)
npx opxskills validate ./SKILL.md

# Install a skill into ~/.claude/skills/<slug>/SKILL.md
npx opxskills add docx

# Install into a repo for Cursor / Codex CLI / Gemini CLI (.agents/skills/<slug>/SKILL.md)
npx opxskills add homelab-network-setup --agent cursor --scope project

# Preview install path & source without writing files
npx opxskills add game-hacking-techniques --dry-run

# Search the OpxSkills directory
npx opxskills search "homelab subnet"

# Print metadata, install commands, and GitHub README badge Markdown
npx opxskills info docx
```

*(You can also run directly from GitHub via `npx github:alvintclam/opxskills ...`.)*

## Commands

| Command | Description |
| --- | --- |
| `add <slug> [--agent claude\|cursor\|codex\|gemini] [--scope personal\|project] [--dry-run]` | Download a verified `SKILL.md` directly into the right folder for your agent. |
| `validate <path/to/SKILL.md>` | Lint YAML frontmatter (`name`, `description`, tabs, fences, trigger wording, token estimate). Useful in CI. |
| `search <query> [--limit N]` | Search the live OpxSkills catalog from your terminal. |
| `info <slug>` | Show OpxScore, upstream GitHub source, install commands, and README badge Markdown. |

## Browser tools & guides

- **Free browser `SKILL.md` Validator & Generator** (100% client-side, no login): https://www.opxskills.com/tools/skill-validator
- **Dynamic GitHub README badges**: `https://www.opxskills.com/badge/<slug>.svg`
- **Cross-agent guides**:
  - [SKILL.md vs CLAUDE.md vs AGENTS.md](https://www.opxskills.com/guides/skill-md-vs-claude-md-vs-agents-md)
  - [Cursor Rules vs Claude Skills](https://www.opxskills.com/guides/cursor-rules-vs-claude-skills)
  - [OpenAI Codex & Gemini CLI Skills](https://www.opxskills.com/guides/codex-and-gemini-cli-skills)
  - [Why Claude Skills Don't Trigger (Debug Guide)](https://www.opxskills.com/guides/claude-skills-not-working)

## Development & testing

```bash
npm test
```

## License

MIT
