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

// Writes the full JSON report somewhere durable and returns the path to it.
export type ReportFileWriter = (json: string) => string;

export interface OutputDeps {
  setOutput: SetOutputFn;
  writeReportFile: ReportFileWriter;
  warning: (msg: string) => void;
}

// GitHub caps a single output value at ~1 MB (and job-level outputs enforce it
// strictly). Above this we skip the inline `report-json` and point users at the
// `report-path` file instead, rather than emit a silently truncated value.
export const MAX_INLINE_REPORT_BYTES = 1_000_000;

function countDeprecated(report: AnalysisReport): number {
  if (typeof report.summary.deprecated === 'number') {
    return report.summary.deprecated;
  }
  return report.dependencies.filter((d) => d.deprecated !== null && d.deprecated !== undefined)
    .length;
}

export function setOutputs(opts: PublishOptions, deps: OutputDeps): void {
  const { report, exitCode } = opts;
  const { setOutput, writeReportFile, warning } = deps;

  setOutput('total', report.summary.total);
  setOutput('up-to-date', report.summary.upToDate);
  setOutput('patch-updates', report.summary.patchUpdates);
  setOutput('minor-updates', report.summary.minorUpdates);
  setOutput('major-updates', report.summary.majorUpdates);
  setOutput('deprecated', countDeprecated(report));
  setOutput('policy-passed', exitCode === 0 ? 'true' : 'false');

  const json = JSON.stringify(report);

  // Always persist the full report to a file so large reports remain available
  // regardless of the inline-output size cap.
  const reportPath = writeReportFile(json);
  setOutput('report-path', reportPath);

  // Only expose the inline JSON when it comfortably fits GitHub's output limit.
  // Byte length (not string length) is what counts against the cap.
  const byteLength = Buffer.byteLength(json, 'utf8');
  if (byteLength <= MAX_INLINE_REPORT_BYTES) {
    setOutput('report-json', json);
  } else {
    setOutput('report-json', '');
    warning(
      `report-json omitted: report is ${byteLength} bytes, over the ${MAX_INLINE_REPORT_BYTES}-byte ` +
        `output limit. Read the full report from the "report-path" output (${reportPath}) instead.`,
    );
  }
}

export async function writeStepSummary(
  markdown: string,
  writer: SummaryWriter,
): Promise<void> {
  if (markdown.trim() === '') return;
  await writer(markdown);
}
