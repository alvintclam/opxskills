#!/usr/bin/env node
import { realpathSync } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const DEFAULT_BASE_URL = process.env.OPXSKILLS_BASE_URL || 'https://www.opxskills.com';
const VALID_SLUG = /^[a-z0-9][a-z0-9._-]{0,120}$/;

export function resolveInstallDirectory({ slug, agent = 'claude', scope = 'personal', cwd = process.cwd(), homeDir = os.homedir() }) {
  if (!VALID_SLUG.test(slug)) {
    throw new Error(`Invalid skill slug "${slug}". Use lowercase letters, numbers, dots, underscores, or hyphens.`);
  }
  const normalizedAgent = String(agent).toLowerCase();
  const normalizedScope = String(scope).toLowerCase();

  if (normalizedAgent === 'claude' || normalizedAgent === 'claude-code') {
    return normalizedScope === 'project'
      ? path.join(cwd, '.claude', 'skills', slug)
      : path.join(homeDir, '.claude', 'skills', slug);
  }
  if (normalizedAgent === 'cursor') {
    return path.join(cwd, '.agents', 'skills', slug);
  }
  if (normalizedAgent === 'codex' || normalizedAgent === 'gemini' || normalizedAgent === 'agents') {
    return normalizedScope === 'personal'
      ? path.join(homeDir, '.agents', 'skills', slug)
      : path.join(cwd, '.agents', 'skills', slug);
  }
  throw new Error(`Unsupported agent "${agent}". Choose one of: claude, cursor, codex, gemini, agents.`);
}

export function validateLocalSkillMarkdown(rawContent) {
  const normalized = String(rawContent || '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const trimmed = normalized.replace(/^(?:\s*<!--[\s\S]*?-->\s*)+/, '');
  const errors = [];
  const warnings = [];

  if (!trimmed.startsWith('---\n')) {
    errors.push('Missing opening YAML frontmatter fence (---).');
    return { valid: false, errors, warnings, name: '', description: '' };
  }

  const lines = trimmed.split('\n');
  let endLine = -1;
  for (let i = 1; i < lines.length; i += 1) {
    if (lines[i].trim() === '---') {
      endLine = i;
      break;
    }
  }
  if (endLine === -1) {
    errors.push('Missing closing YAML frontmatter fence (---).');
    return { valid: false, errors, warnings, name: '', description: '' };
  }

  const fmLines = lines.slice(1, endLine);
  const attrs = {};
  for (let i = 0; i < fmLines.length; i += 1) {
    const line = fmLines[i];
    if (/^\t/.test(line)) errors.push('Tab indentation detected in YAML frontmatter (use spaces).');
    const match = line.match(/^([A-Za-z][\w-]*):\s*(.*)$/);
    if (!match) continue;
    const key = match[1].toLowerCase();
    let value = match[2].trim();
    if (value === '|' || value === '>' || value === '|-' || value === '>-') {
      const folded = value.startsWith('>');
      const block = [];
      while (i + 1 < fmLines.length && (/^\s+/.test(fmLines[i + 1]) || fmLines[i + 1].trim() === '')) {
        block.push(fmLines[++i].trim());
      }
      value = block.filter(Boolean).join(folded ? ' ' : '\n');
    } else if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    attrs[key] = value.trim();
  }

  const name = attrs.name || '';
  const description = attrs.description || '';
  const body = lines.slice(endLine + 1).join('\n').trim();

  if (!name) errors.push('Missing required frontmatter key: name');
  else if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(name)) {
    warnings.push(`Skill name "${name}" should be lowercase kebab-case.`);
  }
  if (!description) errors.push('Missing required frontmatter key: description');
  else {
    if (description.length < 40) warnings.push('Description is shorter than 40 characters; add trigger wording.');
    if (!/\b(?:use\s+when|when\s+the\s+user|whenever|\.[a-z0-9]{2,5}\b)/i.test(description)) {
      warnings.push('Consider adding an explicit "Use when..." trigger clause to description.');
    }
  }
  if (body.length < 60) warnings.push('Markdown instruction body is very short.');

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    name,
    description,
    tokens: Math.ceil(normalized.length / 4),
  };
}

