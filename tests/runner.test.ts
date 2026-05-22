import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { runCli } from '../src/runner.ts';
import type { ExecFn, ExecOptions } from '../src/runner.ts';

interface Captured {
  command: string;
  args: string[];
  options: ExecOptions;
}

function makeFakeExec(
  stdoutChunks: string[] = [],
  stderrChunks: string[] = [],
  exitCode = 0,
): { exec: ExecFn; calls: Captured[] } {
  const calls: Captured[] = [];
  const exec: ExecFn = async (command, args, options) => {
    calls.push({ command, args, options });
    for (const chunk of stdoutChunks) {
      options.listeners.stdout(Buffer.from(chunk));
    }
    for (const chunk of stderrChunks) {
      options.listeners.stderr(Buffer.from(chunk));
    }
    return exitCode;
  };
  return { exec, calls };
}

describe('runCli', () => {
  it('invokes npx with --yes and the versioned package', async () => {
    const { exec, calls } = makeFakeExec(['{}'], [], 0);
    await runCli(
      { version: '1.2.3', args: ['--format', 'json'], cwd: '/tmp/x' },
      exec,
    );
    assert.equal(calls.length, 1);
    assert.equal(calls[0].command, 'npx');
    assert.deepEqual(calls[0].args, [
      '--yes',
      '@sheplu/dependency-guard@1.2.3',
      '--format',
      'json',
    ]);
  });

  it('passes cwd, ignoreReturnCode=true, and silent through to exec options', async () => {
    const { exec, calls } = makeFakeExec();
    await runCli(
      { version: 'latest', args: [], cwd: '/repo', silent: true },
      exec,
    );
    assert.equal(calls[0].options.cwd, '/repo');
    assert.equal(calls[0].options.ignoreReturnCode, true);
    assert.equal(calls[0].options.silent, true);
  });

  it('defaults silent to false when not provided', async () => {
    const { exec, calls } = makeFakeExec();
    await runCli({ version: 'latest', args: [], cwd: '.' }, exec);
    assert.equal(calls[0].options.silent, false);
  });

  it('captures multi-chunk stdout and stderr in order', async () => {
    const { exec } = makeFakeExec(['hel', 'lo\n'], ['oh ', 'no\n'], 0);
    const result = await runCli(
      { version: 'latest', args: [], cwd: '.' },
      exec,
    );
    assert.equal(result.stdout, 'hello\n');
    assert.equal(result.stderr, 'oh no\n');
  });

  it('returns the exit code from the injected exec', async () => {
    const { exec } = makeFakeExec([], [], 2);
    const result = await runCli(
      { version: 'latest', args: [], cwd: '.' },
      exec,
    );
    assert.equal(result.exitCode, 2);
  });

  it('returns empty strings when exec produces no output', async () => {
    const { exec } = makeFakeExec();
    const result = await runCli(
      { version: 'latest', args: [], cwd: '.' },
      exec,
    );
    assert.equal(result.stdout, '');
    assert.equal(result.stderr, '');
  });
});
