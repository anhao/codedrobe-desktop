// SPDX-License-Identifier: MPL-2.0

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ThemeLibrary } from './theme-library';

let root = '';
let sources = '';
let library: ThemeLibrary;

function themePackage(overrides: { id?: string; displayName?: string; version?: string } = {}) {
  return {
    format: 'codedrobe-theme',
    schemaVersion: 1,
    theme: {
      id: overrides.id ?? 'neon',
      displayName: overrides.displayName ?? 'Neon',
      version: overrides.version ?? '1.0.0',
    },
    targets: { codex: { css: 'body { color: red; }' } },
  };
}

async function writePackage(filename: string, bundle: unknown): Promise<string> {
  const filePath = path.join(sources, filename);
  await fs.writeFile(filePath, JSON.stringify(bundle), 'utf8');
  return filePath;
}

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'codedrobe-library-'));
  sources = await fs.mkdtemp(path.join(os.tmpdir(), 'codedrobe-sources-'));
  library = new ThemeLibrary(root);
  await library.initialize();
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
  await fs.rm(sources, { recursive: true, force: true });
});

describe('inspectPackage', () => {
  it('reports a fresh install without touching the library', async () => {
    const source = await writePackage('neon.codedrobe-theme', themePackage());
    const inspection = await library.inspectPackage(source);
    expect(inspection.incoming).toMatchObject({ id: 'neon', displayName: 'Neon', version: '1.0.0' });
    expect(inspection.existing).toBeNull();
    await expect(library.summaries()).resolves.toEqual([]);
  });

  it('reports the installed theme a same-id import would replace', async () => {
    await library.importPackage(await writePackage('neon.codedrobe-theme', themePackage()));
    const update = await writePackage('neon-2.codedrobe-theme', themePackage({ version: '2.0.0' }));
    const inspection = await library.inspectPackage(update);
    expect(inspection.incoming.version).toBe('2.0.0');
    expect(inspection.existing).toMatchObject({ id: 'neon', version: '1.0.0' });
  });

  it('converts legacy packages before inspecting them', async () => {
    const legacy = await writePackage('retro.codex-theme', {
      format: 'codex-theme',
      schemaVersion: 1,
      manifest: { schemaVersion: 1, id: 'retro', displayName: 'Retro', version: '0.3.0', css: 'theme.css' },
      css: 'body { color: blue; }',
    });
    const inspection = await library.inspectPackage(legacy);
    expect(inspection.incoming).toMatchObject({ id: 'retro', version: '0.3.0', supportedApps: ['codex'] });
    expect(inspection.existing).toBeNull();
  });

  it('rejects unknown extensions and invalid packages', async () => {
    await expect(library.inspectPackage(path.join(sources, 'note.txt'))).rejects.toThrow();
    const broken = await writePackage('broken.codedrobe-theme', { format: 'codedrobe-theme' });
    await expect(library.inspectPackage(broken)).rejects.toThrow();
  });
});

describe('importPackage', () => {
  it('installs a package and replaces same-id installs atomically', async () => {
    await library.importPackage(await writePackage('neon.codedrobe-theme', themePackage()));
    const updated = await library.importPackage(
      await writePackage('neon-2.codedrobe-theme', themePackage({ version: '2.0.0' })),
    );
    expect(updated.version).toBe('2.0.0');
    const summaries = await library.summaries();
    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toMatchObject({ id: 'neon', version: '2.0.0' });
  });

  it('imports legacy packages by converting them', async () => {
    const legacy = await writePackage('retro.codex-theme', {
      format: 'codex-theme',
      schemaVersion: 1,
      manifest: { schemaVersion: 1, id: 'retro', displayName: 'Retro', version: '0.3.0', css: 'theme.css' },
      css: 'body { color: blue; }',
    });
    const installed = await library.importPackage(legacy);
    expect(installed).toMatchObject({ id: 'retro', version: '0.3.0' });
    await expect(library.summaries()).resolves.toHaveLength(1);
  });
});
