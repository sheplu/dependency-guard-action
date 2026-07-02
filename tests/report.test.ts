import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyExit,
  MAX_INLINE_REPORT_BYTES,
  parseReport,
  setOutputs,
  writeStepSummary,
} from '../src/report.ts';
import type { OutputDeps } from '../src/report.ts';
import type { AnalysisReport } from '../src/types.ts';

const baseReport: AnalysisReport = {
  summary: {
    total: 3,
    upToDate: 1,
    patchUpdates: 0,
    minorUpdates: 1,
    majorUpdates: 1,
  },
  dependencies: [
    {
      name: 'lodash',
      type: 'dependencies',
      current: { version: '4.17.20', publishedAt: '2020-08-13' },
      latestPatch: null,
      latestMinor: null,
      latestMajor: { version: '5.0.0', publishedAt: '2024-01-01' },
      ageInDays: 1500,
      latestAgeInDays: 30,
      updateType: 'major',
      deprecated: null,
      transitive: false,
    },
  ],
  skipped: [],
};

describe('classifyExit', () => {
  it('classifies 0 as success', () => {
    assert.equal(classifyExit(0), 'success');
  });

  it('classifies 2 as policy-violation', () => {
    assert.equal(classifyExit(2), 'policy-violation');
  });

  it('classifies anything else as error', () => {
    assert.equal(classifyExit(1), 'error');
    assert.equal(classifyExit(127), 'error');
    assert.equal(classifyExit(-1), 'error');
  });
});

describe('parseReport', () => {
  it('parses valid JSON', () => {
    const parsed = parseReport(JSON.stringify(baseReport));
    assert.deepEqual(parsed, baseReport);
  });

  it('tolerates leading/trailing whitespace', () => {
    const parsed = parseReport(`\n  ${JSON.stringify(baseReport)}  \n`);
    assert.deepEqual(parsed, baseReport);
  });

  it('throws on empty stdout', () => {
    assert.throws(() => parseReport(''), /no JSON output/);
    assert.throws(() => parseReport('   '), /no JSON output/);
  });

  it('throws on invalid JSON', () => {
    assert.throws(() => parseReport('{ not json'));
  });
});

describe('setOutputs', () => {
  function collect(): {
    deps: OutputDeps;
    calls: Map<string, string | number>;
    reportWrites: string[];
    warnings: string[];
  } {
    const calls = new Map<string, string | number>();
    const reportWrites: string[] = [];
    const warnings: string[] = [];
    return {
      deps: {
        setOutput: (name, value) => calls.set(name, value),
        writeReportFile: (json) => {
          reportWrites.push(json);
          return '/tmp/dependency-guard-report.json';
        },
        warning: (msg) => warnings.push(msg),
      },
      calls,
      reportWrites,
      warnings,
    };
  }

  it('emits each summary metric and the JSON report', () => {
    const { deps, calls } = collect();
    setOutputs({ report: baseReport, exitCode: 0 }, deps);
    assert.equal(calls.get('total'), 3);
    assert.equal(calls.get('up-to-date'), 1);
    assert.equal(calls.get('patch-updates'), 0);
    assert.equal(calls.get('minor-updates'), 1);
    assert.equal(calls.get('major-updates'), 1);
    assert.equal(calls.get('deprecated'), 0);
    assert.equal(calls.get('policy-passed'), 'true');
    assert.equal(calls.get('report-json'), JSON.stringify(baseReport));
  });

  it('always writes the full report to a file and sets report-path', () => {
    const { deps, calls, reportWrites } = collect();
    setOutputs({ report: baseReport, exitCode: 0 }, deps);
    assert.deepEqual(reportWrites, [JSON.stringify(baseReport)]);
    assert.equal(calls.get('report-path'), '/tmp/dependency-guard-report.json');
  });

  it('omits report-json and warns when the report exceeds the size cap', () => {
    const { deps, calls, warnings, reportWrites } = collect();
    // Build a report whose JSON comfortably exceeds the inline cap.
    const filler = 'x'.repeat(2000);
    const bigReport: AnalysisReport = {
      ...baseReport,
      dependencies: Array.from({ length: 600 }, (_, i) => ({
        ...baseReport.dependencies[0],
        name: `pkg-${i}-${filler}`,
      })),
    };
    const json = JSON.stringify(bigReport);
    assert.ok(
      Buffer.byteLength(json, 'utf8') > MAX_INLINE_REPORT_BYTES,
      'fixture must exceed the cap',
    );

    setOutputs({ report: bigReport, exitCode: 0 }, deps);

    assert.equal(calls.get('report-json'), '');
    assert.equal(calls.get('report-path'), '/tmp/dependency-guard-report.json');
    // The file always gets the complete report, even when inline is omitted.
    assert.deepEqual(reportWrites, [json]);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /report-path/);
  });

  it('uses summary.deprecated when it is a number', () => {
    const { deps, calls } = collect();
    const report: AnalysisReport = {
      ...baseReport,
      summary: { ...baseReport.summary, deprecated: 7 },
    };
    setOutputs({ report, exitCode: 0 }, deps);
    assert.equal(calls.get('deprecated'), 7);
  });

  it('counts deprecated dependencies when summary.deprecated is absent', () => {
    const { deps, calls } = collect();
    const report: AnalysisReport = {
      ...baseReport,
      dependencies: [
        { ...baseReport.dependencies[0], name: 'a', deprecated: 'use b' },
        { ...baseReport.dependencies[0], name: 'b', deprecated: null },
        { ...baseReport.dependencies[0], name: 'c', deprecated: 'unmaintained' },
      ],
    };
    setOutputs({ report, exitCode: 0 }, deps);
    assert.equal(calls.get('deprecated'), 2);
  });

  it('policy-passed is "true" only when exitCode is 0', () => {
    for (const [exitCode, expected] of [
      [0, 'true'],
      [2, 'false'],
      [1, 'false'],
      [127, 'false'],
    ] as const) {
      const { deps, calls } = collect();
      setOutputs({ report: baseReport, exitCode }, deps);
      assert.equal(
        calls.get('policy-passed'),
        expected,
        `exitCode=${exitCode}`,
      );
    }
  });
});

describe('writeStepSummary', () => {
  it('invokes the writer when markdown has content', async () => {
    const writes: string[] = [];
    await writeStepSummary('# hello', async (md) => {
      writes.push(md);
    });
    assert.deepEqual(writes, ['# hello']);
  });

  it('skips the writer for empty markdown', async () => {
    const writes: string[] = [];
    await writeStepSummary('', async (md) => {
      writes.push(md);
    });
    assert.equal(writes.length, 0);
  });

  it('skips the writer for whitespace-only markdown', async () => {
    const writes: string[] = [];
    await writeStepSummary('   \n  \t', async (md) => {
      writes.push(md);
    });
    assert.equal(writes.length, 0);
  });
});
