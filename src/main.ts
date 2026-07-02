import { readInputs as readInputsImpl } from './inputs.ts';
import type { Config } from './inputs.ts';
import { buildArgs } from './args.ts';
import { runCli } from './runner.ts';
import type { ExecFn } from './runner.ts';
import { classifyExit, parseReport, setOutputs, writeStepSummary } from './report.ts';
import type { ReportFileWriter, SetOutputFn, SummaryWriter } from './report.ts';

export interface OrchestrateDeps {
  readInputs: () => Config;
  exec: ExecFn;
  setOutput: SetOutputFn;
  setFailed: (msg: string) => void;
  error: (msg: string) => void;
  warning: (msg: string) => void;
  writeReportFile: ReportFileWriter;
  writeSummary: SummaryWriter;
}

export async function orchestrate(deps: OrchestrateDeps): Promise<void> {
  const config = deps.readInputs();

  // First pass: always JSON, so we can parse, set outputs, and classify the exit code.
  const jsonRun = await runCli(
    {
      version: config.version,
      args: buildArgs(config, { formatOverride: 'json', forceQuiet: true }),
      cwd: config.workingDirectory,
      silent: true,
    },
    deps.exec,
  );

  const classification = classifyExit(jsonRun.exitCode);

  if (classification === 'error') {
    if (jsonRun.stderr.trim() !== '') deps.error(jsonRun.stderr.trim());
    deps.setFailed(
      `dependency-guard exited with code ${jsonRun.exitCode}. See logs above.`,
    );
    return;
  }

  const report = parseReport(jsonRun.stdout);
  setOutputs(
    { report, exitCode: jsonRun.exitCode },
    {
      setOutput: deps.setOutput,
      writeReportFile: deps.writeReportFile,
      warning: deps.warning,
    },
  );

  // Second pass: render the user's preferred format to the action log.
  // We deliberately call the CLI again rather than re-render JSON ourselves,
  // so the action stays consistent with the CLI's renderer.
  await runCli(
    {
      version: config.version,
      args: buildArgs(config),
      cwd: config.workingDirectory,
      silent: false,
    },
    deps.exec,
  );

  if (config.summary) {
    const summaryRun = await runCli(
      {
        version: config.version,
        args: buildArgs(config, { formatOverride: 'markdown', forceQuiet: true }),
        cwd: config.workingDirectory,
        silent: true,
      },
      deps.exec,
    );
    await writeStepSummary(summaryRun.stdout, deps.writeSummary);
  }

  if (classification === 'policy-violation') {
    deps.setFailed(
      'Dependency policy violation: one or more dependencies failed --fail-on / --max-age checks.',
    );
  }
}

// Re-export for the entry-point wiring in index.ts.
export { readInputsImpl as readInputs };