function parseFlags(args) {
  const positionals = [];
  const flags = {};
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = args[i + 1];
      if (!next || next.startsWith('--')) {
        flags[key] = true;
      } else {
        flags[key] = next;
        i += 1;
      }
    } else {
      positionals.push(arg);
    }
  }
  return { positionals, flags };
}

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'opxskills-cli/0.1.0' },
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} fetching ${url}`);
  }
  return res.json();
}

async function cmdAdd(slug, flags) {
  if (!slug || !VALID_SLUG.test(slug)) {
    throw new Error('Usage: npx opxskills add <slug> [--agent claude|cursor|codex|gemini|agents] [--scope personal|project] [--dry-run]');
  }
  const baseUrl = String(flags.registry || DEFAULT_BASE_URL).replace(/\/$/, '');
  const meta = await fetchJson(`${baseUrl}/api/cli/skills/${encodeURIComponent(slug)}`);

  if (meta.kind === 'prompt') {
    console.log(`"${meta.name}" is a prompt template, not an installable SKILL.md folder.`);
    console.log(`Open: ${meta.url}`);
    return;
  }
  if (!meta.rawSkillMdUrl) {
    console.log(`"${meta.name}" does not have a direct raw SKILL.md URL.`);
    if (meta.pluginCommand) {
      console.log('\nInstall via plugin command:\n' + meta.pluginCommand);
    }
    if (meta.sourceUrl) console.log(`\nSource: ${meta.sourceUrl}`);
    return;
  }

  const targetDir = resolveInstallDirectory({
    slug: meta.slug,
    agent: flags.agent || 'claude',
    scope: flags.scope || (flags.agent === 'cursor' ? 'project' : 'personal'),
  });
  const targetFile = path.join(targetDir, 'SKILL.md');

  if (flags['dry-run']) {
    console.log(`[dry-run] Would download ${meta.rawSkillMdUrl}`);
    console.log(`[dry-run] Would write ${targetFile}`);
    return;
  }

  const res = await fetch(meta.rawSkillMdUrl, { headers: { 'User-Agent': 'opxskills-cli/0.1.0' } });
  if (!res.ok) {
    throw new Error(`Failed to download SKILL.md (${res.status}) from ${meta.rawSkillMdUrl}`);
  }
  const content = await res.text();
  await fs.mkdir(targetDir, { recursive: true });
  await fs.writeFile(targetFile, content, 'utf8');

  console.log(`Installed ${meta.name} -> ${targetFile}`);
  if (meta.starterPrompt) {
    console.log(`\nStarter prompt:\n  ${meta.starterPrompt}`);
  }
  console.log(`\nDetails & badge: ${meta.url}`);
}

async function cmdSearch(query, flags) {
  if (!query) {
    throw new Error('Usage: npx opxskills search <query>');
  }
  const baseUrl = String(flags.registry || DEFAULT_BASE_URL).replace(/\/$/, '');
  const data = await fetchJson(`${baseUrl}/api/skills?q=${encodeURIComponent(query)}&limit=10`);
  const items = Array.isArray(data.skills) ? data.skills : Array.isArray(data.data) ? data.data : [];
  if (items.length === 0) {
    console.log(`No skills found for "${query}". Browse all: ${baseUrl}/skills`);
    return;
  }
  for (const item of items) {
    const score = typeof item.opxScore === 'number' ? ` (${Math.round(item.opxScore)}/100)` : '';
    console.log(`- ${item.slug}${score}: ${item.name}`);
    if (item.description) console.log(`  ${String(item.description).slice(0, 110)}`);
  }
  console.log(`\nInstall one with: npx opxskills add <slug>`);
}

async function cmdValidate(filePath = 'SKILL.md') {
  const resolved = path.resolve(filePath);
  const raw = await fs.readFile(resolved, 'utf8');
  const report = validateLocalSkillMarkdown(raw);
  console.log(`File: ${resolved}`);
  console.log(`Status: ${report.valid ? 'PASS' : 'FAIL'} (~${report.tokens || 0} tokens)`);
  for (const err of report.errors) console.log(`  ERROR: ${err}`);
  for (const warn of report.warnings) console.log(`  WARN:  ${warn}`);
  if (!report.valid) process.exitCode = 1;
}

async function cmdInfo(slug, flags) {
  if (!slug || !VALID_SLUG.test(slug)) {
    throw new Error('Usage: npx opxskills info <slug>');
  }
  const baseUrl = String(flags.registry || DEFAULT_BASE_URL).replace(/\/$/, '');
  const meta = await fetchJson(`${baseUrl}/api/cli/skills/${encodeURIComponent(slug)}`);
  console.log(`${meta.name} (${meta.slug}) — OpxScore ${Math.round(meta.opxScore)}/100`);
  console.log(meta.description);
  console.log(`Page:   ${meta.url}`);
  if (meta.sourceUrl) console.log(`Source: ${meta.sourceUrl}`);
  if (meta.badgeUrl) console.log(`Badge:  [![${meta.name}](${meta.badgeUrl})](${meta.url})`);
}

function printHelp() {
  console.log(`opxskills — Install, search, and validate SKILL.md agent skills

Usage:
  npx opxskills add <slug> [--agent claude|cursor|codex|gemini|agents] [--scope personal|project] [--dry-run]
  npx opxskills search <query>
  npx opxskills info <slug>
  npx opxskills validate [path/to/SKILL.md]

Examples:
  npx opxskills add docx
  npx opxskills add webapp-testing --agent cursor --scope project
  npx opxskills search "homelab subnet"
  npx opxskills validate ./SKILL.md

Web directory & online validator: https://www.opxskills.com/tools/skill-validator`);
}

async function main() {
  const { positionals, flags } = parseFlags(process.argv.slice(2));
  const [command, ...rest] = positionals;
  if (!command || command === 'help' || flags.help || flags.h) {
    printHelp();
    return;
  }
  if (command === 'add') return cmdAdd(rest[0], flags);
  if (command === 'search') return cmdSearch(rest.join(' '), flags);
  if (command === 'info') return cmdInfo(rest[0], flags);
  if (command === 'validate') return cmdValidate(rest[0]);
  throw new Error(`Unknown command "${command}". Run "npx opxskills help".`);
}

function isDirectExecution() {
  if (!process.argv[1]) return false;
  try {
    return import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href;
  } catch {
    return import.meta.url === pathToFileURL(process.argv[1]).href;
  }
}

if (isDirectExecution()) {
  main().catch((err) => {
    console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 1;
  });
}
