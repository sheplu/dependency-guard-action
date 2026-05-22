import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildArgs } from '../src/args.ts';
import type { Config } from '../src/inputs.ts';

function baseConfig(overrides: Partial<Config> = {}): Config {
  return {
    version: 'latest',
    workingDirectory: '.',
    path: null,
    format: 'table',
    failOn: null,
    maxAgeDays: null,
    only: [],
    ignoreScopes: [],
    filter: [],
    includeTransitive: false,
    registry: null,
    noCache: false,
    cacheClear: false,
    cacheTtl: null,
    sort: null,
    allColumns: false,
    updateLevel: null,
    dryRun: false,
    quiet: false,
    summary: true,
    ...overrides,
  };
}

describe('buildArgs', () => {
  it('emits only --format by default', () => {
    assert.deepEqual(buildArgs(baseConfig()), ['--format', 'table']);
  });

  it('uses path verbatim when provided', () => {
    const args = buildArgs(baseConfig({ path: '/repo/sub/package.json' }));
    assert.deepEqual(args, ['--path', '/repo/sub/package.json', '--format', 'table']);
  });

  it('does not emit --path when only working-directory is set (cwd handles it)', () => {
    const args = buildArgs(baseConfig({ workingDirectory: 'packages/api' }));
    assert.deepEqual(args, ['--format', 'table']);
  });

  it('path takes precedence when both path and working-directory are set', () => {
    const args = buildArgs(
      baseConfig({ path: '/repo/sub/package.json', workingDirectory: 'packages/api' }),
    );
    assert.deepEqual(args, ['--path', '/repo/sub/package.json', '--format', 'table']);
  });

  it('honors formatOverride', () => {
    const args = buildArgs(baseConfig({ format: 'table' }), { formatOverride: 'json' });
    assert.deepEqual(args, ['--format', 'json']);
  });

  it('emits filter flags in declared order', () => {
    const args = buildArgs(baseConfig({ filter: ['prod', 'dev', 'pnpm-overrides'] }));
    assert.deepEqual(args, [
      '--format',
      'table',
      '--prod',
      '--dev',
      '--pnpm-overrides',
    ]);
  });

  it('emits --fail-on and --max-age', () => {
    const args = buildArgs(baseConfig({ failOn: 'major', maxAgeDays: 180 }));
    assert.deepEqual(args, [
      '--format',
      'table',
      '--fail-on',
      'major',
      '--max-age',
      '180',
    ]);
  });

  it('emits repeated --ignore-scope and --only flags', () => {
    const args = buildArgs(
      baseConfig({
        ignoreScopes: ['@internal', '@private'],
        only: ['react', 'lodash'],
      }),
    );
    assert.deepEqual(args, [
      '--format',
      'table',
      '--ignore-scope',
      '@internal',
      '--ignore-scope',
      '@private',
      '--only',
      'react',
      '--only',
      'lodash',
    ]);
  });

  it('emits caching, registry, sort, all-columns flags', () => {
    const args = buildArgs(
      baseConfig({
        registry: 'https://registry.example.com',
        noCache: true,
        cacheClear: true,
        cacheTtl: 30,
        sort: 'age',
        allColumns: true,
        includeTransitive: true,
      }),
    );
    assert.deepEqual(args, [
      '--format',
      'table',
      '--include-transitive',
      '--registry',
      'https://registry.example.com',
      '--no-cache',
      '--cache-clear',
      '--cache-ttl',
      '30',
      '--sort',
      'age',
      '--all-columns',
    ]);
  });

  it('emits --update and --dry-run', () => {
    const args = buildArgs(baseConfig({ updateLevel: 'minor', dryRun: true }));
    assert.deepEqual(args, [
      '--format',
      'table',
      '--update',
      'minor',
      '--dry-run',
    ]);
  });

  it('emits --quiet when quiet is true', () => {
    const args = buildArgs(baseConfig({ quiet: true }));
    assert.deepEqual(args, ['--format', 'table', '--quiet']);
  });

  it('forceQuiet overrides config.quiet=false', () => {
    const args = buildArgs(baseConfig({ quiet: false }), { forceQuiet: true });
    assert.deepEqual(args, ['--format', 'table', '--quiet']);
  });

  it('does not double-emit --quiet when both forceQuiet and config.quiet are true', () => {
    const args = buildArgs(baseConfig({ quiet: true }), { forceQuiet: true });
    assert.equal(args.filter((a) => a === '--quiet').length, 1);
  });
});
