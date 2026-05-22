import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readInputs } from '../src/inputs.ts';

const ORIGINAL_ENV = { ...process.env };

function setInput(name: string, value: string): void {
  process.env[`INPUT_${name.replace(/ /g, '_').toUpperCase()}`] = value;
}

function clearAllInputs(): void {
  for (const key of Object.keys(process.env)) {
    if (key.startsWith('INPUT_')) delete process.env[key];
  }
}

describe('readInputs', () => {
  beforeEach(() => {
    clearAllInputs();
  });

  afterEach(() => {
    clearAllInputs();
    process.env = { ...ORIGINAL_ENV };
  });

  it('returns sane defaults when no inputs are set', () => {
    const cfg = readInputs();
    assert.equal(cfg.version, 'latest');
    assert.equal(cfg.workingDirectory, '.');
    assert.equal(cfg.path, null);
    assert.equal(cfg.format, 'table');
    assert.equal(cfg.failOn, null);
    assert.equal(cfg.maxAgeDays, null);
    assert.deepEqual(cfg.only, []);
    assert.deepEqual(cfg.ignoreScopes, []);
    assert.deepEqual(cfg.filter, []);
    assert.equal(cfg.includeTransitive, false);
    assert.equal(cfg.summary, true);
  });

  it('parses CSV inputs and trims whitespace', () => {
    setInput('only', ' react , lodash ,  ');
    setInput('ignore-scopes', '@internal,@private');
    const cfg = readInputs();
    assert.deepEqual(cfg.only, ['react', 'lodash']);
    assert.deepEqual(cfg.ignoreScopes, ['@internal', '@private']);
  });

  it('rejects invalid format', () => {
    setInput('format', 'xml');
    assert.throws(() => readInputs(), /Invalid value "xml" for input "format"/);
  });

  it('rejects invalid fail-on', () => {
    setInput('fail-on', 'critical');
    assert.throws(() => readInputs(), /Invalid value "critical" for input "fail-on"/);
  });

  it('rejects invalid filter entry', () => {
    setInput('filter', 'prod,bogus');
    assert.throws(() => readInputs(), /Invalid value "bogus" in input "filter"/);
  });

  it('rejects negative max-age-days', () => {
    setInput('max-age-days', '-5');
    assert.throws(() => readInputs(), /must be a non-negative integer/);
  });

  it('rejects non-integer max-age-days', () => {
    setInput('max-age-days', '3.5');
    assert.throws(() => readInputs(), /must be a non-negative integer/);
  });

  it('parses booleans via @actions/core convention', () => {
    setInput('include-transitive', 'true');
    setInput('no-cache', 'TRUE');
    setInput('summary', 'false');
    const cfg = readInputs();
    assert.equal(cfg.includeTransitive, true);
    assert.equal(cfg.noCache, true);
    assert.equal(cfg.summary, false);
  });

  it('parses all enums when valid', () => {
    setInput('format', 'json');
    setInput('fail-on', 'minor');
    setInput('update-level', 'patch');
    setInput('sort', 'age');
    const cfg = readInputs();
    assert.equal(cfg.format, 'json');
    assert.equal(cfg.failOn, 'minor');
    assert.equal(cfg.updateLevel, 'patch');
    assert.equal(cfg.sort, 'age');
  });

  it('boolean inputs without a fallback default to false when unset', () => {
    const cfg = readInputs();
    assert.equal(cfg.includeTransitive, false);
    assert.equal(cfg.noCache, false);
    assert.equal(cfg.cacheClear, false);
    assert.equal(cfg.allColumns, false);
    assert.equal(cfg.dryRun, false);
    assert.equal(cfg.quiet, false);
  });

  it('summary defaults to true when unset (fallback path)', () => {
    const cfg = readInputs();
    assert.equal(cfg.summary, true);
  });

  it('explicit registry / path strings round-trip', () => {
    setInput('registry', 'https://r.example.com');
    setInput('path', '/abs/package.json');
    const cfg = readInputs();
    assert.equal(cfg.registry, 'https://r.example.com');
    assert.equal(cfg.path, '/abs/package.json');
  });

  it('cache-ttl parses a positive integer', () => {
    setInput('cache-ttl', '45');
    const cfg = readInputs();
    assert.equal(cfg.cacheTtl, 45);
  });

  it('rejects invalid update-level', () => {
    setInput('update-level', 'mega');
    assert.throws(() => readInputs(), /Invalid value "mega" for input "update-level"/);
  });

  it('rejects invalid sort', () => {
    setInput('sort', 'random');
    assert.throws(() => readInputs(), /Invalid value "random" for input "sort"/);
  });
});
