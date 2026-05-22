import type { AnalysisReport } from './types.ts';

export type ExitClassification = 'success' | 'policy-violation' | 'error';

export function classifyExit(exitCode: number): ExitClassification {
  if (exitCode === 0) return 'success';
  if (exitCode === 2) return 'policy-violation';
  return 'error';
}

export function parseReport(stdout: string): AnalysisReport {
  // dependency-guard --format json prints a single JSON object to stdout.
  // Be tolerant of leading/trailing whitespace.
  const trimmed = stdout.trim();
  if (trimmed === '') {
    throw new Error('dependency-guard produced no JSON output');
  }
  return JSON.parse(trimmed) as AnalysisReport;
}

export interface PublishOptions {
  report: AnalysisReport;
  exitCode: number;
}

export type SetOutputFn = (name: string, value: string | number) => void;

export type SummaryWriter = (markdown: string) => Promise<void>;

function countDeprecated(report: AnalysisReport): number {
  if (typeof report.summary.deprecated === 'number') {
    return report.summary.deprecated;
  }
  return report.dependencies.filter((d) => d.deprecated !== null && d.deprecated !== undefined)
    .length;
}

export function setOutputs(opts: PublishOptions, setOutput: SetOutputFn): void {
  const { report, exitCode } = opts;
  setOutput('total', report.summary.total);
  setOutput('up-to-date', report.summary.upToDate);
  setOutput('patch-updates', report.summary.patchUpdates);
  setOutput('minor-updates', report.summary.minorUpdates);
  setOutput('major-updates', report.summary.majorUpdates);
  setOutput('deprecated', countDeprecated(report));
  setOutput('policy-passed', exitCode === 0 ? 'true' : 'false');
  setOutput('report-json', JSON.stringify(report));
}

export async function writeStepSummary(
  markdown: string,
  writer: SummaryWriter,
): Promise<void> {
  if (markdown.trim() === '') return;
  await writer(markdown);
}
