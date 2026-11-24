import assert from 'node:assert/strict';
import path from 'node:path';
import { describe, it } from 'node:test';
import { resolveInstallDirectory, validateLocalSkillMarkdown } from './opxskills.mjs';

describe('opxskills CLI helpers', () => {
  it('resolves install paths safely across agents and scopes', () => {
    assert.equal(
      resolveInstallDirectory({ slug: 'docx', agent: 'claude', scope: 'personal', cwd: '/repo', homeDir: '/home/dev' }),
      path.join('/home/dev', '.claude', 'skills', 'docx')
    );
    assert.equal(
      resolveInstallDirectory({ slug: 'docx', agent: 'claude', scope: 'project', cwd: '/repo', homeDir: '/home/dev' }),
      path.join('/repo', '.claude', 'skills', 'docx')
    );
    assert.equal(
      resolveInstallDirectory({ slug: 'webapp-testing', agent: 'cursor', cwd: '/repo', homeDir: '/home/dev' }),
      path.join('/repo', '.agents', 'skills', 'webapp-testing')
    );
    assert.equal(
      resolveInstallDirectory({ slug: 'pdf', agent: 'codex', scope: 'project', cwd: '/repo', homeDir: '/home/dev' }),
      path.join('/repo', '.agents', 'skills', 'pdf')
    );
    assert.throws(() => resolveInstallDirectory({ slug: '../etc', agent: 'claude' }), /Invalid skill slug/);
    assert.throws(() => resolveInstallDirectory({ slug: 'docx', agent: 'unknown' }), /Unsupported agent/);
  });

  it('validates SKILL.md files cleanly', () => {
    const ok = validateLocalSkillMarkdown(
      '---\nname: release-notes\ndescription: "Draft release notes from merged PRs. Use when asked for a changelog."\n---\n\n# Release Notes\n\n1. Read merged PRs and write one-line bullets for every change.\n'
    );
    assert.equal(ok.valid, true);
    assert.equal(ok.errors.length, 0);

    const bad = validateLocalSkillMarkdown('# No Frontmatter\nJust markdown.');
    assert.equal(bad.valid, false);
    assert.ok(bad.errors.length > 0);
  });
});
