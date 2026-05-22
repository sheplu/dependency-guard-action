import type { Config, DependencyFilter, OutputFormat } from './inputs.ts';

const FILTER_FLAGS: Record<DependencyFilter, string> = {
  prod: '--prod',
  dev: '--dev',
  peer: '--peer',
  optional: '--optional',
  overrides: '--overrides',
  resolutions: '--resolutions',
  'pnpm-overrides': '--pnpm-overrides',
};

export interface BuildArgsOptions {
  // Override the format flag, regardless of config.format.
  // Used when we need JSON internally for parsing/outputs.
  formatOverride?: OutputFormat;
  // Force --quiet on (e.g. when re-running for the markdown summary).
  forceQuiet?: boolean;
}

export function buildArgs(config: Config, options: BuildArgsOptions = {}): string[] {
  const args: string[] = [];

  // Only forward --path when the user explicitly set it. Otherwise let the CLI
  // resolve ./package.json against the cwd we already pass via runner options.
  if (config.path !== null) {
    args.push('--path', config.path);
  }

  const format = options.formatOverride ?? config.format;
  args.push('--format', format);

  for (const f of config.filter) {
    args.push(FILTER_FLAGS[f]);
  }

  if (config.failOn !== null) args.push('--fail-on', config.failOn);
  if (config.maxAgeDays !== null) args.push('--max-age', String(config.maxAgeDays));

  for (const scope of config.ignoreScopes) {
    args.push('--ignore-scope', scope);
  }

  for (const name of config.only) {
    args.push('--only', name);
  }

  if (config.includeTransitive) args.push('--include-transitive');

  if (config.registry !== null) args.push('--registry', config.registry);
  if (config.noCache) args.push('--no-cache');
  if (config.cacheClear) args.push('--cache-clear');
  if (config.cacheTtl !== null) args.push('--cache-ttl', String(config.cacheTtl));

  if (config.sort !== null) args.push('--sort', config.sort);
  if (config.allColumns) args.push('--all-columns');

  if (config.updateLevel !== null) args.push('--update', config.updateLevel);
  if (config.dryRun) args.push('--dry-run');

  if (options.forceQuiet || config.quiet) args.push('--quiet');

  return args;
}
