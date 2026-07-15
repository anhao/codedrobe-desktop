// SPDX-License-Identifier: MPL-2.0

import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ThemePackage } from '../shared/types';
import { ThemeRepository } from './theme-repository';

const execFileAsync = promisify(execFile);

let root = '';
let userRoot = '';

const manifest = {
  schemaVersion: 1 as const,
  id: 'studio-night',
  displayName: '工作室之夜',
  version: '1.0.0',
  css: 'theme.css',
  art: 'cover.png',
  copy: { tagline: '把灵感留在桌面上。' },
  baseTheme: { accent: '#8f5fd1', ink: '#211827', surface: '#f6f0e7' },
};

function bundle(overrides: Partial<ThemePackage> = {}): ThemePackage {
  return {
    format: 'codex-theme',
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    manifest,
    css: ':root { --accent: #8f5fd1; }',
    art: { filename: 'cover.png', mimeType: 'image/png', base64: Buffer.from([137, 80, 78, 71]).toString('base64') },
    ...overrides,
  };
}

async function writePackage(filename: string, value = bundle()): Promise<string> {
  const packagePath = path.join(root, filename);
  await fs.writeFile(packagePath, JSON.stringify(value), 'utf8');
  return packagePath;
}

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'codedrobe-themes-'));
  userRoot = path.join(root, 'user');
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

describe('ThemeRepository', () => {
  it('随桌面端分发三个核心内置主题', async () => {
    const builtinRoot = path.resolve('node_modules', '@codedrobe', 'codex-core', 'themes');
    const repository = new ThemeRepository(userRoot, builtinRoot);
    await repository.initialize();

    const themes = await repository.summaries();

    expect(themes.map((theme) => theme.id).sort()).toEqual(['dilraba-rose', 'dream', 'kun-stage']);
    expect(themes.every((theme) => theme.source === 'builtin')).toBe(true);
  });

  it('新安装会加载内置主题', async () => {
    const builtinRoot = path.join(root, 'builtin');
    await fs.mkdir(builtinRoot);
    await fs.writeFile(path.join(builtinRoot, 'studio-night.json'), JSON.stringify({ ...manifest, css: 'studio.css' }), 'utf8');
    await fs.writeFile(path.join(builtinRoot, 'studio.css'), ':root { --accent: #8f5fd1; }', 'utf8');
    await fs.writeFile(path.join(builtinRoot, 'cover.png'), Buffer.from([137, 80, 78, 71]));
    const repository = new ThemeRepository(userRoot, builtinRoot);
    await repository.initialize();

    await expect(repository.summaries()).resolves.toMatchObject([{ id: 'studio-night', source: 'builtin' }]);
    await expect(repository.delete('studio-night')).rejects.toThrow('内置主题不能删除');
  });

  it('可导入、预览并重新导出主题包', async () => {
    const repository = new ThemeRepository(userRoot);
    await repository.initialize();
    const imported = await repository.importPackage(await writePackage('studio.codex-theme'));

    expect(imported).toMatchObject({ id: 'studio-night', source: 'imported', accent: '#8f5fd1' });
    expect(imported.artDataUrl).toMatch(/^data:image\/png;base64,/);
    await expect(repository.exportPackage('studio-night')).resolves.toMatchObject({
      format: 'codex-theme',
      schemaVersion: 1,
      manifest: { id: 'studio-night', css: 'theme.css' },
    });
  });

  it('可删除已导入主题及其本地文件', async () => {
    const repository = new ThemeRepository(userRoot);
    await repository.initialize();
    await repository.importPackage(await writePackage('studio.codex-theme'));

    await repository.delete('studio-night');

    await expect(repository.summaries()).resolves.toEqual([]);
    await expect(fs.access(path.join(userRoot, 'studio-night'))).rejects.toThrow();
  });

  it('拒绝带有远程网络资源的主题包', async () => {
    const repository = new ThemeRepository(userRoot);
    await repository.initialize();
    const unsafe = bundle({
      manifest: { ...manifest, id: 'unsafe', art: null },
      css: '.hero { background: url(https://example.com/tracker.png); }',
      art: undefined,
    });

    await expect(repository.importPackage(await writePackage('unsafe.codex-theme', unsafe))).rejects.toThrow('远程 CSS');
  });

  it('Skill CLI 导出的主题包可被桌面端直接导入', async () => {
    const sourceRoot = path.join(root, 'source');
    await fs.mkdir(sourceRoot);
    await fs.writeFile(path.join(sourceRoot, 'studio.json'), JSON.stringify({ ...manifest, css: 'studio.css' }), 'utf8');
    await fs.writeFile(path.join(sourceRoot, 'studio.css'), ':root { --accent: #8f5fd1; }', 'utf8');
    await fs.writeFile(path.join(sourceRoot, 'cover.png'), Buffer.from([137, 80, 78, 71]));
    const packagePath = path.join(root, 'skill-export.codex-theme');
    const exporter = path.resolve(process.cwd(), 'node_modules', '@codedrobe', 'codex-core', 'scripts', 'export-theme.mjs');
    await execFileAsync(process.execPath, [exporter, '--theme', path.join(sourceRoot, 'studio.json'), '--output', packagePath]);
    const repository = new ThemeRepository(userRoot);
    await repository.initialize();

    const imported = await repository.importPackage(packagePath);

    expect(imported).toMatchObject({ id: 'studio-night', source: 'imported' });
    const exportedBundle = JSON.parse(await fs.readFile(packagePath, 'utf8')) as ThemePackage;
    expect(exportedBundle).toMatchObject({ format: 'codex-theme', schemaVersion: 1 });
    expect(exportedBundle.manifest.css).toBe('theme.css');
  });
});
