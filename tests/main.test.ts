import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { orchestrate } from '../src/main.ts';
import type { OrchestrateDeps } from '../src/main.ts';
import type { Config } from '../src/inputs.ts';
import type { ExecFn } from '../src/runner.ts';
import type { AnalysisReport } from '../src/types.ts';

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

const sampleReport: AnalysisReport = {
  summary: {
    total: 1,
    upToDate: 1,
    patchUpdates: 0,
    minorUpdates: 0,
    majorUpdates: 0,
  },
  dependencies: [
    {
      name: 'lodash',
      type: 'dependencies',
      current: { version: '4.17.21', publishedAt: '2021-02-20' },
      latestPatch: null,
      latestMinor: null,
      latestMajor: null,
      ageInDays: 1500,
      latestAgeInDays: 1500,
      updateType: 'up-to-date',
      deprecated: null,
      transitive: false,
    },
  ],
  skipped: [],
};

interface ScriptedRun {
  stdout?: string;
  stderr?: string;
  exitCode: number;
}

function makeDeps(
  config: Config,
  runs: ScriptedRun[],
): {
  deps: OrchestrateDeps;
  execCalls: number;
  outputs: Map<string, string | number>;
  failed: string[];
  errors: string[];
  warnings: string[];
  reportWrites: string[];
  summaryWrites: string[];
} {
  let execCallIndex = 0;
  const outputs = new Map<string, string | number>();
  const failed: string[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];
  const reportWrites: string[] = [];
  const summaryWrites: string[] = [];

  const exec: ExecFn = async (_cmd, _args, options) => {
    const run = runs[execCallIndex++];
    if (run === undefined) {
      throw new Error(`unexpected exec call (only ${runs.length} scripted)`);
    }
    if (run.stdout !== undefined) options.listeners.stdout(Buffer.from(run.stdout));
    if (run.stderr !== undefined) options.listeners.stderr(Buffer.from(run.stderr));
    return run.exitCode;
  };

  const deps: OrchestrateDeps = {
    readInputs: () => config,
    exec,
    setOutput: (name, value) => {
      outputs.set(name, value);
    },
    setFailed: (msg) => {
      failed.push(msg);
    },
    error: (msg) => {
      errors.push(msg);
    },
    warning: (msg) => {
      warnings.push(msg);
    },
    writeReportFile: (json) => {
      reportWrites.push(json);
      return '/tmp/dependency-guard-report.json';
    },
    writeSummary: async (md) => {
      summaryWrites.push(md);
    },
  };

  return {
    deps,
    get execCalls() {
      return execCallIndex;
    },
    outputs,
    failed,
    errors,
    warnings,
    reportWrites,
    summaryWrites,
  };
}

describe('orchestrate', () => {
  it('happy path: runs three execs, sets outputs, writes summary, no setFailed', async () => {
    const config = baseConfig({ summary: true });
    const ctx = makeDeps(config, [
      { stdout: JSON.stringify(sampleReport), exitCode: 0 }, // json pass
      { exitCode: 0 }, // user-format pass
      { stdout: '# report\n', exitCode: 0 }, // markdown pass
    ]);

    await orchestrate(ctx.deps);

    assert.equal(ctx.execCalls, 3);
    assert.equal(ctx.failed.length, 0);
    assert.equal(ctx.errors.length, 0);
    assert.equal(ctx.outputs.get('total'), 1);
    assert.equal(ctx.outputs.get('policy-passed'), 'true');
    assert.equal(ctx.outputs.get('report-path'), '/tmp/dependency-guard-report.json');
    assert.deepEqual(ctx.reportWrites, [JSON.stringify(sampleReport)]);
    assert.deepEqual(ctx.summaryWrites, ['# report\n']);
  });

  it('policy violation: runs all three execs and sets failed with policy message', async () => {
    const config = baseConfig({ summary: true });
    const ctx = makeDeps(config, [
      { stdout: JSON.stringify(sampleReport), exitCode: 2 },
      { exitCode: 2 },
      { stdout: '# violation\n', exitCode: 2 },
    ]);

    await orchestrate(ctx.deps);

    assert.equal(ctx.execCalls, 3);
    assert.equal(ctx.outputs.get('policy-passed'), 'false');
    assert.equal(ctx.failed.length, 1);
    assert.match(ctx.failed[0], /policy violation/i);
    assert.deepEqual(ctx.summaryWrites, ['# violation\n']);
  });

  it('error path: only the JSON pass runs, error/setFailed called, no summary', async () => {
    const config = baseConfig({ summary: true });
    const ctx = makeDeps(config, [{ stderr: 'boom\n', exitCode: 1 }]);

    await orchestrate(ctx.deps);

    assert.equal(ctx.execCalls, 1);
    assert.deepEqual(ctx.errors, ['boom']);
    assert.equal(ctx.failed.length, 1);
    assert.match(ctx.failed[0], /exited with code 1/);
    assert.equal(ctx.summaryWrites.length, 0);
    assert.equal(ctx.outputs.size, 0);
  });

  it('error path with empty stderr: skips error() but still calls setFailed', async () => {
    const config = baseConfig();
    const ctx = makeDeps(config, [{ stderr: '   ', exitCode: 127 }]);

    await orchestrate(ctx.deps);

    assert.equal(ctx.errors.length, 0);
    assert.equal(ctx.failed.length, 1);
    assert.match(ctx.failed[0], /exited with code 127/);
  });

  it('summary disabled: skips the third exec and never writes summary', async () => {
    const config = baseConfig({ summary: false });
    const ctx = makeDeps(config, [
      { stdout: JSON.stringify(sampleReport), exitCode: 0 },
      { exitCode: 0 },
    ]);

    await orchestrate(ctx.deps);

    assert.equal(ctx.execCalls, 2);
    assert.equal(ctx.summaryWrites.length, 0);
    assert.equal(ctx.failed.length, 0);
  });

  it('summary enabled but markdown is empty: third exec runs, summary write is skipped', async () => {
    const config = baseConfig({ summary: true });
    const ctx = makeDeps(config, [
      { stdout: JSON.stringify(sampleReport), exitCode: 0 },
      { exitCode: 0 },
      { stdout: '   \n', exitCode: 0 },
    ]);

    await orchestrate(ctx.deps);

    assert.equal(ctx.execCalls, 3);
    assert.equal(ctx.summaryWrites.length, 0);
  });

  it('readInputs throwing propagates out (caller is responsible for catching)', async () => {
    const ctx = makeDeps(baseConfig(), []);
    const deps: OrchestrateDeps = {
      ...ctx.deps,
      readInputs: () => {
        throw new Error('invalid input');
      },
    };

    await assert.rejects(orchestrate(deps), /invalid input/);
  });
});
