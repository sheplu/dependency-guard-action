import * as core from '@actions/core';
import * as exec from '@actions/exec';
import { orchestrate, readInputs } from './main.ts';

orchestrate({
  readInputs,
  exec: (cmd, args, opts) => exec.exec(cmd, args, opts),
  setOutput: (name, value) => core.setOutput(name, value),
  setFailed: (m) => core.setFailed(m),
  error: (m) => core.error(m),
  writeSummary: async (md) => {
    await core.summary.addRaw(md).addEOL().write();
  },
}).catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  core.setFailed(message);
});
