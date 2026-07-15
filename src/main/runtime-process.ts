// SPDX-License-Identifier: MPL-2.0

import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { getMainMessages } from '../shared/i18n';

export interface RuntimeResult {
  code: number;
  stdout: string;
  stderr: string;
}

function electronNodeEnv(): NodeJS.ProcessEnv {
  return { ...process.env, ELECTRON_RUN_AS_NODE: '1' };
}

export function spawnNodeModule(modulePath: string, args: string[]): ChildProcessWithoutNullStreams {
  return spawn(process.execPath, [modulePath, ...args], {
    env: electronNodeEnv(),
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
  });
}

export function runNodeModule(modulePath: string, args: string[], timeoutMs = 30_000): Promise<RuntimeResult> {
  return new Promise((resolve, reject) => {
    const child = spawnNodeModule(modulePath, args);
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(getMainMessages().runtimeTimeout(modulePath)));
    }, timeoutMs);
    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('exit', (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });
}
