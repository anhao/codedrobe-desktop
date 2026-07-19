// SPDX-License-Identifier: MPL-2.0

import fs from 'node:fs';
import { LEGACY_THEME_EXTENSION, THEME_EXTENSION } from '@codedrobe/core';

export function isThemePackagePath(value: string): boolean {
  return value.endsWith(THEME_EXTENSION) || value.endsWith(LEGACY_THEME_EXTENSION);
}

/**
 * Theme packages passed on the command line (Windows double-click / "Open
 * with" routes the file path through argv on cold start and second-instance).
 */
export function extractThemeFilesFromArgv(
  argv: string[],
  exists: (candidate: string) => boolean = fs.existsSync,
): string[] {
  return argv.filter((argument) => isThemePackagePath(argument) && exists(argument));
}

/**
 * Queues file-open requests until the renderer can receive them (same
 * queue-until-sink pattern as DeepLinkManager). macOS "open-file" can fire
 * before app ready, and cold-start argv files arrive before the window loads.
 */
export class FileOpenQueue {
  private pending: string[] = [];
  private sink: ((filePath: string) => void) | null = null;

  handlePath(filePath: string): boolean {
    if (!isThemePackagePath(filePath)) return false;
    if (this.sink) this.sink(filePath);
    else this.pending.push(filePath);
    return true;
  }

  setSink(sink: (filePath: string) => void): void {
    this.sink = sink;
    for (const filePath of this.pending.splice(0)) sink(filePath);
  }
}
