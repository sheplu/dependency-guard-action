import * as core from '@actions/core';

export type OutputFormat = 'table' | 'json' | 'markdown';
export type FailOnLevel = 'major' | 'minor' | 'patch' | 'any' | 'deprecated';
export type UpdateLevel = 'patch' | 'minor' | 'major' | 'all';
export type SortField = 'age' | 'status' | 'name';
export type DependencyFilter =
  | 'prod'
  | 'dev'
  | 'peer'
  | 'optional'
  | 'overrides'
  | 'resolutions'
  | 'pnpm-overrides';

export interface Config {
  version: string;
  workingDirectory: string;
  path: string | null;
  format: OutputFormat;
  failOn: FailOnLevel | null;
  maxAgeDays: number | null;
  only: string[];
  ignoreScopes: string[];
  filter: DependencyFilter[];
  includeTransitive: boolean;
  registry: string | null;
  noCache: boolean;
  cacheClear: boolean;
  cacheTtl: number | null;
  sort: SortField | null;
  allColumns: boolean;
  updateLevel: UpdateLevel | null;
  dryRun: boolean;
  quiet: boolean;
  summary: boolean;
}

const FORMATS: readonly OutputFormat[] = ['table', 'json', 'markdown'];
const FAIL_ON_LEVELS: readonly FailOnLevel[] = ['major', 'minor', 'patch', 'any', 'deprecated'];
const UPDATE_LEVELS: readonly UpdateLevel[] = ['patch', 'minor', 'major', 'all'];
const SORT_FIELDS: readonly SortField[] = ['age', 'status', 'name'];
const FILTERS: readonly DependencyFilter[] = [
  'prod',
  'dev',
  'peer',
  'optional',
  'overrides',
  'resolutions',
  'pnpm-overrides',
];

function readEnum<T extends string>(
  name: string,
  allowed: readonly T[],
): T | null {
  const raw = core.getInput(name).trim();
  if (raw === '') return null;
  if (!(allowed as readonly string[]).includes(raw)) {
    throw new Error(
      `Invalid value "${raw}" for input "${name}". Allowed: ${allowed.join(', ')}.`,
    );
  }
  return raw as T;
}

function readCsv(name: string): string[] {
  const raw = core.getInput(name).trim();
  if (raw === '') return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function readPositiveInt(name: string): number | null {
  const raw = core.getInput(name).trim();
  if (raw === '') return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) {
    throw new Error(`Input "${name}" must be a non-negative integer (got "${raw}").`);
  }
  return n;
}

function readBool(name: string, fallback = false): boolean {
  const raw = core.getInput(name).trim();
  if (raw === '') return fallback;
  return core.getBooleanInput(name);
}

function readString(name: string): string | null {
  const raw = core.getInput(name).trim();
  return raw === '' ? null : raw;
}

export function readInputs(): Config {
  const filterRaw = readCsv('filter');
  for (const f of filterRaw) {
    if (!(FILTERS as readonly string[]).includes(f)) {
      throw new Error(
        `Invalid value "${f}" in input "filter". Allowed: ${FILTERS.join(', ')}.`,
      );
    }
  }

  return {
    version: core.getInput('version').trim() || 'latest',
    workingDirectory: core.getInput('working-directory').trim() || '.',
    path: readString('path'),
    format: (readEnum('format', FORMATS) ?? 'table') as OutputFormat,
    failOn: readEnum('fail-on', FAIL_ON_LEVELS),
    maxAgeDays: readPositiveInt('max-age-days'),
    only: readCsv('only'),
    ignoreScopes: readCsv('ignore-scopes'),
    filter: filterRaw as DependencyFilter[],
    includeTransitive: readBool('include-transitive'),
    registry: readString('registry'),
    noCache: readBool('no-cache'),
    cacheClear: readBool('cache-clear'),
    cacheTtl: readPositiveInt('cache-ttl'),
    sort: readEnum('sort', SORT_FIELDS),
    allColumns: readBool('all-columns'),
    updateLevel: readEnum('update-level', UPDATE_LEVELS),
    dryRun: readBool('dry-run'),
    quiet: readBool('quiet'),
    summary: readBool('summary', true),
  };
}
